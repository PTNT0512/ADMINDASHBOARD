const { execSync } = require('child_process');

const ports = process.argv
  .slice(2)
  .map((value) => Number(value))
  .filter((value) => Number.isInteger(value) && value > 0 && value < 65536);

if (!ports.length) {
  process.exit(0);
}

const isWin = process.platform === 'win32';
const killed = new Set();

const getPidsForPortWin = (port) => {
  try {
    const cmd = `netstat -ano -p tcp | findstr LISTENING | findstr :${port}`;
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/).pop())
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch (_) {
    return [];
  }
};

const getPidsForPortUnix = (port) => {
  try {
    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch (_) {
    return [];
  }
};

const killPid = (pid) => {
  if (killed.has(pid)) return;
  try {
    if (isWin) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    killed.add(pid);
    console.log(`[kill-dev-ports] killed pid ${pid}`);
  } catch (_) {
    // Ignore failures (process may already exit).
  }
};

for (const port of ports) {
  const pids = isWin ? getPidsForPortWin(port) : getPidsForPortUnix(port);
  for (const pid of pids) {
    killPid(pid);
  }
}
