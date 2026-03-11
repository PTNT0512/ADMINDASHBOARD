require('dotenv').config();

const { execFileSync } = require('child_process');
const packageJson = require('../package.json');
const { resolveGithubConfig } = require('../electron/updater-config.cjs');

const args = process.argv.slice(2);

const hasFlag = (name) => args.includes(`--${name}`);

const readArg = (name) => {
  const prefix = `--${name}=`;
  const hit = args.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : '';
};

const toText = (value) => String(value || '').trim();

const getCurrentBranch = () => {
  try {
    const branch = execFileSync('git', ['branch', '--show-current'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return branch && branch !== 'HEAD' ? branch : '';
  } catch {
    return '';
  }
};

const parseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const githubConfig = resolveGithubConfig();
if (!githubConfig || !githubConfig.owner || !githubConfig.repo) {
  throw new Error('Khong xac dinh duoc GitHub repository cho updater.');
}

const token = toText(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
if (!token) {
  throw new Error('Thieu GH_TOKEN/GITHUB_TOKEN. Script nay tu dong doc .env, hoac ban co the set env truoc khi chay.');
}

const version = toText(readArg('version') || packageJson.version);
if (!version) {
  throw new Error('Khong doc duoc version tu package.json.');
}

const tagName = toText(readArg('tag') || `v${version}`);
const releaseName = toText(readArg('name') || tagName);
const body = toText(readArg('notes'));
const targetCommitish = toText(readArg('target') || getCurrentBranch());
const dryRun = hasFlag('dry-run');
const useGeneratedNotes = !body || hasFlag('generate-notes');

const apiBaseUrl = `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}`;

const githubRequest = async (method, pathname, payload) => {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'admin-app-dashboard-web-release-publisher',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const raw = await response.text();
  const data = parseJson(raw);

  if (!response.ok) {
    const details = toText(data && (data.message || data.error || raw));
    const suffix = details ? `: ${details}` : '';
    const error = new Error(`GitHub API HTTP ${response.status}${suffix}`);
    error.status = response.status;
    throw error;
  }

  return data;
};

const releasePayload = {
  tag_name: tagName,
  name: releaseName,
  draft: false,
  prerelease: false,
  generate_release_notes: useGeneratedNotes,
};

if (targetCommitish) {
  releasePayload.target_commitish = targetCommitish;
}

if (body && !useGeneratedNotes) {
  releasePayload.body = body;
}

(async () => {
  console.log(`[web-release] repo: ${githubConfig.owner}/${githubConfig.repo}`);
  console.log(`[web-release] tag: ${tagName}`);
  console.log(`[web-release] target: ${targetCommitish || '(default branch)'}`);

  if (dryRun) {
    console.log('[web-release] dry-run payload:');
    console.log(JSON.stringify(releasePayload, null, 2));
    return;
  }

  try {
    const existing = await githubRequest('GET', `/releases/tags/${encodeURIComponent(tagName)}`);
    console.log(`[web-release] Release da ton tai: ${existing.html_url}`);
    return;
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
  }

  let created;
  try {
    created = await githubRequest('POST', '/releases', releasePayload);
  } catch (error) {
    if (error.status === 500 && releasePayload.target_commitish) {
      const fallbackPayload = { ...releasePayload };
      delete fallbackPayload.target_commitish;
      console.warn('[web-release] GitHub tu choi target hien tai, thu tao release tren default branch...');
      created = await githubRequest('POST', '/releases', fallbackPayload);
    } else {
      throw error;
    }
  }

  console.log(`[web-release] Da tao release: ${created.html_url}`);
})();
