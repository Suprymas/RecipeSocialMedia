// Runs ESLint with metrics/complexity.config.js and prints one row per function:
// cyclomatic, cognitive, file:line. The numbers come straight from ESLint's messages.
//   node metrics/complexity-table.js [files...] [--min N]

const path = require('node:path');
const { ESLint } = require('eslint');

const DEFAULT_FILES = ['App.js', 'screens', 'services', 'server/index.js'];

const args = process.argv.slice(2);
const minIndex = args.indexOf('--min');
const min = minIndex === -1 ? 0 : Number(args.splice(minIndex, 2)[1]);
const files = args.length ? args : DEFAULT_FILES;

(async () => {
  const eslint = new ESLint({
    overrideConfigFile: path.join(__dirname, 'complexity.config.js'),
  });
  const results = await eslint.lintFiles(files);

  const rows = [];
  for (const { filePath, messages } of results) {
    const file = path.relative(process.cwd(), filePath);
    // Both rules report at the function's start, so they meet on line:column
    const byPos = new Map();
    const at = (m) => {
      const key = `${m.line}:${m.column}`;
      if (!byPos.has(key)) byPos.set(key, { file, line: m.line });
      return byPos.get(key);
    };
    for (const m of messages) {
      if (m.ruleId === 'complexity') at(m).cyclomatic = Number(m.message.match(/complexity of (\d+)/)[1]);
      if (m.ruleId === 'sonarjs/cognitive-complexity') {
        // sonarjs points at the function name, which can be on a later column than ESLint's start
        const row = [...byPos.values()].find((r) => r.line === m.line && r.cognitive == null) ?? at(m);
        row.cognitive = Number(m.message.match(/from (\d+)/)[1]);
      }
    }
    rows.push(...[...byPos.values()].filter((r) => r.cyclomatic != null));
  }

  rows.sort((a, b) => b.cyclomatic - a.cyclomatic || (b.cognitive ?? 0) - (a.cognitive ?? 0));
  const shown = rows.filter((r) => r.cyclomatic >= min);

  console.log('Cyclomatic  Cognitive  Location');
  for (const r of shown) {
    console.log(`${String(r.cyclomatic).padStart(10)}  ${String(r.cognitive ?? 0).padStart(9)}  ${r.file}:${r.line}`);
  }
  console.log(`\n${shown.length} of ${rows.length} functions shown`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
