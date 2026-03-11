
import Http from "../../Loading/src/Http";
import BundleControl from "./BundleControl";
import ClientEndpointConfig from "./ClientEndpointConfig";
import Configs from "./Configs";
import { Global } from "./Global";
import UtilsNative from "./UtilsNative";
import {
    TaiXiuDevGame,
    TaiXiuDevState,
    TaiXiuDevTickEvent,
    createTaiXiuDevState,
    advanceTaiXiuDevState
} from "./dev/TaiXiuDevMockData";
const { ccclass, property } = cc._decorator;

@ccclass
export default class Loading extends cc.Component {


    @property(cc.Label)
    lblStatus: cc.Label = null;
    @property(cc.Label)
    lbTips: cc.Label = null;
    @property(cc.Slider)
    nodeSlider: cc.Slider = null;

    // @property(cc.Slider)
    // slider :cc.Slider = null;

    @property(cc.Sprite)
    spriteProgress: cc.Sprite = null;
    listSkeData = []
    private static readonly DEV_SCENE_DOUBLE_ID = "8ea5a17a-8bd0-42d4-b496-68a3813fa4b7";
    private static readonly DEV_SCENE_MD5_ID = "ad5c8b06-2f9f-4aa7-af8b-d824c98cf487";
    private static readonly DEV_SCENE_UNIFIED_ID = "2f7db1c2-40cd-4aa4-b3af-db121a14c8a6";
    private devCurrentGame = "";
    private devCurrentGameNode: cc.Node = null;
    private devSwitchPanel: cc.Node = null;
    private devAccountPanel: cc.Node = null;
    private devAccountIdLabel: cc.Label = null;
    private devAccountCoinLabel: cc.Label = null;
    private devDepsReady = false;
    private devDepsLoading = false;
    private devDepsPending: Array<() => void> = [];
    private devMockTimer: any = null;
    private devMockStates: { [game: string]: TaiXiuDevState } = {};
    private devMockController: any = null;
    private hasStartedGame = false;
    listTips = [
        {
            vi: "Đừng quên đăng nhập hàng ngày để nhận thưởng Điểm Danh bạn nhé!",
            en: "Dont forget login every day to get free attendance bonus!"
        },
        {
            vi: "Tiến Lên Miền Nam: Chống gian lận,an toàn tuyệt đối",
            en: "Killer 13: Anti cheating,absolute safety"
        },
        {
            vi: "Nạp đầu nhận thưởng lên tới 790K",
            en: "First cash-in can receive bonus up to 790K"
        },
        {
            vi: "Bộ phận chăm sóc khách hàng luôn online 24/24 bạn nhé!",
            en: "Customer care team support online 24/24!"
        },
        {
            vi: "Go88 nạp rút nhanh chóng và an toàn!",
            en: "Go88 quick cashin,cashout and alway safety!"
        },
    ]
    start() {
        cc.assetManager.downloader.maxConcurrency = 20;
		cc.assetManager.downloader.maxRequestsPerFrame = 6;
        this.showTips();
        if (cc.sys.isBrowser) {
            this.scheduleOnce(() => {
                this.startGame();
            }, 0);
        }
    }
    startGame() {
        if (this.hasStartedGame) {
            return;
        }
        this.hasStartedGame = true;
        this.applyMiniGameSocketOverridesFromUrl();
        const targetMiniGame = this.getMiniGameTarget();
        if (targetMiniGame) {
            this.bootstrapLoginFromUrlToken(() => {
                if (this.shouldUseDevOfflineMode()) {
                    if (!this.isTaiXiuDevGame(targetMiniGame)) {
                        this.startDirectMiniGameOnline(targetMiniGame);
                        return;
                    }
                    this.startDevPreview(targetMiniGame);
                    return;
                }
                this.startDirectMiniGameOnline(targetMiniGame);
            });
            UtilsNative.getDeviceId();
            return;
        }
        this.lblStatus.string = "Đang tải bản cập nhật..."; 
        this.spriteProgress.fillRange = 0;
        this.nodeSlider.progress = 0;

        if (Configs.App.IS_LOCAL == false) {
            Http.get("https://sun102.fun/assets/AssetBundleVersion.json", {}, (err, data) => {
                BundleControl.init(data);
              this.loadLobby();  
            });
			
        }
        else {
            this.loadLobby();
        }
        UtilsNative.getDeviceId();
    }
    private getMiniGameTarget(): string {
        const targetFromUrl = this.getMiniGameTargetFromUrl();
        if (targetFromUrl) {
            return targetFromUrl;
        }

        const scene: any = cc.director.getScene();
        const sceneId = scene && scene._id ? scene._id : "";

        if (sceneId === Loading.DEV_SCENE_DOUBLE_ID) {
            return "TaiXiuDouble";
        } else if (sceneId === Loading.DEV_SCENE_MD5_ID) {
            return "TaiXiuMD5";
        } else if (sceneId === Loading.DEV_SCENE_UNIFIED_ID) {
            return this.getDefaultDevGame();
        }

        const sceneName = (scene && scene.name ? scene.name : "").toLowerCase();
        if (sceneName.indexOf("md5") >= 0) {
            return "TaiXiuMD5";
        }
        if (sceneName.indexOf("double") >= 0) {
            return "TaiXiuDouble";
        }
        if (sceneName.indexOf("minipoker") >= 0 || sceneName.indexOf("mini-poker") >= 0) {
            return "MiniPoker";
        }
        if (sceneName.indexOf("baucua") >= 0 || sceneName.indexOf("bau-cua") >= 0) {
            return "BauCua";
        }
        if (sceneName.indexOf("xocdia") >= 0 || sceneName.indexOf("xoc-dia") >= 0) {
            return "XocDia";
        }
        if (sceneName.indexOf("devscene") >= 0 || sceneName.indexOf("dev_scene") >= 0) {
            return this.getDefaultDevGame();
        }

        return "";
    }

    private getDefaultDevGame(): string {
        const raw = (ClientEndpointConfig.DEV_DEFAULT_GAME || "").toLowerCase();
        if (raw === "taixiumd5" || raw === "md5") return "TaiXiuMD5";
        if (raw === "minipoker" || raw === "mini-poker") return "MiniPoker";
        if (raw === "baucua" || raw === "bau-cua") return "BauCua";
        if (raw === "xocdia" || raw === "xoc-dia") return "XocDia";
        return "TaiXiuDouble";
    }

    private getMiniGameTargetFromUrl(): string {
        if (!cc.sys.isBrowser || typeof window === "undefined" || !window.location) {
            return "";
        }

        const path = (window.location.pathname || "").toLowerCase();
        const search = (window.location.search || "").toLowerCase();
        const hash = (window.location.hash || "").toLowerCase();
        const params = this.getUrlSearchParams();
        const gameParam = String(params.get("game") || "").trim().toLowerCase();

        if (gameParam === "double" || gameParam === "taixiudouble" || gameParam === "txdouble") {
            return "TaiXiuDouble";
        }
        if (gameParam === "md5" || gameParam === "taixiumd5") {
            return "TaiXiuMD5";
        }
        if (gameParam === "minipoker" || gameParam === "mini-poker") {
            return "MiniPoker";
        }
        if (gameParam === "baucua" || gameParam === "bau-cua") {
            return "BauCua";
        }
        if (gameParam === "xocdia" || gameParam === "xoc-dia") {
            return "XocDia";
        }

        if (path.indexOf("/taixiumd5") >= 0 || search.indexOf("game=md5") >= 0 || hash.indexOf("taixiumd5") >= 0) {
            return "TaiXiuMD5";
        }
        if (path.indexOf("/taixiudouble") >= 0 || search.indexOf("game=double") >= 0 || hash.indexOf("taixiudouble") >= 0) {
            return "TaiXiuDouble";
        }
        if (path.indexOf("/minipoker") >= 0 || search.indexOf("game=minipoker") >= 0 || hash.indexOf("minipoker") >= 0) {
            return "MiniPoker";
        }
        if (path.indexOf("/baucua") >= 0 || search.indexOf("game=baucua") >= 0 || hash.indexOf("baucua") >= 0) {
            return "BauCua";
        }
        if (path.indexOf("/xocdia") >= 0 || search.indexOf("game=xocdia") >= 0 || hash.indexOf("xocdia") >= 0) {
            return "XocDia";
        }

        return "";
    }

    private shouldUseDevOfflineMode(): boolean {
        if (!cc.sys.isBrowser || typeof window === "undefined" || !window.location) {
            return false;
        }
        const params = this.getUrlSearchParams();
        const rawMode = params.get("offline") || params.get("devOffline") || params.get("mode");
        if (!rawMode) {
            return false;
        }
        const value = rawMode.toLowerCase();
        return value === "1" || value === "true" || value === "yes" || value === "offline" || value === "dev";
    }

    private applyMiniGameSocketOverridesFromUrl() {
        if (!cc.sys.isBrowser || typeof window === "undefined" || !window.location) {
            return;
        }
        const loc = window.location;
        const params = this.getUrlSearchParams();
        const allowQueryOverride = ClientEndpointConfig.ALLOW_QUERY_OVERRIDE !== false;
        const useStaticEndpoints = ClientEndpointConfig.USE_STATIC_ENDPOINTS !== false;
        const path = (loc.pathname || "").toLowerCase();
        const search = (loc.search || "").toLowerCase();
        const isDevRoute = path === "/dev" || path.indexOf("/dev/") >= 0;
        const isTaiXiuRoute = path.indexOf("/taixiudouble") >= 0 ||
            path.indexOf("/taixiumd5") >= 0 ||
            search.indexOf("game=double") >= 0 ||
            search.indexOf("game=md5") >= 0;
        const isMiniRoute = isTaiXiuRoute ||
            isDevRoute ||
            path.indexOf("/minipoker") >= 0 ||
            path.indexOf("/baucua") >= 0 ||
            path.indexOf("/xocdia") >= 0 ||
            search.indexOf("game=minipoker") >= 0 ||
            search.indexOf("game=baucua") >= 0 ||
            search.indexOf("game=xocdia") >= 0;
        const wsHost = allowQueryOverride ? params.get("wsHost") : null;
        const wsPortRaw = allowQueryOverride ? params.get("wsPort") : null;
        const wsSecureRaw = allowQueryOverride ? params.get("wsSecure") : null;
        const apiHostRaw = allowQueryOverride ? params.get("apiHost") : null;
        const apiPortRaw = allowQueryOverride ? params.get("apiPort") : null;
        const apiSecureRaw = allowQueryOverride ? params.get("apiSecure") : null;
        const apiPathRaw = allowQueryOverride ? params.get("apiPath") : null;
        const hasExplicitWs = allowQueryOverride && (!!wsHost || !!wsPortRaw || !!wsSecureRaw);
        const hasExplicitApi = allowQueryOverride && (!!apiHostRaw || !!apiPortRaw || !!apiSecureRaw || !!apiPathRaw);
        if (!isMiniRoute && !hasExplicitWs && !hasExplicitApi) {
            return;
        }

        const staticWsHost = this.normalizeHost(ClientEndpointConfig.WS_HOST, "localhost");
        const staticWsPort = this.normalizePort(ClientEndpointConfig.WS_PORT, 18082);
        const staticWsSecure = !!ClientEndpointConfig.WS_SECURE;
        const staticApiHost = this.normalizeHost(ClientEndpointConfig.API_HOST, "localhost");
        const staticApiPort = this.normalizePort(ClientEndpointConfig.API_PORT, staticWsPort);
        const staticApiSecure = !!ClientEndpointConfig.API_SECURE;
        const staticApiPath = this.normalizeApiPath(ClientEndpointConfig.API_PATH || "/api");

        if (isMiniRoute || hasExplicitWs) {
            const defaultHost = useStaticEndpoints ? staticWsHost : (isMiniRoute ? "localhost" : (loc.hostname || "localhost"));
            const host = (wsHost && wsHost.length > 0) ? wsHost : defaultHost;
            const wsPort = parseInt(wsPortRaw || "");
            const defaultPort = useStaticEndpoints ? staticWsPort : 18082;
            const port = Number.isFinite(wsPort) && wsPort > 0 ? wsPort : defaultPort;

            let useWss = false;
            if (wsSecureRaw != null) {
                useWss = this.parseBoolFlag(wsSecureRaw, useStaticEndpoints ? staticWsSecure : false);
            } else if (useStaticEndpoints) {
                useWss = staticWsSecure;
            } else {
                useWss = loc.protocol === "https:" && !this.isLocalSocketHost(host);
            }

            Configs.App.USE_WSS = useWss;
            Configs.App.HOST_MINIGAME.host = host;
            Configs.App.HOST_MINIGAME.port = port;
            Configs.App.HOST_MINIGAME2.host = host;
            Configs.App.HOST_MINIGAME2.port = port;
            Configs.App.HOST_TAI_XIU_MINI2.host = host;
            Configs.App.HOST_TAI_XIU_MINI2.port = port;
            Configs.App.HOST_XOCDIA.host = host;
            Configs.App.HOST_XOCDIA.port = port;
            Configs.App.HOST_POKER.host = host;
            Configs.App.HOST_POKER.port = port;
            cc.log("[Loading] MiniGame WS override:", host + ":" + port + ", secure=" + useWss);
        }

        if (isMiniRoute || hasExplicitApi) {
            const defaultApiHost = useStaticEndpoints ? staticApiHost : (isMiniRoute ? "localhost" : (loc.hostname || "localhost"));
            const apiHost = (apiHostRaw && apiHostRaw.length > 0) ? apiHostRaw : defaultApiHost;
            const defaultApiPort = useStaticEndpoints ? staticApiPort : 18082;
            const parsedApiPort = parseInt(apiPortRaw || wsPortRaw || "");
            const apiPort = Number.isFinite(parsedApiPort) && parsedApiPort > 0 ? parsedApiPort : defaultApiPort;

            let useHttpsApi = false;
            if (apiSecureRaw != null) {
                useHttpsApi = this.parseBoolFlag(apiSecureRaw, useStaticEndpoints ? staticApiSecure : false);
            } else if (useStaticEndpoints) {
                useHttpsApi = staticApiSecure;
            } else {
                useHttpsApi = loc.protocol === "https:" && !this.isLocalSocketHost(apiHost);
            }
            const apiProtocol = useHttpsApi ? "https://" : "http://";
            const apiPath = this.normalizeApiPath((apiPathRaw && apiPathRaw.length > 0) ? apiPathRaw : staticApiPath);
            Configs.App.API = apiProtocol + apiHost + ":" + apiPort + apiPath;
            Configs.App.API2 = Configs.App.API;
            Configs.App.APIROY = Configs.App.API;
            cc.log("[Loading] MiniGame API override:", Configs.App.API);
        }
    }

    private getUrlSearchParams(): any {
        try {
            return new URLSearchParams(window.location.search || "");
        } catch (error) {
            return new URLSearchParams();
        }
    }

    private isLocalSocketHost(host: string): boolean {
        if (!host) return true;
        const lower = host.toLowerCase();
        if (lower === "localhost" || lower === "127.0.0.1" || lower === "0.0.0.0" || lower === "::1") {
            return true;
        }
        if (lower.indexOf("192.168.") === 0 || lower.indexOf("10.") === 0 || lower.indexOf("172.") === 0) {
            return true;
        }
        return false;
    }

    private parseBoolFlag(raw: string, fallback: boolean): boolean {
        if (raw == null || raw.length <= 0) return fallback;
        const value = raw.toLowerCase();
        if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
        if (value === "0" || value === "false" || value === "no" || value === "off") return false;
        return fallback;
    }

    private normalizePort(value: any, fallback: number): number {
        const num = parseInt((value != null ? value : "").toString());
        if (Number.isFinite(num) && num > 0) {
            return num;
        }
        return fallback;
    }

    private normalizeHost(host: string, fallback: string): string {
        if (!host) return fallback;
        const trimmed = host.trim();
        return trimmed.length > 0 ? trimmed : fallback;
    }

    private normalizeApiPath(path: string): string {
        let normalized = path || "/api";
        if (normalized.charAt(0) !== "/") {
            normalized = "/" + normalized;
        }
        return normalized;
    }

    private isTaiXiuDevGame(targetGame: string): boolean {
        return targetGame === "TaiXiuDouble" || targetGame === "TaiXiuMD5";
    }

    private startDevPreview(targetGame: string) {
        if (!this.isTaiXiuDevGame(targetGame)) {
            this.startDirectMiniGameOnline(targetGame);
            return;
        }
        if (this.devCurrentGame === targetGame && this.devCurrentGameNode && cc.isValid(this.devCurrentGameNode)) {
            return;
        }

        this.stopDevMockLoop();
        this.devCurrentGame = targetGame;
        this.removeCurrentDevGame();
        const canvas = this.getCanvasNode();
        this.createDevBackground(canvas, targetGame, true);
        this.createDevSwitchPanel(canvas, targetGame, true);
        this.hideLoadingUiForDev();

        this.lblStatus.string = "DEV mode: khoi tao " + targetGame + "...";
        this.spriteProgress.fillRange = 0;
        this.nodeSlider.progress = 0;
        this.setupDevLogin();
        this.ensureDevDependencies(() => {
            if (this.devCurrentGame !== targetGame) return;
            this.setupDevAppMock();
            this.setupDevNetworkMock();
            this.loadDevGamePrefab(targetGame, true);
        });
    }

    private startDirectMiniGameOnline(targetGame: string) {
        if (this.devCurrentGame === targetGame && this.devCurrentGameNode && cc.isValid(this.devCurrentGameNode)) {
            return;
        }

        this.applyMiniGameSocketOverridesFromUrl();
        this.stopDevMockLoop();
        this.restoreDevNetworkMock();
        this.devCurrentGame = targetGame;
        this.removeCurrentDevGame();
        const canvas = this.getCanvasNode();
        this.createDevBackground(canvas, targetGame, false);
        this.createDevSwitchPanel(canvas, targetGame, false);
        this.hideLoadingUiForDev();

        this.lblStatus.string = "ONLINE mode: khoi tao " + targetGame + "...";
        this.spriteProgress.fillRange = 0;
        this.nodeSlider.progress = 0;
        this.setupDevLogin();
        this.ensureDevDependencies(() => {
            if (this.devCurrentGame !== targetGame) return;
            this.setupDevAppMock();
            this.loadDevGamePrefab(targetGame, false);
        });
    }

    private removeCurrentDevGame() {
        this.stopDevMockLoop();
        if (!this.devCurrentGameNode || !cc.isValid(this.devCurrentGameNode)) {
            this.devCurrentGameNode = null;
            return;
        }
        const components = this.devCurrentGameNode.getComponents(cc.Component);
        for (let i = 0; i < components.length; i++) {
            const comp: any = components[i];
            if (comp && typeof comp.dismiss === "function") {
                comp.dismiss();
            }
        }
        this.devCurrentGameNode.destroy();
        this.devCurrentGameNode = null;
    }

    private setupDevLogin() {
        Configs.Login.IsLogin = true;
        if (!Configs.Login.Nickname || Configs.Login.Nickname.length === 0) {
            Configs.Login.Nickname = "dev_player";
        }
        if (!Configs.Login.AccessToken || Configs.Login.AccessToken.length === 0) {
            Configs.Login.AccessToken = "dev_token";
        }
        if (Configs.Login.Coin <= 0) {
            Configs.Login.Coin = 1000000000;
        }
    }

    private bootstrapLoginFromUrlToken(done: () => void) {
        const finish = (() => {
            let called = false;
            return () => {
                if (called) return;
                called = true;
                if (done) done();
            };
        })();

        if (!cc.sys.isBrowser || typeof window === "undefined" || !window.location) {
            finish();
            return;
        }

        const params = this.getUrlSearchParams();
        const urlToken = this.getStringParam(params, ["token", "accessToken", "at"]);
        const urlNickname = this.getStringParam(params, ["nickname", "un", "username"]);
        const urlCoin = this.getNumberParam(params, ["coin", "money", "balance"]);

        if (urlNickname.length > 0) {
            Configs.Login.Nickname = urlNickname;
        }
        if (Number.isFinite(urlCoin) && urlCoin > 0) {
            Configs.Login.Coin = Math.floor(urlCoin);
        }

        if (!urlToken) {
            finish();
            return;
        }

        Configs.Login.IsLogin = true;
        Configs.Login.AccessToken = urlToken;
        Configs.Login.AccessToken2 = urlToken;
        Configs.Login.AccessTokenSockJs = urlToken;
        if (!Configs.Login.Nickname || Configs.Login.Nickname.length <= 0) {
            Configs.Login.Nickname = "user_token";
        }

        cc.log("[Loading] URL token detected, resolving profile...");

        let timeoutId: any = setTimeout(() => {
            timeoutId = null;
            cc.warn("[Loading] URL token profile timeout, continue with fallback profile.");
            finish();
        }, 1800);

        const req: any = { c: 199, token: urlToken };
        if (urlNickname.length > 0) {
            req.nickname = urlNickname;
        }

        Http.get(Configs.App.API, req, (err, res) => {
            if (timeoutId != null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            if (!err && res && res.success && res.profile) {
                this.applyUrlLoginProfile(res.profile);
                cc.log("[Loading] URL token login success:", Configs.Login.Nickname);
            } else {
                cc.warn("[Loading] URL token login failed, using raw token.", err, res && res.message ? res.message : "");
            }
            finish();
        });
    }

    private applyUrlLoginProfile(profile: any) {
        if (!profile) return;

        const nickname = String(profile.nickname || "").trim();
        if (nickname.length > 0) {
            Configs.Login.Nickname = nickname;
        }

        const token = String(profile.accessToken || "").trim();
        if (token.length > 0) {
            Configs.Login.AccessToken = token;
            Configs.Login.AccessToken2 = token;
            Configs.Login.AccessTokenSockJs = token;
        }

        const coin = Number(profile.coin);
        if (Number.isFinite(coin) && coin >= 0) {
            Configs.Login.Coin = Math.floor(coin);
        }

        const userId = Number(profile.userId);
        if (Number.isFinite(userId) && userId > 0) {
            Configs.Login.UserId = Math.floor(userId);
        }

        Configs.Login.IsLogin = true;
    }

    private getStringParam(params: any, keys: string[]): string {
        if (!params || !keys || keys.length <= 0) return "";
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = params.get(key);
            if (value != null) {
                const text = String(value).trim();
                if (text.length > 0) {
                    return text;
                }
            }
        }
        return "";
    }

    private getNumberParam(params: any, keys: string[]): number {
        if (!params || !keys || keys.length <= 0) return NaN;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = params.get(key);
            if (value != null && String(value).trim().length > 0) {
                const num = Number(value);
                if (Number.isFinite(num)) {
                    return num;
                }
            }
        }
        return NaN;
    }
    private setupDevAppMock() {
        const AppClass = this.requireDefault("App");
        if (!AppClass) {
            cc.warn("[DEV] App module not found.");
            return;
        }
        const canvasNode = this.getCanvasNode();
        const appMock: any = AppClass.instance ? AppClass.instance : {};
        appMock.canvas = canvasNode || this.node;
        appMock.buttonMiniGame = appMock.buttonMiniGame || {};
        appMock.buttonMiniGame.showTimeTaiXiu = () => { };
        appMock.buttonMiniGame.show = () => { };
        appMock.buttonMiniGame.hide = () => { };
        appMock.alertDialog = appMock.alertDialog || {};
        appMock.alertDialog.showMsg = (msg: string) => {
            cc.log("[DEV] alertDialog:", msg);
        };
        appMock.showBgMiniGame = () => { };
        appMock.showGameMini = (_name: string, node?: cc.Node) => {
            if (node) node.active = true;
        };
        appMock.hideGameMini = (_name: string, node?: cc.Node) => {
            if (node) node.active = false;
        };
        appMock.showLoading = () => { };
        if (typeof appMock.showErrLoading !== "function") {
            appMock.showErrLoading = () => { };
        }
        if (typeof appMock.showToast !== "function") {
            appMock.showToast = (msg: string) => {
                cc.log("[DEV] toast:", msg);
            };
        }
        if (typeof appMock.ShowAlertDialog !== "function") {
            appMock.ShowAlertDialog = (msg: string) => {
                cc.log("[DEV] alert:", msg);
            };
        }
        if (typeof appMock.loadScene !== "function") {
            appMock.loadScene = (sceneName: string) => {
                cc.log("[DEV] loadScene:", sceneName);
            };
        }
        if (typeof appMock.getAvatarSpriteFrame !== "function") {
            appMock.getAvatarSpriteFrame = (avatar: string) => {
                const frames: cc.SpriteFrame[] = appMock.sprFrameAvatars || [];
                if (!frames || frames.length === 0) {
                    return null;
                }
                const avatarInt = parseInt(avatar);
                if (Number.isFinite(avatarInt) && avatarInt >= 0 && avatarInt < frames.length) {
                    return frames[avatarInt];
                }
                return frames[0];
            };
        }
        const fallbackLang: { [key: string]: string } = {
            txt_taixiu_new_session: "Bat dau phien moi",
            txt_taixiu_refund: "",
            txt_taixiu_refund1: "Phien da hoan tra",
            txt_bet_success: "Dat cuoc thanh cong",
            txt_bet_error2: "Dat cuoc that bai",
            txt_bet_error3: "Da het thoi gian dat cuoc",
            txt_bet_error7: "So tien cuoc khong hop le",
            txt_not_enough: "So du khong du",
            txt_notify_fast_action: "Ban thao tac qua nhanh",
            txt_taixiu_chat_error4: "Khong the dat 2 cua",
            txt_need_login: "Vui long dang nhap"
        };
        appMock.getTextLang = (key: string) => {
            if (!key) return "";
            if (typeof fallbackLang[key] !== "undefined") {
                return fallbackLang[key];
            }
            if (key.indexOf("txt_") === 0) {
                return "";
            }
            return key;
        };
        AppClass.instance = appMock;
    }

    private setupDevNetworkMock() {
        const miniClientClass = this.requireDefault("MiniGameNetworkClient");
        const tx2ClientClass = this.requireDefault("TX2NetworkClient");
        if (miniClientClass && typeof miniClientClass.getInstance === "function") {
            this.patchNetworkClient(miniClientClass.getInstance());
        }
        if (tx2ClientClass && typeof tx2ClientClass.getInstance === "function") {
            this.patchNetworkClient(tx2ClientClass.getInstance());
        }
    }

    private patchNetworkClient(client: any) {
        if (!client) return;
        if (!client.__devOriginalMethods) {
            client.__devOriginalMethods = {
                checkConnect: client.checkConnect,
                addListener: client.addListener,
                addOnClose: client.addOnClose,
                send: client.send,
                sendCheck: client.sendCheck,
                connect: client.connect,
                close: client.close,
                ping: client.ping,
                isConnected: client.isConnected
            };
        }
        client.checkConnect = (onLogined?: () => void) => {
            if (onLogined) onLogined();
        };
        client.addListener = () => { };
        client.addOnClose = () => { };
        client.send = (packet: any) => {
            this.handleDevPacket(packet);
        };
        client.sendCheck = (packet: any) => {
            if (client.checkConnect) {
                client.checkConnect(() => client.send(packet));
            }
        };
        client.connect = () => { };
        client.close = () => { };
        client.ping = () => { };
        client.isConnected = () => true;
    }

    private restoreDevNetworkMock() {
        const miniClientClass = this.requireDefault("MiniGameNetworkClient");
        const tx2ClientClass = this.requireDefault("TX2NetworkClient");
        if (miniClientClass && typeof miniClientClass.getInstance === "function") {
            this.restoreNetworkClient(miniClientClass.getInstance());
        }
        if (tx2ClientClass && typeof tx2ClientClass.getInstance === "function") {
            this.restoreNetworkClient(tx2ClientClass.getInstance());
        }
    }

    private restoreNetworkClient(client: any) {
        if (!client || !client.__devOriginalMethods) return;
        const methods = client.__devOriginalMethods;
        client.checkConnect = methods.checkConnect;
        client.addListener = methods.addListener;
        client.addOnClose = methods.addOnClose;
        client.send = methods.send;
        client.sendCheck = methods.sendCheck;
        client.connect = methods.connect;
        client.close = methods.close;
        client.ping = methods.ping;
        client.isConnected = methods.isConnected;
        delete client.__devOriginalMethods;
    }

    private getCanvasNode(): cc.Node {
        const scene = cc.director.getScene();
        if (!scene) return null;
        return scene.getChildByName("Canvas");
    }

    private ensureDevDependencies(done: () => void) {
        if (this.devDepsReady) {
            done();
            return;
        }
        this.devDepsPending.push(done);
        if (this.devDepsLoading) return;
        this.devDepsLoading = true;

        BundleControl.loadBundle("Lobby", () => {
            this.devDepsReady = true;
            this.devDepsLoading = false;
            const pending = this.devDepsPending.slice();
            this.devDepsPending = [];
            for (let i = 0; i < pending.length; i++) {
                pending[i]();
            }
        });
    }

    private loadDevGamePrefab(targetGame: string, useOfflineMock: boolean = true) {
        const requestedGame = targetGame;
        const loadInfo = this.getMiniGamePrefabInfo(requestedGame);
        BundleControl.loadPrefabGame(loadInfo.bundleName, loadInfo.prefabPath, (finish, total) => {
            if (this.devCurrentGame !== requestedGame) return;
            let progress = total > 0 ? (finish / total) : 0;
            if (progress < 0) progress = 0;
            if (progress > 1) progress = 1;
            const modeLabel = useOfflineMock ? "DEV mode" : "ONLINE mode";
            this.lblStatus.string = modeLabel + ": loading " + requestedGame + " " + parseInt((progress * 100) + "") + "%";
            this.spriteProgress.fillRange = progress;
            this.nodeSlider.progress = progress;
        }, (prefab, bundle) => {
            if (this.devCurrentGame !== requestedGame) return;
            const parent = this.getCanvasNode() || this.node.parent || this.node;
            if (!prefab) {
                this.lblStatus.string = "Khong load duoc prefab " + loadInfo.prefabPath;
                return;
            }
            let gameNode = cc.instantiate(prefab);
            gameNode.parent = parent;
            gameNode.position = cc.Vec3.ZERO;
            // Keep node inactive so controller.show() runs full first-time init logic.
            gameNode.active = false;
            this.attachMiniGameBundle(requestedGame, gameNode, bundle);
            this.devCurrentGameNode = gameNode;
            this.tryShowMiniGame(gameNode, useOfflineMock);
            if (requestedGame === "XocDia") {
                this.lblStatus.string = "PREFAB mode: XocDia (Play)";
            } else {
                this.lblStatus.string = useOfflineMock ? ("DEV mode: " + requestedGame + " (offline)") : ("ONLINE mode: " + requestedGame + " connected");
            }
            this.bringDevSwitchPanelToFront();
        });
    }

    private getMiniGamePrefabInfo(targetGame: string): { bundleName: string, prefabPath: string } {
        if (targetGame === "XocDia") {
            return {
                bundleName: "XocDia",
                prefabPath: "res/prefabs/Play"
            };
        }
        return {
            bundleName: targetGame,
            prefabPath: targetGame
        };
    }

    private attachMiniGameBundle(targetGame: string, gameNode: cc.Node, bundle: any) {
        if (!gameNode || !bundle) return;
        if (targetGame !== "BauCua") return;
        const ctrl: any = gameNode.getComponent("BauCua.BauCuaController");
        if (ctrl) {
            ctrl.baucuaBundle = bundle;
        }
    }

    private requireDefault(moduleName: string): any {
        const req = this.getGlobalRequire();
        if (!req) return null;
        try {
            const mod = req(moduleName);
            return mod && mod.default ? mod.default : mod;
        } catch (error) {
            return null;
        }
    }

    private getGlobalRequire(): any {
        const g: any = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
        if (!g) return null;
        return typeof g.__require === "function" ? g.__require : null;
    }

    private hideLoadingUiForDev() {
        if (this.lbTips && this.lbTips.node) this.lbTips.node.active = false;
        if (this.nodeSlider && this.nodeSlider.node) this.nodeSlider.node.active = false;
        if (this.spriteProgress && this.spriteProgress.node) this.spriteProgress.node.active = false;
        // Hide runtime status text (e.g. "ONLINE mode: ... connected") on dev mini-game routes.
        if (this.lblStatus && this.lblStatus.node) this.lblStatus.node.active = false;
        const canvas = this.getCanvasNode();
        if (!canvas) return;
        const sceneBg = canvas.getChildByName(this.getDevSceneBackgroundNodeName());
        if (sceneBg) {
            sceneBg.active = ClientEndpointConfig.DEV_USE_SCENE_BACKGROUND === true;
            if (sceneBg.active) {
                sceneBg.setSiblingIndex(0);
            }
        }
    }

    private getDevSceneBackgroundNodeName(): string {
        const raw = (ClientEndpointConfig.DEV_SCENE_BACKGROUND_NODE || "").trim();
        return raw.length > 0 ? raw : "mobile-lobby-bg";
    }

    private createDevBackground(canvas: cc.Node, targetGame: string, useOfflineMock: boolean = true) {
        if (!canvas) return;

        let oldBg = canvas.getChildByName("DevOfflineBackground");
        if (oldBg) {
            oldBg.destroy();
        }

        const sceneBg = canvas.getChildByName(this.getDevSceneBackgroundNodeName());
        const useSceneBackground = ClientEndpointConfig.DEV_USE_SCENE_BACKGROUND === true;
        if (useSceneBackground && sceneBg) {
            sceneBg.active = true;
            sceneBg.setSiblingIndex(0);
            return;
        }
        if (sceneBg) {
            sceneBg.active = false;
        }

        const bgNode = new cc.Node("DevOfflineBackground");
        bgNode.parent = canvas;
        bgNode.setSiblingIndex(0);
        bgNode.width = canvas.width;
        bgNode.height = canvas.height;
        bgNode.position = cc.Vec3.ZERO;

        const widget = bgNode.addComponent(cc.Widget);
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.top = 0;
        widget.bottom = 0;
        widget.left = 0;
        widget.right = 0;
        widget.alignMode = cc.Widget.AlignMode.ALWAYS;

        const graphics = bgNode.addComponent(cc.Graphics);
        const size = canvas.getContentSize();
        const w = size.width;
        const h = size.height;

        const mainColor = targetGame === "TaiXiuMD5" ? new cc.Color(26, 22, 60, 255) : new cc.Color(16, 36, 64, 255);
        const accentA = targetGame === "TaiXiuMD5" ? new cc.Color(44, 96, 184, 255) : new cc.Color(15, 134, 176, 255);
        const accentB = targetGame === "TaiXiuMD5" ? new cc.Color(28, 166, 132, 255) : new cc.Color(241, 163, 74, 255);

        graphics.clear();
        graphics.fillColor = mainColor;
        graphics.rect(-w / 2, -h / 2, w, h);
        graphics.fill();

        graphics.fillColor = accentA;
        graphics.circle(-w * 0.35, h * 0.42, w * 0.42);
        graphics.fill();

        graphics.fillColor = accentB;
        graphics.circle(w * 0.42, -h * 0.28, w * 0.35);
        graphics.fill();

        const titleNode = new cc.Node("DevTitle");
        titleNode.parent = bgNode;
        titleNode.y = h * 0.43;
        const title = titleNode.addComponent(cc.Label);
        title.fontSize = 34;
        title.lineHeight = 40;
        title.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        title.string = targetGame + (useOfflineMock ? " DEV OFFLINE" : " ONLINE");

        const subNode = new cc.Node("DevSubTitle");
        subNode.parent = bgNode;
        subNode.y = h * 0.38;
        const subTitle = subNode.addComponent(cc.Label);
        subTitle.fontSize = 20;
        subTitle.lineHeight = 24;
        subTitle.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        subTitle.string = useOfflineMock ? "Khong can server - dung de test giao dien" : "Dang ket noi server that";
    }

    private createDevSwitchPanel(canvas: cc.Node, targetGame: string, useOfflineMock: boolean = true) {
        if (!canvas) return;
        if (this.devSwitchPanel && cc.isValid(this.devSwitchPanel)) {
            this.devSwitchPanel.destroy();
            this.devSwitchPanel = null;
        }

        // Hide quick game-switch buttons on dev scene by request.
        this.devSwitchPanel = null;

        this.createOrUpdateDevAccountPanel(canvas);
        this.bringDevSwitchPanelToFront();
    }

    private createDevSwitchButton(parent: cc.Node, text: string, active: boolean, onClick: () => void): cc.Node {
        const buttonNode = new cc.Node(text + "Btn");
        buttonNode.parent = parent;
        buttonNode.width = 220;
        buttonNode.height = 58;

        const graphics = buttonNode.addComponent(cc.Graphics);
        graphics.clear();
        graphics.lineWidth = 2;
        graphics.fillColor = active ? new cc.Color(255, 212, 120, 255) : new cc.Color(10, 33, 66, 220);
        graphics.strokeColor = active ? new cc.Color(255, 236, 174, 255) : new cc.Color(72, 152, 225, 255);
        graphics.roundRect(-buttonNode.width / 2, -buttonNode.height / 2, buttonNode.width, buttonNode.height, 14);
        graphics.fill();
        graphics.stroke();

        const labelNode = new cc.Node("Label");
        labelNode.parent = buttonNode;
        const label = labelNode.addComponent(cc.Label);
        label.fontSize = 24;
        label.lineHeight = 28;
        label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        label.string = text;
        labelNode.color = active ? new cc.Color(18, 32, 54, 255) : cc.Color.WHITE;

        buttonNode.on(cc.Node.EventType.TOUCH_END, () => {
            onClick();
        }, this);

        return buttonNode;
    }

    private createOrUpdateDevAccountPanel(canvas: cc.Node) {
        if (!canvas) return;

        if (!this.devAccountPanel || !cc.isValid(this.devAccountPanel)) {
            const panel = new cc.Node("DevAccountPanel");
            panel.parent = canvas;
            panel.width = 250;
            panel.height = 88;
            this.devAccountPanel = panel;

            const widget = panel.addComponent(cc.Widget);
            widget.isAlignTop = true;
            widget.isAlignLeft = true;
            widget.top = 12;
            widget.left = 12;
            widget.alignMode = cc.Widget.AlignMode.ALWAYS;

            const graphics = panel.addComponent(cc.Graphics);
            graphics.clear();
            graphics.fillColor = new cc.Color(8, 22, 44, 190);
            graphics.strokeColor = new cc.Color(95, 176, 240, 220);
            graphics.lineWidth = 1.5;
            graphics.roundRect(-panel.width / 2, -panel.height / 2, panel.width, panel.height, 12);
            graphics.fill();
            graphics.stroke();

            const idNode = new cc.Node("DevAccountId");
            idNode.parent = panel;
            idNode.anchorX = 0;
            idNode.x = -panel.width / 2 + 16;
            idNode.y = 14;
            this.devAccountIdLabel = idNode.addComponent(cc.Label);
            this.devAccountIdLabel.fontSize = 24;
            this.devAccountIdLabel.lineHeight = 28;
            this.devAccountIdLabel.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
            this.devAccountIdLabel.string = "#ID: --";

            const coinNode = new cc.Node("DevAccountCoin");
            coinNode.parent = panel;
            coinNode.anchorX = 0;
            coinNode.x = -panel.width / 2 + 16;
            coinNode.y = -18;
            this.devAccountCoinLabel = coinNode.addComponent(cc.Label);
            this.devAccountCoinLabel.fontSize = 24;
            this.devAccountCoinLabel.lineHeight = 28;
            this.devAccountCoinLabel.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
            this.devAccountCoinLabel.string = "S\u1ed1 d\u01b0: 0";
        }

        this.refreshDevAccountPanel();
        this.unschedule(this.refreshDevAccountPanel);
        this.schedule(this.refreshDevAccountPanel, 0.25);
    }

    private refreshDevAccountPanel() {
        if (!this.devAccountPanel || !cc.isValid(this.devAccountPanel)) return;

        if (this.devAccountIdLabel && cc.isValid(this.devAccountIdLabel.node)) {
            const userId = Math.floor(Number(Configs.Login.UserId || 0));
            this.devAccountIdLabel.string = "#ID: " + (userId > 0 ? userId : "--");
        }

        if (this.devAccountCoinLabel && cc.isValid(this.devAccountCoinLabel.node)) {
            const coin = Math.max(0, Math.floor(Number(Configs.Login.Coin || 0)));
            this.devAccountCoinLabel.string = "S\u1ed1 d\u01b0: " + this.formatDevNumber(coin);
        }
    }

    private bringDevSwitchPanelToFront() {
        if (this.devSwitchPanel && cc.isValid(this.devSwitchPanel) && this.devSwitchPanel.parent) {
            this.devSwitchPanel.setSiblingIndex(this.devSwitchPanel.parent.childrenCount - 1);
        }
        if (this.devAccountPanel && cc.isValid(this.devAccountPanel) && this.devAccountPanel.parent) {
            this.devAccountPanel.setSiblingIndex(this.devAccountPanel.parent.childrenCount - 1);
        }
    }

    private tryShowMiniGame(gameNode: cc.Node, useOfflineMock: boolean = true) {
        if (!useOfflineMock && this.requiresMiniGameNetworkReady(this.devCurrentGame)) {
            this.ensureMiniGameNetworkReady(() => {
                if (!gameNode || !cc.isValid(gameNode)) return;
                if (this.devCurrentGameNode !== gameNode) return;
                this.showMiniGameNode(gameNode, useOfflineMock);
            });
            return;
        }
        this.showMiniGameNode(gameNode, useOfflineMock);
    }

    private showMiniGameNode(gameNode: cc.Node, useOfflineMock: boolean = true) {
        if (!gameNode) return;
        if (this.devCurrentGame === "XocDia") {
            // XocDia Play prefab has show(data) and should not be called without room payload.
            gameNode.active = true;
            return;
        }
        const components = gameNode.getComponents(cc.Component);
        let didShow = false;
        for (let i = 0; i < components.length; i++) {
            const comp: any = components[i];
            if (comp && typeof comp.show === "function") {
                comp.show();
                didShow = true;
                break;
            }
        }
        if (!didShow) {
            gameNode.active = true;
        }
        if (useOfflineMock && this.isTaiXiuDevGame(this.devCurrentGame)) {
            this.scheduleDevMockForNode(gameNode);
        }
    }

    private requiresMiniGameNetworkReady(targetGame: string): boolean {
        return targetGame === "MiniPoker" || targetGame === "BauCua";
    }

    private ensureMiniGameNetworkReady(done: () => void) {
        const MiniClientClass = this.requireDefault("MiniGameNetworkClient");
        if (!MiniClientClass || typeof MiniClientClass.getInstance !== "function") {
            done();
            return;
        }

        let called = false;
        const finish = () => {
            if (called) return;
            called = true;
            done();
        };

        const timeoutId: any = setTimeout(() => {
            finish();
        }, 1500);

        try {
            const client = MiniClientClass.getInstance();
            if (!client || typeof client.checkConnect !== "function") {
                clearTimeout(timeoutId);
                finish();
                return;
            }
            client.checkConnect(() => {
                clearTimeout(timeoutId);
                cc.log("[Loading] MiniGameNetworkClient login success.");
                finish();
            });
        } catch (error) {
            clearTimeout(timeoutId);
            finish();
        }
    }

    private scheduleDevMockForNode(gameNode: cc.Node) {
        if (!this.isTaiXiuDevGame(this.devCurrentGame)) {
            return;
        }
        const gameKey = this.getDevGameKey(this.devCurrentGame);
        this.scheduleOnce(() => {
            if (this.devCurrentGame !== gameKey) return;
            if (!gameNode || !cc.isValid(gameNode)) return;
            const controller = this.findDevMiniController(gameNode, gameKey);
            if (!controller) {
                cc.warn("[DEV] TaiXiu controller not found for mock data.");
                return;
            }
            this.startDevMockLoop(controller, gameKey);
        }, 0.05);
    }

    private getDevGameKey(targetGame: string): TaiXiuDevGame {
        if (targetGame === "TaiXiuMD5") {
            return "TaiXiuMD5";
        }
        return "TaiXiuDouble";
    }

    private findDevMiniController(root: cc.Node, targetGame: TaiXiuDevGame): any {
        const queue: cc.Node[] = [root];
        while (queue.length > 0) {
            const node = queue.shift();
            if (!node) break;
            const components = node.getComponents(cc.Component);
            for (let i = 0; i < components.length; i++) {
                const comp: any = components[i];
                if (this.isDevMiniController(comp, targetGame)) {
                    return comp;
                }
            }
            for (let i = 0; i < node.childrenCount; i++) {
                queue.push(node.children[i]);
            }
        }
        return null;
    }

    private isDevMiniController(comp: any, targetGame: TaiXiuDevGame): boolean {
        if (!comp) return false;
        if (!comp.node || !comp.node.activeInHierarchy) return false;
        if (!comp.lblSession || !comp.lblTotalBetTai || !comp.lblTotalBetXiu) return false;
        if (typeof comp.showResult !== "function") return false;
        if (targetGame === "TaiXiuMD5" && !comp.lblMD5Text) return false;
        return true;
    }

    private startDevMockLoop(controller: any, game: TaiXiuDevGame) {
        this.stopDevMockLoop();
        this.devMockController = controller;
        let state = this.devMockStates[game];
        if (!state) {
            state = createTaiXiuDevState(game);
            this.devMockStates[game] = state;
        }
        this.applyDevMockSnapshot(controller, game, "tick", state);
        this.devMockTimer = setInterval(() => {
            if (this.devCurrentGame !== game) {
                this.stopDevMockLoop();
                return;
            }
            if (!controller || !controller.node || !cc.isValid(controller.node)) {
                this.stopDevMockLoop();
                return;
            }
            const event = advanceTaiXiuDevState(state);
            this.applyDevMockSnapshot(controller, game, event, state);
        }, 1000);
    }

    private stopDevMockLoop() {
        if (this.devMockTimer != null) {
            clearInterval(this.devMockTimer);
            this.devMockTimer = null;
        }
        this.devMockController = null;
    }

    private handleDevPacket(packet: any) {
        if (!packet || typeof packet._cmdId !== "number") return;
        const game = this.getDevGameKey(this.devCurrentGame);
        const state = this.devMockStates[game];
        const controller = this.devMockController;
        if (!state || !controller) return;

        const cmdId = packet._cmdId;
        if (cmdId === 2110 || cmdId === 22110) {
            this.applyDevBetPacket(state, packet);
            this.applyDevMockSnapshot(controller, game, "tick", state);
        }
    }

    private applyDevBetPacket(state: TaiXiuDevState, packet: any) {
        if (state.phase !== "betting") return;
        const bytes: number[] = Array.isArray(packet._data) ? packet._data : [];
        if (bytes.length < 32) return;
        const betValue = this.readLongBE(bytes, 18);
        const door = this.readShortBE(bytes, 28);
        if (betValue <= 0) return;

        if (door === 1) {
            state.betTai += betValue;
            state.potTai += betValue;
        } else {
            state.betXiu += betValue;
            state.potXiu += betValue;
        }
        state.currentMoney = Math.max(0, state.currentMoney - betValue);
    }

    private readShortBE(bytes: number[], offset: number): number {
        const hi = bytes[offset] & 0xff;
        const lo = bytes[offset + 1] & 0xff;
        return (hi << 8) | lo;
    }

    private readLongBE(bytes: number[], offset: number): number {
        let value = 0;
        for (let i = 0; i < 8; i++) {
            value = value * 256 + (bytes[offset + i] & 0xff);
        }
        return Math.floor(value);
    }

    private applyDevMockSnapshot(controller: any, game: TaiXiuDevGame, event: TaiXiuDevTickEvent, state: TaiXiuDevState) {
        controller["referenceId"] = state.referenceId;
        controller["remainTime"] = state.remainTime;
        controller["isBetting"] = state.phase === "betting";
        controller["betedTai"] = state.betTai;
        controller["betedXiu"] = state.betXiu;
        controller["histories"] = state.histories.slice();

        Configs.Login.Coin = state.currentMoney;
        this.setLabelString(controller.lblSession, "#" + state.referenceId);
        this.setLabelString(controller.lblTotalBetTai, this.formatDevNumber(state.potTai));
        this.setLabelString(controller.lblTotalBetXiu, this.formatDevNumber(state.potXiu));
        this.setLabelString(controller.lblUserTai, this.formatDevNumber(state.numBetTai));
        this.setLabelString(controller.lblUserXiu, this.formatDevNumber(state.numBetXiu));
        this.setLabelString(controller.lblBetedTai, game === "TaiXiuMD5" ? (state.betTai > 0 ? this.formatDevNumber(state.betTai) : "") : this.formatDevNumber(state.betTai));
        this.setLabelString(controller.lblBetedXiu, game === "TaiXiuMD5" ? (state.betXiu > 0 ? this.formatDevNumber(state.betXiu) : "") : this.formatDevNumber(state.betXiu));
        if (controller.lbJackPotTai) this.setLabelString(controller.lbJackPotTai, this.formatDevNumber(state.jpTai));
        if (controller.lbJackPotXiu) this.setLabelString(controller.lbJackPotXiu, this.formatDevNumber(state.jpXiu));
        if (game === "TaiXiuMD5") {
            this.setLabelString(controller.lblMD5Text, state.md5Code);
        }

        if (state.phase === "betting") {
            this.setNodeActive(controller.lblRemainTime, true);
            this.setLabelString(controller.lblRemainTime, this.pad2(state.remainTime));
            if (controller.fontTime && controller.fontTime.length > 0 && controller.lblRemainTime) {
                const idx = state.remainTime < 10 && controller.fontTime.length > 1 ? 1 : 0;
                controller.lblRemainTime.font = controller.fontTime[idx];
            }
            if (controller.lblRemainTime2 && controller.lblRemainTime2.node && controller.lblRemainTime2.node.parent) {
                controller.lblRemainTime2.node.parent.active = false;
            }
            if (controller.lblScore && controller.lblScore.node && controller.lblScore.node.parent) {
                controller.lblScore.node.parent.active = false;
            }
        } else {
            this.setNodeActive(controller.lblRemainTime, false);
            if (controller.lblRemainTime2 && controller.lblRemainTime2.node && controller.lblRemainTime2.node.parent) {
                controller.lblRemainTime2.node.parent.active = true;
            }
            this.setNodeActive(controller.lblRemainTime2, true);
            this.setLabelString(controller.lblRemainTime2, this.pad2(state.remainTime));
        }

        if (event === "result") {
            this.applyDevResultEvent(controller, game, state);
        } else if (event === "new_round") {
            this.applyDevNewRoundEvent(controller, game, state);
        }
    }

    private applyDevResultEvent(controller: any, game: TaiXiuDevGame, state: TaiXiuDevState) {
        const score = state.dices[0] + state.dices[1] + state.dices[2];
        controller["lastScore"] = score;
        controller["resultData"] = {
            currentMoney: state.currentMoney,
            totalMoney: state.totalMoney
        };
        if (game === "TaiXiuMD5") {
            controller["md5CodeResult"] = state.md5Code;
        }
        controller["isOpenBowl"] = false;

        this.applyDiceFace(controller, "dice1", state.dices[0]);
        this.applyDiceFace(controller, "dice2", state.dices[1]);
        this.applyDiceFace(controller, "dice3", state.dices[2]);

        const isNan = !!controller["isNan"];
        if (isNan) {
            this.setBowlToStart(controller, true);
            if (typeof controller.updateStatusBlow === "function") {
                this.tryCallWithArgs(controller, "updateStatusBlow", ["NAN"]);
            } else {
                this.setNodeActive(controller.bowl, true);
            }
            controller["lastWinCash"] = state.totalMoney;
            this.tryCallWithArgs(controller, "showToast", ["Xin moi nan bat"]);
        } else {
            if (typeof controller.updateStatusBlow === "function") {
                this.tryCallWithArgs(controller, "updateStatusBlow", ["ANIM_OPEN"]);
            } else {
                this.setBowlToStart(controller, false);
            }
            this.tryCall(controller, "showResult");
            this.tryCall(controller, "updateBtnHistories");

            if (typeof controller.handleResult === "function") {
                this.tryCall(controller, "handleResult");
            } else if (state.totalMoney > 0) {
                controller["lastWinCash"] = state.totalMoney;
                this.tryCall(controller, "showWinCash");
            }
        }
    }

    private applyDevNewRoundEvent(controller: any, game: TaiXiuDevGame, state: TaiXiuDevState) {
        controller["resultData"] = null;
        controller["lastWinCash"] = 0;
        controller["isOpenBowl"] = false;
        this.tryCall(controller, "stopWin");
        this.setNodeActive(controller.dice1, false);
        this.setNodeActive(controller.dice2, false);
        this.setNodeActive(controller.dice3, false);
        this.setNodeActive(controller.layoutBet, false);
        if (controller.layoutBet) controller.layoutBet.y = 28;
        this.setBowlToStart(controller, false);

        if (game === "TaiXiuMD5") {
            this.setLabelString(controller.lblBetTai, "");
            this.setLabelString(controller.lblBetXiu, "");
            this.setLabelString(controller.lblMD5Text, state.md5Code);
            if (typeof controller.updateStatusBlow === "function") {
                this.tryCallWithArgs(controller, "updateStatusBlow", ["SHOW"]);
            }
        } else {
            this.setLabelString(controller.lblBetTai, "ĐẶT CƯỢC");
            this.setLabelString(controller.lblBetXiu, "ĐẶT CƯỢC");
        }
    }

    private setBowlToStart(controller: any, active: boolean) {
        if (!controller || !controller.bowl) return;
        const bowlNode = controller.bowl.node ? controller.bowl.node : controller.bowl;
        if (!bowlNode) return;
        bowlNode.active = active;
        if (controller.bowlStartPos && typeof bowlNode.setPosition === "function") {
            bowlNode.setPosition(controller.bowlStartPos);
        }
    }

    private applyDiceFace(controller: any, diceKey: string, diceValue: number) {
        const dice = controller[diceKey];
        if (!dice || !dice.node) return;
        dice.node.active = true;
        if (typeof controller.getAnimationDiceEnd !== "function" || typeof dice.setAnimation !== "function") return;
        try {
            const animName = controller.getAnimationDiceEnd(diceValue);
            if (animName) {
                dice.setAnimation(0, animName, false);
            }
        } catch (error) {
            // keep dev mode resilient when a skeleton has no matching animation
        }
    }

    private setLabelString(label: any, value: string) {
        if (!label || typeof label.string === "undefined") return;
        label.string = value;
    }

    private setNodeActive(target: any, active: boolean) {
        if (!target) return;
        const node = target.node ? target.node : target;
        if (!node || typeof node.active === "undefined") return;
        node.active = active;
    }

    private tryCall(target: any, methodName: string) {
        if (!target || typeof target[methodName] !== "function") return;
        try {
            target[methodName]();
        } catch (error) {
            cc.warn("[DEV] call failed:", methodName, error);
        }
    }

    private tryCallWithArgs(target: any, methodName: string, args: any[]) {
        if (!target || typeof target[methodName] !== "function") return;
        try {
            target[methodName].apply(target, args || []);
        } catch (error) {
            cc.warn("[DEV] call failed:", methodName, error);
        }
    }

    private formatDevNumber(value: number): string {
        const safeValue = Math.max(0, Math.floor(value || 0));
        return safeValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    private pad2(value: number): string {
        const n = Math.max(0, Math.floor(value || 0));
        return n < 10 ? "0" + n : "" + n;
    }

    loadScriptCore() {
        BundleControl.loadBundle("ScriptCore", (bundle) => {
            this.loadLobby();
        });
    }

    loadLobby() {
        var self = this;
        let time = new Date().getTime();
        BundleControl.loadBundle("Lobby", (bundle) => {
            Global.BundleLobby = bundle;
            let size = this.listSkeData.length;
            for (let i = 0; i < size; i++) {
                let path = this.listSkeData[i];
                bundle.load(path, sp.SkeletonData, (err, asset) => {
                    if (err) {
                        //  cc.log("err load ske:", err);
                        return;
                    }
                    // cc.log("load Success Ske Data:" + path);
                });
            }
            bundle.loadScene('Lobby', function (finish, total, item) {
                self.lblStatus.string = "Đang tải dữ liệu "  + parseInt((finish / total) * 100) + "%";
                self.spriteProgress.fillRange = (finish / total);
                self.nodeSlider.progress = self.spriteProgress.fillRange;
            }, (err1, scene) => {
                if (err1 != null) {
                    //  cc.log("Error Load Scene Lobby:", JSON.stringify(err1));
                }
                cc.sys.localStorage.setItem("SceneLobby", scene);
                cc.director.runScene(scene);
                let time2 = new Date().getTime();
                //  cc.log("Time Delta=" + ((time2 - time) / 1000));
            });
            bundle.loadDir("PrefabPopup", cc.Prefab, (err, arrPrefab) => {
                if (err) {
                    //  cc.log("Error Bundle LoadDir PrefabPopup!");
                    return;
                }
            });
        })

    }
    onDestroy() {
        this.stopDevMockLoop();
        this.unschedule(this.refreshDevAccountPanel);
        if (this.devAccountPanel && cc.isValid(this.devAccountPanel)) {
            this.devAccountPanel.destroy();
        }
        this.devAccountPanel = null;
        this.devAccountIdLabel = null;
        this.devAccountCoinLabel = null;
    }
    showTips() {
        this.schedule(() => {
            this.lbTips.string = this.getStrTips();
        }, 3.0, cc.macro.REPEAT_FOREVER, 0.1)
    }
    getStrTips() {
        let langCode = cc.sys.localStorage.getItem("langCode");
        if (langCode == null) {
            langCode = "vi"
        }
        let strTip = this.listTips[this.randomRangeInt(0, this.listTips.length)];
        return strTip[langCode];
    }
    randomRangeInt(min: number, max: number): number {
        //Returns a random number between min (inclusive) and max (inclusive)
        //Math.floor(Math.random() * (max - min + 1)) + min;

        //Returns a random number between min (inclusive) and max (exclusive)
        return Math.floor(Math.random() * (max - min)) + min;
    }

    // update (dt) {}
}










