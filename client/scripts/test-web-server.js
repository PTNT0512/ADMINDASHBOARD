"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

function parseEnvFile(filePath) {
  const out = {};
  if (!filePath || !fs.existsSync(filePath)) return out;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function readBool(value, fallback) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function readPort(value, fallback) {
  const port = Number(value);
  return Number.isFinite(port) && port > 0 ? Math.trunc(port) : fallback;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function loadSharedEndpointConfig(defaultPort) {
  const envCandidates = [
    process.env.SHARED_ENDPOINT_ENV_FILE ? path.resolve(process.env.SHARED_ENDPOINT_ENV_FILE) : "",
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../server/taixiu-backend/.env"),
  ].filter(Boolean);
  const fileEnv = Object.assign({}, ...envCandidates.map(parseEnvFile));
  const readEnv = (name) => {
    const direct = process.env[name];
    if (direct != null && String(direct).trim() !== "") return String(direct).trim();
    return String(fileEnv[name] || "").trim();
  };
  const publicHost = firstNonEmpty(readEnv("TAIXIU_PUBLIC_HOST"), readEnv("PUBLIC_HOST"), "localhost");
  const publicPort = readPort(firstNonEmpty(readEnv("TAIXIU_PUBLIC_PORT"), readEnv("PUBLIC_PORT"), readEnv("TAIXIU_APP_PORT"), readEnv("PORT")), defaultPort);
  const wsHost = firstNonEmpty(readEnv("TAIXIU_PUBLIC_WS_HOST"), readEnv("PUBLIC_WS_HOST"), publicHost);
  const wsPort = readPort(firstNonEmpty(readEnv("TAIXIU_PUBLIC_WS_PORT"), readEnv("PUBLIC_WS_PORT"), String(publicPort)), publicPort);
  const apiHost = firstNonEmpty(readEnv("TAIXIU_PUBLIC_API_HOST"), readEnv("PUBLIC_API_HOST"), publicHost, wsHost);
  const apiPort = readPort(firstNonEmpty(readEnv("TAIXIU_PUBLIC_API_PORT"), readEnv("PUBLIC_API_PORT"), String(publicPort), String(wsPort)), publicPort);
  const apiPathRaw = firstNonEmpty(readEnv("TAIXIU_PUBLIC_API_PATH"), readEnv("PUBLIC_API_PATH"), "/api");
  return {
    wsHost,
    wsPort,
    wsSecure: readBool(readEnv("TAIXIU_PUBLIC_WS_SECURE") || readEnv("PUBLIC_WS_SECURE"), false),
    apiHost,
    apiPort,
    apiSecure: readBool(readEnv("TAIXIU_PUBLIC_API_SECURE") || readEnv("PUBLIC_API_SECURE"), false),
    apiPath: apiPathRaw.startsWith("/") ? apiPathRaw : `/${apiPathRaw}`
  };
}

const args = process.argv.slice(2);
const getArgValue = (name, fallback) => {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  if (!found) return fallback;
  return found.slice(prefix.length);
};

const port = Number(getArgValue("port", process.env.PORT || 18081));
const host = getArgValue("host", "0.0.0.0");
const rootDir = path.resolve(process.cwd(), getArgValue("root", "build/web-mobile"));
const endpointConfig = loadSharedEndpointConfig(port);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

function safeJoin(base, targetPath) {
  const normalized = path.normalize(targetPath).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(base, normalized);
}

function decodePathname(rawPathname) {
  try {
    return decodeURIComponent(rawPathname || "/");
  } catch (_error) {
    return rawPathname || "/";
  }
}

function sendFile(res, filePath) {
  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    });
    stream.pipe(res);
  });
}

function buildGameRedirectLocation(parsedUrl, game) {
  const params = new url.URLSearchParams(parsedUrl.query || "");
  params.set("game", game);
  return `/?${params.toString()}`;
}

function hasEndpointQuery(parsedUrl) {
  const params = new url.URLSearchParams(parsedUrl.query || "");
  return !!(params.get("wsHost") || params.get("wsPort") || params.get("wsSecure") || params.get("apiHost") || params.get("apiPort") || params.get("apiSecure") || params.get("apiPath"));
}

function resolveRequestPath(reqPath) {
  if (!reqPath || reqPath === "/") return "index.html";
  if (reqPath === "/dev" || reqPath === "/dev/") return "dev/index.html";
  if (reqPath === "/taixiudouble" || reqPath === "/taixiudouble/") return "taixiudouble/index.html";
  if (reqPath === "/taixiumd5" || reqPath === "/taixiumd5/") return "taixiumd5/index.html";
  if (reqPath === "/minipoker" || reqPath === "/minipoker/") return "minipoker/index.html";
  if (reqPath === "/baucua" || reqPath === "/baucua/") return "baucua/index.html";
  if (reqPath === "/xocdia" || reqPath === "/xocdia/") return "xocdia/index.html";

  const cleaned = reqPath.replace(/^\/+/, "");
  if (!cleaned) return "index.html";

  if (!path.extname(cleaned)) {
    return `${cleaned}/index.html`;
  }

  return cleaned;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "/");
  const decodedPathname = decodePathname(parsed.pathname || "/");
  if (decodedPathname === "/xocdia" || decodedPathname === "/xocdia/") {
    res.writeHead(302, {
      Location: buildGameRedirectLocation(parsed, "xocdia")
    });
    res.end();
    return;
  }
  if ((decodedPathname === "/" || decodedPathname === "/index.html") && parsed.query) {
    const params = new url.URLSearchParams(parsed.query);
    const game = String(params.get("game") || "").trim().toLowerCase();
  }
  if (parsed.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      ok: true,
      service: "sonclub-web-test-server",
      port
    }));
    return;
  }
  if (parsed.pathname === "/__whoami") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      service: "sonclub-web-test-server",
      rootDir,
      routes: ["/", "/dev", "/taixiudouble", "/taixiumd5", "/minipoker", "/baucua", "/xocdia", "/health"]
    }));
    return;
  }
  const routeFile = resolveRequestPath(decodedPathname);
  const absPath = safeJoin(rootDir, routeFile);

  if (!absPath.startsWith(rootDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.access(absPath, fs.constants.F_OK, (err) => {
    if (!err) {
      sendFile(res, absPath);
      return;
    }

    const cleanPath = decodedPathname.replace(/^\/+/, "");
    if (path.extname(cleanPath)) {
      const staticPath = safeJoin(rootDir, cleanPath);
      if (!staticPath.startsWith(rootDir)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }
      sendFile(res, staticPath);
      return;
    }

    sendFile(res, path.join(rootDir, "index.html"));
  });
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`[web-test-server] port ${port} is already in use.`);
    console.error(`[web-test-server] run with another port, e.g.: node scripts/test-web-server.js --port=19090`);
    process.exit(1);
    return;
  }
  console.error("[web-test-server] error:", err);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`[web-test-server] serving: ${rootDir}`);
  console.log(`[web-test-server] url: http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
  console.log("[web-test-server] routes:");
  console.log("  /");
  console.log("  /dev");
  console.log("  /taixiudouble");
  console.log("  /taixiumd5");
  console.log("  /minipoker");
  console.log("  /baucua");
  console.log("  /xocdia");
  console.log("  /health");
  console.log("  /__whoami");
});
