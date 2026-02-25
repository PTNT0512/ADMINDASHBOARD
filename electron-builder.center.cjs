module.exports = {
  appId: "com.lasvegas.admin.center",
  productName: "LasVegas Admin Center",
  directories: {
    output: "dist_electron/center",
    buildResources: "build"
  },
  files: [
    "dist/**/*",
    "electron/center.cjs",
    "!**/.env*"
  ],
  win: {
    target: "portable",
    icon: "public/icon_center.ico"
  },
  extraMetadata: {
    main: "electron/center.cjs"
  }
};