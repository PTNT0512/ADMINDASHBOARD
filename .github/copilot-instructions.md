# Copilot / AI Agent Instructions for Admin App

This file gives concise, actionable guidance for an AI coding agent to be immediately productive in this repository.

1) Big-picture architecture
- Two Electron modes: **Center** and **Dashboard**. See `electron/center.cjs` and `electron/dashboard.cjs` for main logic.
- Renderer is a React + Vite app (ports: `5173` = dashboard, `5174` = center). Dev servers live under `src/` and some nested apps (e.g., `cskh-app/`).
- Database: MongoDB via `mongoose`. Models live in `src/models/` (e.g., `Account.js`, `User.js`, `License.js`).
- Bots & services: telegram bots and bot managers live in `src/components/` (`bot-service.js`, `main-bot-service.js`, `cskh-bot-service.js`).
- Game server: child process started from `game/taixiu/server.js`. Dashboard spawns this as a forked process.

2) Developer workflows & commands
- Dev (center): `npm run electron:dev:center` — starts Vite on 5174 then runs `electron electron/center.cjs`.
- Dev (dashboard): `npm run electron:dev:dashboard` — starts Vite on 5173 then runs `electron electron/dashboard.cjs`.
- Build (center): `npm run electron:build:center` — runs `vite build` then `electron-builder` using `electron-builder.center.cjs`.
- Build (dashboard): `npm run electron:build:dashboard` — similar with `electron-builder.dashboard.cjs`.
- Optional: `npm run compile:main` uses `bytenode` to compile `electron/dashboard.cjs`.
- Env files: runtime loads `.env.${VITE_APP_MODE}` via `src/init-env.js`. Typical names: `.env.dashboard`, `.env.center`.

3) Project-specific patterns and gotchas
- IPC abstraction: both `center.cjs` and `dashboard.cjs` use a helper `ipcHandle(channel, listener)` that verifies `mongoose.connection.readyState` and sanitizes responses. Always return plain objects (it calls `sanitizeIPC` to strip Mongoose internals and map `_id` to `id`).
- IPC names are string channels (examples): `login-request`, `get-licenses`, `activate-license`, `send-support-reply`, `start-game-server`, `get-logs`.
- Auto-created admin user: on DB init the code ensures account `admincenter` with password `1` is present — useful when testing authentication flows.
- Embedded servers: Dashboard includes an Express + Socket.IO server. API port defaults to `process.env.API_PORT || 4001`. Center runs a tiny HTTP activation API on `5175`.
- License activation flow: Dashboard posts to `process.env.LICENSE_API_URL` which should point to a running Center (center exposes `/api/activate`). When debugging, ensure Center is reachable.
- Child processes: the game admin server is forked and logs forwarded to the dashboard; look for `startGameAdminServer()` in `electron/dashboard.cjs`.

4) Code navigation heuristics
- If you need DB shape or sample fields, inspect `src/models/*.js`.
- Bot behavior and Telegram integration live in `src/components/*-bot-service.js` and `src/components/bot-service.js`.
- UI components are in `src/components/` (React), and Vite entry is `src/main.jsx`.

5) Testing & runtime tips for agents
- To reproduce runtime issues locally, run the matching dev script for the mode you're testing (center vs dashboard). Use `wait-on` in the scripts to ensure the Vite server is ready before Electron starts.
- When changing IPC handlers or models, restart the corresponding Electron process. In dev the scripts auto-restart by running Vite plus Electron concurrently.
- Check `src/init-env.js` for which `.env` file is loaded; environment mismatches are a common source of bugs (missing `MONGODB_URI`, `SYSTEM_BOT_TOKEN`, `LICENSE_API_URL`, `ADMIN_TELEGRAM_ID`).

6) Files to inspect for common tasks (examples)
- Startup / IPC: [electron/center.cjs](electron/center.cjs) and [electron/dashboard.cjs](electron/dashboard.cjs)
- Env loader: [src/init-env.js](src/init-env.js)
- Models: [src/models/Account.js](src/models/Account.js), [src/models/User.js](src/models/User.js), [src/models/License.js](src/models/License.js)
- Bot services: [src/components/bot-service.js](src/components/bot-service.js), [src/components/main-bot-service.js](src/components/main-bot-service.js)
- Game server: [game/taixiu/server.js](game/taixiu/server.js)

7) Editing guidance for AI agents
- Prefer small, focused changes: update IPC handlers in `electron/*.cjs` and matching renderer calls in `src/components/*` together.
- Maintain the `sanitizeIPC`/`ipcHandle` pattern when returning DB objects to prevent serialization errors across IPC.
- When touching build or packaging, keep `electron-builder.center.cjs` and `electron-builder.dashboard.cjs` in sync with expectations in `package.json` scripts.

If anything here is unclear or you want additional examples (e.g., typical IPC request/response shapes or a short runbook for local debugging), tell me which area to expand.
