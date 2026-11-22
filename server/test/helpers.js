// Starts the real backend (server/index.js) inside the test process with its own empty
// database and a free port, and gives the tests small helpers to call it over HTTP.
// The tests only use the HTTP interface, so they keep working when the server code is reorganised.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

export const startServer = async (name) => {
  const dataDir = path.join(os.tmpdir(), 'hungrybear-tests', name);
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.env.DATA_DIR = dataDir;
  process.env.PORT = String(await freePort());
  await import('../index.js');

  const baseUrl = `http://127.0.0.1:${process.env.PORT}`;
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) break;
    } catch (error) {
      if (attempt > 50) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Raw request: returns { status, headers, body } where body is parsed JSON when possible
  const request = async (method, urlPath, { body, token, headers = {}, raw = false } = {}) => {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, body: parsed };
  };

  let userCount = 0;
  // Registers a new user and returns { id, email, token }
  const signUp = async (username = `user${++userCount}`) => {
    const email = `${username}-${Date.now()}@test.app`;
    const { status, body } = await request('POST', '/auth/signup', {
      body: { email, password: 'secret123', options: { data: { username } } },
    });
    if (status !== 200) throw new Error(`Sign up failed: ${JSON.stringify(body)}`);
    return { id: body.user.id, email, token: body.session.access_token };
  };

  // POST /query as the given user; returns { status, data, error }
  const query = async (user, q) => {
    const { status, body } = await request('POST', '/query', { body: q, token: user.token });
    return { status, data: body?.data, error: body?.error };
  };

  return { baseUrl, request, signUp, query };
};
