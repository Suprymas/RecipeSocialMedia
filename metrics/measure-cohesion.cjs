// Cohesion of each file, in the spirit of Tight Class Cohesion (TCC):
// the share of function pairs in a file that use at least one common outer variable.
// 1 = every pair of functions shares state or dependencies, 0 = no pair does.
//   node metrics/measure-cohesion.cjs [files or folders...]
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const root = process.cwd();
const DEFAULT_TARGETS = ["App.js", "screens", "components", "services", "server/index.js"];
const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TARGETS;
const SKIP_DIRS = new Set(["node_modules", "data"]);
const results = [];

function analyzeFile(file) {
  const code = fs.readFileSync(file, "utf8");
  const ast = parser.parse(code, {
    sourceType: "unambiguous",
    plugins: ["jsx", "typescript"]
  });

  const functions = [];

  traverse(ast, {
    Function(path) {
      // Only analyze named functions and functions assigned to variables.
      const parent = path.parentPath;
      const name =
        path.node.id?.name ||
        (parent.isVariableDeclarator() && parent.node.id.name) ||
        (parent.isObjectProperty() && parent.node.key.name);

      if (!name) return;

      const references = new Set();

      path.traverse({
        ReferencedIdentifier(p) {
          const binding = p.scope.getBinding(p.node.name);

          // Count only variables defined outside this function.
          if (
            binding &&
            !binding.path.findParent(ancestor => ancestor === path) &&
            binding.path !== path
          ) {
            references.add(p.node.name);
          }
        }
      });

      functions.push({ name, references });
    }
  });

  if (functions.length < 2) return null;

  let connected = 0;
  const total = functions.length * (functions.length - 1) / 2;

  for (let i = 0; i < functions.length; i++) {
    for (let j = i + 1; j < functions.length; j++) {
      const shared = [...functions[i].references].some(ref =>
        functions[j].references.has(ref)
      );

      if (shared) connected++;
    }
  }

  return {
    file: path.relative(root, file),
    functions: functions.length,
    connected,
    total,
    cohesion: Number((connected / total).toFixed(3))
  };
}

function scan(directory) {
  if (!fs.existsSync(directory)) return;

  if (fs.statSync(directory).isFile()) {
    analyze(directory);
    return;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) scan(fullPath);
    } else if (/\.[jt]sx?$/.test(entry.name)) {
      analyze(fullPath);
    }
  }
}

function analyze(file) {
  try {
    const result = analyzeFile(file);
    if (result) results.push(result);
  } catch (error) {
    console.error(`Failed: ${file}: ${error.message}`);
  }
}

targets.forEach(target => scan(path.join(root, target)));

results.sort((a, b) => a.cohesion - b.cohesion);

console.table(results.map(r => ({
  File: r.file,
  Functions: r.functions,
  "Connected pairs": `${r.connected}/${r.total}`,
  Cohesion: r.cohesion
})));

if (results.length) {
  const average = results.reduce((sum, r) => sum + r.cohesion, 0) / results.length;
  console.log(`Average cohesion: ${average.toFixed(3)}`);
}
