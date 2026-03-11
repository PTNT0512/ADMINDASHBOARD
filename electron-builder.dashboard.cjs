const { getGithubPublishConfig } = require('./electron/updater-config.cjs');

module.exports = {
  appId: 'com.lasvegas.admin.dashboard',
  productName: 'LasVegas Admin Dashboard',
  directories: {
    output: 'dist_electron/dashboard',
    buildResources: 'build'
  },
  files: [
    'dist/**/*',
    'electron/**/*',
    'src/**/*',
    'webgame/dist/**/*',
    'cskh-app/dist/**/*',
    'landing/dist/**/*',
    '!**/.env*'
  ],
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] }
    ],
    icon: 'public/icon_dashboard.ico',
    executableName: 'admin-app'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    artifactName: '${productName} Setup ${version}.${ext}'
  },
  portable: {
    artifactName: '${productName} Portable ${version}.${ext}'
  },
  publish: getGithubPublishConfig(),
  extraMetadata: {
    main: 'electron/dashboard.cjs'
  }
};