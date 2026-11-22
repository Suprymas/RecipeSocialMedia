// Coupling between modules, measured with madge.
// Prints fan-in / fan-out of every local module, the number of import edges and cycles.
//   node metrics/coupling.cjs [files or folders...]
// fan-out = how many local modules this module imports
// fan-in  = how many local modules import this module

const madge = require('madge');

// Same scope as the complexity and static analysis commands (server/index.js is not imported by the app)
const DEFAULT_ENTRIES = ['index.js', 'App.js', 'components', 'screens', 'services', 'server/index.js'];
const entries = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ENTRIES;

(async () => {
  const res = await madge(entries, { baseDir: process.cwd(), fileExtensions: ['js'], excludeRegExp: [/node_modules/] });
  const graph = res.obj();
  const modules = Object.keys(graph).sort();
  const fanIn = Object.fromEntries(modules.map((m) => [m, 0]));
  for (const deps of Object.values(graph)) deps.forEach((d) => { fanIn[d] = (fanIn[d] ?? 0) + 1; });

  const rows = modules
    .map((m) => ({ Module: m, 'Fan-in': fanIn[m], 'Fan-out': graph[m].length }))
    .sort((a, b) => b['Fan-in'] + b['Fan-out'] - (a['Fan-in'] + a['Fan-out']) || a.Module.localeCompare(b.Module));
  console.table(rows);

  const edges = Object.values(graph).reduce((n, deps) => n + deps.length, 0);
  console.log(`Modules: ${modules.length}  Import edges: ${edges}  Circular dependencies: ${res.circular().length}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
