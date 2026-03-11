const mongoose = require('mongoose');

const DEFAULT_GAME_MENU_BUTTONS = [
  { id: 'tx_cao', text: '\uD83C\uDFB2 Tai Xiu Cao', callbackData: 'game_tx_cao', webAppUrl: '', enabled: true, order: 1 },
  { id: 'tx_nan', text: '\uD83C\uDFB2 Tai Xiu Nan', callbackData: 'game_tx_nan', webAppUrl: '', enabled: true, order: 2 },
  { id: 'xocdia', text: '\uD83D\uDCBF Xoc Dia', callbackData: 'game_xocdia', webAppUrl: '', enabled: true, order: 3 },
  { id: 'baucua', text: '\uD83E\uDD80 Bau Cua', callbackData: 'game_baucua', webAppUrl: '', enabled: true, order: 4 },
  { id: 'tx_tele', text: '\uD83D\uDCC8 Tai Xiu Tele', callbackData: 'game_tx_tele', webAppUrl: '', enabled: true, order: 5 },
  { id: 'cl_tele', text: '\uD83D\uDCCA Chan Le Tele', callbackData: 'game_cl_tele', webAppUrl: '', enabled: true, order: 6 },
  { id: 'tx_dice', text: '\uD83C\uDFB2 TX Xuc Xac Tele', callbackData: 'game_tx_dice', webAppUrl: '', enabled: true, order: 7 },
  { id: 'cl_dice', text: '\uD83C\uDFB2 CL Xuc Xac Tele', callbackData: 'game_cl_dice', webAppUrl: '', enabled: true, order: 8 },
  { id: 'slot_tele', text: '\uD83C\uDFB0 Slot Tele', callbackData: 'game_slot', webAppUrl: '', enabled: true, order: 9 },
  { id: 'plinko', text: '\uD83C\uDFB1 Plinko', callbackData: 'game_plinko', webAppUrl: '', enabled: true, order: 10 },
  { id: 'booms', text: '\uD83D\uDCA3 Booms', callbackData: 'game_booms', webAppUrl: '', enabled: true, order: 11 },
  { id: 'xeng', text: '\uD83C\uDF52 Xeng', callbackData: 'game_xeng', webAppUrl: '', enabled: true, order: 12 },
];

const settingSchema = new mongoose.Schema({
  domain: { type: String, default: '' },
  systemGroupId: { type: String, default: '' },
  bankingGroupId: { type: String, default: '' },

  minDeposit: { type: Number, default: 20000 },
  maxDeposit: { type: Number, default: 500000000 },

  minWithdraw: { type: Number, default: 50000 },
  maxWithdraw: { type: Number, default: 100000000 },

  maxWithdrawalsPerDay: { type: Number, default: 3 },
  withdrawWageringReq: { type: Number, default: 1 },

  gameListImage: { type: String, default: '' },

  // Card charging config
  partnerId: { type: String, default: '' },
  partnerKey: { type: String, default: '' },
  cardFee: { type: Number, default: 0 },

  enableSound: { type: Boolean, default: true },

  maintenanceDeposit: { type: Boolean, default: false },
  maintenanceWithdraw: { type: Boolean, default: false },
  maintenanceSystem: { type: Boolean, default: false },
  maintenanceSchedule: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '02:00' },
    endTime: { type: String, default: '03:00' },
    timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
    applySystem: { type: Boolean, default: true },
    applyDeposit: { type: Boolean, default: false },
    applyWithdraw: { type: Boolean, default: false },
    runtimeActive: { type: Boolean, default: false },
  },

  resourceOptimizer: {
    enabled: { type: Boolean, default: true },
    checkIntervalSec: { type: Number, default: 20 },
    highCpuPercent: { type: Number, default: 85 },
    highRamPercent: { type: Number, default: 85 },
    hiddenFps: { type: Number, default: 15 },
    clearCacheCooldownSec: { type: Number, default: 300 },
  },

  useBankAuto: { type: Boolean, default: true },

  minBetCL: { type: Number, default: 1000 },
  maxBetCL: { type: Number, default: 10000000 },
  minBetTX: { type: Number, default: 1000 },
  maxBetTX: { type: Number, default: 10000000 },
  minBetDice: { type: Number, default: 1000 },
  maxBetDice: { type: Number, default: 10000000 },
  minBetSlot: { type: Number, default: 1000 },

  startWelcomeImage: { type: String, default: '' },
  startWelcomeNewUserMessage: {
    type: String,
    default: '👋 Chao mung <b>{username}</b>!\nTai khoan da duoc tao.\nID: <code>{userId}</code>\nToken: <code>{token}</code>\n\nChon mot chuc nang ben duoi de bat dau:',
  },
  startWelcomeReturningMessage: {
    type: String,
    default: '👋 Chao mung tro lai, <b>{username}</b>!\n\nBan muon thuc hien tac vu nao?',
  },

  cskhMessage: { type: String, default: 'Vui long lien he Admin de duoc ho tro.' },
  gameMenuButtons: { type: mongoose.Schema.Types.Mixed, default: DEFAULT_GAME_MENU_BUTTONS },
  webgameRoutes: { type: mongoose.Schema.Types.Mixed, default: {} },
  nonSessionWinRates: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      booms: 35,
      plinko: 45,
      roulette: 38,
      xeng: 40,
      trading: 50,
      lottery: 42,
      lode: 45,
      xoso1phut: 44,
    },
  }
}, { timestamps: true });

module.exports = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
