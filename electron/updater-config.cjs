const packageJson = require('../package.json');

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (/^(1|true|yes|on)$/i.test(value.trim())) return true;
    if (/^(0|false|no|off)$/i.test(value.trim())) return false;
  }
  return fallback;
};

const cleanText = (value) => String(value || '').trim();

const parseGithubRepository = (input) => {
  const raw = cleanText(input)
    .replace(/^git\+/, '')
    .replace(/\.git$/i, '');

  const match = raw.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/#?]+)/i);
  if (!match || !match.groups) return null;

  return {
    owner: cleanText(match.groups.owner),
    repo: cleanText(match.groups.repo),
  };
};

const resolveGithubConfig = () => {
  const explicitOwner = cleanText(process.env.UPDATER_GITHUB_OWNER);
  const explicitRepo = cleanText(process.env.UPDATER_GITHUB_REPO);
  const releaseType = cleanText(process.env.UPDATER_GITHUB_RELEASE_TYPE) || 'release';
  const isPrivate = toBool(process.env.UPDATER_GITHUB_PRIVATE, false);
  const token = cleanText(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);

  let repoInfo = null;
  if (explicitOwner && explicitRepo) {
    repoInfo = { owner: explicitOwner, repo: explicitRepo };
  } else {
    repoInfo = parseGithubRepository(process.env.UPDATER_GITHUB_REPOSITORY || packageJson.repository?.url || packageJson.homepage || '');
  }

  if (!repoInfo || !repoInfo.owner || !repoInfo.repo) {
    return null;
  }

  return {
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    private: isPrivate,
    releaseType,
    token,
  };
};

const getGithubPublishConfig = () => {
  const config = resolveGithubConfig();
  if (!config) return [];

  const publish = {
    provider: 'github',
    owner: config.owner,
    repo: config.repo,
    releaseType: config.releaseType,
  };

  if (config.private) publish.private = true;
  return [publish];
};

const getGithubFeedConfig = () => {
  const config = resolveGithubConfig();
  if (!config) return null;

  const feed = {
    provider: 'github',
    owner: config.owner,
    repo: config.repo,
    releaseType: config.releaseType,
  };

  if (config.private) feed.private = true;
  if (config.token) feed.token = config.token;
  return feed;
};

const getReleasePageUrl = () => {
  const config = resolveGithubConfig();
  if (config) {
    return `https://github.com/${config.owner}/${config.repo}/releases`;
  }
  return 'https://github.com';
};

module.exports = {
  resolveGithubConfig,
  getGithubPublishConfig,
  getGithubFeedConfig,
  getReleasePageUrl,
};