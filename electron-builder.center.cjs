module.exports = {
  appId: "com.lasvegas.admin.center",
  productName: "LasVegas Admin Center",
  directories: {
    output: "dist_electron/center",
    buildResources: "build"
  },
  files: [
    "dist/**/*",
    "src/electron.js",
    "!**/.env*"
  ],
  win: {
    target: "portable",
    icon: "public/icon_center.ico"
  },
  extraMetadata: {
    main: "src/electron.js"
  }
};