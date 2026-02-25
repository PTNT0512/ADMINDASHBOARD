module.exports = {
  appId: "com.lasvegas.admin.dashboard",
  productName: "LasVegas Admin Dashboard",
  directories: {
    output: "dist_electron/dashboard",
    buildResources: "build"
  },
  files: [
    "dist/**/*",
    "electron/**/*",
    "src/**/*",
    "!**/.env*"
  ],
  win: {
    target: "portable",
    icon: "public/icon_dashboard.ico"
  },
  extraMetadata: {
    main: "electron/dashboard.cjs"
  }
};