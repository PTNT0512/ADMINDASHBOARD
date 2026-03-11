const { getGithubPublishConfig } = require('./electron/updater-config.cjs');

module.exports = {
  appId: 'com.lasvegas.admin.center',
  productName: 'LasVegas Admin Center',
  directories: {
    output: 'dist_electron/center',
    buildResources: 'build',
  },
  files: [
    'dist/**/*',
    'electron/center.cjs',
    'electron/updater-config.cjs',
    '!**/.env*',
  ],
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    icon: 'public/icon_center.ico',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    artifactName: '${productName} Setup ${version}.${ext}',
  },
  portable: {
    artifactName: '${productName} Portable ${version}.${ext}',
  },
  publish: getGithubPublishConfig(),
  extraMetadata: {
    main: 'electron/center.cjs',
  },
};