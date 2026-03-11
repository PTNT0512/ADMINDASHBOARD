const { execSync, spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const readArg = (name) => {
  const prefix = `--${name}=`;
  const hit = args.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : '';
};

const commitMessage = readArg('message') || process.env.npm_config_message || 'Update code';
const branchArg = readArg('branch') || process.env.npm_config_branch || '';

const run = (command) => execSync(command, {
  cwd: projectRoot,
  stdio: 'inherit',
  encoding: 'utf8',
});

const runCapture = (command) => execSync(command, {
  cwd: projectRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
}).trim();

const branch = branchArg || runCapture('git rev-parse --abbrev-ref HEAD');

run('git add .');

const status = runCapture('git status --porcelain');
if (!status) {
  console.log('[git-push] Khong co thay doi de commit.');
} else {
  const commit = spawnSync('git', ['commit', '-m', commitMessage], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (commit.status !== 0) {
    process.exit(typeof commit.status === 'number' ? commit.status : 1);
  }
}

const push = spawnSync('git', ['push', 'origin', branch], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(typeof push.status === 'number' ? push.status : 1);