const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const outdir = path.join(root, 'dist-dashboard');
const mainEntry = path.join(root, 'src', 'main.jsx');
const dashboardAppEntry = path.join(root, 'src', 'App.dashboard.jsx');
const publicDir = path.join(root, 'public');
const indexTemplatePath = path.join(root, 'index.html');

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const toPosix = (value) => String(value || '').replace(/\\/g, '/');

(async () => {
  fs.rmSync(outdir, { recursive: true, force: true });
  ensureDir(outdir);

  const result = await esbuild.build({
    entryPoints: [mainEntry],
    outdir,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2019'],
    sourcemap: false,
    minify: true,
    metafile: true,
    logLevel: 'info',
    jsx: 'automatic',
    entryNames: 'assets/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    loader: {
      '.png': 'file',
      '.svg': 'file',
      '.ico': 'file',
      '.woff': 'file',
      '.woff2': 'file',
      '.ttf': 'file',
      '.eot': 'file',
      '.mp3': 'file',
    },
    define: {
      'import.meta.env.VITE_APP_MODE': JSON.stringify('dashboard'),
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    plugins: [
      {
        name: 'alias-dashboard-app-entry',
        setup(build) {
          build.onResolve({ filter: /^@app-root$/ }, () => ({ path: dashboardAppEntry }));
        },
      },
    ],
  });

  const outputs = Object.entries(result.metafile.outputs || {});
  const entryChunk = outputs.find(([, meta]) => meta.entryPoint && path.resolve(meta.entryPoint) === mainEntry);
  if (!entryChunk) {
    throw new Error('Cannot find compiled main entry chunk for Dashboard web build.');
  }

  const jsOutputPath = entryChunk[0];
  const cssOutput = outputs.find(([filePath]) => filePath.endsWith('.css'));
  const jsRelative = './' + toPosix(path.relative(outdir, jsOutputPath));
  const cssRelative = cssOutput ? './' + toPosix(path.relative(outdir, cssOutput[0])) : '';

  let html = fs.readFileSync(indexTemplatePath, 'utf8');
  html = html.replace(/<script type="module" src="\/src\/main\.jsx"><\/script>/, `<script type="module" src="${jsRelative}"></script>`);
  if (cssRelative) {
    html = html.replace('</head>', `  <link rel="stylesheet" href="${cssRelative}" />\n  </head>`);
  }
  fs.writeFileSync(path.join(outdir, 'index.html'), html, 'utf8');

  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, outdir, { recursive: true });
  }

  console.log(`[dashboard-web-build] built ${jsRelative}${cssRelative ? ` and ${cssRelative}` : ''}`);
})();
