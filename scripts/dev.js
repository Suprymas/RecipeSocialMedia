// Starts the backend (unless one is already running) and Expo together.
// Extra arguments are passed to `expo start`, e.g. `npm run dev -- --localhost`.

const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const port = process.env.PORT || 4000;

const backendRunning = async () => {
  try {
    return (await fetch(`http://127.0.0.1:${port}/health`)).ok;
  } catch {
    return false;
  }
};

(async () => {
  let server = null;
  if (await backendRunning()) {
    console.log(`Backend already running on port ${port}`);
  } else {
    // Only errors are shown so the output doesn't fight with Expo's terminal UI
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(root, 'server'),
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    server.on('exit', (code) => {
      if (code) console.error(`\nBackend stopped (exit code ${code}). Run "npm run server" to see why.`);
    });
    console.log(`Backend starting on port ${port}`);
  }

  const expo = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start', ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit',
  });
  expo.on('exit', (code) => {
    server?.kill();
    process.exit(code ?? 0);
  });
})();
