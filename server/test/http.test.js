// Behaviour of the HTTP layer (handle): routes, authentication, RPC and file storage.
// These tests describe what the server does today, so refactoring must keep them green.
//
// Each test notes the part of handle (server/index.js) it covers. Together they cover
// every line and branch of handle.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { startServer } from './helpers.js';

let api;
let anna;
let ben;

// Smallest valid PNG (1x1 pixel)
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000'
  + '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

before(async () => {
  api = await startServer('http');
  anna = await api.signUp('anna');
  ben = await api.signUp('ben');
});

// handle: routes that need no user, the final 404, and readJson errors
describe('handle: basics', () => {
  // if (req.method === 'OPTIONS') -> 204 with CORS headers
  it('answers CORS preflight requests with 204', async () => {
    const res = await api.request('OPTIONS', '/query');
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.equal(res.headers.get('access-control-allow-headers'), 'Authorization, Content-Type');
    assert.equal(res.headers.get('access-control-allow-methods'), 'GET, POST, PUT, OPTIONS');
  });

  // route === 'GET /health'
  it('reports health', async () => {
    const res = await api.request('GET', '/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(res.headers.get('content-type'), 'application/json');
  });

  // no route matches -> throw 404 'Not found' at the end of handle
  it('returns 404 for unknown routes', async () => {
    const res = await api.request('GET', '/nope');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: { message: 'Not found' } });
  });

  // route === 'POST /auth/login' -> readJson fails to parse -> 400
  it('rejects a body that is not JSON', async () => {
    const res = await api.request('POST', '/auth/login', { body: '{not json', raw: true });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Invalid JSON body');
  });
});

// handle: the /auth/* routes and requireUser()
describe('handle: authentication', () => {
  // route === 'POST /auth/signup' -> signUp with a chosen username
  it('signs up a user, creates the profile and returns a session', async () => {
    const res = await api.request('POST', '/auth/signup', {
      body: { email: '  New.User@Test.app ', password: 'secret123', options: { data: { username: 'newbie' } } },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'new.user@test.app');
    assert.equal(res.body.session.token_type, 'bearer');
    assert.equal(res.body.session.user.id, res.body.user.id);
    const profile = await api.query({ token: res.body.session.access_token }, {
      table: 'profiles', filters: [{ column: 'id', op: 'eq', value: res.body.user.id }], single: 'single',
    });
    assert.equal(profile.data.username, 'newbie');
  });

  // route === 'POST /auth/signup' -> signUp without options (default username)
  it('gives a default username when none is chosen', async () => {
    const res = await api.request('POST', '/auth/signup', { body: { email: 'plain@test.app', password: 'secret123' } });
    const profile = await api.query({ token: res.body.session.access_token }, {
      table: 'profiles', filters: [{ column: 'id', op: 'eq', value: res.body.user.id }], single: 'single',
    });
    assert.equal(profile.data.username, `user_${res.body.user.id.slice(0, 8)}`);
  });

  // route === 'POST /auth/signup' -> signUp throws 400 (missing email, short password, duplicate)
  it('rejects invalid sign ups', async () => {
    const cases = [
      [{ password: 'secret123' }, 'Email and password are required'],
      [{ email: 'short@test.app', password: '123' }, 'Password should be at least 6 characters'],
      [{ email: anna.email, password: 'secret123' }, 'User already registered'],
    ];
    for (const [body, message] of cases) {
      const res = await api.request('POST', '/auth/signup', { body });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.message, message);
    }
  });

  // route === 'POST /auth/login' -> signIn succeeds or throws 400
  it('logs in with the right password only', async () => {
    const ok = await api.request('POST', '/auth/login', { body: { email: anna.email.toUpperCase(), password: 'secret123' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.id, anna.id);
    for (const body of [{ email: anna.email, password: 'wrong-pass' }, { email: 'nobody@test.app', password: 'secret123' }, { email: anna.email }]) {
      const bad = await api.request('POST', '/auth/login', { body });
      assert.equal(bad.status, 400);
      assert.equal(bad.body.error.message, 'Invalid login credentials');
    }
  });

  // route === 'GET /auth/user' -> requireUser(): user found, or no / unknown token -> 401
  // (also covers the `req.headers.authorization ?? ''` fallback when there is no header)
  it('returns the signed-in user and 401 without a valid token', async () => {
    const me = await api.request('GET', '/auth/user', { token: anna.token });
    assert.equal(me.status, 200);
    assert.deepEqual(Object.keys(me.body.user).sort(), ['created_at', 'email', 'id']);
    assert.equal(me.body.user.id, anna.id);
    for (const token of [undefined, 'not-a-token']) {
      const res = await api.request('GET', '/auth/user', { token });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.message, 'Not signed in');
    }
  });

  // route === 'POST /auth/logout' -> deleteSession(token)
  it('logs out by ending the session', async () => {
    const temp = await api.signUp('leaver');
    const res = await api.request('POST', '/auth/logout', { token: temp.token, body: {} });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {});
    assert.equal((await api.request('GET', '/auth/user', { token: temp.token })).status, 401);
  });
});

// handle: route === 'POST /query' and the /rpc/ prefix
describe('handle: query and rpc routes', () => {
  // POST /query -> requireUser() throws 401
  it('requires a signed-in user for /query', async () => {
    const res = await api.request('POST', '/query', { body: { table: 'recipes' } });
    assert.equal(res.status, 401);
  });

  // POST /query -> runQuery(await readJson(req), user.id)
  it('runs the query for a signed-in user', async () => {
    const res = await api.request('POST', '/query', { token: anna.token, body: { table: 'recipes', filters: [{ column: 'title', op: 'eq', value: 'Garlic Butter Spaghetti' }] } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
  });

  // POST /query -> readJson returns {} for an empty body -> runQuery's unknown table check
  it('treats an empty body as an empty query', async () => {
    const res = await api.request('POST', '/query', { token: anna.token });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.message, 'Unknown table "undefined"');
  });

  // POST /rpc/<name> -> rpcs.get_recipe found and called
  it('calls get_recipe with ingredients and steps in order', async () => {
    const recipe = (await api.query(anna, { table: 'recipes', filters: [{ column: 'title', op: 'eq', value: 'Garlic Butter Spaghetti' }], single: 'single' })).data;
    const res = await api.request('POST', '/rpc/get_recipe', { token: anna.token, body: { p_recipe_id: recipe.id } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.recipe.title, 'Garlic Butter Spaghetti');
    assert.deepEqual(res.body.data.ingredients.map((i) => i.order_index), [0, 1, 2, 3, 4]);
    assert.deepEqual(res.body.data.steps.map((s) => s.step_number), [1, 2, 3]);
  });

  // POST /rpc/<name> -> get_recipe throws 404; if (!fn) throw 404 'Unknown function'
  it('returns 404 for a missing recipe and an unknown function', async () => {
    const missing = await api.request('POST', '/rpc/get_recipe', { token: anna.token, body: { p_recipe_id: 'nope' } });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.message, 'Recipe not found');
    const unknown = await api.request('POST', '/rpc/nope', { token: anna.token, body: {} });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.error.message, 'Unknown function');
  });

  // POST /rpc/<name> -> requireUser() 401; GET /rpc/... does not match req.method === 'POST' -> final 404
  it('requires a signed-in user for rpc and only accepts POST', async () => {
    assert.equal((await api.request('POST', '/rpc/get_recipe', { body: {} })).status, 401);
    assert.equal((await api.request('GET', '/rpc/get_recipe', { token: anna.token })).status, 404);
  });
});

// handle: if (url.pathname.startsWith('/storage/'))
describe('handle: storage', () => {
  const upload = (method, path, token, body = PNG) =>
    api.request(method, path, { token, body, raw: true, headers: { 'Content-Type': 'image/png' } });

  // POST: user's own folder -> readBody, write file, { path };
  // GET: fs.existsSync -> stream the file with MIME type and Cache-Control
  it('stores an upload in the own folder and serves it back', async () => {
    const path = `/storage/avatars/${anna.id}/me.png`;
    const res = await upload('POST', path, anna.token);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { path: `avatars/${anna.id}/me.png` });

    const file = await fetch(`${api.baseUrl}${path}`);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'image/png');
    assert.equal(file.headers.get('cache-control'), 'public, max-age=3600');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), PNG);
  });

  // req.method === 'PUT' side of POST || PUT; user id deeper in the path; MIME lookup lower-cases .JPG
  it('accepts PUT and nested folders that contain the user id', async () => {
    const res = await upload('PUT', `/storage/recipes/${anna.id}/2025/cake.JPG`, anna.token);
    assert.equal(res.status, 200);
    const file = await fetch(`${api.baseUrl}/storage/recipes/${anna.id}/2025/cake.JPG`);
    assert.equal(file.headers.get('content-type'), 'image/jpeg');
  });

  // !rest.join('/').split('/').includes(user.id) -> 403; requireUser() -> 401
  it("refuses uploads into someone else's folder or without signing in", async () => {
    const other = await upload('POST', `/storage/avatars/${ben.id}/x.png`, anna.token);
    assert.equal(other.status, 403);
    assert.equal(other.body.error.message, 'You can only upload to your own folder');
    const anonymous = await upload('POST', `/storage/avatars/${anna.id}/x.png`, undefined);
    assert.equal(anonymous.status, 401);
  });

  // MIME[...] ?? 'application/octet-stream'
  it('serves unknown file types as binary', async () => {
    await upload('POST', `/storage/files/${anna.id}/data.bin`, anna.token);
    const file = await fetch(`${api.baseUrl}/storage/files/${anna.id}/data.bin`);
    assert.equal(file.headers.get('content-type'), 'application/octet-stream');
  });

  // GET: !fs.existsSync(file) -> 404; DELETE matches neither POST/PUT nor GET -> final 404
  it('returns 404 for missing files and unsupported methods', async () => {
    assert.equal((await api.request('GET', `/storage/avatars/${anna.id}/missing.png`)).status, 404);
    const del = await api.request('DELETE', `/storage/avatars/${anna.id}/me.png`, { token: anna.token });
    assert.equal(del.status, 404);
    assert.equal(del.body.error.message, 'Not found');
  });

  // decodeURIComponent + safeUploadPath(rel) -> 400 for paths outside UPLOAD_DIR
  it('rejects paths that leave the upload folder', async () => {
    const res = await api.request('GET', '/storage/..%2F..%2Fsecret.txt');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Invalid path');
  });
});
