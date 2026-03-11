param(
    [string]$BuildDir = "build/web-mobile"
)

$resolved = Resolve-Path -Path $BuildDir -ErrorAction SilentlyContinue
if (-not $resolved) {
    Write-Error "Build folder not found: $BuildDir"
    exit 1
}

$root = $resolved.Path
$routes = @(
    @{ Name = "taixiudouble"; Query = "double"; Title = "TaiXiuDouble"; Extra = "" },
    @{ Name = "taixiumd5"; Query = "md5"; Title = "TaiXiuMD5"; Extra = "" },
    @{ Name = "minipoker"; Query = "minipoker"; Title = "MiniPoker"; Extra = "" },
    @{ Name = "baucua"; Query = "baucua"; Title = "BauCua"; Extra = "" },
    @{ Name = "xocdia"; Query = "xocdia"; Title = "XocDia"; Extra = "" }
)

foreach ($route in $routes) {
    $routeDir = Join-Path $root $route.Name
    New-Item -Path $routeDir -ItemType Directory -Force | Out-Null

    $html = @"
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1,minimum-scale=1,maximum-scale=1">
  <title>$($route.Title)</title>
  <script>
    (function () {
      window.location.replace("../?game=$($route.Query)$($route.Extra)");
    })();
  </script>
</head>
<body></body>
</html>
"@

    Set-Content -Path (Join-Path $routeDir "index.html") -Value $html -Encoding UTF8
}

$devDir = Join-Path $root "dev"
New-Item -Path $devDir -ItemType Directory -Force | Out-Null

$devHtml = @"
<!DOCTYPE html>
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
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      line-height: 1.2;
    }
    p {
      margin: 0 0 18px;
      opacity: 0.9;
    }
    .actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
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
    .btn.md5 {
      background: linear-gradient(135deg, #8be9fd 0%, #5fa8ff 100%);
    }
    .btn.poker {
      background: linear-gradient(135deg, #9ef01a 0%, #70e000 100%);
    }
    .btn.baucua {
      background: linear-gradient(135deg, #ff99c8 0%, #ff595e 100%);
    }
    .btn.xocdia {
      background: linear-gradient(135deg, #c4f1be 0%, #4cc9f0 100%);
    }
    .btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.02);
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Dev Launcher</h1>
    <p>Chon game de mo truc tiep che do online.</p>
    <div class="actions">
      <a class="btn" href="../taixiudouble/">TaiXiuDouble</a>
      <a class="btn md5" href="../taixiumd5/">TaiXiuMD5</a>
      <a class="btn poker" href="../minipoker/">MiniPoker</a>
      <a class="btn baucua" href="../baucua/">BauCua</a>
      <a class="btn xocdia" href="../xocdia/">XocDia</a>
    </div>
  </main>
</body>
</html>
"@

Set-Content -Path (Join-Path $devDir "index.html") -Value $devHtml -Encoding UTF8

Write-Host "Created routes in ${root}:"
Write-Host "- /taixiudouble -> /?game=double"
Write-Host "- /taixiumd5 -> /?game=md5"
Write-Host "- /minipoker -> /?game=minipoker"
Write-Host "- /baucua -> /?game=baucua"
Write-Host "- /xocdia -> /?game=xocdia"
Write-Host "- /dev -> launcher page"
