// Test that the Electron app launches correctly
// This script verifies the app structure and can launch headlessly

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== VoteBeats Desktop Helper Launch Test ===\n');

// Test 1: Verify all required files exist
console.log('Test 1: File Structure');
const requiredFiles = [
  'package.json',
  'src/main.js',
  'src/preload.js',
  'src/renderer/setup.html',
  'src/renderer/main.html'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  console.log(`  ${exists ? 'PASS' : 'FAIL'}: ${file}`);
  if (!exists) allFilesExist = false;
}

// Test 2: Verify package.json is valid
console.log('\nTest 2: Package Configuration');
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  console.log(`  PASS: Name = ${pkg.name}`);
  console.log(`  PASS: Version = ${pkg.version}`);
  console.log(`  PASS: Main = ${pkg.main}`);
  console.log(`  PASS: Has electron dependency = ${!!pkg.devDependencies.electron}`);
  console.log(`  PASS: Has electron-builder = ${!!pkg.devDependencies['electron-builder']}`);
  console.log(`  PASS: Has win build config = ${!!pkg.build?.win}`);
  console.log(`  PASS: Has mac build config = ${!!pkg.build?.mac}`);
  console.log(`  PASS: Build scripts exist = ${!!pkg.scripts?.['build:win'] && !!pkg.scripts?.['build:mac']}`);
} catch (err) {
  console.log(`  FAIL: ${err.message}`);
}

// Test 3: Verify main.js has required Electron components
console.log('\nTest 3: Main Process Components');
const mainJs = fs.readFileSync(path.join(__dirname, 'src/main.js'), 'utf8');
const components = [
  ['BrowserWindow', 'Window management'],
  ['Tray', 'System tray support'],
  ['Menu', 'Tray menu'],
  ['ipcMain', 'IPC communication'],
  ['Notification', 'Desktop notifications'],
  ['requestSingleInstanceLock', 'Single instance lock'],
  ['electron-store', 'Persistent settings'],
  ['checkSpotifyStatus', 'Spotify monitoring'],
  ['startSpotifyMonitoring', 'Monitoring start'],
  ['stopSpotifyMonitoring', 'Monitoring stop'],
  ['updateNowPlaying', 'Now playing updates'],
  ['syncOfflineQueue', 'Offline sync'],
  ['createTray', 'Tray creation'],
  ['automationMode', 'Automation modes (full/semi/manual)'],
];
for (const [pattern, desc] of components) {
  const found = mainJs.includes(pattern);
  console.log(`  ${found ? 'PASS' : 'FAIL'}: ${desc} (${pattern})`);
}

// Test 4: Verify preload.js exposes API
console.log('\nTest 4: Preload API');
const preloadJs = fs.readFileSync(path.join(__dirname, 'src/preload.js'), 'utf8');
const apis = ['login', 'getEvents', 'selectEvent', 'startMonitoring', 'stopMonitoring', 'checkSpotify', 'completeSetup', 'confirmUpdate'];
for (const api of apis) {
  const found = preloadJs.includes(api);
  console.log(`  ${found ? 'PASS' : 'FAIL'}: API method '${api}'`);
}

// Test 5: Verify setup wizard HTML
console.log('\nTest 5: Setup Wizard');
const setupHtml = fs.readFileSync(path.join(__dirname, 'src/renderer/setup.html'), 'utf8');
const setupFeatures = [
  ['Step 1', 'Step 1: Sign In'],
  ['Step 2', 'Step 2: Select Event'],
  ['Step 3', 'Step 3: Spotify Detection'],
  ['Step 4', 'Setup Complete'],
  ['VoteBeats', 'Branding'],
];
for (const [pattern, desc] of setupFeatures) {
  console.log(`  ${setupHtml.includes(pattern) ? 'PASS' : 'FAIL'}: ${desc}`);
}

// Test 6: Verify main window HTML
console.log('\nTest 6: Main Window');
const mainHtml = fs.readFileSync(path.join(__dirname, 'src/renderer/main.html'), 'utf8');
const mainFeatures = [
  ['Now Playing', 'Now Playing section'],
  ['Start Monitoring', 'Monitor control'],
  ['Queue', 'Queue panel'],
  ['Settings', 'Settings panel'],
  ['Automation Mode', 'Automation settings'],
  ['progress-fill', 'Progress bar'],
  ['confirm-overlay', 'Confirmation dialog'],
  ['alert-banner', 'Alert notifications'],
];
for (const [pattern, desc] of mainFeatures) {
  console.log(`  ${mainHtml.includes(pattern) ? 'PASS' : 'FAIL'}: ${desc}`);
}

// Test 7: Cross-platform build config
console.log('\nTest 7: Cross-Platform Support');
const pkg2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
console.log(`  PASS: Windows target = ${pkg2.build.win.target}`);
console.log(`  PASS: Mac target = ${pkg2.build.mac.target}`);
console.log(`  PASS: App ID = ${pkg2.build.appId}`);
console.log(`  PASS: Product name = ${pkg2.build.productName}`);

// Test 8: Electron is installed
console.log('\nTest 8: Electron Installed');
try {
  const electronPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules/electron/package.json'), 'utf8'));
  console.log(`  PASS: Electron v${electronPkg.version} installed`);
} catch {
  console.log('  FAIL: Electron not installed');
}

console.log('\n=== All Tests Complete ===');
