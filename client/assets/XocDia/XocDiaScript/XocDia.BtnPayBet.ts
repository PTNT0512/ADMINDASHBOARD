import Utils from "../../Lobby/LobbyScript/Script/common/Utils";


const { ccclass, property } = cc._decorator;

@ccclass
export default class BtnPayBet extends cc.Component {
    @property(cc.Label)
    lblTotalBet: cc.Label = null;
	@property(cc.Label)
    lblBet: cc.Label = null;
	@property(cc.Label)
    total: cc.Label = null;
    @property(cc.Node)
    active: cc.Node = null;
    @property([cc.SpriteFrame])
    winlineFrames: cc.SpriteFrame[] = [];

    private winlineTick: (() => void) | null = null;
    private winlineRuntimeFrames: cc.SpriteFrame[] = [];
    private winlineIdx = 0;

    public reset() {
        this.lblTotalBet.string = "";
		this.lblBet.string = "";
		this.total.string = 0;
        this.stopWinEffect();
    }

    public setTotalBet(coin: number) {
        this.lblTotalBet.string = coin > 0 ? Utils.formatMoney(coin) : "";
    }
	public setBet(coin: number) {
        this.lblBet.string = coin > 0 ? Utils.formatMoney(coin) : "";
    }

    public playWinEffect() {
        if (!this.active) return;
        this.stopWinEffect(false);
        this.active.active = true;
        this.active.opacity = 255;
        if (this.active.parent) {
            this.active.setSiblingIndex(this.active.parent.childrenCount - 1);
        }
        this.startWinlineFrameEffect();
        if (!this.playDoorActiveAnimation()) {
            this.startPulseTween(true);
        }
    }

    public stopWinEffect(hide: boolean = true) {
        if (!this.active) return;
        this.stopWinlineFrameEffect();
        cc.Tween.stopAllByTarget(this.active);
        const anim = this.active.getComponent(cc.Animation);
        if (anim) {
            anim.stop();
        }
        this.active.scale = 1;
        this.active.opacity = 255;
        if (hide) {
            this.active.active = false;
        }
    }

    private startWinlineFrameEffect() {
        if (!this.active) return;
        const spr = this.active.getComponent(cc.Sprite);
        if (!spr) return;

        this.winlineRuntimeFrames = this.resolveWinlineFrames(spr);
        if (this.winlineRuntimeFrames.length <= 0) return;

        this.winlineIdx = 0;
        spr.spriteFrame = this.winlineRuntimeFrames[0];

        if (this.winlineRuntimeFrames.length < 2) return;
        this.winlineTick = () => {
            if (!this.active || !this.active.active) return;
            const sprite = this.active.getComponent(cc.Sprite);
            if (!sprite) return;
            this.winlineIdx = (this.winlineIdx + 1) % this.winlineRuntimeFrames.length;
            sprite.spriteFrame = this.winlineRuntimeFrames[this.winlineIdx];
        };
        this.schedule(this.winlineTick, 0.12);
    }

    private stopWinlineFrameEffect() {
        if (!this.winlineTick) return;
        this.unschedule(this.winlineTick);
        this.winlineTick = null;
        this.winlineRuntimeFrames = [];
    }

    private resolveWinlineFrames(sprite: cc.Sprite): cc.SpriteFrame[] {
        if (this.winlineFrames && this.winlineFrames.length >= 2) {
            return [this.winlineFrames[0], this.winlineFrames[1]];
        }

        const atlas: cc.SpriteAtlas = (sprite as any)._atlas || (sprite as any).spriteAtlas;
        if (atlas && atlas.getSpriteFrame) {
            const w1 = atlas.getSpriteFrame("winline1") || atlas.getSpriteFrame("winline1.png");
            const w2 = atlas.getSpriteFrame("winline2") || atlas.getSpriteFrame("winline2.png");
            if (w1 && w2) {
                return [w1, w2];
            }
        }

        if (sprite.spriteFrame) {
            return [sprite.spriteFrame];
        }
        return [];
    }

    private playDoorActiveAnimation(): boolean {
        if (!this.active) return false;
        const anim = this.active.getComponent(cc.Animation);
        if (!anim) return false;

        let clipName = "door_active";
        let state = anim.getAnimationState(clipName);
        if (!state) {
            const clips = anim.getClips ? anim.getClips() : [];
            if (!clips || clips.length <= 0) {
                return false;
            }
            clipName = clips[0].name;
            state = anim.getAnimationState(clipName);
        }

        if (state) {
            state.wrapMode = cc.WrapMode.Loop;
            state.repeatCount = Infinity;
        }
        try {
            anim.play(clipName);
            return true;
        } catch (e) {
            cc.warn("[XocDia] play door_active failed:", e);
            return false;
        }
    }

    private startPulseTween(withOpacity: boolean) {
        if (!this.active) return;
        cc.Tween.stopAllByTarget(this.active);
        this.active.scale = 1;
        if (!withOpacity) {
            this.active.opacity = 255;
        }

        const toA: any = withOpacity ? { scale: 1.08, opacity: 255 } : { scale: 1.08 };
        const toB: any = withOpacity ? { scale: 0.98, opacity: 185 } : { scale: 0.98 };
        cc.tween(this.active)
            .repeatForever(
                cc.tween()
                    .to(0.22, toA, { easing: "sineOut" })
                    .to(0.22, toB, { easing: "sineIn" })
            )
            .start();
    }
}
