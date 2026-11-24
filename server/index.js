// Lightweight backend for the app: auth, a SQLite database with a small
// PostgREST-style query endpoint, image storage and realtime broadcast chat.
// Only dependency is `ws`; SQLite comes from Node's built-in node:sqlite.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 4000;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'app.db');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- database ----------

const isNew = !fs.existsSync(DB_FILE);
const sql = new DatabaseSync(DB_FILE);
sql.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

const TIMESTAMPS = `
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ'))`;

sql.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ'))
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username TEXT,
    bio TEXT,
    avatar_url TEXT,${TIMESTAMPS}
  );
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    story TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    main_image_url TEXT,${TIMESTAMPS}
  );
  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,${TIMESTAMPS}
  );
  CREATE TABLE IF NOT EXISTS recipe_steps (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,${TIMESTAMPS}
  );
  CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    image TEXT,
    likes INTEGER NOT NULL DEFAULT 0,${TIMESTAMPS}
  );
  CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'accepted',${TIMESTAMPS}
  );
  CREATE TABLE IF NOT EXISTS "groups" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,${TIMESTAMPS}
  );
  CREATE TABLE IF NOT EXISTS group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ')),${TIMESTAMPS}
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,${TIMESTAMPS}
  );
  CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id);
  CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON recipe_ingredients(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_steps_recipe ON recipe_steps(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);
  CREATE INDEX IF NOT EXISTS idx_members_group ON group_members(group_id);
  CREATE INDEX IF NOT EXISTS idx_members_user ON group_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
`);

// Tables the app may query through /query, with their columns
const TABLES = Object.fromEntries(
  ['profiles', 'recipes', 'recipe_ingredients', 'recipe_steps', 'stories',
    'friendships', 'groups', 'group_members', 'messages']
    .map((t) => [t, sql.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name)]),
);

// Columns stored as JSON text
const JSON_COLUMNS = { recipes: ['tags'] };

const q = (name) => `"${name}"`;

const toDb = (table, row) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (JSON_COLUMNS[table]?.includes(k)) out[k] = JSON.stringify(v ?? []);
    else if (typeof v === 'boolean') out[k] = v ? 1 : 0;
    else if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
};

const fromDb = (table, row) => {
  const out = { ...row };
  for (const c of JSON_COLUMNS[table] ?? []) {
    if (typeof out[c] === 'string') {
      try { out[c] = JSON.parse(out[c]); } catch { /* leave as text */ }
    }
  }
  return out;
};

const transaction = (fn) => {
  sql.exec('BEGIN');
  try {
    const result = fn();
    sql.exec('COMMIT');
    return result;
  } catch (e) {
    sql.exec('ROLLBACK');
    throw e;
  }
};

const insertRow = (table, row) => {
  const data = toDb(table, row);
  const cols = Object.keys(data);
  sql.prepare(`INSERT INTO ${q(table)} (${cols.map(q).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...cols.map((c) => data[c]));
};

const getById = (table, id) => {
  const row = sql.prepare(`SELECT * FROM ${q(table)} WHERE id = ?`).get(id);
  return row ? fromDb(table, row) : null;
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;

const verifyPassword = (password, stored) => {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
};

const seed = () => {
  const now = new Date().toISOString();
  const demo = [
    { email: 'anna@demo.app', username: 'chef_anna', bio: 'Pasta lover' },
    { email: 'ben@demo.app', username: 'baker_ben', bio: 'Sourdough every weekend' },
  ].map((u) => ({ ...u, id: crypto.randomUUID() }));
  for (const u of demo) {
    insertRow('users', { id: u.id, email: u.email, password: hashPassword('password'), created_at: now });
    insertRow('profiles', { id: u.id, username: u.username, bio: u.bio });
  }
  const recipeId = crypto.randomUUID();
  insertRow('recipes', {
    id: recipeId, user_id: demo[0].id, title: 'Garlic Butter Spaghetti',
    story: 'My go-to weeknight dinner.', tags: ['pasta', 'quick'],
  });
  ['200g spaghetti', '3 cloves garlic', '50g butter', 'Parmesan', 'Salt'].forEach((ingredient, order_index) =>
    insertRow('recipe_ingredients', { id: crypto.randomUUID(), recipe_id: recipeId, ingredient, order_index }));
  ['Boil the spaghetti in salted water.', 'Melt butter and gently fry sliced garlic.', 'Toss pasta with the garlic butter and top with Parmesan.']
    .forEach((description, i) =>
      insertRow('recipe_steps', { id: crypto.randomUUID(), recipe_id: recipeId, step_number: i + 1, description }));
};

// One-time import from the old JSON-file storage
const importLegacyJson = () => {
  const old = JSON.parse(fs.readFileSync(LEGACY_JSON_FILE, 'utf8'));
  // Parents before children so foreign keys resolve
  const order = ['users', 'profiles', 'recipes', 'recipe_ingredients', 'recipe_steps', 'stories',
    'friendships', 'groups', 'group_members', 'messages'];
  for (const table of order) {
    const cols = table === 'users' ? ['id', 'email', 'password', 'created_at'] : TABLES[table];
    for (const row of old[table] ?? []) {
      insertRow(table, Object.fromEntries(Object.entries(row).filter(([k]) => cols.includes(k))));
    }
  }
  for (const [token, user_id] of Object.entries(old.sessions ?? {})) insertRow('sessions', { token, user_id });
};

if (isNew) {
  transaction(() => {
    if (fs.existsSync(LEGACY_JSON_FILE)) {
      importLegacyJson();
      console.log(`Imported ${LEGACY_JSON_FILE} into ${DB_FILE}`);
    } else {
      seed();
    }
  });
  if (fs.existsSync(LEGACY_JSON_FILE)) fs.renameSync(LEGACY_JSON_FILE, `${LEGACY_JSON_FILE}.imported`);
}

// ---------- access rules ----------
// Everyone signed in can read everything except other groups' chat messages.
// Writes are limited to rows the user owns.

const exists = (query, ...params) => !!sql.prepare(query).get(...params);
const isGroupMember = (groupId, uid) => exists('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', groupId, uid);
const ownsRecipe = (recipeId, uid) => exists('SELECT 1 FROM recipes WHERE id = ? AND user_id = ?', recipeId, uid);
const ownsGroup = (groupId, uid) => exists('SELECT 1 FROM "groups" WHERE id = ? AND created_by = ?', groupId, uid);

// Extra WHERE clause restricting which rows a user may read
const readRules = {
  messages: (uid) => ({ clause: 'group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)', params: [uid] }),
};

const canWrite = {
  profiles: (row, uid) => row.id === uid,
  recipes: (row, uid) => row.user_id === uid,
  recipe_ingredients: (row, uid) => ownsRecipe(row.recipe_id, uid),
  recipe_steps: (row, uid) => ownsRecipe(row.recipe_id, uid),
  stories: (row, uid) => row.user_id === uid,
  friendships: (row, uid) => row.requester_id === uid || row.addressee_id === uid,
  groups: (row, uid) => row.created_by === uid,
  group_members: (row, uid) => row.user_id === uid || ownsGroup(row.group_id, uid),
  messages: (row, uid) => row.author_id === uid && isGroupMember(row.group_id, uid),
};

// ---------- query engine ----------
// Translates the client's supabase-style query description into SQL.

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const rlsError = (table) =>
  new HttpError(403, `new row violates row-level security policy for table "${table}"`, '42501');

const checkColumn = (table, column) => {
  if (!TABLES[table].includes(column)) {
    throw new HttpError(400, `column ${table}.${column} does not exist`, '42703');
  }
  return q(column);
};

// PostgREST LIKE patterns (% and _) as a case-sensitive GLOB pattern
const likeToGlob = (pattern) =>
  String(pattern).replace(/[*?[\]]/g, '[$&]').replace(/%/g, '*').replace(/_/g, '?');

// SQLite has no boolean type: booleans are stored as 1 / 0
const toSqlValue = (value) => (typeof value === 'boolean' ? Number(value) : value);

// `is` filter values arrive as text ("true", "false") from the client
const parseIsValue = (value) => {
  if (value === 'true') return 1;
  if (value === 'false') return 0;
  return value;
};

// Filters that compare a column with one value
const COMPARISONS = { eq: '=', neq: 'IS NOT', gt: '>', gte: '>=', lt: '<', lte: '<=', ilike: 'LIKE' };

const isFilter = (col, value) => {
  if (value === null || value === 'null') return { clause: `${col} IS NULL`, params: [] };
  return { clause: `${col} IS ?`, params: [parseIsValue(value)] };
};

const inFilter = (col, value) => {
  const list = Array.isArray(value) ? value : [];
  if (list.length === 0) return { clause: '0', params: [] };
  const placeholders = list.map(() => '?').join(', ');
  return { clause: `${col} IN (${placeholders})`, params: list };
};

// Filters with their own SQL shape
const SPECIAL_FILTERS = {
  like: (col, value) => ({ clause: `${col} GLOB ?`, params: [likeToGlob(value)] }),
  is: isFilter,
  in: inFilter,
};

const condition = (table, { column, op, value }) => {
  const col = checkColumn(table, column);
  const v = toSqlValue(value);
  if (Object.hasOwn(COMPARISONS, op)) return { clause: `${col} ${COMPARISONS[op]} ?`, params: [v] };
  if (Object.hasOwn(SPECIAL_FILTERS, op)) return SPECIAL_FILTERS[op](col, v);
  throw new HttpError(400, `Unsupported filter "${op}"`);
};

// Filters are [{ column, op, value }] or { or: "col.op.value,col.op.value" }
const parseOr = (expr) =>
  String(expr).split(',').map((part) => {
    const [column, op, ...rest] = part.trim().split('.');
    return { column, op, value: rest.join('.') };
  });

const buildWhere = (table, filters, uid) => {
  const parts = filters.map((f) => {
    if (f.or == null) return condition(table, f);
    const ors = parseOr(f.or).map((c) => condition(table, c));
    return { clause: `(${ors.map((o) => o.clause).join(' OR ')})`, params: ors.flatMap((o) => o.params) };
  });
  if (readRules[table]) parts.push(readRules[table](uid));
  if (parts.length === 0) return { where: '', params: [] };
  return { where: ` WHERE ${parts.map((p) => p.clause).join(' AND ')}`, params: parts.flatMap((p) => p.params) };
};

const pickColumns = (row, columns = '*') => {
  const cols = String(columns).split(',').map((c) => c.trim()).filter(Boolean);
  if (cols.length === 0 || cols.includes('*')) return row;
  return Object.fromEntries(cols.map((c) => [c, row[c] ?? null]));
};

// ---------- query actions ----------
// Each action gets a context { table, uid, filters, now, writable } and returns the affected rows.

const setClause = (column) => `${q(column)} = ?`;

// Updates the row's non-id columns from already converted (toDb) data
const updateRow = (table, id, data) => {
  const cols = Object.keys(data).filter((c) => c !== 'id');
  if (cols.length === 0) return;
  sql.prepare(`UPDATE ${q(table)} SET ${cols.map(setClause).join(', ')} WHERE id = ?`)
    .run(...cols.map((c) => data[c]), id);
};

const checkPayloadColumns = (table, obj) => {
  for (const column of Object.keys(obj)) checkColumn(table, column);
};

const assertWritable = (ctx, ...rows) => {
  if (!rows.every(ctx.writable)) throw rlsError(ctx.table);
};

const selectRows = (ctx, extra = '') => {
  const { where, params } = buildWhere(ctx.table, ctx.filters, ctx.uid);
  return sql.prepare(`SELECT * FROM ${q(ctx.table)}${where}${extra}`).all(...params)
    .map((r) => fromDb(ctx.table, r));
};

const insertNewRow = (ctx, item) => {
  const row = { id: crypto.randomUUID(), ...item };
  assertWritable(ctx, row);
  insertRow(ctx.table, row);
  return getById(ctx.table, row.id);
};

const mergeIntoExisting = (ctx, existing, item) => {
  const next = { ...existing, ...item, updated_at: ctx.now };
  assertWritable(ctx, existing, next);
  updateRow(ctx.table, existing.id, toDb(ctx.table, next));
  return getById(ctx.table, existing.id);
};

// insert creates new rows only; upsert also merges into a row with the same id
const writeItem = (ctx, item, action) => {
  checkPayloadColumns(ctx.table, item);
  const existing = item.id == null ? null : getById(ctx.table, item.id);
  if (!existing) return insertNewRow(ctx, item);
  if (action === 'insert') throw new HttpError(409, 'duplicate key value violates unique constraint', '23505');
  return mergeIntoExisting(ctx, existing, item);
};

const runInsert = (ctx, { action, payload }) => {
  const items = Array.isArray(payload) ? payload : [payload];
  return transaction(() => items.map((item) => writeItem(ctx, item, action)));
};

const withUpdatedAt = (ctx, payload) =>
  TABLES[ctx.table].includes('updated_at') ? { updated_at: ctx.now, ...payload } : payload;

const runUpdate = (ctx, { payload }) => {
  checkPayloadColumns(ctx.table, payload);
  return transaction(() => {
    const rows = selectRows(ctx).filter(ctx.writable);
    const changes = withUpdatedAt(ctx, payload);
    const data = toDb(ctx.table, changes);
    return rows.map((r) => {
      assertWritable(ctx, { ...r, ...changes, id: r.id });
      updateRow(ctx.table, r.id, data);
      return getById(ctx.table, r.id);
    });
  });
};

const runDelete = (ctx) => transaction(() => {
  const rows = selectRows(ctx).filter(ctx.writable);
  const del = sql.prepare(`DELETE FROM ${q(ctx.table)} WHERE id = ?`);
  for (const r of rows) del.run(r.id);
  return rows;
});

const sortDirection = (order) => (order.ascending === false ? 'DESC' : 'ASC');

const orderClause = (table, orders) => {
  if (orders.length === 0) return '';
  const terms = orders.map((o) => `${checkColumn(table, o.column)} ${sortDirection(o)}`);
  return ` ORDER BY ${terms.join(', ')}`;
};

const limitClause = (limit) => (Number.isInteger(limit) && limit >= 0 ? ` LIMIT ${limit}` : '');

const runSelect = (ctx, { orders, limit }) =>
  selectRows(ctx, orderClause(ctx.table, orders) + limitClause(limit));

const WRITE_ACTIONS = new Map([
  ['insert', runInsert],
  ['upsert', runInsert],
  ['update', runUpdate],
  ['delete', runDelete],
]);

// ---------- query results ----------

const compareRows = (a, b, orders) => {
  for (const { column, ascending = true } of orders) {
    if (a[column] !== b[column]) return (a[column] > b[column] ? 1 : -1) * (ascending ? 1 : -1);
  }
  return 0;
};

// Rare for writes; applied in JS to keep the write SQL simple
const orderWrittenRows = (rows, { orders, limit }) => {
  if (orders.length === 0 && limit == null) return rows;
  const sorted = [...rows].sort((a, b) => compareRows(a, b, orders));
  return limit == null ? sorted : sorted.slice(0, limit);
};

const singleRow = (rows, single) => {
  if (rows.length === 1) return rows[0];
  if (rows.length === 0 && single === 'maybe') return null;
  throw new HttpError(406, `JSON object requested, ${rows.length} rows returned`, 'PGRST116');
};

const shapeResult = (rows, { columns, single }) => {
  const picked = rows.map((r) => pickColumns(r, columns));
  return single ? singleRow(picked, single) : picked;
};

const runQuery = (query, uid) => {
  const { table, action = 'select', filters = [], orders = [], returning } = query;
  if (!TABLES[table]) throw new HttpError(404, `Unknown table "${table}"`);
  const ctx = { table, uid, filters, now: new Date().toISOString(), writable: (r) => canWrite[table](r, uid) };
  const options = { ...query, action, orders };
  if (action === 'select') return shapeResult(runSelect(ctx, options), options);

  // Unknown actions read like a select but are treated as writes below
  const rows = (WRITE_ACTIONS.get(action) ?? runSelect)(ctx, options);
  if (!returning) return null;
  return shapeResult(orderWrittenRows(rows, options), options);
};

const rpcs = {
  get_recipe: ({ p_recipe_id }) => {
    const recipe = getById('recipes', p_recipe_id);
    if (!recipe) throw new HttpError(404, 'Recipe not found');
    return {
      recipe,
      ingredients: sql.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY order_index').all(p_recipe_id),
      steps: sql.prepare('SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number').all(p_recipe_id),
    };
  },
};

// ---------- auth ----------

const publicUser = ({ id, email, created_at }) => ({ id, email, created_at });

const createSession = (user) => {
  const access_token = crypto.randomBytes(32).toString('hex');
  insertRow('sessions', { token: access_token, user_id: user.id });
  return { access_token, token_type: 'bearer', user: publicUser(user) };
};

const userFromToken = (token) =>
  token
    ? sql.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token) ?? null
    : null;

const deleteSession = (token) => sql.prepare('DELETE FROM sessions WHERE token = ?').run(token);

const signUp = ({ email, password, options }) => {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized || !password) throw new HttpError(400, 'Email and password are required');
  if (String(password).length < 6) throw new HttpError(400, 'Password should be at least 6 characters');
  if (exists('SELECT 1 FROM users WHERE email = ?', normalized)) throw new HttpError(400, 'User already registered');
  const user = { id: crypto.randomUUID(), email: normalized, password: hashPassword(String(password)), created_at: new Date().toISOString() };
  return transaction(() => {
    insertRow('users', user);
    insertRow('profiles', { id: user.id, username: options?.data?.username ?? `user_${user.id.slice(0, 8)}` });
    const session = createSession(user);
    return { user: session.user, session };
  });
};

const signIn = ({ email, password }) => {
  const normalized = String(email ?? '').trim().toLowerCase();
  const user = sql.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
  if (!user || !password || !verifyPassword(String(password), user.password)) {
    throw new HttpError(400, 'Invalid login credentials');
  }
  const session = createSession(user);
  return { user: session.user, session };
};

// ---------- http ----------

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };

const readBody = (req, limit = MAX_UPLOAD_BYTES) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Payload too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const readJson = async (req) => {
  const buf = await readBody(req, 2 * 1024 * 1024);
  try {
    return buf.length ? JSON.parse(buf.toString('utf8')) : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
};

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
};

// Keeps uploaded paths inside UPLOAD_DIR
const safeUploadPath = (rel) => {
  const full = path.resolve(UPLOAD_DIR, rel);
  if (!full.startsWith(UPLOAD_DIR + path.sep)) throw new HttpError(400, 'Invalid path');
  return full;
};

const handle = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = `${req.method} ${url.pathname}`;
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const requireUser = () => {
    const user = userFromToken(token);
    if (!user) throw new HttpError(401, 'Not signed in');
    return user;
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    });
    return res.end();
  }

  if (route === 'GET /health') return send(res, 200, { ok: true });
  if (route === 'POST /auth/signup') return send(res, 200, signUp(await readJson(req)));
  if (route === 'POST /auth/login') return send(res, 200, signIn(await readJson(req)));
  if (route === 'GET /auth/user') return send(res, 200, { user: publicUser(requireUser()) });
  if (route === 'POST /auth/logout') {
    deleteSession(token);
    return send(res, 200, {});
  }
  if (route === 'POST /query') {
    const user = requireUser();
    return send(res, 200, { data: runQuery(await readJson(req), user.id) });
  }
  if (req.method === 'POST' && url.pathname.startsWith('/rpc/')) {
    requireUser();
    const fn = rpcs[url.pathname.slice('/rpc/'.length)];
    if (!fn) throw new HttpError(404, 'Unknown function');
    return send(res, 200, { data: fn(await readJson(req)) });
  }
  if (url.pathname.startsWith('/storage/')) {
    const rel = decodeURIComponent(url.pathname.slice('/storage/'.length));
    const file = safeUploadPath(rel);
    if (req.method === 'POST' || req.method === 'PUT') {
      const user = requireUser();
      // Files live under <bucket>/<path that starts with the uploader's id>
      const [, ...rest] = rel.split('/');
      if (!rest.join('/').split('/').includes(user.id)) throw new HttpError(403, 'You can only upload to your own folder');
      const body = await readBody(req);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body);
      return send(res, 200, { path: rel });
    }
    if (req.method === 'GET') {
      if (!fs.existsSync(file)) throw new HttpError(404, 'Not found');
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      return fs.createReadStream(file).pipe(res);
    }
  }
  throw new HttpError(404, 'Not found');
};

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    send(res, status, { error: { message: err.message, code: err.code } });
  });
});

// ---------- realtime ----------
// Clients join named channels and broadcast to everyone else in them.

const wss = new WebSocketServer({ server, path: '/realtime' });
const rooms = new Map();

wss.on('connection', (socket, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  if (!userFromToken(token)) return socket.close(4001, 'Not signed in');
  const joined = new Set();

  socket.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, channel } = msg;
    if (typeof channel !== 'string') return;
    if (type === 'join') {
      if (!rooms.has(channel)) rooms.set(channel, new Set());
      rooms.get(channel).add(socket);
      joined.add(channel);
    } else if (type === 'leave') {
      rooms.get(channel)?.delete(socket);
      joined.delete(channel);
    } else if (type === 'broadcast') {
      const out = JSON.stringify({ type: 'broadcast', channel, event: msg.event, payload: msg.payload });
      rooms.get(channel)?.forEach((s) => s !== socket && s.readyState === s.OPEN && s.send(out));
    }
  });

  socket.on('close', () => joined.forEach((c) => rooms.get(c)?.delete(socket)));
});

server.listen(PORT, () => console.log(`Backend listening on http://0.0.0.0:${PORT}`));
