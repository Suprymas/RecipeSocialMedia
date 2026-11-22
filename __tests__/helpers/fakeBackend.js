// Stand-in for backend.from(table): a chainable query that records what the screen asked for
// and resolves to whatever respond(query) returns (a value or a promise).
export function fakeFrom(respond) {
  const queries = [];

  const from = (table) => {
    const query = { table, action: 'select', filters: [], orders: [] };
    queries.push(query);
    const chain = {
      select: (columns) => { query.columns = columns; return chain; },
      insert: (payload) => { query.action = 'insert'; query.payload = payload; return chain; },
      update: (payload) => { query.action = 'update'; query.payload = payload; return chain; },
      eq: (column, value) => { query.filters.push({ column, op: 'eq', value }); return chain; },
      order: (column, options) => { query.orders.push({ column, ...options }); return chain; },
      single: () => { query.single = true; return chain; },
      then: (resolve, reject) => Promise.resolve().then(() => respond(query)).then(resolve, reject),
    };
    return chain;
  };

  return { from, queries };
}

// A promise that never settles, to look at loading states
export const pending = () => new Promise(() => {});
