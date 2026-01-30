const { execSync } = require('child_process');
try {
  const result = execSync('netstat -ano | findstr :3002 | findstr LISTENING', { encoding: 'utf8' });
  const lines = result.trim().split('\n');
  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  }
  for (const pid of pids) {
    console.log('Killing PID:', pid);
    try { execSync(`taskkill /F /PID ${pid}`); console.log('Killed', pid); } catch(e) { console.log('Failed:', e.stderr?.toString() || e.message); }
  }
} catch(e) {
  console.log('No process on port 3002');
}
