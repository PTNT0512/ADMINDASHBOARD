'use strict';

const path = require('path');
const fs = require('fs');

const URL_BUNDLE = 'https://play.hit3s.fun/assets';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeTextFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function safeReadDir(dirPath) {
  try {
    return fs.readdirSync(dirPath);
  } catch (error) {
    Editor.warn('[Tool-Build-Update] cannot read dir:', dirPath, error.message || error);
    return [];
  }
}

function collectBundleVersionData(assetsDir) {
  const versionData = {};
  const bundleFolders = safeReadDir(assetsDir);

  bundleFolders.forEach((bundleName) => {
    const bundleDir = path.join(assetsDir, bundleName);
    let status = null;
    try {
      status = fs.statSync(bundleDir);
    } catch (error) {
      return;
    }
    if (!status.isDirectory()) return;

    const files = safeReadDir(bundleDir);
    const indexFile = files.find((file) => file.startsWith('index.') && file.endsWith('.js'));
    if (!indexFile) return;

    const matched = indexFile.match(/^index\.([a-z0-9]{5})/i);
    if (!matched) return;

    versionData[bundleName] = {
      hash: matched[1],
      url: `${URL_BUNDLE}/${bundleName}`
    };
  });

  return versionData;
}

function writeAssetBundleVersion(assetsDir) {
  if (!fs.existsSync(assetsDir)) {
    Editor.warn('[Tool-Build-Update] assets dir not found:', assetsDir);
    return;
  }

  const versionData = collectBundleVersionData(assetsDir);
  const outputPath = path.join(assetsDir, 'AssetBundleVersion.json');
  const output = JSON.stringify(versionData).replace(/\\/g, '/');
  writeTextFile(outputPath, output);
  Editor.log('[Tool-Build-Update] Generate AssetBundleVersion.json success:', outputPath);
}

function createRouteIndex(webRoot, routeName, query, title) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1,minimum-scale=1,maximum-scale=1">
  <title>${title}</title>
  <script>
    (function () {
      window.location.replace("../?game=${query}");
    })();
  </script>
</head>
<body></body>
</html>
`;
  writeTextFile(path.join(webRoot, routeName, 'index.html'), html);
}

function createDevLauncher(webRoot) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1,minimum-scale=1,maximum-scale=1">
  <title>Game Dev Launcher</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: radial-gradient(circle at 20% 20%, #2f80ed 0%, #132b4b 42%, #0b1628 100%);
      color: #f3f6ff;
      padding: 24px;
    }
    .card {
      width: min(520px, 100%);
      background: rgba(6, 12, 22, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      padding: 24px;
      backdrop-filter: blur(6px);
    }
    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.2; }
    p { margin: 0 0 18px; opacity: 0.9; }
    .actions { display: grid; gap: 12px; }
    .btn {
      display: block;
      text-align: center;
      text-decoration: none;
      font-weight: 700;
      padding: 14px 16px;
      border-radius: 12px;
      color: #0d1726;
      background: linear-gradient(135deg, #ffd166 0%, #fca311 100%);
      transition: transform .15s ease, filter .15s ease;
    }
    .btn.md5 { background: linear-gradient(135deg, #8be9fd 0%, #5fa8ff 100%); }
    .btn:hover { transform: translateY(-1px); filter: brightness(1.02); }
  </style>
</head>
<body>
  <main class="card">
    <h1>Dev Launcher</h1>
    <p>Chon game de mo truc tiep che do dev offline.</p>
    <div class="actions">
      <a class="btn" href="../taixiudouble/">TaiXiuDouble</a>
      <a class="btn md5" href="../taixiumd5/">TaiXiuMD5</a>
    </div>
  </main>
</body>
</html>
`;
  writeTextFile(path.join(webRoot, 'dev', 'index.html'), html);
}

function createWebRoutes(buildRoot) {
  createRouteIndex(buildRoot, 'taixiudouble', 'double', 'TaiXiuDouble');
  createRouteIndex(buildRoot, 'taixiumd5', 'md5', 'TaiXiuMD5');
  createDevLauncher(buildRoot);
  Editor.log('[Tool-Build-Update] Created routes: /taixiudouble, /taixiumd5, /dev');
}

function patchWebMainBoot(buildRoot) {
  const entries = safeReadDir(buildRoot);
  const mainFile = entries.find((name) => /^main\.[a-z0-9]+\.js$/i.test(name));
  if (!mainFile) {
    Editor.warn('[Tool-Build-Update] main.*.js not found in:', buildRoot);
    return;
  }

  const mainPath = path.join(buildRoot, mainFile);
  let content = '';
  try {
    content = fs.readFileSync(mainPath, 'utf8');
  } catch (error) {
    Editor.warn('[Tool-Build-Update] cannot read boot file:', mainPath, error.message || error);
    return;
  }

  if (content.includes('[boot] Cannot load launch bundle:')) {
    return;
  }

  const launchBlockRegex = /        var launchScene = settings\.launchScene;[\s\S]*?        bundle\.loadScene\(launchScene, null, onProgress,[\s\S]*?        \);\r?\n/;
  if (!launchBlockRegex.test(content)) {
    Editor.warn('[Tool-Build-Update] launch scene block not found in:', mainPath);
    return;
  }

  const patchedBlock = `        var launchScene = settings.launchScene;
        var sceneFromQuery = "";
        if (typeof window !== "undefined" && window.location) {
            var query = (window.location.search || "").toLowerCase();
            if (query.indexOf("game=md5") >= 0) {
                sceneFromQuery = "db://assets/Loading/scenes/TaiXiuMD5Scene.fire";
            } else if (query.indexOf("game=double") >= 0) {
                sceneFromQuery = "db://assets/Loading/scenes/TaiXiuDoubleScene.fire";
            }
        }

        function findBundleByScene(scenePath) {
            return cc.assetManager.bundles.find(function (b) {
                return b.getSceneInfo(scenePath);
            });
        }

        function tryAutoStartMiniGameFromScene(sceneInstance) {
            if (!sceneFromQuery || !sceneInstance) {
                return;
            }
            var started = false;
            function visit(node) {
                if (!node || started) return;
                var components = node._components || [];
                for (var i = 0; i < components.length; i++) {
                    var comp = components[i];
                    if (comp && typeof comp.startGame === 'function') {
                        started = true;
                        setTimeout(function () {
                            try {
                                comp.startGame();
                            } catch (error) {
                                console.error('[boot] Auto startGame failed:', error);
                            }
                        }, 0);
                        return;
                    }
                }
                var children = node.children || [];
                for (var j = 0; j < children.length; j++) {
                    visit(children[j]);
                    if (started) return;
                }
            }
            visit(sceneInstance);
        }

        function runLaunchScene(targetBundle) {
            targetBundle.loadScene(launchScene, null, onProgress,
                function (err, scene) {
                    if (!err) {
                        cc.director.runSceneImmediate(scene);
                        tryAutoStartMiniGameFromScene(scene);
                        if (cc.sys.isBrowser) {
                            // show canvas
                            var canvas = document.getElementById('GameCanvas');
                            canvas.style.visibility = '';
                            var div = document.getElementById('GameDiv');
                            if (div) {
                                div.style.backgroundImage = '';
                            }
                            console.log('Success to load scene: ' + launchScene);
                        }
                    }
                }
            );
        }

        var bundle = null;
        if (sceneFromQuery) {
            bundle = findBundleByScene(sceneFromQuery);
            if (bundle) {
                launchScene = sceneFromQuery;
            } else {
                // Query scene is not included in build, fallback to default launch scene.
            }
        }

        if (!bundle) {
            bundle = findBundleByScene(launchScene);
        }

        if (bundle) {
            runLaunchScene(bundle);
        } else if (settings.hasStartSceneBundle) {
            var launchBundleMatch = /^db:\\/\\/assets\\/([^\\/]+)\\//.exec(launchScene);
            var launchBundleName = launchBundleMatch && launchBundleMatch[1] ? launchBundleMatch[1] : "";
            if (!launchBundleName) {
                console.error('[boot] Cannot resolve launch bundle from scene:', launchScene);
                return;
            }
            cc.assetManager.loadBundle(launchBundleName, function (bundleErr, loadedBundle) {
                if (bundleErr || !loadedBundle) {
                    console.error('[boot] Cannot load launch bundle:', launchBundleName, bundleErr);
                    return;
                }
                runLaunchScene(loadedBundle);
            });
        } else {
            console.error('[boot] Launch scene is missing in build:', launchScene);
            console.error('[boot] Please add scene in Build -> Included Scenes.');
        }
`;

  content = content.replace(launchBlockRegex, patchedBlock);
  fs.writeFileSync(mainPath, content, 'utf8');
  Editor.log('[Tool-Build-Update] Patched boot scene loader:', mainPath);
}

function onBuildFinished(options, callback) {
  try {
    if (!options || !options.dest) {
      return;
    }

    const assetsDir = path.join(options.dest, 'assets');
    writeAssetBundleVersion(assetsDir);

    if (options.platform === 'web-mobile' || options.platform === 'web-desktop') {
      createWebRoutes(options.dest);
      patchWebMainBoot(options.dest);
    }
  } catch (error) {
    Editor.error('[Tool-Build-Update] build-finished error:', error);
  } finally {
    if (typeof callback === 'function') {
      callback();
    }
  }
}

module.exports = {
  load() {
    Editor.Builder.on('build-finished', onBuildFinished);
  },

  unload() {
    Editor.Builder.removeListener('build-finished', onBuildFinished);
  },

  messages: {
    open() {
      Editor.Panel.open('test');
    },
    'say-hello'() {
      Editor.Ipc.sendToPanel('test', 'test:hello');
    },
    clicked() {}
  }
};
