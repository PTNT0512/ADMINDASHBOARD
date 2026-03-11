export type TaiXiuDevGame = "TaiXiuDouble" | "TaiXiuMD5";
export type TaiXiuDevPhase = "betting" | "result";
export type TaiXiuDevTickEvent = "tick" | "result" | "new_round";

export interface TaiXiuDevHistoryItem {
    session: number;
    dices: [number, number, number];
}

export interface TaiXiuDevConfig {
    seedReferenceId: number;
    bettingDuration: number;
    resultDuration: number;
    minPotStep: number;
    maxPotStep: number;
    minUsersStep: number;
    maxUsersStep: number;
    jackpotStartTai: number;
    jackpotStartXiu: number;
    coinStart: number;
}

export interface TaiXiuDevState {
    game: TaiXiuDevGame;
    phase: TaiXiuDevPhase;
    referenceId: number;
    remainTime: number;
    potTai: number;
    potXiu: number;
    numBetTai: number;
    numBetXiu: number;
    betTai: number;
    betXiu: number;
    jpTai: number;
    jpXiu: number;
    dices: [number, number, number];
    md5Code: string;
    histories: TaiXiuDevHistoryItem[];
    currentMoney: number;
    totalMoney: number;
}

export const TAI_XIU_DEV_CONFIG: Record<TaiXiuDevGame, TaiXiuDevConfig> = {
    TaiXiuDouble: {
        seedReferenceId: 180001,
        bettingDuration: 60,
        resultDuration: 15,
        minPotStep: 250000,
        maxPotStep: 2400000,
        minUsersStep: 1,
        maxUsersStep: 12,
        jackpotStartTai: 512000000,
        jackpotStartXiu: 498000000,
        coinStart: 1000000000
    },
    TaiXiuMD5: {
        seedReferenceId: 280001,
        bettingDuration: 55,
        resultDuration: 12,
        minPotStep: 180000,
        maxPotStep: 1800000,
        minUsersStep: 1,
        maxUsersStep: 10,
        jackpotStartTai: 0,
        jackpotStartXiu: 0,
        coinStart: 1000000000
    }
};

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDice(): [number, number, number] {
    return [randomInt(1, 6), randomInt(1, 6), randomInt(1, 6)];
}

function makePseudoMd5(referenceId: number, dices: [number, number, number]): string {
    let seed = (referenceId * 1315423911) >>> 0;
    seed = (seed ^ (dices[0] << 3) ^ (dices[1] << 7) ^ (dices[2] << 11)) >>> 0;
    let md5 = "";
    for (let i = 0; i < 32; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        md5 += ((seed >>> 28) & 0x0f).toString(16);
    }
    return md5;
}

export function createTaiXiuDevState(game: TaiXiuDevGame): TaiXiuDevState {
    const config = TAI_XIU_DEV_CONFIG[game];
    const state: TaiXiuDevState = {
        game,
        phase: "betting",
        referenceId: config.seedReferenceId,
        remainTime: config.bettingDuration,
        potTai: randomInt(120000000, 190000000),
        potXiu: randomInt(110000000, 180000000),
        numBetTai: randomInt(120, 260),
        numBetXiu: randomInt(120, 260),
        betTai: 0,
        betXiu: 0,
        jpTai: config.jackpotStartTai,
        jpXiu: config.jackpotStartXiu,
        dices: [1, 1, 1],
        md5Code: makePseudoMd5(config.seedReferenceId, [1, 1, 1]),
        histories: [],
        currentMoney: config.coinStart,
        totalMoney: 0
    };

    for (let i = 8; i >= 1; i--) {
        const session = state.referenceId - i;
        const dices = randomDice();
        state.histories.push({ session, dices });
    }

    return state;
}

export function advanceTaiXiuDevState(state: TaiXiuDevState): TaiXiuDevTickEvent {
    const config = TAI_XIU_DEV_CONFIG[state.game];
    const potTaiStep = randomInt(config.minPotStep, config.maxPotStep);
    const potXiuStep = randomInt(config.minPotStep, config.maxPotStep);
    state.potTai += potTaiStep;
    state.potXiu += potXiuStep;
    state.numBetTai += randomInt(config.minUsersStep, config.maxUsersStep);
    state.numBetXiu += randomInt(config.minUsersStep, config.maxUsersStep);

    state.remainTime -= 1;
    if (state.remainTime > 0) {
        return "tick";
    }

    if (state.phase === "betting") {
        state.phase = "result";
        state.remainTime = config.resultDuration;
        state.dices = randomDice();
        state.md5Code = makePseudoMd5(state.referenceId, state.dices);
        state.betTai = randomInt(0, 1) === 1 ? randomInt(100000, 5000000) : 0;
        state.betXiu = state.betTai > 0 ? 0 : randomInt(100000, 5000000);
        const score = state.dices[0] + state.dices[1] + state.dices[2];
        const taiWin = score >= 11;
        const playerWin = (taiWin && state.betTai > 0) || (!taiWin && state.betXiu > 0);
        state.totalMoney = playerWin ? Math.floor((state.betTai + state.betXiu) * 0.95) : 0;
        state.currentMoney += state.totalMoney;
        state.histories.push({
            session: state.referenceId,
            dices: state.dices
        });
        if (state.histories.length > 100) {
            state.histories.splice(0, state.histories.length - 100);
        }
        return "result";
    }

    state.phase = "betting";
    state.referenceId += 1;
    state.remainTime = config.bettingDuration;
    state.betTai = 0;
    state.betXiu = 0;
    state.totalMoney = 0;
    if (state.game === "TaiXiuDouble") {
        state.jpTai += randomInt(100000, 600000);
        state.jpXiu += randomInt(100000, 600000);
    }
    return "new_round";
}
