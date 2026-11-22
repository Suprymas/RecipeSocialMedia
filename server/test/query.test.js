// Behaviour of POST /query (runQuery and the filter conditions it builds).
// These tests describe what the server does today, so refactoring must keep them green.
//
// Each test notes the part of runQuery (server/index.js) it covers.
// Not covered: the `: payload` side of `TABLES[table].includes('updated_at') ? ... : payload`
// in the update branch. It cannot be reached, because every table /query accepts has updated_at.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { startServer } from './helpers.js';

let api;
let anna;
let ben;

const titles = (rows) => rows.map((r) => r.title);

before(async () => {
  api = await startServer('query');
  anna = await api.signUp('anna');
  ben = await api.signUp('ben');
});

// runQuery: start of the function (table check, default action)
describe('runQuery: general', () => {
  // if (!TABLES[table]) throw 404
  it('rejects an unknown table with 404', async () => {
    const res = await api.query(anna, { table: 'nope' });
    assert.equal(res.status, 404);
    assert.equal(res.error.message, 'Unknown table "nope"');
  });

  // action = 'select' default, then the select branch
  it('treats a query without action as select', async () => {
    const res = await api.query(anna, { table: 'profiles', filters: [{ column: 'id', op: 'eq', value: anna.id }] });
    assert.equal(res.status, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].username, 'anna');
  });
});

// runQuery: if (action === 'insert' || action === 'upsert') with action 'insert'
describe('runQuery: insert', () => {
  // [payload] for a single object; new row: { id: randomUUID(), ...item }, writable(row), insertRow;
  // returning set, so the rows are returned
  it('inserts one row, generates its id and returns it when returning is set', async () => {
    const res = await api.query(anna, {
      table: 'recipes', action: 'insert', returning: true,
      payload: { user_id: anna.id, title: 'Soup', tags: ['warm', 'easy'] },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.length, 1);
    assert.match(res.data[0].id, /^[0-9a-f-]{36}$/);
    assert.equal(res.data[0].title, 'Soup');
    assert.deepEqual(res.data[0].tags, ['warm', 'easy']);
  });

  // if (action !== 'select' && !returning) return null
  it('returns null for a write without returning', async () => {
    const res = await api.query(anna, { table: 'recipes', action: 'insert', payload: { user_id: anna.id, title: 'Quiet' } });
    assert.equal(res.status, 200);
    assert.equal(res.data, null);
  });

  // Array.isArray(payload) ? payload : ...
  it('inserts every item of an array payload', async () => {
    const res = await api.query(anna, {
      table: 'stories', action: 'insert', returning: true,
      payload: [{ user_id: anna.id, title: 'First' }, { user_id: anna.id, title: 'Second' }],
    });
    assert.equal(res.status, 200);
    assert.deepEqual(titles(res.data), ['First', 'Second']);
  });

  // item.id != null ? getById(...) : null, with an id that does not exist yet
  it('keeps a client-chosen id', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const res = await api.query(anna, { table: 'stories', action: 'insert', returning: true, payload: { id, user_id: anna.id, title: 'Own id' } });
    assert.equal(res.data[0].id, id);
  });

  // if (existing && action === 'insert') throw 409
  it('rejects an insert with an id that already exists (409, 23505)', async () => {
    const created = await api.query(anna, { table: 'stories', action: 'insert', returning: true, payload: { user_id: anna.id, title: 'Dup' } });
    const res = await api.query(anna, { table: 'stories', action: 'insert', payload: { id: created.data[0].id, user_id: anna.id, title: 'Dup again' } });
    assert.equal(res.status, 409);
    assert.equal(res.error.code, '23505');
  });

  // if (!writable(row)) throw rlsError; transaction() rolls back the rows inserted before it
  it("rejects a row owned by someone else (403, 42501) and rolls back the whole batch", async () => {
    const res = await api.query(anna, {
      table: 'stories', action: 'insert',
      payload: [{ user_id: anna.id, title: 'Rollback me' }, { user_id: ben.id, title: 'Not mine' }],
    });
    assert.equal(res.status, 403);
    assert.equal(res.error.code, '42501');
    assert.equal(res.error.message, 'new row violates row-level security policy for table "stories"');
    const left = await api.query(anna, { table: 'stories', filters: [{ column: 'title', op: 'eq', value: 'Rollback me' }] });
    assert.deepEqual(left.data, []);
  });

  // checkPayloadColumns(item) -> checkColumn throws 400
  it('rejects an unknown column in the payload (400, 42703)', async () => {
    const res = await api.query(anna, { table: 'stories', action: 'insert', payload: { user_id: anna.id, colour: 'red' } });
    assert.equal(res.status, 400);
    assert.equal(res.error.code, '42703');
    assert.equal(res.error.message, 'column stories.colour does not exist');
  });

  // insertRow fails in SQLite (NOT NULL title); transaction() rolls back and the error becomes a 500
  it('returns 500 when the database rejects the row (missing required title)', async () => {
    const res = await api.query(anna, { table: 'recipes', action: 'insert', payload: { user_id: anna.id } });
    assert.equal(res.status, 500);
  });
});

// runQuery: if (action === 'insert' || action === 'upsert') with action 'upsert'
describe('runQuery: upsert', () => {
  // existing is null, so the row is inserted like a normal insert
  it('inserts a row that does not exist yet', async () => {
    const res = await api.query(anna, { table: 'stories', action: 'upsert', returning: true, payload: { user_id: anna.id, title: 'Upserted' } });
    assert.equal(res.status, 200);
    assert.equal(res.data[0].title, 'Upserted');
  });

  // if (existing) { next = { ...existing, ...item, updated_at: now }; UPDATE ... }
  it('merges into an existing own row and refreshes updated_at', async () => {
    const created = await api.query(anna, { table: 'stories', action: 'insert', returning: true, payload: { user_id: anna.id, title: 'Before', likes: 3 } });
    const before = created.data[0];
    await new Promise((resolve) => setTimeout(resolve, 5));
    const res = await api.query(anna, { table: 'stories', action: 'upsert', returning: true, payload: { id: before.id, title: 'After' } });
    assert.equal(res.status, 200);
    assert.equal(res.data[0].title, 'After');
    assert.equal(res.data[0].likes, 3);
    assert.equal(res.data[0].user_id, anna.id);
    assert.notEqual(res.data[0].updated_at, before.updated_at);
  });

  // !writable(existing) -> 403
  it("refuses to overwrite someone else's row", async () => {
    const bens = await api.query(ben, { table: 'stories', action: 'insert', returning: true, payload: { user_id: ben.id, title: "Ben's" } });
    const res = await api.query(anna, { table: 'stories', action: 'upsert', payload: { id: bens.data[0].id, title: 'Taken' } });
    assert.equal(res.status, 403);
  });

  // writable(existing) but !writable(next) -> 403
  it('refuses to hand an own row over to another user', async () => {
    const own = await api.query(anna, { table: 'stories', action: 'insert', returning: true, payload: { user_id: anna.id, title: 'Mine' } });
    const res = await api.query(anna, { table: 'stories', action: 'upsert', payload: { id: own.data[0].id, user_id: ben.id } });
    assert.equal(res.status, 403);
  });
});

// runQuery: else if (action === 'update')
describe('runQuery: update', () => {
  let annaStory;
  let benStory;

  before(async () => {
    annaStory = (await api.query(anna, { table: 'stories', action: 'insert', returning: true, payload: { user_id: anna.id, title: 'Shared title' } })).data[0];
    benStory = (await api.query(ben, { table: 'stories', action: 'insert', returning: true, payload: { user_id: ben.id, title: 'Shared title' } })).data[0];
  });

  // selectWhere().filter(writable) drops other users' rows; UPDATE runs for each own row
  it('updates only the rows the user owns and returns them', async () => {
    const res = await api.query(anna, {
      table: 'stories', action: 'update', returning: true,
      filters: [{ column: 'title', op: 'eq', value: 'Shared title' }],
      payload: { likes: 7 },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.map((r) => r.id), [annaStory.id]);
    assert.equal(res.data[0].likes, 7);
    const bens = await api.query(ben, { table: 'stories', filters: [{ column: 'id', op: 'eq', value: benStory.id }], single: 'single' });
    assert.equal(bens.data.likes, 0);
  });

  // if (action !== 'select' && !returning) return null
  it('returns null without returning', async () => {
    const res = await api.query(anna, { table: 'stories', action: 'update', filters: [{ column: 'id', op: 'eq', value: annaStory.id }], payload: { likes: 8 } });
    assert.equal(res.status, 200);
    assert.equal(res.data, null);
  });

  // filter(writable) leaves no rows, so rows.map(...) returns []
  it('returns an empty list when no own row matches', async () => {
    const res = await api.query(anna, { table: 'stories', action: 'update', returning: true, filters: [{ column: 'id', op: 'eq', value: benStory.id }], payload: { likes: 1 } });
    assert.deepEqual(res.data, []);
  });

  // if (!writable({ ...r, ...changes, id: r.id })) throw rlsError; transaction() rolls back
  it('refuses an update that would give the row to another user and changes nothing', async () => {
    const res = await api.query(anna, { table: 'stories', action: 'update', filters: [{ column: 'id', op: 'eq', value: annaStory.id }], payload: { user_id: ben.id, title: 'Stolen' } });
    assert.equal(res.status, 403);
    const still = await api.query(anna, { table: 'stories', filters: [{ column: 'id', op: 'eq', value: annaStory.id }], single: 'single' });
    assert.equal(still.data.title, 'Shared title');
    assert.equal(still.data.user_id, anna.id);
  });

  // checkPayloadColumns(payload) -> 400
  it('rejects an unknown column', async () => {
    const res = await api.query(anna, { table: 'stories', action: 'update', filters: [], payload: { nope: 1 } });
    assert.equal(res.status, 400);
    assert.equal(res.error.code, '42703');
  });
});

// runQuery: else if (action === 'delete')
describe('runQuery: delete', () => {
  // selectWhere().filter(writable), DELETE for each own row, deleted rows returned
  it("deletes the user's matching rows, returns them and leaves other users' rows", async () => {
    await api.query(anna, { table: 'stories', action: 'insert', payload: { user_id: anna.id, title: 'Delete me' } });
    await api.query(ben, { table: 'stories', action: 'insert', payload: { user_id: ben.id, title: 'Delete me' } });
    const res = await api.query(anna, { table: 'stories', action: 'delete', returning: true, filters: [{ column: 'title', op: 'eq', value: 'Delete me' }] });
    assert.equal(res.status, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].user_id, anna.id);
    const left = await api.query(anna, { table: 'stories', filters: [{ column: 'title', op: 'eq', value: 'Delete me' }] });
    assert.deepEqual(left.data.map((r) => r.user_id), [ben.id]);
  });

  // if (action !== 'select' && !returning) return null
  it('returns null without returning', async () => {
    const res = await api.query(anna, { table: 'stories', action: 'delete', filters: [{ column: 'title', op: 'eq', value: 'Nothing here' }] });
    assert.equal(res.data, null);
  });
});

// runQuery: if (action !== 'select') { if (orders.length || limit != null) { sort in JS; slice } }
describe('runQuery: ordering and limit of written rows', () => {
  const batch = () => [
    { user_id: anna.id, title: 'w-b', likes: 2 },
    { user_id: anna.id, title: 'w-c', likes: 1 },
    { user_id: anna.id, title: 'w-a', likes: 2 },
  ];

  // ascending false, a[column] === b[column] -> continue to the next column, ascending default true,
  // if (limit != null) slice
  it('sorts by several columns (ties fall through to the next) and applies the limit', async () => {
    const res = await api.query(anna, {
      table: 'stories', action: 'insert', returning: true, payload: batch(),
      orders: [{ column: 'likes', ascending: false }, { column: 'title' }], limit: 2,
    });
    assert.deepEqual(titles(res.data), ['w-a', 'w-b']);
  });

  // orders.length true, limit == null (no slice)
  it('sorts without a limit', async () => {
    const res = await api.query(anna, { table: 'stories', action: 'insert', returning: true, payload: batch(), orders: [{ column: 'likes', ascending: true }] });
    assert.deepEqual(res.data.map((r) => r.likes), [1, 2, 2]);
  });

  // orders.length 0 but limit != null: the comparator returns 0, then slice
  it('applies a limit without ordering', async () => {
    const res = await api.query(anna, { table: 'stories', action: 'insert', returning: true, payload: batch(), limit: 1 });
    assert.deepEqual(titles(res.data), ['w-b']);
  });
});

// runQuery: else { select } branch, then pickColumns and the single handling at the end
describe('runQuery: select', () => {
  let cook;

  before(async () => {
    cook = await api.signUp('cook');
    await api.query(cook, {
      table: 'recipes', action: 'insert',
      payload: [
        { user_id: cook.id, title: 'Cake', tags: ['sweet'] },
        { user_id: cook.id, title: 'Bread' },
        { user_id: cook.id, title: 'Pie' },
      ],
    });
  });

  const mine = () => [{ column: 'user_id', op: 'eq', value: cook.id }];

  // orders.length ? ORDER BY ... with o.ascending === false -> DESC; Number.isInteger(limit) && limit >= 0 -> LIMIT
  it('filters, orders descending and limits in SQL', async () => {
    const res = await api.query(cook, { table: 'recipes', filters: mine(), orders: [{ column: 'title', ascending: false }], limit: 2 });
    assert.deepEqual(titles(res.data), ['Pie', 'Cake']);
  });

  // o.ascending === false is false -> ASC
  it('orders ascending by default', async () => {
    const res = await api.query(cook, { table: 'recipes', filters: mine(), orders: [{ column: 'title' }] });
    assert.deepEqual(titles(res.data), ['Bread', 'Cake', 'Pie']);
  });

  // Number.isInteger(limit) && limit >= 0 is false -> no LIMIT
  it('ignores a negative or fractional limit', async () => {
    for (const limit of [-1, 1.5]) {
      const res = await api.query(cook, { table: 'recipes', filters: mine(), limit });
      assert.equal(res.data.length, 3);
    }
  });

  // limit >= 0 includes 0
  it('accepts a limit of 0', async () => {
    const res = await api.query(cook, { table: 'recipes', filters: mine(), limit: 0 });
    assert.deepEqual(res.data, []);
  });

  // checkColumn(table, o.column) inside the ORDER BY builder -> 400
  it('rejects ordering by an unknown column', async () => {
    const res = await api.query(cook, { table: 'recipes', orders: [{ column: 'nope' }] });
    assert.equal(res.status, 400);
    assert.equal(res.error.code, '42703');
  });

  // result.map((r) => pickColumns(r, columns)) with a column list
  it('returns only the requested columns, null for columns that do not exist', async () => {
    const res = await api.query(cook, { table: 'recipes', filters: mine(), orders: [{ column: 'title' }], limit: 1, columns: 'title, nope' });
    assert.deepEqual(res.data, [{ title: 'Bread', nope: null }]);
  });

  // pickColumns: cols.length === 0 || cols.includes('*') -> whole row
  it('returns whole rows for columns "*" or an empty list', async () => {
    for (const columns of ['*', ' , ']) {
      const res = await api.query(cook, { table: 'recipes', filters: mine(), limit: 1, columns });
      assert.ok('user_id' in res.data[0]);
    }
  });

  // selectWhere -> fromDb parses JSON_COLUMNS
  it('parses JSON columns back into arrays', async () => {
    const res = await api.query(cook, { table: 'recipes', filters: [...mine(), { column: 'title', op: 'eq', value: 'Cake' }] });
    assert.deepEqual(res.data[0].tags, ['sweet']);
  });

  // selectWhere -> buildWhere: f.or != null -> parseOr, joined with OR
  it('combines an "or" filter string with other filters', async () => {
    const res = await api.query(cook, { table: 'recipes', filters: [...mine(), { or: 'title.eq.Cake,title.eq.Pie' }], orders: [{ column: 'title' }] });
    assert.deepEqual(titles(res.data), ['Cake', 'Pie']);
  });

  // if (single) { if (result.length === 1) return result[0] }
  it('single: returns the row object when exactly one row matches', async () => {
    const res = await api.query(cook, { table: 'recipes', filters: [...mine(), { column: 'title', op: 'eq', value: 'Pie' }], single: 'single' });
    assert.equal(res.data.title, 'Pie');
  });

  // if (single): 0 rows and single !== 'maybe' -> throw 406
  it('single: 406 PGRST116 when no row matches', async () => {
    const res = await api.query(cook, { table: 'recipes', filters: [{ column: 'title', op: 'eq', value: 'Nope' }], single: 'single' });
    assert.equal(res.status, 406);
    assert.equal(res.error.code, 'PGRST116');
    assert.equal(res.error.message, 'JSON object requested, 0 rows returned');
  });

  // if (result.length === 0 && single === 'maybe') return null
  it('maybeSingle: null when no row matches', async () => {
    const res = await api.query(cook, { table: 'recipes', filters: [{ column: 'title', op: 'eq', value: 'Nope' }], single: 'maybe' });
    assert.equal(res.status, 200);
    assert.equal(res.data, null);
  });

  // if (single): several rows -> throw 406 for both modes
  it('single and maybeSingle: 406 when several rows match', async () => {
    for (const single of ['single', 'maybe']) {
      const res = await api.query(cook, { table: 'recipes', filters: mine(), single });
      assert.equal(res.status, 406);
      assert.equal(res.error.message, 'JSON object requested, 3 rows returned');
    }
  });

  // selectWhere -> buildWhere: if (readRules[table]) adds the messages rule;
  // insert: canWrite.messages requires group membership
  it('only shows chat messages of groups the user belongs to', async () => {
    const group = (await api.query(cook, { table: 'groups', action: 'insert', returning: true, payload: { name: 'Bakers', created_by: cook.id } })).data[0];
    await api.query(cook, { table: 'group_members', action: 'insert', payload: { group_id: group.id, user_id: cook.id } });
    const posted = await api.query(cook, { table: 'messages', action: 'insert', returning: true, payload: { group_id: group.id, author_id: cook.id, content: 'Hi' } });
    assert.equal(posted.status, 200);

    const asMember = await api.query(cook, { table: 'messages', filters: [{ column: 'group_id', op: 'eq', value: group.id }] });
    assert.equal(asMember.data.length, 1);
    const asOutsider = await api.query(ben, { table: 'messages', filters: [{ column: 'group_id', op: 'eq', value: group.id }] });
    assert.deepEqual(asOutsider.data, []);
    const outsiderPost = await api.query(ben, { table: 'messages', action: 'insert', payload: { group_id: group.id, author_id: ben.id, content: 'Let me in' } });
    assert.equal(outsiderPost.status, 403);
  });
});

// runQuery -> selectWhere -> buildWhere -> condition(): every case of switch (op)
describe('runQuery: filter operators', () => {
  let taster;

  before(async () => {
    taster = await api.signUp('taster');
    await api.query(taster, {
      table: 'stories', action: 'insert',
      payload: [
        { user_id: taster.id, title: 'Apple pie', likes: 1, image: 'a.jpg' },
        { user_id: taster.id, title: 'apple tart', likes: 2 },
        { user_id: taster.id, title: 'Banana bread', likes: 3 },
        { user_id: taster.id, title: 'Star*', likes: 4 },
        { user_id: taster.id, title: 'Starfruit', likes: 5 },
      ],
    });
  });

  const where = async (column, op, value) => {
    const res = await api.query(taster, {
      table: 'stories', orders: [{ column: 'likes' }],
      filters: [{ column: 'user_id', op: 'eq', value: taster.id }, { column, op, value }],
    });
    assert.equal(res.status, 200, JSON.stringify(res.error));
    return titles(res.data);
  };

  // case 'eq', case 'neq'
  it('eq / neq', async () => {
    assert.deepEqual(await where('likes', 'eq', 2), ['apple tart']);
    assert.deepEqual(await where('likes', 'neq', 2), ['Apple pie', 'Banana bread', 'Star*', 'Starfruit']);
  });

  // case 'gt', 'gte', 'lt', 'lte'
  it('gt / gte / lt / lte', async () => {
    assert.deepEqual(await where('likes', 'gt', 4), ['Starfruit']);
    assert.deepEqual(await where('likes', 'gte', 4), ['Star*', 'Starfruit']);
    assert.deepEqual(await where('likes', 'lt', 2), ['Apple pie']);
    assert.deepEqual(await where('likes', 'lte', 2), ['Apple pie', 'apple tart']);
  });

  // case 'like' -> likeToGlob (% -> *, _ -> ?, [*?[\]] escaped)
  it('like is case-sensitive, supports % and _ and treats glob characters literally', async () => {
    assert.deepEqual(await where('title', 'like', 'Apple%'), ['Apple pie']);
    assert.deepEqual(await where('title', 'like', 'Banana_bread'), ['Banana bread']);
    assert.deepEqual(await where('title', 'like', 'Star*'), ['Star*']);
  });

  // case 'ilike'
  it('ilike is case-insensitive', async () => {
    assert.deepEqual(await where('title', 'ilike', 'apple%'), ['Apple pie', 'apple tart']);
  });

  // case 'is': v === null || v === 'null' -> IS NULL; v === 'true' ? 1 : v === 'false' ? 0 : v
  it('is: null, "null", "true", "false" and plain values', async () => {
    assert.deepEqual(await where('image', 'is', null), ['apple tart', 'Banana bread', 'Star*', 'Starfruit']);
    assert.deepEqual(await where('image', 'is', 'null'), ['apple tart', 'Banana bread', 'Star*', 'Starfruit']);
    assert.deepEqual(await where('likes', 'is', 'true'), ['Apple pie']);
    assert.deepEqual(await where('likes', 'is', 'false'), []);
    assert.deepEqual(await where('likes', 'is', 3), ['Banana bread']);
  });

  // typeof value === 'boolean' ? (value ? 1 : 0) : value
  it('converts boolean values to 1 and 0', async () => {
    assert.deepEqual(await where('likes', 'eq', true), ['Apple pie']);
    assert.deepEqual(await where('likes', 'eq', false), []);
  });

  // case 'in': Array.isArray(v) ? v : []; if (list.length === 0) -> clause '0'
  it('in: list, empty list and a value that is not a list', async () => {
    assert.deepEqual(await where('likes', 'in', [1, 3]), ['Apple pie', 'Banana bread']);
    assert.deepEqual(await where('likes', 'in', []), []);
    assert.deepEqual(await where('likes', 'in', 'not a list'), []);
  });

  // default: throw 400; checkColumn(table, column) -> 400
  it('rejects an unsupported operator and an unknown column', async () => {
    const op = await api.query(taster, { table: 'stories', filters: [{ column: 'likes', op: 'between', value: 1 }] });
    assert.equal(op.status, 400);
    assert.equal(op.error.message, 'Unsupported filter "between"');
    const col = await api.query(taster, { table: 'stories', filters: [{ column: 'nope', op: 'eq', value: 1 }] });
    assert.equal(col.status, 400);
    assert.equal(col.error.code, '42703');
  });
});
