import Configs from "../../Loading/src/Configs";
import Http from "../../Loading/src/Http";
import MiniGame from "../../Lobby/LobbyScript/MiniGame";
import App from "../../Lobby/LobbyScript/Script/common/App";
import BroadcastReceiver from "../../Lobby/LobbyScript/Script/common/BroadcastReceiver";
import ScrollViewControl from "../../Lobby/LobbyScript/Script/common/ScrollViewControl";
import Utils from "../../Lobby/LobbyScript/Script/common/Utils";
import MiniGameNetworkClient from "../../Lobby/LobbyScript/Script/networks/MiniGameNetworkClient";
import InPacket from "../../Lobby/LobbyScript/Script/networks/Network.InPacket";
import ButtonPayBet from "./BauCua.ButtonPayBet";
import cmd from "./BauCua.Cmd";
import PopupHistory from "./BauCua.PopupHistory";
import PopupHonors from "./BauCua.PopupHonors";

var TW = cc.tween;
const { ccclass, property } = cc._decorator;

@ccclass("BauCua.ButtonBet")
export class ButtonBet {
    @property(cc.Button)
    button: cc.Button = null;
    @property(cc.SpriteFrame)
    sfNormal: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    sfActive: cc.SpriteFrame = null;

    @property(sp.Skeleton)
    border_chip: sp.Skeleton = null;
    _isActive = false;

    setActive(isActive: boolean) {
        this._isActive = isActive;
        // this.button.getComponent(cc.Sprite).spriteFrame = isActive ? this.sfActive : this.sfNormal;
        this.button.interactable = !isActive;

        // this.button.getComponentInChildren(cc.Sprite).node.active = isActive;
        if (isActive)
            this.border_chip.node.x = this.button.node.x;
    }
}

@ccclass
export default class BauCuaController extends MiniGame {

    static instance: BauCuaController = null;
    static lastBeted = null;

    @property([cc.SpriteFrame])
    public sprSmallDices: cc.SpriteFrame[] = [];
    @property([cc.ScrollView])
    public scrollChip: cc.ScrollView[] = [];
    @property([cc.SpriteFrame])
    public sprResultDices: cc.SpriteFrame[] = [];
    @property(cc.Label)
    public lblSession: cc.Label = null;
    @property(cc.Label)
    public lblTime: cc.Label = null;
    @property(cc.Label)
    public lblToast: cc.Label = null;
    @property(cc.Label)
    public lblWinCoin: cc.Label = null;
    @property([ButtonBet])
    public buttonBets: ButtonBet[] = [];
    @property([ButtonPayBet])
    public btnPayBets: ButtonPayBet[] = [];
    @property(cc.Node)
    public nodeSoiCau: cc.Node = null;
    @property(cc.Node)
    public nodeHistories: cc.Node = null;
    @property(cc.Node)
    public itemHistoryTemplate: cc.Node = null;
    @property(cc.Button)
    public btnConfirm: cc.Button = null;
    @property(cc.Button)
    public btnCancel: cc.Button = null;
    @property(cc.Button)
    public btnReBet: cc.Button = null;
    @property([cc.Label])
    public lblsSoiCau: cc.Label[] = [];
    @property([cc.Node])
    public popups: cc.Node[] = [];
    @property(cc.Node)
    public popupContainer: cc.Node = null;

    @property(ScrollViewControl)
    public scrHistory: ScrollViewControl = null;

    @property(cc.Node)
    public bowl: cc.Node = null;


    private readonly listBet = [1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];
    private roomId = 0;
    private betIdx = 0;
    private isBetting = false;
    private historiesData = [];
    private beted = [0, 0, 0, 0, 0, 0];
    private betting = [0, 0, 0, 0, 0, 0];
    private inited = false;
    private sprResultDice: cc.Node = null;
    private percentScroll = 0;
    private timeBet;
    private popupHonor: PopupHonors = null;
    private popupHistory: PopupHistory = null;
    private popupGuide = null;
    private isNetworkBound = false;
    private subscribeRetryTimer: any = null;
    private subscribeRetryCount = 0;
    private readonly maxSubscribeRetry = 8;
    private readonly subscribeRetryDelayMs = 350;
    private historyFallbackRequested = false;
    private readonly historyCacheLimit = 60;
    public baucuaBundle = null;
    onLoad() {
        super.onLoad();
        this.sprResultDice = this.bowl.getChildByName("sprResult");
        BauCuaController.instance = this;
        this.bindNetworkHandlersOnce();
    }
    start() {
        this.timeBet = Date.now();
        this.percentScroll = 0;
        this.scrollChip.scrollToPercentHorizontal(this.percentScroll, 0.1);
        if (this.itemHistoryTemplate) {
            this.itemHistoryTemplate.active = false;
        }

        for (let i = 0; i < this.buttonBets.length; i++) {
            var btn = this.buttonBets[i];
            // btn.setActive(i == this.betIdx);
            btn.button.node.on("click", () => {
                this.betIdx = i;
                App.instance.showBgMiniGame("BauCua");
                for (let j = 0; j < this.buttonBets.length; j++) {
                    //  cc.log("this:" + this.betIdx + ":" + j);
                    this.buttonBets[j].setActive(j == this.betIdx);
                }
            });
        }

        for (let i = 0; i < this.btnPayBets.length; i++) {
            this.btnPayBets[i].node.on("click", () => {
                App.instance.showBgMiniGame("BauCua");
                this.actConfirm(i);
            });
        }

        this.bindNetworkHandlersOnce();
    }

    private bindNetworkHandlersOnce() {
        if (this.isNetworkBound) return;
        this.isNetworkBound = true;
        cc.log("[BauCua] bind network handlers.");

        BroadcastReceiver.register(BroadcastReceiver.USER_LOGOUT, () => {
            if (!this.node.active) return;
            this.dismiss();
        }, this);

        MiniGameNetworkClient.getInstance().addOnClose(() => {
            if (!this.node.active) return;
            this.dismiss();
        }, this);

        MiniGameNetworkClient.getInstance().addListener((data: Uint8Array) => {
            this.handleNetworkMessage(data);
        }, this);
    }

    private handleNetworkMessage(data: Uint8Array) {
        if (!this.node.active) return;
        let inpacket = new InPacket(data);
        switch (inpacket.getCmdId()) {
            case cmd.Code.INFO: {
                this.inited = true;
                this.stopInitialInfoRetry();

                let res = new cmd.ReceiveInfo(data);
                cc.log("[BauCua] INFO received. session=" + res.referenceId + ", remain=" + res.remainTime);
                this.isBetting = res.bettingState;
                this.lblSession.string = "#" + res.referenceId;
                this.lblTime.string = this.longToTime(res.remainTime);

                let totalBets = res.potData.split(",");
                let beted = res.betData.split(",");
                for (let i = 0; i < this.btnPayBets.length; i++) {
                    let btnPayBet = this.btnPayBets[i];
                    const total = parseInt(totalBets[i], 10);
                    const betedValue = parseInt(beted[i], 10);
                    btnPayBet.lblTotal.string = this.moneyToK(isNaN(total) ? 0 : total);
                    btnPayBet.lblBeted.string = this.moneyToK(isNaN(betedValue) ? 0 : betedValue);
                    btnPayBet.overlay.active = true;
                    btnPayBet.button.interactable = this.isBetting;
                    btnPayBet.lblFactor.node.active = false;
                    this.beted[i] = isNaN(betedValue) ? 0 : betedValue;
                }

                if (!this.isBetting) {
                    const d1 = this.toSafeDiceValue(res.dice1);
                    const d2 = this.toSafeDiceValue(res.dice2);
                    const d3 = this.toSafeDiceValue(res.dice3);
                    if (d1 >= 0 && d1 < this.btnPayBets.length) this.btnPayBets[d1].overlay.active = false;
                    if (d2 >= 0 && d2 < this.btnPayBets.length) this.btnPayBets[d2].overlay.active = false;
                    if (d3 >= 0 && d3 < this.btnPayBets.length) this.btnPayBets[d3].overlay.active = false;

                    if (res.xValue > 1 && res.xPot >= 0 && res.xPot < this.btnPayBets.length) {
                        this.btnPayBets[res.xPot].lblFactor.node.active = true;
                        this.btnPayBets[res.xPot].lblFactor.string = "x" + res.xValue;
                    }
                }

                cc.log("[BauCua] INFO history raw:", res.lichSuPhien ? res.lichSuPhien.length : 0);
                const parsedHistory = this.parseHistoryData(res.lichSuPhien);
                if (parsedHistory.length > 0) {
                    this.historiesData = parsedHistory;
                    this.persistHistoryCache();
                    this.loadHistory(this.historiesData);
                    this.caculatorSoiCau();
                } else {
                    // Keep existing UI data when a late/empty INFO arrives.
                    if (!Array.isArray(this.historiesData) || this.historiesData.length === 0) {
                        const currentResult = this.buildCurrentResultHistory(res);
                        if (currentResult) {
                            this.historiesData = [currentResult];
                            this.persistHistoryCache();
                        }
                    }
                    this.loadHistory(this.historiesData);
                    this.caculatorSoiCau();
                }
                if (this.historiesData.length === 0) {
                    this.requestHistoryFallbackFromApi();
                }
                break;
            }
            case cmd.Code.START_NEW_GAME: {
                let res = new cmd.ReceiveNewGame(data);
                this.actStartNewGame();
                this.lblSession.string = "#" + res.referenceId;
                for (let i = 0; i < this.btnPayBets.length; i++) {
                    let btnPayBet = this.btnPayBets[i];
                    btnPayBet.lblBeted.string = "0";
                    btnPayBet.lblBeted.node.color = cc.Color.WHITE;
                    btnPayBet.lblTotal.string = "0";
                    btnPayBet.overlay.active = false;
                    btnPayBet.button.interactable = true;
                    btnPayBet.lblFactor.node.active = false;
                }
                this.beted = [0, 0, 0, 0, 0, 0];
                this.betting = [0, 0, 0, 0, 0, 0];
                this.btnConfirm.interactable = true;
                this.btnCancel.interactable = true;
                this.btnReBet.interactable = true;
                break;
            }
            case cmd.Code.UPDATE: {
                let res = new cmd.ReceiveUpdate(data);
                this.lblTime.string = this.longToTime(res.remainTime);

                this.isBetting = res.bettingState == 1;
                let totalBets = res.potData.split(",");
                for (let i = 0; i < this.btnPayBets.length; i++) {
                    let btnPayBet = this.btnPayBets[i];
                    const total = parseInt(totalBets[i], 10);
                    btnPayBet.lblTotal.string = this.moneyToK(isNaN(total) ? 0 : total);
                    if (this.isBetting) {
                        btnPayBet.overlay.active = false;
                        btnPayBet.lblFactor.node.active = false;
                    } else {
                        btnPayBet.button.interactable = false;
                        btnPayBet.lblBeted.string = this.moneyToK(this.beted[i]);
                        btnPayBet.lblBeted.node.color = cc.Color.WHITE;
                    }
                }
                break;
            }
            case cmd.Code.RESULT: {
                let res = new cmd.ReceiveResult(data);
                this.atcShowResult(res);
                break;
            }
            case cmd.Code.PRIZE: {
                let res = new cmd.ReceivePrize(data);
                Configs.Login.Coin = res.currentMoney;
                BroadcastReceiver.send(BroadcastReceiver.USER_UPDATE_COIN);
                this.lblWinCoin.node.stopAllActions();
                this.lblWinCoin.node.setPosition(-26, -16);
                this.lblWinCoin.node.opacity = 0;
                this.lblWinCoin.string = "+" + Utils.formatNumber(res.prize);
                this.lblWinCoin.node.active = true;
                this.lblWinCoin.node.runAction(cc.sequence(
                    cc.spawn(cc.fadeIn(0.2), cc.moveBy(2, cc.v2(0, 100))),
                    cc.fadeOut(0.15),
                    cc.callFunc(() => {
                        this.lblWinCoin.node.active = false;
                    })
                ));
                break;
            }
            case cmd.Code.BET: {
                let res = new cmd.ReceiveBet(data);
                switch (res.result) {
                    case 100:
                        this.showToast(App.instance.getTextLang('txt_bet_error2'));
                        break;
                    case 101:
                        this.showToast(App.instance.getTextLang('txt_bet_error3'));
                        break;
                    case 102:
                        this.showToast(App.instance.getTextLang('txt_not_enough'));
                        break;
                    case 103:
                        this.showToast("Chá»‰ Ä‘Æ°á»£c cÆ°á»£c tá»‘i Ä‘a 1000.000.");
                        this.btnConfirm.interactable = true;
                        this.btnCancel.interactable = true;
                        this.btnReBet.interactable = true;
                        break;
                }
                if (res.result != 1) {
                    break;
                }
                Configs.Login.Coin = res.currentMoney;
                BroadcastReceiver.send(BroadcastReceiver.USER_UPDATE_COIN);
                for (let i = 0; i < this.btnPayBets.length; i++) {
                    this.beted[i] += this.betting[i];
                    this.betting[i] = 0;

                    let btnPayBet = this.btnPayBets[i];
                    btnPayBet.lblBeted.string = this.moneyToK(this.beted[i]);
                    btnPayBet.lblBeted.node.color = cc.Color.WHITE;
                }
                BauCuaController.lastBeted = this.beted;
                this.showToast(App.instance.getTextLang('txt_bet_success'));
                this.btnConfirm.interactable = true;
                this.btnCancel.interactable = true;
                this.btnReBet.interactable = true;
                break;
            }
        }
    }

    private sendSubscribeRequest(reason: string) {
        cc.log("[BauCua] subscribe " + reason + ", room=" + this.roomId);
        MiniGameNetworkClient.getInstance().sendCheck(new cmd.SendScribe(this.roomId));
    }

    private requestInitialInfoWithRetry() {
        this.stopInitialInfoRetry(false);
        this.subscribeRetryCount = 0;
        this.sendSubscribeRequest("initial");
        cc.log("[BauCua] start INFO retry.");
        this.subscribeRetryTimer = setInterval(() => {
            if (!this.node || !cc.isValid(this.node) || !this.node.active) {
                this.stopInitialInfoRetry();
                return;
            }
            if (this.inited) {
                this.stopInitialInfoRetry();
                return;
            }
            this.subscribeRetryCount += 1;
            if (this.subscribeRetryCount > this.maxSubscribeRetry) {
                cc.warn("[BauCua] INFO retry exhausted.");
                this.stopInitialInfoRetry();
                this.requestHistoryFallbackFromApi();
                return;
            }
            this.sendSubscribeRequest("retry#" + this.subscribeRetryCount);
        }, this.subscribeRetryDelayMs);
    }

    private stopInitialInfoRetry(withLog: boolean = true) {
        if (this.subscribeRetryTimer != null) {
            clearInterval(this.subscribeRetryTimer);
            this.subscribeRetryTimer = null;
            if (withLog) {
                cc.log("[BauCua] stop INFO retry.");
            }
        }
        this.subscribeRetryCount = 0;
    }

    private parseHistoryData(rawHistory: string): number[][] {
        const result: number[][] = [];
        if (!rawHistory || rawHistory.length === 0) {
            return result;
        }

        const raw = String(rawHistory).trim();
        if (raw.length === 0) {
            return result;
        }

        // Accept JSON-like payloads: [[d1,d2,d3], ...] or [{dices:[...]}]
        if (raw.charAt(0) === "[") {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    for (let i = 0; i < parsed.length; i++) {
                        const row: any = parsed[i];
                        const dices = Array.isArray(row) ? row : (row && Array.isArray(row.dices) ? row.dices : null);
                        if (!dices || dices.length < 3) continue;
                        const d1 = this.toSafeDiceValue(dices[0]);
                        const d2 = this.toSafeDiceValue(dices[1]);
                        const d3 = this.toSafeDiceValue(dices[2]);
                        if (d1 < 0 || d2 < 0 || d3 < 0) continue;
                        result.push([d1, d2, d3]);
                    }
                }
            } catch (_error) {
                // Continue with CSV parser below.
            }
            if (result.length > 0) return result;
        }

        const normalized = raw.replace(/[|;]+/g, ",").replace(/\s+/g, "");
        const values = normalized.split(",").filter((item) => item !== "");
        if (values.length === 0) {
            return result;
        }

        const step = values.length % 5 === 0 ? 5 : 3;
        for (let i = 0; i + 2 < values.length; i += step) {
            const dice1 = this.toSafeDiceValue(values[i]);
            const dice2 = this.toSafeDiceValue(values[i + 1]);
            const dice3 = this.toSafeDiceValue(values[i + 2]);
            if (dice1 < 0 || dice2 < 0 || dice3 < 0) {
                continue;
            }
            result.push([dice1, dice2, dice3]);
        }
        return result;
    }

    private buildCurrentResultHistory(res: cmd.ReceiveInfo): number[] | null {
        if (!res || res.bettingState) return null;
        const d1 = this.toSafeDiceValue(res.dice1);
        const d2 = this.toSafeDiceValue(res.dice2);
        const d3 = this.toSafeDiceValue(res.dice3);
        if (d1 < 0 || d2 < 0 || d3 < 0) return null;
        return [d1, d2, d3];
    }

    private getHistoryCacheKey(): string {
        const nickname = Configs && Configs.Login && Configs.Login.Nickname ? String(Configs.Login.Nickname) : "guest";
        return "baucua_history_cache_" + nickname;
    }

    private loadHistoryFromCache(): number[][] {
        try {
            if (!cc.sys || !cc.sys.localStorage) return [];
            const raw = cc.sys.localStorage.getItem(this.getHistoryCacheKey());
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            const result: number[][] = [];
            for (let i = 0; i < parsed.length; i++) {
                const row = parsed[i];
                if (!Array.isArray(row) || row.length < 3) continue;
                const d1 = this.toSafeDiceValue(row[0]);
                const d2 = this.toSafeDiceValue(row[1]);
                const d3 = this.toSafeDiceValue(row[2]);
                if (d1 < 0 || d2 < 0 || d3 < 0) continue;
                result.push([d1, d2, d3]);
            }
            return result;
        } catch (_error) {
            return [];
        }
    }

    private persistHistoryCache() {
        try {
            if (!cc.sys || !cc.sys.localStorage) return;
            const source = Array.isArray(this.historiesData) ? this.historiesData : [];
            const max = this.historyCacheLimit > 0 ? this.historyCacheLimit : 60;
            const sliced = source.length > max ? source.slice(source.length - max) : source.slice();
            cc.sys.localStorage.setItem(this.getHistoryCacheKey(), JSON.stringify(sliced));
        } catch (_error) {
        }
    }

    private toSafeDiceValue(rawValue: any): number {
        const value = parseInt(rawValue, 10);
        if (isNaN(value)) return -1;
        const maxDice = Math.max(this.sprSmallDices ? this.sprSmallDices.length : 0, this.sprResultDices ? this.sprResultDices.length : 0, 6);
        // Accept both 0-based (0..5) and 1-based (1..6) dice values.
        if (value >= 0 && value < maxDice) return value;
        if (value >= 1 && value <= maxDice) return value - 1;
        return -1;
    }

    private requestHistoryFallbackFromApi() {
        if (this.historyFallbackRequested) return;
        this.historyFallbackRequested = true;
        cc.log("[BauCua] load history fallback from API.");
        const apiBase = String(Configs.App.API || "");
        const root = apiBase.replace(/\/api\/?$/, "");
        const devSessionsUrl = root + "/api/dev/sessions";
        Http.get(devSessionsUrl, {
            "game": "baucua",
            "limit": 30
        }, (err, res) => {
            if (!this.node || !cc.isValid(this.node) || !this.node.active) {
                this.historyFallbackRequested = false;
                return;
            }
            if (Array.isArray(this.historiesData) && this.historiesData.length > 0) {
                this.historyFallbackRequested = false;
                cc.log("[BauCua] skip fallback: history already available.");
                return;
            }
            const parsed: number[][] = [];
            if (err == null && res && res["ok"] && Array.isArray(res["items"])) {
                const rows = res["items"];
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i] || {};
                    const d1 = this.toSafeDiceValue(row["dice1"]);
                    const d2 = this.toSafeDiceValue(row["dice2"]);
                    const d3 = this.toSafeDiceValue(row["dice3"]);
                    if (d1 < 0 || d2 < 0 || d3 < 0) continue;
                    parsed.push([d1, d2, d3]);
                }
            }
            if (parsed.length > 0) {
                this.historyFallbackRequested = false;
                this.historiesData = parsed;
                this.persistHistoryCache();
                this.loadHistory(this.historiesData);
                this.caculatorSoiCau();
                cc.log("[BauCua] history fallback loaded from /api/dev/sessions:", parsed.length);
                return;
            }

            // Secondary fallback: old transaction endpoint (may be empty if user has no bets).
            Http.get(Configs.App.API, {
                "c": 121,
                "mt": Configs.App.MONEY_TYPE,
                "p": 1,
                "un": Configs.Login.Nickname
            }, (errLegacy, resLegacy) => {
                this.historyFallbackRequested = false;
                if (!this.node || !cc.isValid(this.node) || !this.node.active) return;
                if (Array.isArray(this.historiesData) && this.historiesData.length > 0) {
                    cc.log("[BauCua] skip legacy fallback: history already available.");
                    return;
                }
                if (errLegacy != null || !resLegacy || !resLegacy["success"]) {
                    cc.warn("[BauCua] history fallback error.");
                    return;
                }
                const rows = Array.isArray(resLegacy["transactions"]) ? resLegacy["transactions"] : [];
                for (let i = 0; i < rows.length; i++) {
                    const dicesRaw = rows[i] && rows[i]["dices"] ? String(rows[i]["dices"]) : "";
                    if (!dicesRaw) continue;
                    const parts = dicesRaw.split(",");
                    if (parts.length < 3) continue;
                    const d1 = this.toSafeDiceValue(parts[0]);
                    const d2 = this.toSafeDiceValue(parts[1]);
                    const d3 = this.toSafeDiceValue(parts[2]);
                    if (d1 < 0 || d2 < 0 || d3 < 0) continue;
                    parsed.push([d1, d2, d3]);
                }
                if (parsed.length === 0) {
                    cc.log("[BauCua] history fallback empty.");
                    if ((!this.historiesData || this.historiesData.length === 0)) {
                        this.historiesData = this.loadHistoryFromCache();
                        this.loadHistory(this.historiesData);
                        this.caculatorSoiCau();
                    }
                    return;
                }
                this.historiesData = parsed;
                this.persistHistoryCache();
                this.loadHistory(this.historiesData);
                this.caculatorSoiCau();
                cc.log("[BauCua] history fallback loaded (legacy):", parsed.length);
            });
        });
    }

    onBtnScrollLeft() {
        this.percentScroll -= 0.3;
        if (this.percentScroll <= 0) this.percentScroll = 0;

        this.scrollChip.scrollToPercentHorizontal(this.percentScroll, 0.1);
    }

    onBtnScrollRight() {
        this.percentScroll += 0.3;
        if (this.percentScroll >= 1) this.percentScroll = 1;
        this.scrollChip.scrollToPercentHorizontal(this.percentScroll, 0.1);
    }

    private spin(arrDice) {
        for (let i = 0; i < this.btnPayBets.length; i++) {
            let btnPayBet = this.btnPayBets[i];
            btnPayBet.overlay.active = false;
        }
        for (let i = 0; i < arrDice.length; i++) {
            let btnPayBet = this.btnPayBets[arrDice[i]];
            btnPayBet.overlay.active = true;
            TW(btnPayBet.overlay).then(cc.blink(2.0, 10)).start();
        }

    }

    private longToTime(time: number): string {
        let m = parseInt((time / 60).toString());
        let s = time % 60;
        // return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        return (s < 10 ? "0" : "") + s;
    }

    private moneyToK(money: number): string {
        if (money < 100000) {
            return Utils.formatNumber(money);
        }
        // money = parseInt((money / 1000).toString());
        return Utils.formatMoney(money);
    }

    private addHistory(dices: Array<number>) {
        // if (this.itemHistoryTemplate.parent.childrenCount > 50) {
        //     this.itemHistoryTemplate.parent.children[1].removeFromParent();
        //     this.historiesData.splice(0, 1);
        // }
        this.historiesData.push(dices);
        // let item = cc.instantiate(this.itemHistoryTemplate);
        // item.parent = this.itemHistoryTemplate.parent;
        // item.active = true;
        // item.getChildByName("dice1").getComponent(cc.Sprite).spriteFrame = this.sprSmallDices[dices[0]];
        // item.getChildByName("dice2").getComponent(cc.Sprite).spriteFrame = this.sprSmallDices[dices[1]];
        // item.getChildByName("dice3").getComponent(cc.Sprite).spriteFrame = this.sprSmallDices[dices[2]];
    }
    private loadHistory(historyData) {
        if (!this.scrHistory) return;
        let listData = Array.isArray(historyData) ? historyData.slice() : [];
        listData.reverse();
        let updateCb = (item, dices) => {
            if (!dices || dices.length < 3) {
                item.active = false;
                return;
            }
            item.active = true;
            const sf1 = this.sprSmallDices[dices[0]] || this.sprResultDices[dices[0]] || null;
            const sf2 = this.sprSmallDices[dices[1]] || this.sprResultDices[dices[1]] || null;
            const sf3 = this.sprSmallDices[dices[2]] || this.sprResultDices[dices[2]] || null;
            item.getChildByName("dice1").getComponent(cc.Sprite).spriteFrame = sf1;
            item.getChildByName("dice2").getComponent(cc.Sprite).spriteFrame = sf2;
            item.getChildByName("dice3").getComponent(cc.Sprite).spriteFrame = sf3;
        }
        this.scrHistory.setDataList(updateCb, listData);
    }
    private caculatorSoiCau() {
        let counts = [0, 0, 0, 0, 0, 0];
        for (let i = 0; i < this.historiesData.length; i++) {
            let dices = this.historiesData[i];
            for (let j = 0; j < 3; j++) {
                counts[dices[j]]++;
            }
        }
        for (let i = 0; i < this.lblsSoiCau.length; i++) {
            this.lblsSoiCau[i].string = counts[i].toString();
        }
    }

    private showToast(message: string) {
        this.lblToast.string = message;
        let parent = this.lblToast.node.parent;
        parent.stopAllActions();
        parent.active = true;
        parent.opacity = 0;
        parent.runAction(cc.sequence(cc.fadeIn(0.1), cc.delayTime(2), cc.fadeOut(0.2), cc.callFunc(() => {
            parent.active = false;
        })));
    }

    actSoiCau() {
        this.nodeHistories.active = !this.nodeHistories.active;
        this.nodeSoiCau.active = !this.nodeHistories.active;
    }

    actCancel() {
        if (!this.inited) return;
        for (let i = 0; i < this.btnPayBets.length; i++) {
            let btnPayBet = this.btnPayBets[i];
            btnPayBet.lblBeted.node.color = cc.Color.WHITE;
            btnPayBet.lblBeted.string = this.moneyToK(this.beted[i]);
            this.betting[i] = 0;
        }
    }

    actConfirm(index) {
        if (!this.inited) return;
        if (!this.isBetting) {
            this.showToast(App.instance.getTextLang('txt_bet_error3'));
            return;
        }
        if (Configs.Login.Coin < this.listBet[this.betIdx]) {
            this.showToast(App.instance.getTextLang('txt_not_enough'));
            return;
        }
        if (Date.now() - this.timeBet < 1000) {
            this.showToast(App.instance.getTextLang('txt_notify_fast_action'));
            return;
        }

        this.betting[index] += this.listBet[this.betIdx];
        let total = 0;
        for (let i = 0; i < this.betting.length; i++) {
            total += this.betting[i];
        }
        if (total <= 0) {
            this.showToast(App.instance.getTextLang('txt_bet_error4'));
            return;
        }
        this.btnPayBets[index].lblBeted.string = this.moneyToK(this.betting[index] + this.beted[index]);

        this.timeBet = Date.now();
        MiniGameNetworkClient.getInstance().sendCheck(new cmd.SendBet(this.betting.toString()));
        this.btnConfirm.interactable = false;
        this.btnCancel.interactable = false;
        this.btnReBet.interactable = false;
    }



    actReBet() {
        if (!this.inited) return;
        if (!this.isBetting) {
            this.showToast(App.instance.getTextLang('txt_bet_error3'));
            return;
        }
        if (BauCuaController.lastBeted == null) {
            this.showToast(App.instance.getTextLang('txt_bet_error5'));
            return;
        }
        let totalBeted = 0;
        for (let i = 0; i < this.beted.length; i++) {
            totalBeted += this.beted[i];
        }
        if (totalBeted > 0) {
            this.showToast(App.instance.getTextLang('txt_bet_error6'));
            return;
        }
        this.betting = BauCuaController.lastBeted;
        MiniGameNetworkClient.getInstance().sendCheck(new cmd.SendBet(BauCuaController.lastBeted.toString()));
        this.btnConfirm.interactable = false;
        this.btnCancel.interactable = false;
        this.btnReBet.interactable = false;
    }

    show() {
        if (this.node.active && this.inited) {
            this.reOrder();
            return;
        }
        this.bindNetworkHandlersOnce();
        cc.log("[BauCua] show.");
        if (!this.node.active) {
            super.show();
        }
        App.instance.showBgMiniGame("BauCua");
        this.inited = false;
        this.lblToast.node.parent.active = false;
        this.lblWinCoin.node.active = false;
        this.betIdx = 0;
        this.betting = [0, 0, 0, 0, 0, 0];
        this.beted = [0, 0, 0, 0, 0, 0];
        this.historiesData = this.loadHistoryFromCache();
        this.historyFallbackRequested = false;
        this.loadHistory(this.historiesData);
        this.caculatorSoiCau();

        this.nodeHistories.active = true;
        this.nodeSoiCau.active = !this.nodeHistories.active;
        this.nodeHistories.getComponent(cc.ScrollView).scrollToTop(0);

        for (let i = 0; i < this.buttonBets.length; i++) {
            this.buttonBets[i].setActive(i == this.betIdx);
        }
        for (let i = 0; i < this.btnPayBets.length; i++) {
            let btnPayBet = this.btnPayBets[i];
            btnPayBet.lblBeted.string = "0";
            btnPayBet.lblBeted.node.color = cc.Color.WHITE;
            btnPayBet.lblTotal.string = "0";
            btnPayBet.lblFactor.node.active = false;
            btnPayBet.overlay.active = true;
            btnPayBet.button.interactable = false;
        }

        this.requestInitialInfoWithRetry();
    }

    dismiss() {
        this.stopInitialInfoRetry();
        this.inited = false;
        this.historyFallbackRequested = false;
        super.dismiss();
        for (let i = 0; i < this.popups.length; i++) {
            this.popups[i].active = false;
        }

        App.instance.hideGameMini("BauCua");
        // for (let i = 1; i < this.itemHistoryTemplate.parent.childrenCount; i++) {
        //     this.itemHistoryTemplate.parent.children[i].destroy();
        // }
        MiniGameNetworkClient.getInstance().send(new cmd.SendUnScribe(this.roomId));
    }
    onDestroy() {
        this.stopInitialInfoRetry(false);
    }
    _onShowed() {
        super._onShowed;

    }

    public reOrder() {
        super.reOrder();
    }

    atcShowResult(res) {
        const d1 = this.toSafeDiceValue(res.dice1);
        const d2 = this.toSafeDiceValue(res.dice2);
        const d3 = this.toSafeDiceValue(res.dice3);
        if (d1 < 0 || d2 < 0 || d3 < 0) {
            cc.warn("[BauCua] Invalid RESULT dices:", res.dice1, res.dice2, res.dice3);
            return;
        }

        this.sprResultDice.children[0].getComponent(cc.Sprite).spriteFrame = this.sprResultDices[d1];
        this.sprResultDice.children[1].getComponent(cc.Sprite).spriteFrame = this.sprResultDices[d2];
        this.sprResultDice.children[2].getComponent(cc.Sprite).spriteFrame = this.sprResultDices[d3];
        let bowlOn = this.bowl.getChildByName("bowl");
        cc.Tween.stopAllByTarget(bowlOn);
        TW(bowlOn).to(0.7, { y: bowlOn.y + 50, opacity: 150, scale: 1.1 }, { easing: cc.easing.sineIn })
            .call(() => {
                this.historiesData.push([d1, d2, d3]);
                this.persistHistoryCache();
                this.loadHistory(this.historiesData);
                this.caculatorSoiCau();
                if (res.xValue > 1 && res.xPot >= 0 && res.xPot < this.btnPayBets.length) {
                    this.btnPayBets[res.xPot].lblFactor.node.active = true;
                    this.btnPayBets[res.xPot].lblFactor.string = "x" + res.xValue;
                }
                this.spin([d1, d2, d3]);
                bowlOn.active = false;
            }).start();
    }
    actStartNewGame() {

        let bowlOn = this.bowl.getChildByName("bowl");
        bowlOn.active = true;
        TW(bowlOn).set({ opacity: 255, y: 0, scale: 1 }).start();
        let initPos = this.bowl.getPosition();
        let acShake = TW().to(0.1, { x: initPos.x - 20, scale: 1.1 }).to(0.1, { x: initPos.x }).to(0.1, { x: initPos.x + 20 }).to(0.1, { x: initPos.x, scale: 1.0 });
        cc.Tween.stopAllByTarget(this.bowl);
        TW(this.bowl).repeat(5, acShake).call(() => {
            this.showToast(App.instance.getTextLang('txt_bet_invite'));
        }).start();
    }
    actPopupHonors() {
        App.instance.showBgMiniGame("BauCua");
        if (this.popupHonor == null) {
            this.baucuaBundle.load("res/Prefabs/PopupHonors", cc.Prefab, function (finish, total, item) {

            }, (err1, prefab) => {
                this.popupHonor = cc.instantiate(prefab).getComponent("BauCua.PopupHonors");
                this.popupHonor.node.parent = this.popupContainer;
                this.popupHonor.node.active = true;
                this.popupHonor.show();
                this.popups.push(this.popupHonor.node);
            })
        } else {
            this.popupHonor.show();
        }
    }
    actPopupHistory() {
        App.instance.showBgMiniGame("BauCua");
        if (this.popupHistory == null) {
            this.baucuaBundle.load("res/Prefabs/PopupHistory", cc.Prefab, function (finish, total, item) {

            }, (err1, prefab) => {
                this.popupHistory = cc.instantiate(prefab).getComponent("BauCua.PopupHistory");
                this.popupHistory.node.parent = this.popupContainer;
                this.popupHistory.node.active = true;
                this.popupHistory.show();
                this.popups.push(this.popupHistory.node);
            })
        } else {
            this.popupHistory.show();
        }
    }
    actPopupGuide() {
        App.instance.showBgMiniGame("BauCua");
        if (this.popupGuide == null) {
            this.baucuaBundle.load("res/Prefabs/PopupGuide", cc.Prefab, function (finish, total, item) {

            }, (err1, prefab) => {
                this.popupGuide = cc.instantiate(prefab).getComponent("Dialog");
                this.popupGuide.node.parent = this.popupContainer;
                this.popupGuide.node.active = true;
                this.popupGuide.show();
                this.popups.push(this.popupGuide.node);
            })
        } else {
            this.popupGuide.show();
        }
    }
}

