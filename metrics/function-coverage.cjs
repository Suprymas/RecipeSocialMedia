// Test coverage of single functions (or whole files), read from the lcov reports that
// `npm run test:server` and `npm run test:app` write. The function's line range is found
// in the source with @babel/parser, so the numbers cover exactly that function and the
// functions nested in it.
//   node metrics/function-coverage.cjs [file[:function] ...]
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const LCOV_FILES = ['coverage/server/lcov.info', 'coverage/app/lcov.info'];
const DEFAULT_TARGETS = [
  'server/index.js:runQuery',
  'server/index.js:handle',
  'screens/main/ProfileScreen.js:ProfileScreen',
  'screens/settings/ProfileSettingsScreen.js:handleSave',
];

const normalize = (file) => path.resolve(process.cwd(), file).replace(/\\/g, '/').toLowerCase();

// lcov: SF = source file, DA = line hits, BRDA = branch (line, block, branch, taken or '-')
function readLcov(files) {
  const coverage = new Map();
  for (const lcov of files.filter((f) => fs.existsSync(f))) {
    let current = null;
    for (const line of fs.readFileSync(lcov, 'utf8').split(/\r?\n/)) {
      if (line.startsWith('SF:')) {
        const key = normalize(line.slice(3));
        if (!coverage.has(key)) coverage.set(key, { lines: new Map(), branches: new Map() });
        current = coverage.get(key);
      } else if (line.startsWith('DA:') && current) {
        const [lineNo, hits] = line.slice(3).split(',').map(Number);
        current.lines.set(lineNo, (current.lines.get(lineNo) ?? 0) + hits);
      } else if (line.startsWith('BRDA:') && current) {
        const [lineNo, block, branch, taken] = line.slice(5).split(',');
        const key = `${lineNo},${block},${branch}`;
        const hits = taken === '-' ? 0 : Number(taken);
        current.branches.set(key, { line: Number(lineNo), hits: (current.branches.get(key)?.hits ?? 0) + hits });
      } else if (line === 'end_of_record') {
        current = null;
      }
    }
  }
  return coverage;
}

function functionRange(file, name) {
  const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'unambiguous', plugins: ['jsx'] });
  let range = null;
  traverse(ast, {
    Function(p) {
      const parent = p.parentPath;
      const fnName = p.node.id?.name
        ?? (parent.isVariableDeclarator() ? parent.node.id.name : null)
        ?? (parent.isObjectProperty() || parent.isClassMethod() ? parent.node.key.name : null);
      if (!range && fnName === name) {
        range = { start: p.node.loc.start.line, end: p.node.loc.end.line };
        p.stop();
      }
    },
  });
  return range;
}

const percent = (covered, total) => (total ? `${((covered / total) * 100).toFixed(1)} %` : '–');

const coverage = readLcov(LCOV_FILES);
if (coverage.size === 0) {
  console.error('No coverage found. Run `npm test` first.');
  process.exit(1);
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TARGETS;
const rows = targets.map((target) => {
  const [file, name] = target.split(':');
  const data = coverage.get(normalize(file));
  if (!data) return { Target: target, Lines: 'no coverage data' };
  const range = name ? functionRange(file, name) : { start: 1, end: Infinity };
  if (!range) return { Target: target, Lines: 'function not found' };

  const inRange = (line) => line >= range.start && line <= range.end;
  const lines = [...data.lines].filter(([line]) => inRange(line));
  const coveredLines = lines.filter(([, hits]) => hits > 0);
  const branches = [...data.branches.values()].filter((b) => inRange(b.line));
  const coveredBranches = branches.filter((b) => b.hits > 0);
  const uncovered = lines.filter(([, hits]) => hits === 0).map(([line]) => line);

  return {
    Target: target,
    Lines: `${coveredLines.length}/${lines.length}`,
    'Lines %': percent(coveredLines.length, lines.length),
    Branches: `${coveredBranches.length}/${branches.length}`,
    'Branches %': percent(coveredBranches.length, branches.length),
    'Uncovered lines': uncovered.length ? compact(uncovered) : '',
  };
});

// 3,4,5,9 -> "3-5, 9"
function compact(numbers) {
  const parts = [];
  for (let i = 0; i < numbers.length; i++) {
    let j = i;
    while (j + 1 < numbers.length && numbers[j + 1] === numbers[j] + 1) j++;
    parts.push(i === j ? `${numbers[i]}` : `${numbers[i]}-${numbers[j]}`);
    i = j;
  }
  return parts.join(', ');
}

console.table(rows);
