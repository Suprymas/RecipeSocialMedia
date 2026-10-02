import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Client for the lightweight server in /server. It mirrors the subset of the
// supabase-js API the app uses, so screens call it the same way.

const SESSION_KEY = 'backend:session';

// Defaults to port 4000 on the machine running the Expo dev server, so a phone
// on the same network finds it automatically.
const guessApiUrl = () => {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:4000`;
};

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || guessApiUrl()).replace(/\/$/, '');

let session = null;
let sessionLoaded = false;
const authListeners = new Set();

const loadSession = async () => {
  if (sessionLoaded) return session;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    session = raw ? JSON.parse(raw) : null;
  } catch {
    session = null;
  }
  sessionLoaded = true;
  return session;
};

const setSession = async (next, event) => {
  session = next;
  sessionLoaded = true;
  if (next) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else await AsyncStorage.removeItem(SESSION_KEY);
  authListeners.forEach((cb) => cb(event, session));
};

// Returns { data, error } like supabase-js instead of throwing
const request = async (method, path, body, headers = {}) => {
  try {
    const s = await loadSession();
    const isJson = body !== undefined && !(body instanceof ArrayBuffer);
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(isJson ? { 'Content-Type': 'application/json' } : {}),
        ...(s ? { Authorization: `Bearer ${s.access_token}` } : {}),
        ...headers,
      },
      body: isJson ? JSON.stringify(body) : body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && s) await setSession(null, 'SIGNED_OUT');
      return { data: null, error: { status: res.status, ...json.error } };
    }
    return { data: json, error: null };
  } catch (e) {
    return { data: null, error: { message: `Could not reach the server at ${API_URL}: ${e.message}` } };
  }
};

// ---------- query builder ----------

class QueryBuilder {
  constructor(table) {
    this.query = { table, action: 'select', columns: '*', filters: [], orders: [] };
  }

  select(columns = '*') {
    this.query.columns = columns;
    if (this.query.action !== 'select') this.query.returning = true;
    return this;
  }

  insert(payload) { Object.assign(this.query, { action: 'insert', payload }); return this; }
  upsert(payload) { Object.assign(this.query, { action: 'upsert', payload }); return this; }
  update(payload) { Object.assign(this.query, { action: 'update', payload }); return this; }
  delete() { this.query.action = 'delete'; return this; }

  filter(column, op, value) { this.query.filters.push({ column, op, value }); return this; }
  eq(c, v) { return this.filter(c, 'eq', v); }
  neq(c, v) { return this.filter(c, 'neq', v); }
  gt(c, v) { return this.filter(c, 'gt', v); }
  gte(c, v) { return this.filter(c, 'gte', v); }
  lt(c, v) { return this.filter(c, 'lt', v); }
  lte(c, v) { return this.filter(c, 'lte', v); }
  like(c, v) { return this.filter(c, 'like', v); }
  ilike(c, v) { return this.filter(c, 'ilike', v); }
  is(c, v) { return this.filter(c, 'is', v); }
  in(c, v) { return this.filter(c, 'in', v); }
  match(obj) { Object.entries(obj).forEach(([c, v]) => this.eq(c, v)); return this; }
  or(expr) { this.query.filters.push({ or: expr }); return this; }

  order(column, { ascending = true } = {}) { this.query.orders.push({ column, ascending }); return this; }
  limit(n) { this.query.limit = n; return this; }
  single() { this.query.single = 'single'; return this; }
  maybeSingle() { this.query.single = 'maybe'; return this; }

  then(resolve, reject) {
    return request('POST', '/query', this.query)
      .then(({ data, error }) => ({ data: error ? null : data.data, error }))
      .then(resolve, reject);
  }
}

// ---------- auth ----------

const authResult = async ({ data, error }) => {
  if (error) return { data: { user: null, session: null }, error };
  await setSession(data.session, 'SIGNED_IN');
  return { data, error: null };
};

const auth = {
  signUp: async (credentials) => authResult(await request('POST', '/auth/signup', credentials)),
  signInWithPassword: async (credentials) => authResult(await request('POST', '/auth/login', credentials)),

  async signOut() {
    await request('POST', '/auth/logout', {});
    await setSession(null, 'SIGNED_OUT');
    return { error: null };
  },

  async getSession() {
    return { data: { session: await loadSession() }, error: null };
  },

  async getUser() {
    const s = await loadSession();
    if (!s) return { data: { user: null }, error: { message: 'Auth session missing!' } };
    const { data, error } = await request('GET', '/auth/user');
    // If the server is unreachable, keep working with the cached user
    if (error && error.status !== 401) return { data: { user: s.user }, error: null };
    return { data: { user: data?.user ?? null }, error };
  },

  onAuthStateChange(callback) {
    authListeners.add(callback);
    loadSession().then((s) => callback('INITIAL_SESSION', s));
    return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
  },
};

// ---------- storage ----------

const storage = {
  from: (bucket) => ({
    async upload(filePath, body, { contentType } = {}) {
      const { data, error } = await request('POST', `/storage/${bucket}/${filePath}`, body,
        contentType ? { 'Content-Type': contentType } : {});
      return { data, error };
    },
    getPublicUrl: (filePath) => ({ data: { publicUrl: `${API_URL}/storage/${bucket}/${filePath}` } }),
  }),
};

// ---------- realtime ----------
// One shared WebSocket; channels join/leave rooms on it. The server doesn't echo
// broadcasts back to the sender, matching Supabase's default.

const channels = new Map(); // name -> Set of channel objects
let socket = null;
let reconnectTimer = null;
const outbox = [];

const socketSend = (msg) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  else {
    outbox.push(msg);
    connect();
  }
};

const connect = async () => {
  if (socket && socket.readyState <= WebSocket.OPEN) return;
  const s = await loadSession();
  if (!s || (socket && socket.readyState <= WebSocket.OPEN)) return;
  socket = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/realtime?token=${s.access_token}`);
  socket.onopen = () => {
    channels.forEach((_, name) => socket.send(JSON.stringify({ type: 'join', channel: name })));
    outbox.splice(0).forEach((m) => socket.send(JSON.stringify(m)));
  };
  socket.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    channels.get(msg.channel)?.forEach((ch) => ch.dispatch(msg));
  };
  socket.onclose = () => {
    socket = null;
    clearTimeout(reconnectTimer);
    if (channels.size) reconnectTimer = setTimeout(connect, 2000);
  };
};

const channel = (name) => {
  const handlers = [];
  const ch = {
    on(type, filter, cb) { handlers.push({ type, event: filter?.event, cb }); return ch; },
    dispatch(msg) {
      handlers
        .filter((h) => h.type === msg.type && (!h.event || h.event === msg.event))
        .forEach((h) => h.cb({ type: msg.type, event: msg.event, payload: msg.payload }));
    },
    subscribe(cb) {
      if (!channels.has(name)) {
        channels.set(name, new Set());
        socketSend({ type: 'join', channel: name });
      }
      channels.get(name).add(ch);
      cb?.('SUBSCRIBED');
      return ch;
    },
    async send({ type, event, payload }) {
      socketSend({ type, channel: name, event, payload });
      return 'ok';
    },
    async unsubscribe() {
      const set = channels.get(name);
      set?.delete(ch);
      if (set && set.size === 0) {
        channels.delete(name);
        socketSend({ type: 'leave', channel: name });
      }
      return 'ok';
    },
  };
  return ch;
};

export const backend = {
  auth,
  from: (table) => new QueryBuilder(table),
  async rpc(name, params) {
    const { data, error } = await request('POST', `/rpc/${name}`, params ?? {});
    return { data: error ? null : data.data, error };
  },
  storage,
  channel,
  removeChannel: (ch) => ch?.unsubscribe(),
};

// Uploads a local image (e.g. from the image picker) and returns its public URL
export const uploadImage = async (uri, bucket, userId) => {
  const ext = uri.split('.').pop().split('?')[0];
  // Folder starts with the user's id; the server only accepts uploads there
  const filePath = `${userId}/${Date.now()}.${ext}`;
  const arrayBuffer = await (await fetch(uri)).arrayBuffer();
  const { error } = await storage.from(bucket).upload(filePath, arrayBuffer, {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });
  if (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
  return storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
};
