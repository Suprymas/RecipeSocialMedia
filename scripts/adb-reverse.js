// Forwards the Metro (8081) and backend (4000) ports from an Android
// emulator/USB device to this machine, so the app can use 127.0.0.1.
// The forwards are lost whenever the emulator restarts.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
const sdkDirs = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(os.homedir(), 'Android', 'Sdk'),
  path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
].filter(Boolean);

const candidates = [
  'adb', // on PATH
  ...sdkDirs.map((dir) => path.join(dir, 'platform-tools', exe)),
  path.join(os.homedir(), 'platform-tools', exe),
];

const adb = candidates.find((c) => (c === 'adb' ? spawnSync(c, ['version']).status === 0 : fs.existsSync(c)));
if (!adb) {
  console.error('Could not find adb. Install Android platform-tools and add it to PATH or set ANDROID_HOME.');
  process.exit(1);
}

for (const port of [8081, process.env.PORT || 4000]) {
  const result = spawnSync(adb, ['reverse', `tcp:${port}`, `tcp:${port}`], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`adb reverse failed for port ${port}: ${(result.stderr || '').trim()}`);
    console.error('Is the emulator running or the device connected? Check with "adb devices".');
    process.exit(1);
  }
}
console.log('Forwarded ports 8081 and 4000 to the Android device');
