
import cmdMD5 from "./TaiXiuMD5.Cmd";
import PanelChat from "./TaiXiuMD5.PanelChat";
//import MiniGame from "../../../../Lobby/src/MiniGame";
import MiniGameNetworkClient from "../../../Lobby/LobbyScript/Script/networks/MiniGameNetworkClient";
import InPacket from "../../../Lobby/LobbyScript/Script/networks/Network.InPacket";
import Utils from "../../../Lobby/LobbyScript/Script/common/Utils";
import SPUtils from "../../../Lobby/LobbyScript/Script/common/SPUtils";
import Tween from "../../../Lobby/LobbyScript/Script/common/Tween";
import Configs from "../../../Loading/src/Configs";
import BroadcastReceiver from "../../../Lobby/LobbyScript/Script/common/BroadcastReceiver";
import App from "../../../Lobby/LobbyScript/Script/common/App";
import TaiXiuMD5COntroler from "../src/TaiXiuMD5.Controller";
import PopupDetailHistory from "./TaiXiuMD5.PopupDetailHistory";

const { ccclass, property } = cc._decorator;

enum BetDoor {
    None, Tai, Xiu
}
enum audio_clip {
    WIN = 0,
    DICE = 1,
    CLOCK = 2,
}

@ccclass("TaiXiuMD5.TaiXiuMiniController.SoundManager")
export class SoundManager {
    @property(cc.Node)
    nodeSelf: cc.Node = null;
    @property(cc.Node)
    taixiuView: cc.Node = null;

    @property(cc.AudioSource)
    effSound: cc.AudioSource = null;

    @property([cc.AudioClip])
    listAudio: cc.AudioClip[] = [];
    playAudioEffect(indexAudio) {
        const clip = this.listAudio && this.listAudio[indexAudio] ? this.listAudio[indexAudio] : null;
        if (!clip) return;
        const canPlay = !this.taixiuView || this.taixiuView.active;
        const volume = SPUtils.getSoundVolumn();
        if (!canPlay || volume <= 0) return;
        if (this.effSound) {
            this.effSound.clip = clip;
            this.effSound.volume = Math.max(0, Math.min(1, volume));
            this.effSound.play();
            return;
        }
        cc.audioEngine.playEffect(clip, false);

    }
}

@ccclass
export default class TaiXiuMiniController extends cc.Component {

    static instance: TaiXiuMiniController = null;

    @property(cc.Node)
    gamePlay: cc.Node = null;
    @property([cc.SpriteFrame])
    sprDices: Array<cc.SpriteFrame> = new Array<cc.SpriteFrame>();
    @property(cc.SpriteFrame)
    sprFrameTai: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    sprFrameXiu: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    sprFrameBtnNan: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    sprFrameBtnNan2: cc.SpriteFrame = null;
    @property(cc.Label)
    lblSession: cc.Label = null;
    @property(cc.Label)
    lblRemainTime: cc.Label = null;
    @property(cc.Label)
    lblRemainTime2: cc.Label = null;
    @property(cc.Label)
    lblScore: cc.Label = null;
    @property(cc.Label)
    lblUserTai: cc.Label = null;
    @property(cc.Label)
    lblUserXiu: cc.Label = null;
    @property(cc.Label)
    lblTotalBetTai: cc.Label = null;
    @property(cc.Label)
    lblTotalBetXiu: cc.Label = null;
    @property(cc.Label)
    lblBetTai: cc.Label = null;
    @property(cc.Label)
    lblBetXiu: cc.Label = null;
    @property(cc.Label)
    lblBetedTai: cc.Label = null;
    @property(cc.Label)
    lblBetedXiu: cc.Label = null;
    @property(sp.Skeleton)
    dice1: sp.Skeleton = null;
    @property(sp.Skeleton)
    dice2: sp.Skeleton = null;
    @property(sp.Skeleton)
    dice3: sp.Skeleton = null;
    
    @property(sp.Skeleton)
    eftai: sp.Skeleton = null;
    @property(sp.Skeleton)
    efxiu: sp.Skeleton = null;
    @property(cc.Node)
    bowl: cc.Node = null;
    @property(cc.Node)
    tai: cc.Node = null;
    @property(cc.Node)
    xiu: cc.Node = null;
	@property(cc.Node)
    xiu1: cc.Node = null;
    @property(cc.Node)
    xiu2: cc.Node = null;
    @property(cc.Node)
    btnHistories: cc.Node = null;
    @property(cc.Node)
    nodePanelChat: cc.Node = null;
    @property(cc.Node)
    layoutBet: cc.Node = null;
    @property(cc.Node)
    layoutBet1: cc.Node = null;
    @property(cc.Node)
    layoutBet2: cc.Node = null;
    @property([cc.Button])
    buttonsBet1: Array<cc.Button> = new Array<cc.Button>();
    @property([cc.Button])
    buttonsBet2: Array<cc.Button> = new Array<cc.Button>();
    @property(cc.Label)
    lblToast: cc.Label = null;
    @property(cc.Label)
    lblWinCash: cc.Label = null;
    @property(cc.Node)
    btnNan: cc.Node = null;
    @property(cc.Label)
    lblMD5Text: cc.Label = null;
    @property(SoundManager)
    soundManager: SoundManager = null;
    @property(PopupDetailHistory)
    popupDetailHistory: PopupDetailHistory = null;
    @property([cc.BitmapFont])
    fontTime: cc.BitmapFont[] = [];

    @property([cc.Node])
    public popups: cc.Node[] = [];
    private arrTimeoutDice = [];
    private isBetting = false;
    private remainTime = 0;
    private canBet = true;
    private betedTai = 0;
    private betedXiu = 0;
    private referenceId = 0;
    private betingValue = -1;
    private betingDoor = BetDoor.None;
    private isOpenBowl = false;
    private lastWinCash = 0;
    private hasResultPacket = false;
    private hasResultVisual = false;
    private hasShownWinCash = false;
    private lastScore = 0;
    private isNan = false;
    histories = [];
    
    private isCanChat = true;
    private panelChat: PanelChat = null;
    private readonly maxBetValue = 999999999;
    private listBets = [1000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];
    private bowlStartPos = cc.v2(0, 0);
    private md5CodeResult = "";
    private playingNewGame = false;
    private blowType = "CLOSE";
    
    onLoad() {
        TaiXiuMiniController.instance = this;
        cc.game.on(cc.game.EVENT_SHOW, () => {
            if (cc.isValid(this.node) && this.node.active) {
                if (this.arrTimeoutDice == null) this.arrTimeoutDice = [];
                for (var i = 0; i < this.arrTimeoutDice.length; i++) {
                    clearTimeout(this.arrTimeoutDice[i]);
                }
                this.arrTimeoutDice = [];
    }

        })
    }
    getAnimationDiceStart(dice) {
        var anim = "";
        if (dice == 1) anim = "xi ngau bay 1";
        else if (dice == 2) anim = "xi ngau bay 2";
        else if (dice == 3) anim = "xi ngau bay 3";
        else if (dice == 4) anim = "xi ngau bay 4";
        else if (dice == 5) anim = "xi ngau bay 5";
        else if (dice == 6) anim = "xi ngau bay 6";
        return anim;
    }

    getAnimationDiceEnd(dice) {
        var anim = "";
        if (dice == 1) anim = "1";
        else if (dice == 2) anim = "2";
        else if (dice == 3) anim = "3";
        else if (dice == 4) anim = "4";
        else if (dice == 5) anim = "5";
        else if (dice == 6) anim = "6";
        return anim;
    }
    onFocusInEditor() {
        //  cc.log("------------------");
    }


    updateStatusBlow(type = "CLOSE"){
        if (!this.bowl) return;
        if (!this.isNan && type !== "HIDE") {
            type = "HIDE";
        }
        this.blowType = type;
        switch (type) {
            case "HIDE": {
                this.bowl.active = false;
                this.bowl.getComponent(cc.Animation).stop();
                this.bowl.setPosition(this.bowlStartPos);
                this.bowl.opacity = 255;
                break;
            }
            case "SHOW": {
                this.bowl.active = true;
                this.bowl.getComponent(cc.Animation).stop();
                this.bowl.setPosition(this.bowlStartPos);
                this.bowl.opacity = 255;
                break;
            }
            case "ANIM_CLOSE": {
                this.bowl.active = true;  
                this.bowl.getComponent(cc.Animation).stop();
                this.bowl.getComponent(cc.Animation).play("bowlClose"); 
                this.arrTimeoutDice.push(setTimeout(()=>{
                    this.bowl.active = false;  
                    this.updateStatusBlow("SHOW")
                }, 100))
                break;
            }
            case "ANIM_OPEN": {
                this.bowl.active = true;   
                this.bowl.getComponent(cc.Animation).stop();
                this.bowl.getComponent(cc.Animation).play("bowlOpen");  
                this.arrTimeoutDice.push(setTimeout(()=>{
                    this.bowl.active = true;   
                    this.updateStatusBlow("HIDE")
                }, 150))
                break;
            }
            case "NAN": {
                this.bowl.active = true;   
                this.bowl.getComponent(cc.Animation).stop();
                this.bowl.opacity = 255;
                this.bowl.setPosition(this.bowlStartPos);
                break;
            }
        }
    }

    start() {
        if (this.bowl) {
            this.bowlStartPos = cc.v2(this.bowl.x, this.bowl.y);
        }
        if (!this.soundManager) {
            this.soundManager = this.getComponent(SoundManager) || this.getComponentInChildren(SoundManager);
        }
        if (SPUtils.getSoundVolumn() <= 0) {
            SPUtils.setSoundVolumn(1);
        }
        console.log("add listener md5");
        MiniGameNetworkClient.getInstance().addListener((data: Uint8Array) => {
            if (!this.node.active) return;
            let inpacket = new InPacket(data);
 
            switch (inpacket.getCmdId()) {
                case cmdMD5.Code.GAME_INFO: {
                    let res = new cmdMD5.ReceiveGameInfo(data);
                    this.stopWin();
                    this.playingNewGame = false;
                    this.dice3.setCompleteListener(() => {});
                    this.dice1.clearTrack(0);
                    this.dice2.clearTrack(0);
                    this.dice3.clearTrack(0);
                    
                    if (res.bettingState) {
                        this.updateStatusBlow("HIDE");
                        this.isBetting = true;
                        this.dice1.node.active = false;
                        this.dice2.node.active = false;
                        this.dice3.node.active = false;
                        const remainBet = this.normalizeBetRemainTime(res.remainTime);
                        this.lblRemainTime.node.active = true;
                        this.lblRemainTime.string = this.formatRemain(remainBet);
                        this.lblRemainTime.font = remainBet < 10 ? this.fontTime[1] : this.fontTime[0];
                        this.lblRemainTime2.node.parent.active = false;
                        this.lblRemainTime2.node.active = false;
                        this.lblScore.node.parent.active = false;
                    } else {
                        const remainResult = this.normalizeResultRemainTime(res.remainTime);
                        this.updateStatusBlow("HIDE");
                        this.lastScore = res.dice1 + res.dice2 + res.dice3;
                        this.isBetting = false;
                        this.dice1.node.active = true;
                        this.dice1.setAnimation(0, this.getAnimationDiceEnd(res.dice1), false);
                        this.dice2.node.active = true;
                        this.dice2.setAnimation(0, this.getAnimationDiceEnd(res.dice2), false);
                        this.dice3.node.active = true;
                        this.dice3.setAnimation(0, this.getAnimationDiceEnd(res.dice3), false);

                        this.lblRemainTime.node.active = false;
                        this.lblRemainTime2.node.parent.active = true;
                        this.lblRemainTime2.node.active = true;
                        this.lblRemainTime2.string = remainResult < 10 ? "0" + remainResult : "" + remainResult;
                        this.showResult();
                    }
                    if (!res.bettingState) {
                       // if (res.remainTime == 0) {
                            //this.showToast(App.instance.getTextLang('txt_taixiu_refund'));
                       // }
                       // let chipEnd = res.potTai > res.potXiu ? res.potXiu : res.potTai;
                        this.lblTotalBetTai.string = Utils.formatNumber(res.potTai);
                        this.lblTotalBetXiu.string = Utils.formatNumber(res.potXiu);
                    } else {
                        Tween.numberTo(this.lblTotalBetTai, res.potTai, 0.3);
                        Tween.numberTo(this.lblTotalBetXiu, res.potXiu, 0.3);
                    }
                    //Tween.numberTo(this.lblTotalBetTai, res.potTai, 0.3);
                    //Tween.numberTo(this.lblTotalBetXiu, res.potXiu, 0.3);
                    this.betedTai = res.betTai;
                    this.betedXiu = res.betXiu;
					this.lblBetedTai.string = this.betedTai > 0 ? Utils.formatNumber(this.betedTai) : "";
					this.lblBetedXiu.string = this.betedXiu > 0 ? Utils.formatNumber(this.betedXiu) : "";
                    this.referenceId = res.referenceId;
                    this.lblSession.string = "#" + res.referenceId;
                    this.remainTime = res.remainTime;
                    this.lblMD5Text.string = res.md5Code;
                    break;
                }
                case cmdMD5.Code.UPDATE_TIME: {
                    let res = new cmdMD5.ReceiveUpdateTime(data);
                    if (res.bettingState) {
                        this.isBetting = true;
                        this.lblRemainTime.node.active = true;
                        this.lblRemainTime2.node.parent.active = false;
                        this.lblRemainTime2.node.active = false;
                        this.lblScore.node.parent.active = false;
                        const remainBet = this.normalizeBetRemainTime(res.remainTime);
                        this.lblRemainTime.string = this.formatRemain(remainBet);
                        this.lblRemainTime.font = remainBet < 10 ? this.fontTime[1] : this.fontTime[0];
                        if(this.playingNewGame && res.remainTime >=49){
                            this.playingNewGame = false;
                            this.updateStatusBlow("HIDE");
                            this.dice1.node.active = false;
                            this.dice2.node.active = false;
                            this.dice3.node.active = false;
                        }
                        if (res.remainTime < 47) {
                            this.dice1.node.active = false;
                            this.dice2.node.active = false;
                            this.dice3.node.active = false;
                            this.updateStatusBlow("HIDE");
                            this.lblRemainTime.node.active = true;
                        }
                    } else {
                        const remainResult = this.normalizeResultRemainTime(res.remainTime);
                        this.isBetting = false;
                        this.lblRemainTime.node.active = false;
                        this.lblRemainTime2.node.parent.active = true;
                        this.lblRemainTime2.node.active = true;
                        this.lblRemainTime2.string = remainResult < 10 ? "0" + remainResult : "" + remainResult;
                        this.layoutBet.active = false;
                        this.lblBetTai.string = "";
                        this.lblBetXiu.string = "";
                        if (remainResult < 5 && this.isNan && this.blowType != "HIDE" && this.blowType != "ANIM_OPEN" ) {
                            this.updateStatusBlow("ANIM_OPEN");
                            this.showResult();
                        }
                    }
                    if (!res.bettingState) {
                        //if (res.remainTime == 0) {
                        //    this.showToast(App.instance.getTextLang('txt_taixiu_refund'));
                       // }
                      //  let chipEnd = res.potTai > res.potXiu ? res.potXiu : res.potTai;
                        this.lblTotalBetTai.string = Utils.formatNumber(res.potTai);
                        this.lblTotalBetXiu.string = Utils.formatNumber(res.potXiu);
                    } else {
                        if (res.remainTime <= 6) {
                            if(Utils.formatNumber(res.potTai) != this.lblTotalBetTai.string || Utils.formatNumber(res.potXiu) != this.lblTotalBetXiu.string){
                                this.lblTotalBetTai.string = Utils.formatNumber(res.potTai);
                                this.lblTotalBetXiu.string = Utils.formatNumber(res.potXiu);
                            } else {
                                this.lblTotalBetTai.string = Utils.formatNumber(res.potTai);
                                this.lblTotalBetXiu.string = Utils.formatNumber(res.potXiu);
                            }   
                        } else {
                            Tween.numberTo(this.lblTotalBetTai, res.potTai, 0.3);
                            Tween.numberTo(this.lblTotalBetXiu, res.potXiu, 0.3);
                        }
                    }
                    //Tween.numberTo(this.lblTotalBetTai, res.potTai, 0.3);
                    //Tween.numberTo(this.lblTotalBetXiu, res.potXiu, 0.3);
                    this.lblUserTai.string = Utils.formatNumber(res.numBetTai) ;
                    this.lblUserXiu.string =  Utils.formatNumber(res.numBetXiu) ;
                    break;
                }
                case cmdMD5.Code.DICES_RESULT: {
                    let res = new cmdMD5.ReceiveDicesResult(data);
                    this.lastScore = res.dice1 + res.dice2 + res.dice3;
                    this.md5CodeResult = res.md5code;
                    if (this.histories.length >= 100) {
                        this.histories.slice(0, 1);
                    }
                    this.histories.push({
                        "session": this.referenceId,
                        "dices": [
                            res.dice1,
                            res.dice2,
                            res.dice3
                        ]
                    });

                    if (this.isNan) {
                        this.dice1.node.active = true;
                        this.dice2.node.active = true;
                        this.dice3.node.active = true;
                        this.dice1.setAnimation(0, this.getAnimationDiceEnd(res.dice1), false);
                        this.dice2.setAnimation(0, this.getAnimationDiceEnd(res.dice2), false);
                        this.dice3.setAnimation(0, this.getAnimationDiceEnd(res.dice3), false);
                        this.showToast("Xin moi nan");
                        this.updateStatusBlow("NAN");
                    } else {
                        this.updateStatusBlow("HIDE");
                        this.dice1.node.active = true;
                        this.dice2.node.active = true;
                        this.dice3.node.active = true;
                        this.dice1.setAnimation(0, this.getAnimationDiceStart(res.dice1), false);
                        this.dice2.setAnimation(0, this.getAnimationDiceStart(res.dice2), false);
                        this.dice3.setAnimation(0, this.getAnimationDiceStart(res.dice3), false);
                        this.dice3.setCompleteListener(() => {
                            this.dice3.setCompleteListener(() => {});
                            this.dice1.setAnimation(0, this.getAnimationDiceEnd(res.dice1), false);
                            this.dice2.setAnimation(0, this.getAnimationDiceEnd(res.dice2), false);
                            this.dice3.setAnimation(0, this.getAnimationDiceEnd(res.dice3), false);
                            this.lblRemainTime.node.active = false;
                            this.lblRemainTime2.node.parent.active = false;
                            this.lblRemainTime2.node.parent.active = true;
                            this.lblRemainTime2.node.active = true;
                            this.showResult();
                        });
                    }
                    if (this.soundManager) {
                        this.soundManager.playAudioEffect(audio_clip.DICE);
                    }
                    break;

                }
                case cmdMD5.Code.RESULT: {
                    let res = new cmdMD5.ReceiveResult(data);
                    // console.log(res);
                    Configs.Login.Coin = res.currentMoney;
                    this.lastWinCash = res.totalMoney;
                    this.hasResultPacket = true;
                    this.tryShowWinCash();
                    break;
                }
                case cmdMD5.Code.NEW_GAME: {
                    let res = new cmdMD5.ReceiveNewGame(data);
                
                    console.log("new game md5 " + res.md5code);
                    this.playingNewGame = true;
          //          this.lblTotalBetTai.node.scale = 0.7;
            //        this.lblTotalBetXiu.node.scale = 0.7;
                    this.lblTotalBetTai.node.stopAllActions();
                    this.lblTotalBetXiu.node.stopAllActions();
                    this.lblTotalBetTai.string = "";
                    this.lblTotalBetXiu.string = "";
                    this.lblBetedTai.string = "";
                    this.lblBetedXiu.string = "";
                    this.lblUserTai.string = "";
                    this.lblUserXiu.string = "";
                    this.referenceId = res.referenceId;
                    this.lblSession.string = "#" + res.referenceId;
                    this.betingValue = -1;
                    this.betingDoor = BetDoor.None;
                    this.betedTai = 0;
                    this.betedXiu = 0;
                    this.isOpenBowl = false;
                    this.lastWinCash = 0;
                    this.hasResultPacket = false;
                    this.hasResultVisual = false;
                    this.hasShownWinCash = false;
                    this.lblMD5Text.string = res.md5code;
                    this.stopWin();
                    break;
                }
                case cmdMD5.Code.HISTORIES: {
                    let res = new cmdMD5.ReceiveHistories(data);
                    var his = res.data.split(",");
                    for (var i = 0; i < his.length; i++) {
                        this.histories.push({
                            "session": this.referenceId - his.length / 3 + parseInt("" + ((i + 1) / 3)) + (this.isBetting ? 0 : 1),
                            "dices": [
                                parseInt(his[i]),
                                parseInt(his[++i]),
                                parseInt(his[++i])
                            ]
                        });
                    }
                    this.updateBtnHistories();
                    break;
                }
                case cmdMD5.Code.LOG_CHAT: {
                    let res = new cmdMD5.ReceiveLogChat(data);
                    // console.log(res);
                    // break;
                    var msgs = JSON.parse(res.message);
                    console.log('cmdMD5.Code.LOG_CHAT', msgs);
                    for (var i = 0; i < msgs.length; i++) {
                        this.panelChat.addMessage(msgs[i]["u"], msgs[i]["m"]);
                    }
                    this.panelChat.scrollToBottom();
                    break;
                }
                case cmdMD5.Code.SEND_CHAT: {
                    let res = new cmdMD5.ReceiveSendChat(data);
                    switch (res.error) {
                        case 0:
                            this.panelChat.addMessage(res.nickname, res.message);
                            break;
                        case 2:
                            this.showToast("Bạn không có quyền Chat!");
                            break;
                        case 3:
                            this.showToast("Tạm thời bạn bị cấm Chat!");
                            break;
                        case 4:
                            this.showToast("Nội dung chat quá dài.");
                            break;
                        default:
                            this.showToast("Bạn không thể chat vào lúc này.");
                            break;
                    }
                    // console.log(res);
                    break;
                }
                case cmdMD5.Code.BET: {
                 
                    let res = new cmdMD5.ReceiveBet(data);
                    switch (res.result) {
                        case 0:
                            
                            switch (this.betingDoor) {
                                case BetDoor.Tai:
                                    this.betedTai += this.betingValue;
                                    this.lblBetedTai.string = Utils.formatNumber(this.betedTai);
                                    break;
                                case BetDoor.Xiu:
                                    this.betedXiu += this.betingValue;
                                    this.lblBetedXiu.string = Utils.formatNumber(this.betedXiu);
                                    break;
                            }
                            Configs.Login.Coin = res.currentMoney;
                            BroadcastReceiver.send(BroadcastReceiver.USER_UPDATE_COIN);

                            this.betingValue = -1;
                            this.showToast("Đặt cược thành công.");
                            break;
                        case 2:
                            this.betingValue = -1;
                            this.showToast("Hết thời gian cược.");
                            break;
                        case 3:
                            this.betingValue = -1;
                            this.showToast("Số dư không đủ vui lòng nạp thêm.");
                            break;
                        case 4:
                            this.betingValue = -1;
                            this.showToast("Số tiền cược không hợp lệ.");
                            break;
                        default:
                            this.betingValue = -1;
                            this.showToast("Đặt cược không thành công.");
                            break;
                    }
                    break;
                }
                default:
                    // console.log(inpacket.getCmdId());
                    break;
            }
        }, this);
        for (let i = 0; i < this.buttonsBet1.length; i++) {
            let btn = this.buttonsBet1[i];
            let value = this.listBets[i];
            let strValue = value + "";
            if (value >= 1000000) {
                strValue = (value / 1000000) + "M";
            } else if (value >= 1000) {
                strValue = (value / 1000) + "K";
            }
            btn.getComponentInChildren(cc.Label).string = strValue;
            btn.node.on("click", () => {
                
                if (this.betingDoor === BetDoor.None) return;
                let lblBet = this.betingDoor === BetDoor.Tai ? this.lblBetTai : this.lblBetXiu;
                let number = Utils.stringToInt(lblBet.string) + value;
                if (number > this.maxBetValue) number = this.maxBetValue;
                lblBet.string = Utils.formatNumber(number);
            });
        }
        for (let i = 0; i < this.buttonsBet2.length; i++) {
            let btn = this.buttonsBet2[i];
            let value = btn.getComponentInChildren(cc.Label).string;
            btn.node.on("click", () => {
                
                if (this.betingDoor === BetDoor.None) return;
                let lblBet = this.betingDoor === BetDoor.Tai ? this.lblBetTai : this.lblBetXiu;
                let number = Utils.stringToInt(lblBet.string + value);
                if (number > this.maxBetValue) number = this.maxBetValue;
                lblBet.string = Utils.formatNumber(number);
            });
        }

        this.bowl.on(cc.Node.EventType.TOUCH_MOVE, (event: cc.Event.EventTouch) => {
            if( this.isNan && !this.isBetting && this.bowl.active){
                var pos = this.bowl.position;
                pos.x += event.getDeltaX();
                pos.y += event.getDeltaY();
                this.bowl.position = pos;
                let distance = Utils.v2Distance(pos, this.bowlStartPos);
                if (Math.abs(distance) > 220) {
                    this.updateStatusBlow("HIDE");
                    this.showResult();
                }
            }
        }, this);
    }

    show() {
        App.instance.buttonMiniGame.showTimeTaiXiu(false);
        this.layoutBet.active = false;
        this.lblToast.node.parent.active = false;
        this.lblWinCash.node.active = false;
        this.layoutBet.active = false;
        this.bowl.active = false;
        this.dice1.node.active = false;
        this.dice2.node.active = false;
        this.dice3.node.active = false;
        var instance = MiniGameNetworkClient.getInstance();
        instance.send(new cmdMD5.SendScribe());
        this.showChat();
    }

    showChat() {
        if (!this.nodePanelChat) {
            return;
        }
        this.panelChat = this.nodePanelChat.getComponent(PanelChat);
        if (this.panelChat) {
            this.panelChat.show(true);
        }
    }

    copyMd5Text(){
        
        var temp = document.createElement('textarea');
        temp.value = this.lblMD5Text.string;
        document.body.appendChild(temp);
        temp.select(); // é€‰æ‹©å¯¹è±¡
        document.execCommand("Copy"); // æ‰§è¡Œæµè§ˆå™¨å¤åˆ¶å‘½ä»¤
        temp.style.display='none';
        this.showToast("Đã copy chuỗi MD5!");
    }

    dismiss() {
        for (let i = 0; i < this.popups.length; i++) {
            this.popups[i].active = false;
        }
        if (this.panelChat) {
            this.panelChat.show(false);
        }
        MiniGameNetworkClient.getInstance().send(new cmdMD5.SendUnScribe());
    }

    actClose() {
       
        TaiXiuMD5COntroler.instance.dismiss();
    }
	
	actTransaction() {
        if (!Configs.Login.IsLogin) {
            App.instance.alertDialog.showMsg(App.instance.getTextLang('txt_need_login'));
            return;
        }
        if (this.openPopupByName("PopupHistory")) {
            return;
        }
        this.showToast("Khong tim thay popup lich su MD5.");
    }

    private openPopupByName(popupName: string): boolean {
        if (!popupName) return false;

        let popupNode: cc.Node = null;
        for (let i = 0; i < this.popups.length; i++) {
            const node = this.popups[i];
            if (node && node.name === popupName) {
                popupNode = node;
                break;
            }
        }
        if (!popupNode) {
            popupNode = this.findNodeByName(this.node, popupName);
        }
        if (!popupNode) {
            return false;
        }

        const components = popupNode.getComponents(cc.Component);
        for (let i = 0; i < components.length; i++) {
            const comp: any = components[i];
            if (comp && typeof comp.show === "function") {
                comp.show();
                return true;
            }
        }

        popupNode.active = true;
        return true;
    }

    private findNodeByName(root: cc.Node, targetName: string): cc.Node {
        if (!root) return null;
        if (root.name === targetName) return root;
        for (let i = 0; i < root.childrenCount; i++) {
            const found = this.findNodeByName(root.children[i], targetName);
            if (found) return found;
        }
        return null;
    }
    

    actChat() {
        if (!this.panelChat) {
            this.showChat();
        }
        if (!this.panelChat) {
            return;
        }
        this.panelChat.show(!this.panelChat.node.active);
    }

    actBetTai() {
       
        if (!this.isBetting) {
            this.showToast("Chưa đến thời gian đặt cược.");
            return;
        }
        if (this.betingValue >= 0) {
            this.showToast("Bạn thao tác quá nhanh.");
            return;
        }
        this.betingDoor = BetDoor.Tai;
        this.lblBetTai.string = "0";
        this.lblBetXiu.string = "";
		this.xiu1.active = true;
		this.xiu2.active = false;
        this.layoutBet.active = true;
        this.layoutBet1.active = true;
        this.layoutBet2.active = false;
    }

    actBetXiu() {
       
        if (!this.isBetting) {
            this.showToast("Chưa đến thời gian đặt cược.");
            return;
        }
        if (this.betingValue >= 0) {
            this.showToast("Bạn thao tác quá nhanh.");
            return;
        }
        this.betingDoor = BetDoor.Xiu;
        this.lblBetXiu.string = "0";
        this.lblBetTai.string = "";
		this.xiu1.active = false;
		this.xiu2.active = true;
        this.layoutBet.active = true;
        this.layoutBet1.active = true;
        this.layoutBet2.active = false;
    }

    actOtherNumber() {
       
        this.layoutBet1.active = false;
        this.layoutBet2.active = true;
    }

    actAgree() {
       
        if (this.betingValue >= 0 || !this.canBet) {
            this.showToast("Bạn thao tác quá nhanh.");
            return;
        }
        if (this.betingDoor === BetDoor.None) return;
        var lblBet = this.betingDoor === BetDoor.Tai ? this.lblBetTai : this.lblBetXiu;
        this.betingValue = Utils.stringToInt(lblBet.string);
        this.betingDoor = this.betingDoor;
        MiniGameNetworkClient.getInstance().send(new cmdMD5.SendBet(this.referenceId, this.betingValue, this.betingDoor == BetDoor.Tai ? 1 : 0, this.remainTime));
        lblBet.string = "";

        this.canBet = false;
        this.scheduleOnce(function () {
            this.canBet = true;
        }, 1);
    }

    actCancel() {
        if (this.lblBetXiu) this.lblBetXiu.string = "";
        if (this.lblBetTai) this.lblBetTai.string = "";
        if (this.xiu1) this.xiu1.active = false;
        if (this.xiu2) this.xiu2.active = false;
        this.betingDoor = BetDoor.None;
        if (this.layoutBet) this.layoutBet.active = false;
    }

    actBtnGapDoi() {
        
        App.instance.showBgMiniGame("TaiXiu");
        if (this.betingDoor === BetDoor.None) return;
        let lblBet = this.betingDoor === BetDoor.Tai ? this.lblBetTai : this.lblBetXiu;

        let number = Utils.stringToInt(lblBet.string) + Configs.Login.Coin;
        if (number > this.maxBetValue) number = this.maxBetValue;
        lblBet.string = Utils.formatNumber(number);

    }


    actBtnDelete() {
        
        if (this.betingDoor === BetDoor.None) return;
        var lblBet = this.betingDoor === BetDoor.Tai ? this.lblBetTai : this.lblBetXiu;
        var number = "" + Utils.stringToInt(lblBet.string);
        number = number.substring(0, number.length - 1);
        number = Utils.formatNumber(Utils.stringToInt(number));
        lblBet.string = number;
    }

    actBtn000() {
        
        if (this.betingDoor === BetDoor.None) return;
        var lblBet = this.betingDoor === BetDoor.Tai ? this.lblBetTai : this.lblBetXiu;
        var number = Utils.stringToInt(lblBet.string + "000");
        if (number > this.maxBetValue) number = this.maxBetValue;
        lblBet.string = Utils.formatNumber(number);
    }

    actNan() {
       
        this.isNan = !this.isNan;
        this.btnNan.getComponent(cc.Sprite).spriteFrame = this.isNan ? this.sprFrameBtnNan2 : this.sprFrameBtnNan;
        if (!this.isNan) {
            this.updateStatusBlow("HIDE");
        }
    }

    private normalizeResultRemainTime(rawRemain: number): number {
        let remain = Math.max(0, Math.floor(rawRemain || 0));
        if (remain > 15) {
            remain -= 15;
        }
        if (remain <= 1) {
            return 0;
        }
        return remain;
    }

    private normalizeBetRemainTime(rawRemain: number): number {
        let remain = Math.max(0, Math.floor(rawRemain || 0));
        if (remain <= 1) {
            return 0;
        }
        return remain;
    }

    private showResult() {
       // console.error("showResult");
       if (this.lblMD5Text) this.lblMD5Text.string = this.md5CodeResult;
       
        if (this.lblScore && this.lblScore.node && this.lblScore.node.parent) {
            this.lblScore.node.parent.active = true;
        }
        if (this.lblScore) this.lblScore.string = "" + this.lastScore;
        if (this.lastScore >= 11) {
            if (this.eftai && this.eftai.node) this.eftai.node.active = true;
            if (this.efxiu && this.efxiu.node) this.efxiu.node.active = false;
            if (this.tai) {
                this.tai.runAction(cc.repeatForever(cc.spawn(
                    cc.sequence(cc.scaleTo(0.3, 1.3), cc.scaleTo(0.3, 1)),
                    cc.sequence(cc.tintTo(0.3, 255, 255, 0), cc.tintTo(0.3, 255, 255, 255))
                )));
            }
            if (this.eftai) this.eftai.setAnimation(0, "tai", true);
            // this.eftai.node.parent.getChildByName("text").active = false;
            // this.efxiu.node.parent.getChildByName("text").active = true;
        } else {
            if (this.efxiu && this.efxiu.node) this.efxiu.node.active = true;
            
            if (this.eftai && this.eftai.node) this.eftai.node.active = false;
            if (this.xiu) {
                this.xiu.runAction(cc.repeatForever(cc.spawn(
                    cc.sequence(cc.scaleTo(0.3, 1.3), cc.scaleTo(0.3, 1)),
                    cc.sequence(cc.tintTo(0.3, 255, 255, 0), cc.tintTo(0.3, 255, 255, 255))
                )));
            }
            if (this.efxiu) this.efxiu.setAnimation(0, "xiu", true);
            // this.efxiu.node.parent.getChildByName("text").active = false;
            // this.eftai.node.parent.getChildByName("text").active = true;
        }
        this.updateBtnHistories();
        for (var i = 1; i < this.arrTimeoutDice.length; i++) {
            clearTimeout(this.arrTimeoutDice[i]);
        }
        this.arrTimeoutDice = [];
        this.hasResultVisual = true;
        this.tryShowWinCash();
    }

    private stopWin() {
        if (this.eftai && this.eftai.node) this.eftai.node.active = false;
        if (this.efxiu && this.efxiu.node) this.efxiu.node.active = false;
        // this.eftai.node.parent.getChildByName("text").active = true;
        // this.efxiu.node.parent.getChildByName("text").active = true;
        if (this.tai) {
            this.tai.stopAllActions();
            this.tai.runAction(cc.spawn(cc.scaleTo(0.3, 1), cc.tintTo(0.3, 255, 255, 255)));
        }

        if (this.xiu) {
            this.xiu.stopAllActions();
            this.xiu.runAction(cc.spawn(cc.scaleTo(0.3, 1), cc.tintTo(0.3, 255, 255, 255)));
        }
    }

    private showToast(message: string) {
        if (!message) return;
        if (message.indexOf("txt_") === 0) return;
        this.lblToast.string = message;
        let parent = this.lblToast.node.parent;
        parent.stopAllActions();
        parent.active = true;
        parent.opacity = 0;
        parent.runAction(cc.sequence(cc.fadeIn(0.1), cc.delayTime(2), cc.fadeOut(0.2), cc.callFunc(() => {
            parent.active = false;
        })));
    }

    private formatRemain(remain: number): string {
        return remain < 10 ? "0" + remain : "" + remain;
    }

    private tryShowWinCash() {
        if (!this.hasResultPacket || !this.hasResultVisual || this.hasShownWinCash) return;
        if (this.lastWinCash > 0) {
            this.showWinCash();
        }
        this.hasShownWinCash = true;
    }

    private showWinCash() {
        if (!this.hasResultPacket || !this.hasResultVisual || this.lastWinCash <= 0) return;
        if (this.soundManager) {
            this.soundManager.playAudioEffect(audio_clip.WIN);
        }
        this.lblWinCash.node.stopAllActions();
        this.lblWinCash.node.active = true;
        this.lblWinCash.node.scale = 0;
        this.lblWinCash.node.position = cc.Vec2.ZERO;
        Tween.numberTo(this.lblWinCash, this.lastWinCash, 0.5, (n) => { return "+" + Utils.formatNumber(n) });
        this.lblWinCash.node.runAction(cc.sequence(
            cc.scaleTo(0.5, 1),
            cc.delayTime(2),
            cc.moveBy(1, cc.v2(0, 60)),
            cc.callFunc(() => {
                this.lblWinCash.node.active = false;
            })
        ));
        BroadcastReceiver.send(BroadcastReceiver.USER_UPDATE_COIN);
    }

    updateBtnHistories() {
        let histories = this.histories.slice();
        if (histories.length > this.btnHistories.childrenCount) {
            histories.splice(0, histories.length - this.btnHistories.childrenCount);
        }
        let idx = histories.length - 1;
        for (var i = this.btnHistories.childrenCount - 1; i >= 0; i--) {
            if (idx >= 0) {
                let _idx = idx;
                var score = histories[idx]["dices"][0] + histories[idx]["dices"][1] + histories[idx]["dices"][2];
                this.btnHistories.children[i].getComponent(cc.Sprite).spriteFrame = score >= 11 ? this.sprFrameTai : this.sprFrameXiu;
                this.btnHistories.children[i].off("click");
                
                
                this.btnHistories.children[i].active = true;
            } else {
                this.btnHistories.children[i].active = false;
            }
            idx--;
        }
    }

    sendChat(message: string) {
        let _this = this;
        if (!_this.isCanChat) {
            this.showToast("Bạn thao tác quá nhanh.");
            return;
        }
        _this.isCanChat = false;
        this.scheduleOnce(function () {
            _this.isCanChat = true;
        }, 1);
        var req = new cmdMD5.SendChat(unescape(encodeURIComponent(message)));
        MiniGameNetworkClient.getInstance().send(req);
    }
}













