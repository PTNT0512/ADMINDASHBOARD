import cmd from "./XocDia.Cmd";
import Player from "./XocDia.Player";
import Configs from "../../Loading/src/Configs";
import XocDiaController from "./XocDia.XocDiaController";
import BtnPayBet from "./XocDia.BtnPayBet";
import XocDiaNetworkClient from "./XocDia.XocDiaNetworkClient";
import PanelPayDoor from "./XocDia.PanelPayDoor";
import BtnBet from "./XocDia.BtnBet";
import BankerControl from "./XocDia.BankerControl";
import App from "../../Lobby/LobbyScript/Script/common/App";
import BroadcastReceiver from "../../Lobby/LobbyScript/Script/common/BroadcastReceiver";
import Random from "../../Lobby/LobbyScript/Script/common/Random";
import TimeUtils from "../../Lobby/LobbyScript/Script/common/TimeUtils";
import Utils from "../../Lobby/LobbyScript/Script/common/Utils";
import InPacket from "../../Lobby/LobbyScript/Script/networks/Network.InPacket";
import SPUtils from "../../Lobby/LobbyScript/Script/common/SPUtils";
import History from "./XocDia.PopupHistory"
import BundleControl from "../../Loading/src/BundleControl";
import cmdNetwork from "../../Lobby/LobbyScript/Script/networks/Network.Cmd";

enum audio_clip {
    BG = 0,
    LOSE = 1,
    WIN = 2,
    START_GAME = 3,
    XOC_DIA = 4,
    CHIP = 5,
    CLOCK = 6,
    JOIN = 7
}
const { ccclass, property } = cc._decorator;
var TW = cc.tween;
enum TYPE_RESULT {
    FOUR_WHITE = 1,
    FOUR_RED = 2,
    THREE_RED = 3,
    THREE_WHITE = 4,
    TWO_RED_TWO_WHITE = 5
}
enum STATE_DEALER {
    IDLE = 1,
    MOI_CUOC = 2,
    TRA_TIEN = 3,
    XOC_LO = 4,
    MO_DIA = 5
}
@ccclass
export default class Play extends cc.Component {
    @property(History)
    history: History = null;
    @property(cc.Node)
    nodeExit: cc.Node = null;
    @property(cc.ScrollView)
    scrollChip: cc.ScrollView = null;
    @property(cc.Node)
    contentChatNhanh: cc.Node = null;
    @property(cc.Node)
    bgChat: cc.Node = null;
    @property(cc.Node)
    UI_Chat: cc.Node = null;
    @property(cc.Toggle)
    toggleMusic: cc.Toggle = null;
    @property(cc.Toggle)
    toggleSound: cc.Toggle = null;
    @property(cc.Node)
    nodeSetting: cc.Node = null;
    @property(cc.Node)
    nodeTutorial: cc.Node = null;
    @property(cc.Label)
    lblToast: cc.Label = null;
    @property(cc.Node)
    boxSetting: cc.Node = null;
    @property(cc.Node)
    boxMusic: cc.Node = null;
    @property(Player)
    mePlayer: Player = null;
    @property([Player])
    players: Player[] = [];
    @property([BtnBet])
    btnBets: BtnBet[] = [];
    @property([BtnPayBet])
    btnPayBets: BtnPayBet[] = [];
    @property(sp.Skeleton)
    dealer: sp.Skeleton = null;
    @property(cc.Node)
    boxMsg: cc.Node = null;
    @property(cc.Label)
    labelMsg: cc.Label = null;
    @property(cc.Node)
    dealerHandPoint: cc.Node = null;
    @property(cc.Node)
    diceResult: cc.Node = null;
    @property([cc.SpriteFrame])
    sprChipSmalls: cc.SpriteFrame[] = [];
    @property(cc.Node)
    chips: cc.Node = null;
    @property(cc.Node)
    chipTemplate: cc.Node = null;
    @property(cc.Sprite)
    sprProgressTime: cc.Sprite = null;
    @property(cc.Label)
    lblProgressTime: cc.Label = null;
    @property(cc.Label)
    lblHistoryOdd: cc.Label = null;
    @property(cc.Label)
    lblHistoryEven: cc.Label = null;
    @property(cc.SpriteFrame)
    sfOdd: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    sfEven: cc.SpriteFrame = null;
    @property(cc.Node)
    lblHistoryItems: cc.Node = null;
    @property(cc.EditBox)
    edtChatInput: cc.EditBox = null;


    private inited = false;
    private roomId = 0;
    private standaloneBootstrapped = false;
    private standaloneJoining = false;
    private readonly standaloneDefaultRoomId = 1;
    private standaloneRetryTimer: any = null;
    private standaloneRetryCount = 0;
    private readonly standaloneRetryMax = 12;
    private standaloneResyncTimer: any = null;

    private chipsInDoors: any = {};
    private lastBowlStateName = "";
    private curTime = 0;
    private gameState = 0;
    private readonly listBets = [1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000];
    // 1k 5k 10k 50k 100k 500k 1m 5m 10m 50m 100m
    private betIdx = 0;
    private minBetIdx = 0;
    private isBanker = false;
    private banker = "";
    private historyChatData = [];

    private lastUpdateTime = TimeUtils.currentTimeMillis();
    private chipPool = null
    private clockTimeSche = null;
    private finishRoundToken = 0;
	
	private totalbet = 0;

    onBtnSscrollLeft() {
        this.percentScroll -= 0.3;
        if (this.percentScroll <= 0) this.percentScroll = 0;

        this.scrollChip.scrollToPercentHorizontal(this.percentScroll, 0.4);
    }

    onBtnScrollRight() {
        this.percentScroll += 0.3;
        if (this.percentScroll >= 1) this.percentScroll = 1;
        this.scrollChip.scrollToPercentHorizontal(this.percentScroll, 0.4);
    }


    onBtnClickBgChat() {
        this.UI_Chat.opacity = 100;
        this.bgChat.active = false;
    }

    onBtnClickBoxChat() {
        this.UI_Chat.opacity = 255;
        this.bgChat.active = true;
    }
    showUIChat() {
        this.onBtnClickBoxChat();
        this.UI_Chat.active = true;
        cc.tween(this.UI_Chat).to(0.3, { x: cc.winSize.width / 2 - this.UI_Chat.width / 2 }, { easing: cc.easing.sineOut }).start();
    }

    toggleUIChat() {
        if (this.UI_Chat.active == false) {
            this.showUIChat();
        }
        else {
            this.closeUIChat();
        }
    }

    closeUIChat() {
        this.UI_Chat.active = false;
        cc.tween(this.UI_Chat).to(0.3, { x: cc.winSize.width / 2 + this.UI_Chat.width / 2 }, { easing: cc.easing.sineIn }).call(() => {
            this.UI_Chat.active = false;
        }).start();
    }

    playerChat(res) {
        let player = this.getPlayer(res.nickname);
        if (player) {
            let chair = res["chair"];
            let isIcon = res["isIcon"];
            let content = res["content"];
            let seatId = chair;
            if (isIcon) {
                // Chat Icon
                player.showChatEmotion(content);
            } else {
                // Chat Msg
                player.showChatMsg(content);
            }
        }
    }

    chatEmotion(event, id) {
        XocDiaNetworkClient.getInstance().send(new cmd.SendChatRoom(1, id));
        this.closeUIChat();
    }

    chatMsg() {
        if (this.edtChatInput.string.trim().length > 0) {
            XocDiaNetworkClient.getInstance().send(new cmd.SendChatRoom(0, this.edtChatInput.string));
            this.edtChatInput.string = "";
            this.closeUIChat();
        }
    }

    chatNhanhMsg(msg) {
        if (msg.trim().length > 0) {
            XocDiaNetworkClient.getInstance().send(new cmd.SendChatRoom(0, msg));
            this.closeUIChat();
        }
    }
    private percentScroll = 0;
    start() {
        this.init();
        this.bootstrapStandaloneIfNeeded();
        this.percentScroll = 0;
        this.scrollChip.scrollToPercentHorizontal(this.percentScroll, 0.4);
        var self = this;
        for (var i = 0; i < this.contentChatNhanh.childrenCount; i++) {
            let node = this.contentChatNhanh.children[i];
            node.on('click', function () {

                self.chatNhanhMsg(node.children[0].getComponent(cc.Label).string);
            })
        }

        this.chipPool = new cc.NodePool("Chip");
        this.lblToast.node.parent.active = false;
        for (let i = 0; i < this.btnPayBets.length; i++) {
            let btn = this.btnPayBets[i];
            btn.node.on("click", () => {
                if (this.gameState != 2) {
                    this.showToast(App.instance.getTextLang('txt_bet_error3'));
                    return;
                }
                XocDiaNetworkClient.getInstance().send(new cmd.SendPutMoney(i, this.listBets[this.betIdx]));

            });
        }
        for (let i = 0; i < this.btnBets.length; i++) {
            let btnBet = this.btnBets[i];
            btnBet.node.on("click", () => {
                this.betIdx = i;
                for (let j = 0; j < this.btnBets.length; j++) {
                    this.btnBets[j].active.active = j == i;
                }
                //  cc.log("betIdx:" + this.betIdx);
            });
        }

        this.setupTimeRunInBg();
    }
	
	private actTransaction() {
            if (!Configs.Login.IsLogin) {
                App.instance.alertDialog.showMsg(App.instance.getTextLang('txt_need_login'));
                return;
            }
            if (!this.popupTransaction) {
                let cb = (prefab) => {
                    let popupDaily = cc.instantiate(prefab).getComponent("Lobby.PopupTransaction");
                    App.instance.canvas.addChild(popupDaily.node)
                    this.popupTransaction = popupDaily;
                    this.popupTransaction.show();
                }
                BundleControl.loadPrefabPopup("PrefabPopup/PopupTransaction", cb);
            } else {
                this.popupTransaction.show();
            }
        }

    private onBtnHistory() {

        // this.actCoomingSoon();
        // return;
        if (this.history == null) {
            App.instance.showLoading(true);
            cc.assetManager.getBundle("XocDia").load("PopupHistory", cc.Prefab, function (finish, total, item) {
            }, (err1, prefab: cc.Prefab) => {
                App.instance.showLoading(false);
                if (err1 != null) {
                    //  cc.log("errr load game XocDia:", err1);
                } else {
                    //  cc.log("vao daycai chu");
                    this.history = cc.instantiate(prefab).getComponent("XocDia.PopupHistory");
                    this.history.node.parent = this.node.parent;
                    this.history.node.active = true;
                    this.history.show()
                }
            })
        } else {
            this.history.node.parent = this.node.parent;
            this.history.node.active = true;
            this.history.show()
        }

        // App.instance.showLoading(true);
        // Http.get(Configs.App.API, { "c": 139, "p": this.page, "un": Configs.Login.Nickname, "gn": "Audition" }, (err, res) => {
        //     App.instance.showLoading(false);
        //     if (err != null) return;
        //     //  cc.log("");


        // });
    }


    private arrTimeOut = [];
    private isClearOldData = false;
    setupTimeRunInBg() {
        cc.game.on(cc.game.EVENT_SHOW, () => {
            // XocDiaNetworkClient.getInstance().send(new cmd.SendReconnect());
            // if(this.state == STATE_DEALER.MOI_CUOC && this.isClearOldData == false){
            //     if(this.nodeExit && this.nodeExit.active){
            //         this.node.active = false;
            //         XocDiaController.instance.lobby.show();
            //     }
            //     this.setStateDealer(STATE_DEALER.XOC_LO);
            //     this.btnPayBets.forEach(e => e.reset());
            //     this.clearChips();
            //     this.resetDiceResult();
            for (var i = 0; i < this.players.length; i++) {
                this.players[i].clearUI();
            }
            //     for(var i=0;i<this.arrTimeOut.length;i++){
            //         clearTimeout(this.arrTimeOut[i]);
            //     }

            //     this.arrTimeOut = [];
            //     this.isClearOldData = true;

            //     if(this.dataJoinRoom){
            //         this.show(this.dataJoinRoom);
            //     }


            // }



        });

    };

    updateChipTotalBets() {
        for (var i = 0; i < this.btnPayBets.length; i++) {
            if (this.btnPayBets[i].lblTotalBet.string != "") {

            }
        }
    }

    hideSetting() {
        this.nodeSetting.active = false;
    }

    showSetting() {
        this.toggleMusic.isChecked = SPUtils.getMusicVolumn() > 0;
        this.toggleSound.isChecked = SPUtils.getSoundVolumn() > 0;
        this.nodeSetting.active = true;
    }

    showTutorial() {
        this.nodeTutorial.active = true;
    }

    hideTutorial() {
        this.nodeTutorial.active = false;
    }

    onBtnToggleMusic() {
        SPUtils.setMusicVolumn(this.toggleMusic.isChecked ? 1 : 0);
        BroadcastReceiver.send(BroadcastReceiver.ON_AUDIO_CHANGED);
    }

    onBtnToggleSound() {
        SPUtils.setSoundVolumn(this.toggleSound.isChecked ? 1 : 0);
        BroadcastReceiver.send(BroadcastReceiver.ON_AUDIO_CHANGED);
    }

    showToast(msg) {
        this.lblToast.string = msg;
        this.lblToast.node.parent.opacity = 0;
        this.lblToast.node.parent.active = true;
        cc.Tween.stopAllByTarget(this.lblToast.node.parent);
        cc.tween(this.lblToast.node.parent)
            .to(0.3, { opacity: 255 }, { easing: "linear" })
            .delay(1)
            .to(0.3, { opacity: 0 }, { easing: "linear" })
            .call(() => {
                this.lblToast.node.parent.active = false;
            })
            .start();
    }

    private totalTimeState = 0;
    update(dt) {
        if (this.curTime > 0) {
            let timeLeft = Math.max(0, this.curTime - TimeUtils.currentTimeMillis());
            this.sprProgressTime.fillRange = timeLeft / this.totalTimeState;
            if (timeLeft == 0) {
                this.curTime = 0;
                this.sprProgressTime.node.parent.active = false;
                this.unschedule(this.clockTimeSche);
            }
        }

        // let t = TimeUtils.currentTimeMillis();
        // if (t - this.lastUpdateTime > 2000) {
        //     this.node.stopAllActions();
        //     App.instance.showLoading(true);
        //     XocDiaNetworkClient.getInstance().send(new cmd.SendJoinRoomById(this.roomId));
        // }
        // this.lastUpdateTime = t;
    }



    public init() {
        if (this.inited) return;
        this.inited = true;
        BroadcastReceiver.register(BroadcastReceiver.USER_UPDATE_COIN, () => {
            if (!this.node.active) return;
            this.mePlayer.setCoin(Configs.Login.Coin);
        }, this);
        BroadcastReceiver.send(BroadcastReceiver.USER_UPDATE_COIN);

        XocDiaNetworkClient.getInstance().addListener((data) => {
            let inpacket = new InPacket(data);
            switch (inpacket.getCmdId()) {
                case cmd.Code.LOGIN:
                    {
                        if (this.isStandaloneMode()) {
                            cc.log("[XocDia][Standalone] LOGIN ok -> request room list");
                            this.requestStandaloneRoomList();
                        }
                    }
                    break;
                case cmd.Code.GETLISTROOM:
                    {
                        if (!this.isStandaloneMode()) break;
                        let res = new cmd.ReceiveGetListRoom(data);
                        cc.log("[XocDia][Standalone] GETLISTROOM:", res.list ? res.list.length : 0);
                        if (!res.list || res.list.length === 0) break;
                        let room = res.list.find((r) => r.id === this.standaloneDefaultRoomId) || res.list[0];
                        if (!room) break;
                        this.joinStandaloneRoom(room.id);
                    }
                    break;
                case cmd.Code.JOIN_ROOM_FAIL:
                    {
                        if (!this.isStandaloneMode()) break;
                        this.standaloneJoining = false;
                        cc.log("[XocDia][Standalone] JOIN_ROOM_FAIL -> retry list");
                        this.requestStandaloneRoomList();
                    }
                    break;
                case cmd.Code.JOIN_ROOM_SUCCESS:
                    {
                        App.instance.showLoading(false);
                        let res = new cmd.ReceiveJoinRoomSuccess(data);
                        this.standaloneJoining = false;
                        this.stopStandaloneRetry();
                        cc.log("[XocDia][Standalone] JOIN_ROOM_SUCCESS room=", res.roomId, "state=", res.gameState, "time=", res.countTime);
                        if (this.isStandaloneMode()) {
                            this.show(res);
                        } else {
                            const controller = this.getActiveController();
                            if (controller) {
                                controller.showGamePlay(res);
                            } else {
                                this.show(res);
                            }
                        }
                    }
                    break;
                case cmd.Code.USER_JOIN_ROOM_SUCCESS:
                    {
                        let res = new cmd.ReceiveUserJoinRoom(data);
                        let player = this.getRandomEmptyPlayer();
                        if (player != null) {
                            player.set(res.nickname, res.avatar, res.money, false);
                        }
                    }
                    break;
                case cmd.Code.USER_OUT_ROOM:
                    {
                        let res = new cmd.ReceiveUserOutRoom(data);
                        let player = this.getPlayer(res.nickname);
                        if (player != null) player.leave();
                    }
                    break;
                case cmd.Code.QUIT_ROOM:
                    {
                        let res = new cmd.ReceiveLeavedRoom(data);
                        this.standaloneJoining = false;
                        if (this.isStandaloneMode()) {
                            this.node.active = true;
                            this.requestStandaloneRoomList();
                        } else {
                            const controller = this.getActiveController();
                            if (controller) {
                                this.node.active = false;
                                controller.lobby.show();
                            } else {
                                this.node.active = true;
                                this.requestStandaloneRoomList();
                            }
                        }
                        switch (res.reason) {
                            case 1:
                                App.instance.alertDialog.showMsg(App.instance.getTextLang('txt_not_enough_money'));
                                break;
                            case 2:
                                App.instance.alertDialog.showMsg(App.instance.getTextLang('txt_reparing'));
                                break;
                            case 5:
                                App.instance.alertDialog.showMsg(App.instance.getTextLang('txt_room_err13'));
                                break;
                            case 6:
                                App.instance.alertDialog.showMsg(App.instance.getTextLang('txt_room_err10'));
                                break;
                        }
                    }
                    break;
                case cmd.Code.DANG_KY_THOAT_PHONG:
                    {
                        let res = new cmd.ReceiveLeaveRoom(data);
                        //  cc.log("DANG_KY_THOAT_PHONG:" + res.bRegis);
                        if (res.bRegis) {
                            if (this.nodeExit) {
                                this.nodeExit.active = true;
                            }
                            App.instance.showToast(App.instance.getTextLang('txt_room_leave'));
                        } else {
                            if (this.nodeExit) {
                                this.nodeExit.active = false;
                            }
                            App.instance.showToast(App.instance.getTextLang('txt_room_cancel_leave'));
                        }
                    }
                    break;
                case cmd.Code.ACTION_IN_GAME:
                    {
                        let res = new cmd.ReceiveActionInGame(data);
                        let msg = "";
                        this.gameState = res.action;
                        this.queueStandaloneResync(res.time);
                        switch (res.action) {
                            case 1://bat dau van moi
                                msg = "Bắt đầu ván mới";
                                this.sprProgressTime.node.parent.active = true;
                                this.lblProgressTime.string = "Bat dau van moi...";
                                this.unschedule(this.clockTimeSche);
                                this.curTime = TimeUtils.currentTimeMillis() + res.time * 1000;
                                this.totalTimeState = Math.max(1000, res.time * 1000);
                                this.playAudioSafe(audio_clip.START_GAME);
                                break;
                            case 2://bat dau dat cua
                                msg = "Bắt đầu đặt cửa";
                                this.sprProgressTime.node.parent.active = true;
                                this.lblProgressTime.string = "Đang cược...";
                                this.curTime = TimeUtils.currentTimeMillis() + (res.time + 10) * 1000;
                                this.totalTimeState = (res.time + 10) * 1000;
                                this.setStateDealer(STATE_DEALER.MOI_CUOC);
                                this.schedule(this.clockTimeSche = () => {
                                    if (this.node.active) {
                                        this.playAudioSafe(audio_clip.CLOCK);
                                    } else {
                                        this.unschedule(this.clockTimeSche);
                                    }

                                }, 1.0, res.time);
                                break;
                            case 3://bat dau ban cua
                                msg = "Bắt đầu bán cửa";
                                this.sprProgressTime.node.parent.active = true;
                                this.lblProgressTime.string = "Đang bán cửa...";
                                this.curTime = TimeUtils.currentTimeMillis() + res.time * 1000;
                                this.totalTimeState = res.time * 1000;
                                break;
                            case 4://nha cai can tien, hoan tien
                                msg = "Nhà cái cân tiền, hoàn tiền";
                                this.sprProgressTime.node.parent.active = true;
                                this.lblProgressTime.string = "Đang cân cửa...";
                                this.curTime = TimeUtils.currentTimeMillis() + res.time * 1000;
                                this.totalTimeState = res.time * 1000;
                                break;
                            case 5://bat dau hoan tien
                                msg = "Bắt đầu hoàn tiền";
                                this.sprProgressTime.node.parent.active = true;
                                this.lblProgressTime.string = "Đang hoàn tiền...";
                                this.curTime = TimeUtils.currentTimeMillis() + res.time * 1000;
                                this.totalTimeState = res.time * 1000;
                                break;
                            case 6://bat dau tra thuong
                                msg = "Bắt đầu trả thưởng";
                                this.setStateDealer(STATE_DEALER.TRA_TIEN);
                                this.sprProgressTime.node.parent.active = true;
                                this.lblProgressTime.string = "Đang trả thưởng...";
                                this.curTime = TimeUtils.currentTimeMillis() + res.time * 1000;
                                this.totalTimeState = res.time * 1000;
                                break;
                        }
                        if (msg != "") {
                            this.labelMsg.string = msg;
                            this.boxMsg.active = false;
                            this.scheduleOnce(() => {
                                this.boxMsg.active = true;
                                this.scheduleOnce(() => {
                                    this.boxMsg.active = false;
                                }, 0.9);
                            }, 0.3);
                        }
                    }
                    break;
                case cmd.Code.START_GAME:
                    {
                        this.finishRoundToken++;
                        let res = new cmd.ReceiveStartGame(data);

                        if (res.banker != "" && res.banker != Configs.Login.Nickname && this.isBanker) {
                            App.instance.alertDialog.showMsg("Bạn không đủ tiền để tiếp tục làm cái!");
                        }

                        this.banker = res.banker;
                        this.isBanker = this.banker == Configs.Login.Nickname;

                        for (let i = 0; i < this.players.length; i++) {
                            let player = this.players[i];
                            player.banker.active = player.nickname != "" && player.nickname == this.banker;
                        }

                        this.btnPayBets.forEach(e => e.reset());
                        this.clearChips();
                        this.resetDiceResult();
                        this.setStateDealer(STATE_DEALER.XOC_LO);
                    }
                    break;
                case cmd.Code.PUT_MONEY:
                    {
                        let res = new cmd.ReceivePutMoney(data);
						//console.log(res);
                        let btnPayBet = this.btnPayBets[res.potId];
                        btnPayBet.setTotalBet(res.potMoney);

                        if (res.nickname == Configs.Login.Nickname) {
                            //  cc.log("XOC DIA PUT_MONEY:" + res.error);
                            switch (res.error) {
                                case 0:
                                    break;
                                case 1:
                                    App.instance.alertDialog.showMsg(App.instance.getTextLang('txt_not_enough'));
                                    return;
                                case 2:
                                    App.instance.alertDialog.showMsg(App.instance.getTextLang('txt_bet_error1'));
                                    return;
                                default:
                                    App.instance.alertDialog.showMsg(App.instance.getTextLang("txt_unknown_error"));
                                    return;
                            }
                            Configs.Login.Coin = res.currentMoney;
                            BroadcastReceiver.send(BroadcastReceiver.USER_UPDATE_COIN);	
							//console.log(btnPayBet.total.string);	
							//console.log(btnPayBet.total.string);						
							let total =  parseInt(btnPayBet.total.string) + res.betMoney;	
							btnPayBet.total.string = parseInt(btnPayBet.total.string) + res.betMoney;	
							//console.log(total);
							btnPayBet.setBet(total);
							
                        }

                        let player = this.getPlayer(res.nickname);
                        if (player != null) {
                            player.setCoin(res.currentMoney);
                        }
                        const chipOwner = (res.nickname && res.nickname.length > 0) ? res.nickname : "__bot__";
                        const chipStartPos = player != null ? player.node.position.clone() : this.getBotChipSourcePosition(res.potId);
                        let listCoin = this.convertMoneyToChipMoney(res.betMoney);
                        for (let i = 0; i < listCoin.length; i++) {
                            let chip = this.getChip(listCoin[i]);
                            chip.name = chipOwner;
                            chip.position = chipStartPos;
                            if (!this.chipsInDoors.hasOwnProperty(res.potId)) {
                                this.chipsInDoors[res.potId] = [];
                            }
                            this.chipsInDoors[res.potId].push(chip);
                            let position = btnPayBet.node.position.clone();
                            let target = new cc.Vec2(
                                Random.rangeInt(-btnPayBet.node.width / 4 - 20, btnPayBet.node.width / 4 + 20),
                                Random.rangeInt(-btnPayBet.node.height / 4 - 20, btnPayBet.node.height / 2 - 70));
                            position.x += target.x;
                            position.y += target.y;
                            cc.Tween.stopAllByTarget(chip);
                            TW(chip).then(cc.jumpTo(0.5, cc.v2(position.x, position.y), 50, 2).easing(cc.easeSineOut()))
                                .call(() => {
                                    chip.position = position;
                                })
                                .start();
                        }
                        this.playAudioSafe(audio_clip.CHIP);
                    }
                    break;


                case cmd.Code.REFUN_MONEY:
                    {
                        let res = new cmd.ReceiveRefunMoney(data);


                        for (let i = 0; i < res.playerInfosRefun.length; i++) {
                            let rfData = res.playerInfosRefun[i];
                            let player = this.getPlayer(rfData["nickname"]);
                            if (player != null) {
                                player.showRefundCoin(rfData["moneyRefund"]);
                                player.setCoin(rfData["currentMoney"]);
                            }
                            if (rfData["nickname"] == Configs.Login.Nickname) {
                                Configs.Login.Coin = rfData["currentMoney"];
                                BroadcastReceiver.send(BroadcastReceiver.USER_UPDATE_COIN);
                            }
                        }

                        for (let i = 0; i < res.potID.length; i++) {
                            let potData = res.potID[i];
                            this.btnPayBets[i].setTotalBet(potData["totalMoney"]);
                        }
                    }
                    break;
                case cmd.Code.FINISH_GAME:
                    {
                        this.isClearOldData = false;
                        let res = new cmd.ReceiveFinishGame(data);
                        for (let i = 0; i < res.playerInfoWin.length; i++) {
                            let playerData = res.playerInfoWin[i];
                            if (playerData["nickname"] == Configs.Login.Nickname) {
                                Configs.Login.Coin = playerData["currentMoney"];
                                BroadcastReceiver.send(BroadcastReceiver.USER_UPDATE_COIN);
                                break;
                            }
                        }

                        let countRed = 0;
                        let countWhite = 0;
                        for (let i = 0; i < res.diceIDs.length; i++) {
                            if (res.diceIDs[i] == 1) countRed++;
                            else countWhite++;
                        }
                        let isChan = countRed % 2 === 0;
                        // Derive winning doors from dice count to avoid backend flag mismatch.
                        let isLe3do1trang = countRed === 3;
                        let isLe3trang1do = countWhite === 3;
                        let isChan4do = countRed === 4;
                        let isChan4trang = countWhite === 4;
                        let doorWins = [];
                        this.setStateDealer(STATE_DEALER.MO_DIA);
                        const finishToken = ++this.finishRoundToken;
                        let cb = () => {
                            if (finishToken !== this.finishRoundToken) return;
                            this.btnPayBets.forEach((item) => item.stopWinEffect());
                            if (isChan) {
                                doorWins.push(0);
                                this.btnPayBets[0].playWinEffect();
                                if (isChan4do) {
                                    doorWins.push(3);
                                    this.btnPayBets[3].playWinEffect();
                                } else if (isChan4trang) {
                                    doorWins.push(2);
                                    this.btnPayBets[2].playWinEffect();
                                } else {
                                }
                            } else {
                                doorWins.push(1);
                                this.btnPayBets[1].playWinEffect();
                                if (isLe3do1trang) {
                                    doorWins.push(4);
                                    this.btnPayBets[4].playWinEffect();
                                } else if (isLe3trang1do) {
                                    doorWins.push(5);
                                    this.btnPayBets[5].playWinEffect();
                                }
                            }
                            cc.log("[XocDia] finish -> doorWins:", doorWins.join(","));

                            let chipsWithNickname: any = {};
                            for (let k in this.chipsInDoors) {
                                let doorId = parseInt(k);
                                let chips: Array<cc.Node> = this.chipsInDoors[doorId];
                                if (doorWins.indexOf(doorId) == -1) {
                                    let btnPayBet = this.btnPayBets[doorId];
                                    let position = btnPayBet.node.position.clone();
                                    position.y -= 10;
                                    let positionAdd = position.clone();
                                    this.arrTimeOut.push(setTimeout(() => {
                                        let node = new cc.Node();
                                        node.parent = this.chips;
                                        node.opacity = 0;
                                        for (let i = 0; i < chips.length; i++) {
                                            chips[i].parent = node;
                                            // chips[i].position = positionAdd;
                                            // positionAdd.y += 3;
                                        }
                                        cc.Tween.stopAllByTarget(node);
                                        TW(node).to(0.1, { opacity: 255 }, { easing: cc.easing.sineIn })
                                            .delay(0.3)
                                            .to(0.5, { scale: 0, x: this.dealerHandPoint.x, y: this.dealerHandPoint.y })
                                            .to(0.1, { opacity: 0 }, { easing: cc.easing.sineOut })
                                            .call(() => {
                                                for (let i = 0; i < chips.length; i++) {
                                                    chips[i].parent = this.chips;
                                                    chips[i].opacity = 255;
                                                    chips[i].active = false;
                                                }
                                                node.destroy();
                                            }).start();
                                    }, 800));
                                } else {
                                    for (let i = 0; i < chips.length; i++) {
                                        let chip = chips[i];
                                        let nickname = chip.name;
                                        if (!chipsWithNickname.hasOwnProperty(nickname)) {
                                            chipsWithNickname[nickname] = [];
                                        }
                                        chipsWithNickname[nickname].push(chip);
                                    }
                                }
                            }

                            this.arrTimeOut.push(setTimeout(() => {
                                for (let k in chipsWithNickname) {
                                    let player = this.getPlayer(k);
                                    if (player != null) {
                                        let chips = chipsWithNickname[k];
                                        let positionAdd = player.chipsPoint.clone();
                                        let positionAdd2 = player.chipsPoint2.clone();
                                        let count1 = 0;
                                        let count2 = 0;
                                        for (let i = 0; i < chips.length; i++) {
                                            let chip: cc.Node = chips[i];
                                            let opacity1 = count1 < 15 ? 255 : 0;
                                            cc.Tween.stopAllByTarget(chip);
                                            TW(chip).to(0.5, { x: positionAdd.x, y: positionAdd.y, opacity: opacity1 }, { easing: cc.easing.sineOut })
                                                .delay(1 + (chips.length * 0.03 - i * 0.03))
                                                .to(0.5, { position: player.node.position }, { easing: cc.easing.sineIn })
                                                .call(() => {
                                                    chip.active = false;
                                                }).start();

                                            let dealerChip = this.getChip(0);
                                            dealerChip.getComponent(cc.Sprite).spriteFrame = chip.getComponent(cc.Sprite).spriteFrame;
                                            dealerChip.opacity = 0;
                                            dealerChip.position = this.dealerHandPoint.position;
                                            let opacity2 = count2 < 15 ? 255 : 0;
                                            cc.Tween.stopAllByTarget(dealerChip);
                                            TW(dealerChip).delay(0.5)
                                                .to(0.2, { opacity: opacity2 }, { easing: cc.easing.sineIn })
                                                .to(0.5, { x: positionAdd2.x, y: positionAdd2.y }, { easing: cc.easing.sineOut })
                                                .delay(0.3 + (chips.length * 0.03 - i * 0.03))
                                                .to(0.5, { position: player.node.position }, { easing: cc.easing.sineOut })
                                                .call(() => {
                                                    dealerChip.active = false;
                                                }).start();
                                            if (count1 < 15) {
                                                count1++;
                                                positionAdd.y += 3;

                                            }
                                            if (count2 < 15) {
                                                count2++
                                                positionAdd2.y += 3;
                                            }


                                        }
                                    }
                                    else {
                                        let chips = chipsWithNickname[k];
                                        for (let i = 0; i < chips.length; i++) {
                                            let chip: cc.Node = chips[i];
                                            cc.Tween.stopAllByTarget(chip);
                                            TW(chip)
                                                .delay(0.4 + (chips.length * 0.02 - i * 0.02))
                                                .to(0.45, { x: this.dealerHandPoint.x, y: this.dealerHandPoint.y, opacity: 0 }, { easing: cc.easing.sineIn })
                                                .call(() => {
                                                    chip.active = false;
                                                    chip.opacity = 255;
                                                })
                                                .start();
                                        }
                                    }
                                }
                            }, 1500));
                        }
                        let resultType = TYPE_RESULT.TWO_RED_TWO_WHITE;
                        if (countRed === 4) {
                            resultType = TYPE_RESULT.FOUR_RED;
                        } else if (countWhite === 4) {
                            resultType = TYPE_RESULT.FOUR_WHITE;
                        } else if (countRed === 3) {
                            resultType = TYPE_RESULT.THREE_RED;
                        } else if (countWhite === 3) {
                            resultType = TYPE_RESULT.THREE_WHITE;
                        }
                        this.setDiceResult(resultType, cb);


                        this.arrTimeOut.push(setTimeout(() => {
                            for (let i = 0; i < res.playerInfoWin.length; i++) {
                                let playerData = res.playerInfoWin[i];
                                let player = this.getPlayer(playerData["nickname"]);
                                if (player != null) {
                                    var moneyWinPots = playerData["moneyWinPots"];
                                    moneyWinPots = moneyWinPots.split(',');
                                    var msgWin = "";
                                    for (var j = 0; j < moneyWinPots.length; j++) {
                                        msgWin += Utils.formatMoney(moneyWinPots[j]) + "\n\n";
                                    }
                                    player.showWinCoinString(msgWin);
                                    player.setCoin(playerData["currentMoney"]);
                                }
                            }

                            BroadcastReceiver.send(BroadcastReceiver.USER_UPDATE_COIN);
                        }, 3000));

                        if (this.isBanker) {
                            this.mePlayer.showWinCoin(res.moneyBankerExchange);
                            this.mePlayer.setCoin(res.moneyBankerAfter);
                            Configs.Login.Coin = res.moneyBankerAfter;
                            BroadcastReceiver.send(BroadcastReceiver.USER_UPDATE_COIN);
                        }

                        XocDiaNetworkClient.getInstance().send(new cmd.CmdSendGetCau());
                    }
                    break;
                case cmd.Code.SOI_CAU:
                    {
                        let res = new cmd.ReceiveGetCau(data);

                        this.lblHistoryOdd.string = Utils.formatNumber(res.totalOdd);
                        this.lblHistoryEven.string = Utils.formatNumber(res.totalEven);
                        for (let i = 0; i < this.lblHistoryItems.childrenCount; i++) {
                            if (i < res.arrayCau.length) {
                                this.lblHistoryItems.children[i].getComponent(cc.Sprite).spriteFrame = res.arrayCau[i] == 0 ? this.sfOdd : this.sfEven;
                                this.lblHistoryItems.children[i].active = true;
                            } else {
                                this.lblHistoryItems.children[i].active = false;
                            }
                        }
                    }
                    break;
                case cmd.Code.ORDER_BANKER:
                    {
                        let res = new cmd.ReceiveOrderBanker(data);
                        switch (res.error) {
                            case 0:
                                break;
                            case 1:
                                App.instance.alertDialog.showMsg("Bạn cần " + Utils.formatNumber(res.moneyRequire) + " Xu để làm cái!");
                                break;
                            default:
                                App.instance.alertDialog.showMsg("Lỗi " + res.error + ", không xác định.");
                                break;
                        }
                    }
                    break;
                case cmd.Code.HUY_LAM_CAI:
                    {
                        let res = new cmd.ReceiveCancelBanker(data);
                        if (res.bDestroy && this.isBanker) {
                            App.instance.alertDialog.showMsg("Đăng ký huỷ làm cái thành công.");
                        }
                    }
                    break;
                case cmd.Code.INFO_GATE_SELL:
                    {
                        let res = new cmd.ReceiveInfoGateSell(data);
                    }
                    break;
                case cmd.Code.INFO_MONEY_AFTER_BANKER_SELL:
                    {
                        let res = new cmd.ReceiveInfoMoneyAfterBankerSell(data);
                    }
                    break;
                case cmd.Code.CHAT_MS:
                    {
                        let res = new cmd.ReceivedChatRoom(data);
                        this.playerChat(res);

                    }
                    break;
                default:
                    break;
            }
        }, this);
    }

    private isStandaloneMode(): boolean {
        return !this.getActiveController();
    }

    private getActiveController(): XocDiaController {
        if (!XocDiaController || !XocDiaController.instance) return null;
        const controller: any = XocDiaController.instance;
        if (!controller.node || !cc.isValid(controller.node)) return null;
        return controller as XocDiaController;
    }

    private bootstrapStandaloneIfNeeded() {
        if (!this.isStandaloneMode() || this.standaloneBootstrapped) return;
        this.standaloneBootstrapped = true;
        this.standaloneRetryCount = 0;
        cc.log("[XocDia][Standalone] bootstrap start");

        XocDiaNetworkClient.getInstance().addOnOpen(() => {
            cc.log("[XocDia][Standalone] socket open -> login");
            XocDiaNetworkClient.getInstance().send(new cmdNetwork.SendLogin(Configs.Login.Nickname, Configs.Login.AccessToken));
        }, this);

        XocDiaNetworkClient.getInstance().addOnClose(() => {
            this.standaloneJoining = false;
            this.roomId = 0;
            cc.log("[XocDia][Standalone] socket close");
        }, this);

        if (XocDiaNetworkClient.getInstance().isConnected()) {
            cc.log("[XocDia][Standalone] socket already open -> login");
            XocDiaNetworkClient.getInstance().send(new cmdNetwork.SendLogin(Configs.Login.Nickname, Configs.Login.AccessToken));
        } else {
            cc.log("[XocDia][Standalone] connect");
            XocDiaNetworkClient.getInstance().connect();
        }
        this.startStandaloneRetry();
    }

    private requestStandaloneRoomList() {
        this.standaloneJoining = false;
        cc.log("[XocDia][Standalone] send GETLISTROOM");
        XocDiaNetworkClient.getInstance().send(new cmd.SendGetListRoom());
    }

    private joinStandaloneRoom(roomId: number) {
        if (this.standaloneJoining) return;
        this.standaloneJoining = true;
        cc.log("[XocDia][Standalone] send JOIN room=", roomId);
        XocDiaNetworkClient.getInstance().send(new cmd.SendJoinRoomById(roomId));
    }

    private playAudioSafe(clipIndex: number) {
        const controller = this.getActiveController();
        if (controller) {
            controller.playAudioEffect(clipIndex);
        }
    }

    private startStandaloneRetry() {
        this.stopStandaloneRetry();
        if (!this.isStandaloneMode()) return;
        this.standaloneRetryCount = 0;
        this.standaloneRetryTimer = setInterval(() => {
            if (!this.isStandaloneMode()) {
                this.stopStandaloneRetry();
                return;
            }
            if (this.roomId > 0) {
                this.stopStandaloneRetry();
                return;
            }
            if (this.standaloneRetryCount >= this.standaloneRetryMax) {
                cc.log("[XocDia][Standalone] retry stop after max attempts");
                this.stopStandaloneRetry();
                return;
            }
            this.standaloneRetryCount += 1;
            cc.log("[XocDia][Standalone] retry", this.standaloneRetryCount);
            if (!XocDiaNetworkClient.getInstance().isConnected()) {
                XocDiaNetworkClient.getInstance().connect();
                return;
            }
            XocDiaNetworkClient.getInstance().send(new cmdNetwork.SendLogin(Configs.Login.Nickname, Configs.Login.AccessToken));
            if (!this.standaloneJoining) {
                this.requestStandaloneRoomList();
            }
        }, 1500);
    }

    private stopStandaloneRetry() {
        if (!this.standaloneRetryTimer) return;
        clearInterval(this.standaloneRetryTimer);
        this.standaloneRetryTimer = null;
    }

    private queueStandaloneResync(timeSec: number) {
        if (!this.isStandaloneMode()) return;
        if (this.roomId <= 0) return;
        if (this.standaloneResyncTimer) {
            clearTimeout(this.standaloneResyncTimer);
            this.standaloneResyncTimer = null;
        }
        const safeDelayMs = Math.max(2000, (Math.max(1, timeSec) + 1) * 1000);
        this.standaloneResyncTimer = setTimeout(() => {
            if (!this.isStandaloneMode()) return;
            if (this.roomId <= 0) return;
            if (this.standaloneJoining) return;
            cc.log("[XocDia][Standalone] state resync -> request room list");
            this.requestStandaloneRoomList();
        }, safeDelayMs);
    }

    private showDiceResult(cb) {
        let bowl = this.diceResult.getChildByName("bat");
        let ranX1 = [Utils.randomRangeInt(-40, -30), Utils.randomRange(30, 40)][Utils.randomRangeInt(0, 2)];
        let ranY1 = [Utils.randomRangeInt(-40, -30), Utils.randomRangeInt(30, 40)][Utils.randomRangeInt(0, 2)];
        let ranX2 = [Utils.randomRangeInt(-120, -100), Utils.randomRangeInt(100, 120)][Utils.randomRangeInt(0, 2)];
        let ranY2 = [Utils.randomRangeInt(-120, -100), Utils.randomRangeInt(100, 120)][Utils.randomRangeInt(0, 2)];
        cc.Tween.stopAllByTarget(bowl);
        TW(bowl).set({ x: -5, y: 7, opacity: 255 }).to(1.0, { x: ranX1, y: ranY1 })
            .delay(0.5).call(() => {
                if (cb) {
                    cb();
                    this.playAudioSafe(audio_clip.WIN);
                }

            })
            .to(0.6, { x: ranX2, y: ranY2, opacity: 0 }, { easing: cc.easing.sineOut }).start();
    }
    private xocDice() {
        this.resetDiceResult();
        this.diceResult.active = true;
        cc.Tween.stopAllByTarget(this.diceResult);
        TW(this.diceResult).set({ x: 7.755, y: 66.138, scale: 0 }).to(0.5, { scale: 1, x: 0, y: 66 }, { easing: cc.easing.sineIn }).start();
    }
    private setDiceResult(typeResult, cb) {
        let arrSprResult = [];
        switch (typeResult) {
            case TYPE_RESULT.FOUR_RED: {
                arrSprResult.push(this.sfOdd, this.sfOdd, this.sfOdd, this.sfOdd);
                break;
            }
            case TYPE_RESULT.FOUR_WHITE: {
                arrSprResult.push(this.sfEven, this.sfEven, this.sfEven, this.sfEven);
                break;
            }
            case TYPE_RESULT.THREE_RED: {
                arrSprResult.push(this.sfOdd, this.sfEven, this.sfOdd, this.sfOdd);
                break;
            }
            case TYPE_RESULT.THREE_WHITE: {
                arrSprResult.push(this.sfEven, this.sfEven, this.sfOdd, this.sfEven);
                break;
            }
            case TYPE_RESULT.TWO_RED_TWO_WHITE: {
                arrSprResult.push(this.sfEven, this.sfEven, this.sfOdd, this.sfOdd);
                break;
            }
        }
        for (let i = 1; i < 5; i++) {
            this.diceResult.getChildByName("ic_result_" + i).getComponent(cc.Sprite).spriteFrame = arrSprResult[i - 1];
        }
        this.showDiceResult(cb);
    }
    private resetDiceResult() {
        cc.Tween.stopAllByTarget(this.diceResult.getChildByName("bat"));
        this.diceResult.getChildByName("bat").setPosition(cc.v2(-6.81, 9.24));
        this.diceResult.getChildByName("bat").opacity = 255;
        // this.diceResult.active = false;
    }
    private resetView() {
        this.finishRoundToken++;
        this.mePlayer.leave();
        this.players.forEach(e => e.leave());
        this.btnPayBets.forEach(e => e.reset());
        this.setStateDealer(STATE_DEALER.IDLE);
        this.boxMsg.active = false;
        this.resetDiceResult();
        for (var i = 0; i < this.players.length; i++) {
            this.players[i].clearUI();
        }
        for (var i = 0; i < this.arrTimeOut.length; i++) {
            clearTimeout(this.arrTimeOut[i]);
        }
        this.clearChips();
        this.sprProgressTime.node.parent.active = false;
        this.unschedule(this.clockTimeSche);
        this.curTime = 0;
    }

    private getRandomEmptyPlayer(): Player {
        let emptyPlayers = new Array<Player>();
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].nickname == "") emptyPlayers.push(this.players[i]);
        }
        if (emptyPlayers.length > 0) {
            return emptyPlayers[Random.rangeInt(0, emptyPlayers.length)];
        }
        return null;
    }

    private getPlayer(nickname: string): Player {
        for (let i = 0; i < this.players.length; i++) {
            let player = this.players[i];
            if (player.nickname != "" && player.nickname == nickname) return player;
        }
        return null;
    }

    private getBotChipSourcePosition(potId: number): cc.Vec2 {
        const occupiedPlayers: Player[] = [];
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i] && this.players[i].nickname != "") {
                occupiedPlayers.push(this.players[i]);
            }
        }
        if (occupiedPlayers.length > 0) {
            const picked = occupiedPlayers[Random.rangeInt(0, occupiedPlayers.length)];
            const pos = picked.node.position.clone();
            pos.x += Random.rangeInt(-30, 30);
            pos.y += Random.rangeInt(-20, 20);
            return pos;
        }

        const fallbackPoints = [
            cc.v2(-260, 210),
            cc.v2(260, 210),
            cc.v2(-320, 120),
            cc.v2(320, 120),
            cc.v2(-120, 280),
            cc.v2(120, 280)
        ];
        const idx = Math.abs(potId) % fallbackPoints.length;
        const fallback = fallbackPoints[idx].clone();
        fallback.x += Random.rangeInt(-28, 28);
        fallback.y += Random.rangeInt(-18, 18);
        return fallback;
    }

    private listChip: cc.Node[] = [];
    private getChip(coin: number): cc.Node {
        let ret: cc.Node = null;

        if (this.chipPool.size() <= 0) {
            this.chipPool.put(cc.instantiate(this.chipTemplate));
        }
        ret = this.chipPool.get();
        this.listChip.push(ret);
        ret.parent = this.chips;
        let chipIdx = 0;
        for (let i = 0; i < this.listBets.length; i++) {
            if (this.listBets[i] == coin) {
                chipIdx = i;
                break;
            }
        }
        chipIdx -= 0;
        //  cc.log("getChip:" + chipIdx + ":" + this.minBetIdx);
        ret.getComponent(cc.Sprite).spriteFrame = this.sprChipSmalls[chipIdx];
        ret.opacity = 255;
        ret.active = true;
        ret.setSiblingIndex(this.chips.childrenCount - 1);

        return ret;
    }

    private clearChips() {
        this.chipTemplate.active = false;
        for (let i = 0; i < this.listChip.length; i++) {
            this.chipPool.put(this.listChip[i]);
        }
        this.listChip = [];
        this.chipsInDoors = {};
    }

    private convertMoneyToChipMoney(coin: number): Array<number> {
        let ret = new Array<number>();
        let _coin = coin;
        let minCoin = this.listBets[this.minBetIdx];
        let counter = 0;
        while (_coin >= minCoin || counter < 15) {
            for (let i = this.minBetIdx + this.btnBets.length; i >= this.minBetIdx; i--) {
                if (_coin >= this.listBets[i]) {
                    ret.push(this.listBets[i]);
                    _coin -= this.listBets[i];
                    break;
                }
            }
            counter++;
        }
        return ret;
    }
    private dataJoinRoom;
    public show(data: cmd.ReceiveJoinRoomSuccess) {

        //  cc.log("ReceiveJoinRoomSuccess show:" + JSON.stringify(data));
        this.dataJoinRoom = data;
        if (this.chipPool == null) {
            this.chipPool = new cc.NodePool("Chip");
        }
        this.node.active = true;
        this.resetView();
        if (this.nodeExit && this.nodeExit.active) {
            this.nodeExit.active = false;
        }
        this.roomId = data.roomId;
        this.lastUpdateTime = TimeUtils.currentTimeMillis();
        this.playAudioSafe(audio_clip.JOIN);
        Configs.Login.Coin = data.money;
        this.isBanker = data.banker;
        this.banker = "";
        if (this.isBanker) {
            this.banker = Configs.Login.Nickname;
        } else {
        }

        this.mePlayer.set(Configs.Login.Nickname, Configs.Login.Avatar, Configs.Login.Coin, data.banker);
        for (let i = 0; i < data.playerInfos.length; i++) {
            let playerData = data.playerInfos[i];
            let player = this.getRandomEmptyPlayer();
            if (player != null) {
                player.set(playerData["nickname"], playerData["avatar"], playerData["money"], playerData["banker"]);
                if (playerData["banker"]) {
                    this.banker = playerData["nickname"];
                }
            } else {
                break;
            }
        }

        if (data.gameState == 1 || data.gameState == 2) {
            for (let i = 0; i < data.potID.length; i++) {
                let potData = data.potID[i];
                let btnPayBet = this.btnPayBets[i];
                btnPayBet.setTotalBet(potData["totalMoney"]);
                let listCoin = this.convertMoneyToChipMoney(potData["totalMoney"]);
                for (let i = 0; i < listCoin.length; i++) {
                    let chip = this.getChip(listCoin[i]);
                    let player = this.getPlayer(Configs.Login.Nickname);
                    chip.name = player.nickname;
                    chip.position = player.node.position;
                    if (!this.chipsInDoors.hasOwnProperty(potData.id)) {
                        this.chipsInDoors[potData.id] = [];
                    }
                    this.chipsInDoors[potData.id].push(chip);
                    let position = btnPayBet.node.position.clone();
                    let target = new cc.Vec2(
                        Random.rangeInt(-btnPayBet.node.width / 4 - 20, btnPayBet.node.width / 4 + 20),
                        Random.rangeInt(-btnPayBet.node.height / 4 - 20, btnPayBet.node.height / 2 - 70));
                    position.x += target.x;
                    position.y += target.y;
                    cc.Tween.stopAllByTarget(chip);
                    TW(chip).then(cc.jumpTo(0.5, cc.v2(position.x, position.y), 50, 2).easing(cc.easeSineOut()))
                        .call(() => {
                            chip.position = position;
                        })
                        .start();
                }
                this.playAudioSafe(audio_clip.CHIP);
            }
        }

        for (let i = 0; i < this.listBets.length; i++) {
            if (data.moneyBet <= this.listBets[i]) {
                this.betIdx = i;
                this.minBetIdx = this.betIdx;
                break;
            }
        }
        for (let i = 0; i < this.btnBets.length; i++) {
            let btnBet = this.btnBets[i];
            btnBet.active.active = i == this.minBetIdx;
            btnBet.node.active = i >= this.minBetIdx;
        }

        this.gameState = data.gameState;
        this.queueStandaloneResync(data.countTime);
        let msg = "";
        switch (this.gameState) {
            case 1://bat dau van moi
                msg = "Bắt đầu ván mới";
                this.sprProgressTime.node.parent.active = true;
                this.curTime = TimeUtils.currentTimeMillis() + data.countTime * 1000;
                this.totalTimeState = Math.max(1000, data.countTime * 1000);
                this.lblProgressTime.string = "Bat dau van moi...";
                break;
            case 2://bat dau dat cua
                {
                    msg = "Bắt đầu đặt cửa";
                    // if(this.nodeExit && this.nodeExit.active){
                    //     this.node.active = false;
                    //     this.actBack();
                    // }
                    this.sprProgressTime.node.parent.active = true;
                    this.curTime = TimeUtils.currentTimeMillis() + (data.countTime + 10) * 1000;
                    this.totalTimeState = 30000 + 10000;
                    this.lblProgressTime.string = "Đang cược...";
                    this.schedule(this.clockTimeSche = () => {
                        if (this.node.active) {
                            this.playAudioSafe(audio_clip.CLOCK);
                        } else {
                            this.unschedule(this.clockTimeSche);
                        }

                    }, 1.0, data.countTime + 10);
                    this.setStateDealer(STATE_DEALER.MOI_CUOC);
                    this.diceResult.active = true;
                }
                break;

            case 4://nha cai can tien, hoan tien
                msg = "Nhà cái cân tiền, hoàn tiền";
                this.sprProgressTime.node.parent.active = true;
                this.curTime = TimeUtils.currentTimeMillis() + data.countTime * 1000;
                this.totalTimeState = Math.max(1000, data.countTime * 1000);
                this.lblProgressTime.string = "Dang can cua...";
                break;
            case 5://bat dau hoan tien
                msg = "Bắt đầu hoàn tiền";
                this.sprProgressTime.node.parent.active = true;
                this.curTime = TimeUtils.currentTimeMillis() + data.countTime * 1000;
                this.totalTimeState = Math.max(1000, data.countTime * 1000);
                this.lblProgressTime.string = "Dang hoan tien...";
                break;
            case 6://bat dau tra thuong
                msg = "Vui lòng đợi ván sau!";
                this.sprProgressTime.node.parent.active = true;
                this.curTime = TimeUtils.currentTimeMillis() + data.countTime * 1000;
                this.totalTimeState = Math.max(1000, data.countTime * 1000);
                this.lblProgressTime.string = "Vui lòng đợi ván sau!";
                break;
        }
        if (msg != "") {
            this.setStateDealer(STATE_DEALER.IDLE);
            let label = this.dealer.getComponentInChildren(cc.Label);
            label.string = msg;
            this.scheduleOnce(() => {
                this.boxMsg.active = true;
                this.scheduleOnce(() => {
                    this.boxMsg.active = false;
                }, 0.9);
            }, 0.3);
        }

        XocDiaNetworkClient.getInstance().send(new cmd.CmdSendGetCau());
    }
    private state;
    private setStateDealer(state) {
        this.state = state;
        switch (state) {
            case STATE_DEALER.IDLE: {
                this.dealer.timeScale = 1;
                this.dealer.setAnimation(0, "Idle", true);
                break;
            }
            case STATE_DEALER.MOI_CUOC: {
                this.dealer.timeScale = 1;
                this.dealer.setAnimation(0, "MoiDatCuoc1", false);
                this.dealer.setCompleteListener(() => {
                    this.setStateDealer(STATE_DEALER.IDLE);
                });
                break;
            }
            case STATE_DEALER.TRA_TIEN: {
                this.dealer.timeScale = 1;
                this.dealer.setAnimation(0, "MoidDatCuoc2", false);
                this.dealer.setCompleteListener(() => {
                    this.setStateDealer(STATE_DEALER.IDLE);
                });
                break;
            }
            case STATE_DEALER.XOC_LO: {
                cc.Tween.stopAllByTarget(this.diceResult);
                TW(this.diceResult).to(0.5, { scale: 0, y: 335 }, { easing: cc.easing.sineIn }).call(() => {
                    this.diceResult.active = false;
                    this.dealer.timeScale = 3;
                    this.dealer.setAnimation(0, "LacDia", false);
                    this.playAudioSafe(audio_clip.XOC_DIA);
                    this.dealer.setCompleteListener(() => {
                        this.setStateDealer(STATE_DEALER.MOI_CUOC);
                    });
                }).start();
                this.scheduleOnce(() => {
                    this.xocDice();
                }, 3.2 / 2)
                break;
            }
            case STATE_DEALER.MO_DIA: {
                this.dealer.timeScale = 1;
                this.dealer.setAnimation(0, "MoiDatCuoc2", false);
                this.dealer.setCompleteListener(() => {
                    this.setStateDealer(STATE_DEALER.IDLE);
                });
                break;
            }

        }
    }
    public actSetting() {
        this.boxSetting.active = !this.boxSetting.active;
    }


    public actSendChat() {
        // App.instance.ShowAlertDialog(App.instance.getTextLang("txt_function_in_development"));
        let msg = this.edtChatInput.string.trim();
        if (msg != "") {
            XocDiaNetworkClient.getInstance().send(new cmd.SendChatRoom(0, msg));
        }
        this.edtChatInput.string = "";
    }

    public actSendChatNhanh(msg) {
        // App.instance.ShowAlertDialog(App.instance.getTextLang("txt_function_in_development"));
        if (msg != "") {
            XocDiaNetworkClient.getInstance().send(new cmd.SendChatRoom(0, msg));
        }
        this.edtChatInput.string = "";
    }

    public actTutorial() {
        this.showTutorial();
    }

    public actRank() {
        App.instance.ShowAlertDialog(App.instance.getTextLang("txt_function_in_development"));
    }

    public actHistory() {
        this.onBtnHistory();
    }

    public actOpenMusic() {
        App.instance.ShowAlertDialog(App.instance.getTextLang("txt_function_in_development"));
    }

    public actBack() {
        //  cc.log("XocDia actBack");
        XocDiaNetworkClient.getInstance().send(new cmd.SendLeaveRoom());
    }


    public actOrderBanker() {
        XocDiaNetworkClient.getInstance().send(new cmd.SendOrderBanker());
    }

    public actCancelBanker() {
        XocDiaNetworkClient.getInstance().send(new cmd.SendCancelBanker());
    }


    // update (dt) {}
    onDestroy() {
        this.stopStandaloneRetry();
        if (this.standaloneResyncTimer) {
            clearTimeout(this.standaloneResyncTimer);
            this.standaloneResyncTimer = null;
        }
    }
}
