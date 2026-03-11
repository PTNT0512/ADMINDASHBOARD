export default class ClientEndpointConfig {
    // Set true to force mini-game routes (/dev, /taixiudouble, /taixiumd5, /minipoker, /baucua, /xocdia)
    // to use the endpoints below.
    static readonly USE_STATIC_ENDPOINTS = true;

    // WebSocket endpoint used by MiniGame/TaiXiu2/XocDia clients.
    static readonly WS_HOST = "127.0.0.1";
    static readonly WS_PORT = 18082;
    static readonly WS_SECURE = false; // true => wss, false => ws

    // HTTP API endpoint used by popups/history/transactions.
    static readonly API_HOST = "127.0.0.1";
    static readonly API_PORT = 18082;
    static readonly API_SECURE = false; // true => https, false => http
    static readonly API_PATH = "/api";

    // Keep query string overrides (?wsHost=...&wsPort=...&apiHost=...) enabled.
    static readonly ALLOW_QUERY_OVERRIDE = true;

    // DEV background mode:
    // true  => use scene node (e.g. "mobile-lobby-bg"), edit directly in Cocos Editor.
    // false => draw runtime background by code in Loading.ts.
    static readonly DEV_USE_SCENE_BACKGROUND = true;
    static readonly DEV_SCENE_BACKGROUND_NODE = "mobile-lobby-bg";

    // Default game when opening a generic DEV scene (no /taixiudouble, /taixiumd5, ... in URL).
    // Supported: TaiXiuDouble | TaiXiuMD5 | MiniPoker | BauCua | XocDia
    static readonly DEV_DEFAULT_GAME = "TaiXiuDouble";
}
