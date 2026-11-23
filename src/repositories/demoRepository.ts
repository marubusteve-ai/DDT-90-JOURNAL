import type {
  Account,
  AuditLog,
  BalanceSnapshot,
  Broker,
  CashTransaction,
  FXRateSnapshot,
  InstrumentSpecification,
  Portfolio,
  PropFirm,
  Trade,
  TradingPlatform,
  User,
  UserProfile,
  Workspace,
  WorkspaceStatus,
} from '../domain/models';
import {
  accountInputSchema,
  balanceSnapshotInputSchema,
  brokerInputSchema,
  cashTransactionInputSchema,
  fxRateInputSchema,
  portfolioInputSchema,
  propFirmInputSchema,
  tradingPlatformInputSchema,
  workspaceInputSchema,
  type AccountInput,
  type BalanceSnapshotInput,
  type BrokerInput,
  type CashTransactionInput,
  type FXRateInput,
  type PortfolioInput,
  type PropFirmInput,
  type TradingPlatformInput,
  type WorkspaceInput,
} from '../domain/validation/accountValidation';
import {
  instrumentSpecInputSchema,
  tradeInputSchema,
  type InstrumentSpecInput,
  type TradeInput,
} from '../domain/validation/tradeValidation';
import { assertAuthorizedScope, type IDataRepository } from './interfaces';

export const DEMO_USER_UID = 'demo_sandbox_trader';
const DEMO_STORAGE_KEY = 'meridian_isolated_demo_store_v3';

interface DemoStoreState {
  profile: UserProfile;
  workspaces: Workspace[];
  portfolios: Portfolio[];
  accounts: Account[];
  cashTransactions: CashTransaction[];
  balanceSnapshots: BalanceSnapshot[];
  brokers: Broker[];
  platforms: TradingPlatform[];
  propFirms: PropFirm[];
  fxRates: FXRateSnapshot[];
  instruments: InstrumentSpecification[];
  trades: Trade[];
  auditLogs: AuditLog[];
}

function createInitialDemoState(): DemoStoreState {
  const now = '2026-11-22T14:00:00.000Z';
  const wsId = 'ws_demo_primary';
  return {
    profile: {
      uid: DEMO_USER_UID,
      email: 'demo-sandbox@meridian.local',
      displayName: 'Demo Sandbox',
      photoUrl: null,
      theme: 'dark',
      defaultCurrency: 'USD',
      timezone: 'America/New_York',
      activeWorkspaceId: wsId,
      createdAt: now,
      updatedAt: now,
    },
    workspaces: [
      {
        id: wsId,
        ownerId: DEMO_USER_UID,
        name: 'Demo Institutional Desk',
        description: 'Isolated sandbox workspace for Stage 1 evaluation. Completely separate from Cloud Firestore.',
        baseCurrency: 'USD',
        timezone: 'America/New_York',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    portfolios: [
      {
        id: 'pf_demo_prop',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        name: 'Prop Firm Allocation',
        description: 'Evaluation and funded prop firm accounts.',
        baseCurrency: 'USD',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pf_demo_personal',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        name: 'Personal Capital',
        description: 'Direct broker live and test accounts.',
        baseCurrency: 'USD',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    brokers: [
      {
        id: 'brk_demo_ibkr',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        name: 'Interactive Brokers',
        website: 'https://www.interactivebrokers.com',
        notes: 'Direct market access equities & futures',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'brk_demo_rithmic',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        name: 'Rithmic',
        website: 'https://www.rithmic.com',
        notes: 'Low-latency futures data & execution routing',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'brk_demo_ctrader',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        name: 'cTrader Demo Feed',
        website: null,
        notes: 'FX / CFD evaluation broker feed',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    platforms: [
      {
        id: 'plt_demo_tv',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        name: 'TradingView / Tradovate',
        vendor: 'Tradovate',
        notes: 'Browser execution & charting workspace',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'plt_demo_ctrader',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        name: 'cTrader',
        vendor: 'Spotware',
        notes: 'Desktop FX execution terminal',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'plt_demo_tws',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        name: 'TWS',
        vendor: 'Interactive Brokers',
        notes: 'Trader Workstation',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    propFirms: [
      {
        id: 'firm_demo_sample',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        name: 'Sample Prop Firm',
        website: null,
        notes: 'User-configurable reference entry for Stage 1 evaluation',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    fxRates: [
      {
        id: 'fx_demo_eurusd',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        baseCurrency: 'EUR',
        quoteCurrency: 'USD',
        rate: '1.0850',
        capturedAt: '2026-11-22',
        source: 'manual',
        notes: 'Manual FX snapshot for multi-currency consolidation',
        createdAt: now,
        updatedAt: now,
      },
    ],
    accounts: [
      {
        id: 'acc_demo_funded_100k',
        workspaceId: wsId,
        portfolioId: 'pf_demo_prop',
        ownerId: DEMO_USER_UID,
        name: 'Apex Alpha 100K Funded',
        accountIdentifierMasked: '•••• 4821',
        accountType: 'prop_funded',
        customCategory: null,
        status: 'active',
        brokerId: 'brk_demo_rithmic',
        brokerName: 'Rithmic',
        propFirmId: 'firm_demo_sample',
        propFirmName: 'Sample Prop Firm',
        platformId: 'plt_demo_tv',
        platformName: 'TradingView / Tradovate',
        baseCurrency: 'USD',
        timezone: 'America/New_York',
        startingBalance: '100000.00',
        verifiedBalanceSnapshot: '99250.00',
        verifiedEquitySnapshot: '99250.00',
        snapshotAsOf: '2026-11-22',
        reconciliationNotes: 'Reconciled: $100,000 start - $3,200 payout + $2,450.00 net realised trades.',
        openingDate: '2026-09-15',
        challengePhase: 'Funded Stage',
        profitTargetAmount: null,
        profitTargetPct: null,
        maxDailyLossAmount: '2500.00',
        maxDailyLossPct: '2.50',
        maxOverallLossAmount: '5000.00',
        maxOverallLossPct: '5.00',
        drawdownMode: 'trailing_eod',
        minTradingDays: 5,
        maxTradingDays: null,
        notes: 'Demo sandbox funded account with futures trades and verified payout ledger.',
        tags: ['futures', 'ny-session'],
        createdAt: '2026-09-15T09:00:00.000Z',
        updatedAt: now,
      },
      {
        id: 'acc_demo_eval_50k',
        workspaceId: wsId,
        portfolioId: 'pf_demo_prop',
        ownerId: DEMO_USER_UID,
        name: 'Phase 1 Evaluation 50K',
        accountIdentifierMasked: '•••• 9104',
        accountType: 'prop_evaluation',
        customCategory: null,
        status: 'active',
        brokerId: 'brk_demo_ctrader',
        brokerName: 'cTrader Demo Feed',
        propFirmId: 'firm_demo_sample',
        propFirmName: 'Sample Prop Firm',
        platformId: 'plt_demo_ctrader',
        platformName: 'cTrader',
        baseCurrency: 'USD',
        timezone: 'Europe/London',
        startingBalance: '50000.00',
        verifiedBalanceSnapshot: '46100.00',
        verifiedEquitySnapshot: '46100.00',
        snapshotAsOf: '2026-11-22',
        reconciliationNotes: 'Manual balance checkpoint showing drawdown warning threshold behavior.',
        openingDate: '2026-11-01',
        challengePhase: 'Phase 1',
        profitTargetAmount: '4000.00',
        profitTargetPct: '8.00',
        maxDailyLossAmount: '2500.00',
        maxDailyLossPct: '5.00',
        maxOverallLossAmount: '5000.00',
        maxOverallLossPct: '10.00',
        drawdownMode: 'static',
        minTradingDays: 4,
        maxTradingDays: null,
        notes: 'User-configurable example parameters for Stage 1 testing.',
        tags: ['fx', 'london-session'],
        createdAt: '2026-11-01T08:00:00.000Z',
        updatedAt: now,
      },
      {
        id: 'acc_demo_personal_live',
        workspaceId: wsId,
        portfolioId: 'pf_demo_personal',
        ownerId: DEMO_USER_UID,
        name: 'Interactive Personal Spot',
        accountIdentifierMasked: '•••• 3319',
        accountType: 'personal_live',
        customCategory: null,
        status: 'active',
        brokerId: 'brk_demo_ibkr',
        brokerName: 'Interactive Brokers',
        propFirmId: null,
        propFirmName: null,
        platformId: 'plt_demo_tws',
        platformName: 'TWS',
        baseCurrency: 'USD',
        timezone: 'America/New_York',
        startingBalance: '25000.00',
        verifiedBalanceSnapshot: '27848.00',
        verifiedEquitySnapshot: '27848.00',
        snapshotAsOf: '2026-11-20',
        reconciliationNotes: 'Reconciled: $25,000 start + $2,500 deposit + $348.00 net equity trade.',
        openingDate: '2026-08-01',
        challengePhase: null,
        profitTargetAmount: null,
        profitTargetPct: null,
        maxDailyLossAmount: '500.00',
        maxDailyLossPct: '2.00',
        maxOverallLossAmount: null,
        maxOverallLossPct: null,
        drawdownMode: 'none',
        minTradingDays: null,
        maxTradingDays: null,
        notes: 'Personal cash-settled account.',
        tags: ['equities', 'swing'],
        createdAt: '2026-08-01T12:00:00.000Z',
        updatedAt: now,
      },
    ],
    cashTransactions: [
      {
        id: 'tx_demo_payout_1',
        workspaceId: wsId,
        accountId: 'acc_demo_funded_100k',
        ownerId: DEMO_USER_UID,
        type: 'payout',
        amount: '3200.00',
        currency: 'USD',
        grossAmount: '4000.00',
        splitPct: '80.00',
        occurredAt: '2026-11-18',
        notes: 'Demo payout record (80% split of $4,000 gross)',
        createdAt: '2026-11-18T15:00:00.000Z',
        updatedAt: '2026-11-18T15:00:00.000Z',
      },
      {
        id: 'tx_demo_deposit_1',
        workspaceId: wsId,
        accountId: 'acc_demo_personal_live',
        ownerId: DEMO_USER_UID,
        type: 'deposit',
        amount: '2500.00',
        currency: 'USD',
        grossAmount: null,
        splitPct: null,
        occurredAt: '2026-11-10',
        notes: 'Initial top-up deposit',
        createdAt: '2026-11-10T10:00:00.000Z',
        updatedAt: '2026-11-10T10:00:00.000Z',
      },
    ],
    balanceSnapshots: [
      {
        id: 'snap_demo_funded_1',
        workspaceId: wsId,
        accountId: 'acc_demo_funded_100k',
        ownerId: DEMO_USER_UID,
        balance: '99250.00',
        equity: '99250.00',
        capturedAt: '2026-11-22',
        calculatedLedgerBalance: '99250.00',
        reconciliationDelta: '0.00',
        reconciliationStatus: 'reconciled',
        notes: 'Reconciled: $100,000 start - $3,200 payout + $2,450.00 net realised trades.',
        createdAt: now,
      },
      {
        id: 'snap_demo_eval_1',
        workspaceId: wsId,
        accountId: 'acc_demo_eval_50k',
        ownerId: DEMO_USER_UID,
        balance: '46100.00',
        equity: '46100.00',
        capturedAt: '2026-11-22',
        calculatedLedgerBalance: '49873.00',
        reconciliationDelta: '-3773.00',
        reconciliationStatus: 'discrepancy',
        notes: 'Manual balance checkpoint showing drawdown warning threshold behavior.',
        createdAt: now,
      },
      {
        id: 'snap_demo_personal_1',
        workspaceId: wsId,
        accountId: 'acc_demo_personal_live',
        ownerId: DEMO_USER_UID,
        balance: '27848.00',
        equity: '27848.00',
        capturedAt: '2026-11-20',
        calculatedLedgerBalance: '27848.00',
        reconciliationDelta: '0.00',
        reconciliationStatus: 'reconciled',
        notes: 'Reconciled: $25,000 start + $2,500 deposit + $348.00 net equity trade.',
        createdAt: '2026-11-20T18:00:00.000Z',
      },
    ],
    instruments: [
      {
        id: 'inst_demo_eurusd',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        symbol: 'EURUSD',
        displayName: 'Euro / US Dollar',
        assetClass: 'forex',
        baseCurrency: 'EUR',
        quoteCurrency: 'USD',
        profitCurrency: 'USD',
        contractSize: '100000',
        tickSize: '0.00001',
        pipSize: '0.0001',
        tickValue: null,
        quantityUnit: 'lots',
        status: 'active',
        notes: 'Standard FX lot = 100,000 EUR ($10/pip per 1.00 lot).',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'inst_demo_xauusd',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        symbol: 'XAUUSD',
        displayName: 'Spot Gold / US Dollar',
        assetClass: 'commodities',
        baseCurrency: 'XAU',
        quoteCurrency: 'USD',
        profitCurrency: 'USD',
        contractSize: '100',
        tickSize: '0.01',
        pipSize: '0.1',
        tickValue: null,
        quantityUnit: 'lots',
        status: 'active',
        notes: 'Spot gold standard contract = 100 troy oz per 1.00 lot.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'inst_demo_nq',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        symbol: 'NQ',
        displayName: 'E-mini Nasdaq-100 Futures',
        assetClass: 'futures',
        baseCurrency: null,
        quoteCurrency: 'USD',
        profitCurrency: 'USD',
        contractSize: '20',
        tickSize: '0.25',
        pipSize: '0.25',
        tickValue: '5.00',
        quantityUnit: 'contracts',
        status: 'active',
        notes: 'CME E-mini Nasdaq-100 ($5.00 per 0.25 tick, $20/point).',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'inst_demo_btcusd',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        symbol: 'BTCUSD',
        displayName: 'Bitcoin / US Dollar',
        assetClass: 'crypto',
        baseCurrency: 'BTC',
        quoteCurrency: 'USD',
        profitCurrency: 'USD',
        contractSize: '1',
        tickSize: '0.01',
        pipSize: '1',
        tickValue: null,
        quantityUnit: 'units',
        status: 'active',
        notes: '1 unit = 1 BTC linear USD-settled.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'inst_demo_aapl',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        symbol: 'AAPL',
        displayName: 'Apple Inc. Equity',
        assetClass: 'equities',
        baseCurrency: null,
        quoteCurrency: 'USD',
        profitCurrency: 'USD',
        contractSize: '1',
        tickSize: '0.01',
        pipSize: '0.01',
        tickValue: null,
        quantityUnit: 'shares',
        status: 'active',
        notes: 'US spot equity share specification.',
        createdAt: now,
        updatedAt: now,
      },
    ],
    trades: [
      {
        id: 'trd_demo_nq_win',
        workspaceId: wsId,
        portfolioId: 'pf_demo_prop',
        accountId: 'acc_demo_funded_100k',
        ownerId: DEMO_USER_UID,
        externalTicketId: 'RTH-882410',
        symbol: 'NQ',
        instrumentId: 'inst_demo_nq',
        direction: 'long',
        status: 'closed',
        isArchived: false,
        session: 'new_york',
        timeframes: ['M5', 'H1'],
        timezone: 'America/New_York',
        accountCurrency: 'USD',
        accountBalanceSnapshot: '100000.00',
        entryAt: '2026-11-17T09:42',
        entryPrice: '20400.00',
        quantity: '2',
        entryType: 'limit',
        leverage: null,
        marginUsed: '4000.00',
        entryRationale: 'NY open sweep of London low followed by M5 displacement.',
        initialStopPrice: '20375.00',
        actualStopPrice: '20415.00',
        plannedTargetPrice: '20475.00',
        plannedRiskAmount: null,
        plannedRiskPct: null,
        actualRiskAmount: null,
        exitAt: '2026-11-17T11:18',
        exitPrice: '20475.00',
        exitQuantity: '2',
        exitReason: 'Hit full 3R liquidity objective at previous day high.',
        manualGrossPnl: null,
        fxConversionRate: null,
        playbookId: null,
        setupId: null,
        setupTag: 'NY Open Sweep',
        commission: '8.40',
        swap: null,
        fees: '3.60',
        slippage: null,
        spread: '0.25',
        marketConditions: ['Bullish', 'High Volatility'],
        entryNotes: 'Clean limit fill on pullback into imbalance.',
        reviewNotes: 'Followed stop trail plan cleanly after +1.5R.',
        tags: ['a-setup', 'futures'],
        createdAt: '2026-11-17T09:42:00.000Z',
        updatedAt: '2026-11-17T11:25:00.000Z',
      },
      {
        id: 'trd_demo_nq_loss',
        workspaceId: wsId,
        portfolioId: 'pf_demo_prop',
        accountId: 'acc_demo_funded_100k',
        ownerId: DEMO_USER_UID,
        externalTicketId: 'RTH-882955',
        symbol: 'NQ',
        instrumentId: 'inst_demo_nq',
        direction: 'short',
        status: 'closed',
        isArchived: false,
        session: 'new_york',
        timeframes: ['M15', 'H1'],
        timezone: 'America/New_York',
        accountCurrency: 'USD',
        accountBalanceSnapshot: '102988.00',
        entryAt: '2026-11-19T10:15',
        entryPrice: '20520.00',
        quantity: '1',
        entryType: 'market',
        leverage: null,
        marginUsed: '2000.00',
        entryRationale: 'Faded mid-morning VWAP extension.',
        initialStopPrice: '20545.00',
        actualStopPrice: '20545.00',
        plannedTargetPrice: '20460.00',
        plannedRiskAmount: null,
        plannedRiskPct: null,
        actualRiskAmount: null,
        exitAt: '2026-11-19T10:34',
        exitPrice: '20546.00',
        exitQuantity: '1',
        exitReason: 'Stopped out with 1pt slippage during momentum push.',
        manualGrossPnl: null,
        fxConversionRate: null,
        playbookId: null,
        setupId: null,
        setupTag: 'VWAP Fade',
        commission: '4.20',
        swap: null,
        fees: '1.80',
        slippage: '12.00',
        spread: '0.25',
        marketConditions: ['Trending', 'High Volatility'],
        entryNotes: 'Entered slightly early before lower-timeframe confirmation.',
        reviewNotes: 'Wait for M5 structure break before fading strong trend days.',
        tags: ['counter-trend'],
        createdAt: '2026-11-19T10:15:00.000Z',
        updatedAt: '2026-11-19T10:40:00.000Z',
      },
      {
        id: 'trd_demo_eurusd_win',
        workspaceId: wsId,
        portfolioId: 'pf_demo_prop',
        accountId: 'acc_demo_eval_50k',
        ownerId: DEMO_USER_UID,
        externalTicketId: 'CT-44018',
        symbol: 'EURUSD',
        instrumentId: 'inst_demo_eurusd',
        direction: 'long',
        status: 'closed',
        isArchived: false,
        session: 'london',
        timeframes: ['M15', 'H4'],
        timezone: 'Europe/London',
        accountCurrency: 'USD',
        accountBalanceSnapshot: '50000.00',
        entryAt: '2026-11-14T08:30',
        entryPrice: '1.0810',
        quantity: '1.50',
        entryType: 'limit',
        leverage: '30',
        marginUsed: '5405.00',
        entryRationale: 'London session continuation off H4 demand zone.',
        initialStopPrice: '1.0790',
        actualStopPrice: '1.0810',
        plannedTargetPrice: '1.0860',
        plannedRiskAmount: null,
        plannedRiskPct: null,
        actualRiskAmount: null,
        exitAt: '2026-11-14T14:20',
        exitPrice: '1.0860',
        exitQuantity: '1.50',
        exitReason: 'Take profit filled at weekly resistance.',
        manualGrossPnl: null,
        fxConversionRate: null,
        playbookId: null,
        setupId: null,
        setupTag: 'London Continuation',
        commission: '10.50',
        swap: null,
        fees: null,
        slippage: null,
        spread: '0.0001',
        marketConditions: ['Bullish', 'Session Overlap'],
        entryNotes: 'Moved stop to breakeven at +1.2R.',
        reviewNotes: 'A+ execution and patience.',
        tags: ['fx', 'london'],
        createdAt: '2026-11-14T08:30:00.000Z',
        updatedAt: '2026-11-14T14:25:00.000Z',
      },
      {
        id: 'trd_demo_xauusd_loss',
        workspaceId: wsId,
        portfolioId: 'pf_demo_prop',
        accountId: 'acc_demo_eval_50k',
        ownerId: DEMO_USER_UID,
        externalTicketId: 'CT-44192',
        symbol: 'XAUUSD',
        instrumentId: 'inst_demo_xauusd',
        direction: 'short',
        status: 'closed',
        isArchived: false,
        session: 'overlap',
        timeframes: ['H1', 'H4'],
        timezone: 'Europe/London',
        accountCurrency: 'USD',
        accountBalanceSnapshot: '50739.50',
        entryAt: '2026-11-18T13:10',
        entryPrice: '2645.00',
        quantity: '0.50',
        entryType: 'stop',
        leverage: '20',
        marginUsed: '6612.50',
        entryRationale: 'Breakdown below Asian range ahead of US macro release.',
        initialStopPrice: '2655.00',
        actualStopPrice: '2662.00',
        plannedTargetPrice: '2620.00',
        plannedRiskAmount: null,
        plannedRiskPct: null,
        actualRiskAmount: null,
        exitAt: '2026-11-19T09:05',
        exitPrice: '2662.00',
        exitQuantity: '0.50',
        exitReason: 'Widened stop overnight and got stopped out on morning squeeze.',
        manualGrossPnl: null,
        fxConversionRate: null,
        playbookId: null,
        setupId: null,
        setupTag: 'Range Breakdown',
        commission: '4.50',
        swap: '12.00',
        fees: null,
        slippage: null,
        spread: '0.25',
        marketConditions: ['News Event', 'High Volatility'],
        entryNotes: 'Position held overnight.',
        reviewNotes: 'Do not widen initial stop beyond invalidation.',
        tags: ['gold', 'rule-break'],
        createdAt: '2026-11-18T13:10:00.000Z',
        updatedAt: '2026-11-19T09:10:00.000Z',
      },
      {
        id: 'trd_demo_aapl_win',
        workspaceId: wsId,
        portfolioId: 'pf_demo_personal',
        accountId: 'acc_demo_personal_live',
        ownerId: DEMO_USER_UID,
        externalTicketId: 'IBKR-99214',
        symbol: 'AAPL',
        instrumentId: 'inst_demo_aapl',
        direction: 'long',
        status: 'closed',
        isArchived: false,
        session: 'new_york',
        timeframes: ['H1', 'D1'],
        timezone: 'America/New_York',
        accountCurrency: 'USD',
        accountBalanceSnapshot: '27500.00',
        entryAt: '2026-11-12T10:00',
        entryPrice: '224.50',
        quantity: '40',
        entryType: 'limit',
        leverage: '1',
        marginUsed: '8980.00',
        entryRationale: 'Daily flag breakout retest with tech sector leadership.',
        initialStopPrice: '219.50',
        actualStopPrice: '219.50',
        plannedTargetPrice: '234.50',
        plannedRiskAmount: null,
        plannedRiskPct: null,
        actualRiskAmount: null,
        exitAt: '2026-11-19T15:30',
        exitPrice: '233.25',
        exitQuantity: '40',
        exitReason: 'Trailed exit ahead of weekly resistance.',
        manualGrossPnl: null,
        fxConversionRate: null,
        playbookId: null,
        setupId: null,
        setupTag: 'Daily Flag Retest',
        commission: null,
        swap: null,
        fees: '2.00',
        slippage: null,
        spread: null,
        marketConditions: ['Bullish', 'Pullback'],
        entryNotes: 'Multi-day swing trade.',
        reviewNotes: 'Clean swing hold.',
        tags: ['swing', 'equities'],
        createdAt: '2026-11-12T10:00:00.000Z',
        updatedAt: '2026-11-19T15:35:00.000Z',
      },
      {
        id: 'trd_demo_eurusd_open',
        workspaceId: wsId,
        portfolioId: 'pf_demo_prop',
        accountId: 'acc_demo_eval_50k',
        ownerId: DEMO_USER_UID,
        externalTicketId: 'CT-44310',
        symbol: 'EURUSD',
        instrumentId: 'inst_demo_eurusd',
        direction: 'long',
        status: 'open',
        isArchived: false,
        session: 'london',
        timeframes: ['M15', 'H1'],
        timezone: 'Europe/London',
        accountCurrency: 'USD',
        accountBalanceSnapshot: '49873.00',
        entryAt: '2026-11-22T09:15',
        entryPrice: '1.0842',
        quantity: '1.00',
        entryType: 'limit',
        leverage: '30',
        marginUsed: '3614.00',
        entryRationale: 'Holding London morning support above prior week low.',
        initialStopPrice: '1.0822',
        actualStopPrice: '1.0822',
        plannedTargetPrice: '1.0902',
        plannedRiskAmount: null,
        plannedRiskPct: null,
        actualRiskAmount: null,
        exitAt: null,
        exitPrice: null,
        exitQuantity: null,
        exitReason: null,
        manualGrossPnl: null,
        fxConversionRate: null,
        playbookId: null,
        setupId: null,
        setupTag: 'London Support',
        commission: '7.00',
        swap: null,
        fees: null,
        slippage: null,
        spread: '0.0001',
        marketConditions: ['Range-Bound', 'Pullback'],
        entryNotes: 'Active position awaiting NY session catalyst.',
        reviewNotes: null,
        tags: ['active'],
        createdAt: '2026-11-22T09:15:00.000Z',
        updatedAt: '2026-11-22T09:15:00.000Z',
      },
      {
        id: 'trd_demo_btcusd_draft',
        workspaceId: wsId,
        portfolioId: 'pf_demo_personal',
        accountId: 'acc_demo_personal_live',
        ownerId: DEMO_USER_UID,
        externalTicketId: null,
        symbol: 'BTCUSD',
        instrumentId: 'inst_demo_btcusd',
        direction: 'long',
        status: 'draft',
        isArchived: false,
        session: 'custom',
        timeframes: ['H4', 'D1'],
        timezone: 'America/New_York',
        accountCurrency: 'USD',
        accountBalanceSnapshot: '27848.00',
        entryAt: '2026-11-22T12:00',
        entryPrice: '91250.00',
        quantity: '0.25',
        entryType: 'limit',
        leverage: null,
        marginUsed: null,
        entryRationale: 'Watching weekend pullback alert near prior breakout shelf.',
        initialStopPrice: '89650.00',
        actualStopPrice: null,
        plannedTargetPrice: '96050.00',
        plannedRiskAmount: null,
        plannedRiskPct: null,
        actualRiskAmount: null,
        exitAt: null,
        exitPrice: null,
        exitQuantity: null,
        exitReason: null,
        manualGrossPnl: null,
        fxConversionRate: null,
        playbookId: null,
        setupId: null,
        setupTag: 'Breakout Shelf',
        commission: null,
        swap: null,
        fees: null,
        slippage: null,
        spread: null,
        marketConditions: ['Pullback'],
        entryNotes: 'Draft trade idea — optional fields left blank until fill confirms.',
        reviewNotes: null,
        tags: ['crypto-watch'],
        createdAt: '2026-11-22T12:00:00.000Z',
        updatedAt: '2026-11-22T12:00:00.000Z',
      },
      {
        id: 'trd_demo_archived_test',
        workspaceId: wsId,
        portfolioId: 'pf_demo_prop',
        accountId: 'acc_demo_eval_50k',
        ownerId: DEMO_USER_UID,
        externalTicketId: 'CT-43900',
        symbol: 'XAUUSD',
        instrumentId: 'inst_demo_xauusd',
        direction: 'long',
        status: 'closed',
        isArchived: true,
        session: 'asia',
        timeframes: ['M5'],
        timezone: 'Europe/London',
        accountCurrency: 'USD',
        accountBalanceSnapshot: '50000.00',
        entryAt: '2026-11-05T02:30',
        entryPrice: '2610.00',
        quantity: '0.25',
        entryType: 'market',
        leverage: null,
        marginUsed: null,
        entryRationale: 'Archived test entry excluded from live balance impact.',
        initialStopPrice: '2604.00',
        actualStopPrice: null,
        plannedTargetPrice: null,
        plannedRiskAmount: null,
        plannedRiskPct: null,
        actualRiskAmount: null,
        exitAt: '2026-11-05T03:00',
        exitPrice: '2604.00',
        exitQuantity: '0.25',
        exitReason: 'Archived duplicate entry.',
        manualGrossPnl: null,
        fxConversionRate: null,
        playbookId: null,
        setupId: null,
        setupTag: null,
        commission: '2.00',
        swap: null,
        fees: null,
        slippage: null,
        spread: null,
        marketConditions: ['Low Volatility'],
        entryNotes: null,
        reviewNotes: 'Archived from active ledger.',
        tags: ['archived-sample'],
        createdAt: '2026-11-05T02:30:00.000Z',
        updatedAt: '2026-11-05T03:05:00.000Z',
      },
    ],
    auditLogs: [
      {
        id: 'log_demo_init',
        workspaceId: wsId,
        ownerId: DEMO_USER_UID,
        entityType: 'workspace',
        entityId: wsId,
        action: 'create',
        summary: 'Initialized isolated Demo Mode sandbox workspace (Stage 2 Trade Engine active)',
        createdAt: now,
      },
    ],
  };
}

function genDemoId(prefix: string): string {
  return `${prefix}_demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export class DemoRepository implements IDataRepository {
  readonly mode = 'isolated_demo' as const;
  private state: DemoStoreState;

  constructor(persistToSessionStorage = true) {
    this.state = this.loadState(persistToSessionStorage);
  }

  private persistEnabled = true;

  private loadState(persist: boolean): DemoStoreState {
    this.persistEnabled = persist;
    if (persist && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const raw = window.sessionStorage.getItem(DEMO_STORAGE_KEY);
        if (raw) {
          return JSON.parse(raw) as DemoStoreState;
        }
      } catch {
        // Ignore storage read issues and fall back to fresh seed
      }
    }
    return createInitialDemoState();
  }

  private saveState(): void {
    if (this.persistEnabled && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // Ignore storage quota errors
      }
    }
  }

  private pushAudit(
    workspaceId: string,
    ownerId: string,
    entityType: AuditLog['entityType'],
    entityId: string,
    action: AuditLog['action'],
    summary: string
  ): void {
    this.state.auditLogs.unshift({
      id: genDemoId('log'),
      workspaceId,
      ownerId,
      entityType,
      entityId,
      action,
      summary: summary.slice(0, 240),
      createdAt: new Date().toISOString(),
    });
  }

  resetDemoSandbox(): void {
    this.state = createInitialDemoState();
    this.saveState();
  }

  async ensureUserProfile(user: User): Promise<UserProfile> {
    assertAuthorizedScope({ uid: user.uid, emailVerified: user.emailVerified }, DEMO_USER_UID);
    return { ...this.state.profile };
  }

  async updateUserPreferences(
    uid: string,
    patch: Partial<Pick<UserProfile, 'theme' | 'defaultCurrency' | 'timezone' | 'activeWorkspaceId' | 'displayName'>>
  ): Promise<UserProfile> {
    assertAuthorizedScope({ uid, emailVerified: true }, DEMO_USER_UID);
    this.state.profile = {
      ...this.state.profile,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.saveState();
    return { ...this.state.profile };
  }

  async listWorkspaces(ownerId: string): Promise<Workspace[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return this.state.workspaces.filter((w) => w.ownerId === ownerId);
  }

  async createWorkspace(ownerId: string, input: WorkspaceInput): Promise<Workspace> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = workspaceInputSchema.parse(input);
    const now = new Date().toISOString();
    const ws: Workspace = {
      id: genDemoId('ws'),
      ownerId,
      name: valid.name,
      description: valid.description,
      baseCurrency: valid.baseCurrency,
      timezone: valid.timezone,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.state.workspaces.push(ws);
    this.pushAudit(ws.id, ownerId, 'workspace', ws.id, 'create', `Created workspace "${valid.name}" (${valid.baseCurrency})`);
    this.saveState();
    return ws;
  }

  async updateWorkspace(ownerId: string, workspaceId: string, input: WorkspaceInput): Promise<Workspace> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = workspaceInputSchema.parse(input);
    const idx = this.state.workspaces.findIndex((w) => w.id === workspaceId && w.ownerId === ownerId);
    if (idx === -1) throw new Error('Workspace not found in Demo Sandbox.');
    const updated: Workspace = {
      ...this.state.workspaces[idx],
      name: valid.name,
      description: valid.description,
      baseCurrency: valid.baseCurrency,
      timezone: valid.timezone,
      updatedAt: new Date().toISOString(),
    };
    this.state.workspaces[idx] = updated;
    this.pushAudit(workspaceId, ownerId, 'workspace', workspaceId, 'update', `Updated workspace "${valid.name}"`);
    this.saveState();
    return updated;
  }

  async setWorkspaceStatus(
    ownerId: string,
    workspaceId: string,
    status: WorkspaceStatus
  ): Promise<Workspace> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const idx = this.state.workspaces.findIndex((w) => w.id === workspaceId && w.ownerId === ownerId);
    if (idx === -1) throw new Error('Workspace not found in Demo Sandbox.');
    const updated: Workspace = {
      ...this.state.workspaces[idx],
      status,
      updatedAt: new Date().toISOString(),
    };
    this.state.workspaces[idx] = updated;
    this.pushAudit(
      workspaceId,
      ownerId,
      'workspace',
      workspaceId,
      status === 'archived' ? 'archive' : 'restore',
      `${status === 'archived' ? 'Archived' : 'Restored'} workspace "${updated.name}"`
    );
    this.saveState();
    return updated;
  }

  async listPortfolios(ownerId: string, workspaceId: string): Promise<Portfolio[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return this.state.portfolios.filter((p) => p.ownerId === ownerId && p.workspaceId === workspaceId);
  }

  async createPortfolio(ownerId: string, workspaceId: string, input: PortfolioInput): Promise<Portfolio> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = portfolioInputSchema.parse(input);
    const now = new Date().toISOString();
    const portfolio: Portfolio = {
      id: genDemoId('pf'),
      workspaceId,
      ownerId,
      name: valid.name,
      description: valid.description,
      baseCurrency: valid.baseCurrency,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.state.portfolios.push(portfolio);
    this.pushAudit(workspaceId, ownerId, 'portfolio', portfolio.id, 'create', `Created portfolio "${valid.name}"`);
    this.saveState();
    return portfolio;
  }

  async updatePortfolio(
    ownerId: string,
    workspaceId: string,
    portfolioId: string,
    input: PortfolioInput
  ): Promise<Portfolio> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = portfolioInputSchema.parse(input);
    const idx = this.state.portfolios.findIndex(
      (p) => p.id === portfolioId && p.workspaceId === workspaceId && p.ownerId === ownerId
    );
    if (idx === -1) throw new Error('Portfolio not found.');
    const updated: Portfolio = {
      ...this.state.portfolios[idx],
      name: valid.name,
      description: valid.description,
      baseCurrency: valid.baseCurrency,
      updatedAt: new Date().toISOString(),
    };
    this.state.portfolios[idx] = updated;
    this.pushAudit(workspaceId, ownerId, 'portfolio', portfolioId, 'update', `Updated portfolio "${valid.name}"`);
    this.saveState();
    return updated;
  }

  async setPortfolioStatus(
    ownerId: string,
    workspaceId: string,
    portfolioId: string,
    status: WorkspaceStatus
  ): Promise<Portfolio> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const idx = this.state.portfolios.findIndex(
      (p) => p.id === portfolioId && p.workspaceId === workspaceId && p.ownerId === ownerId
    );
    if (idx === -1) throw new Error('Portfolio not found.');
    const updated: Portfolio = {
      ...this.state.portfolios[idx],
      status,
      updatedAt: new Date().toISOString(),
    };
    this.state.portfolios[idx] = updated;
    this.pushAudit(
      workspaceId,
      ownerId,
      'portfolio',
      portfolioId,
      status === 'archived' ? 'archive' : 'restore',
      `${status === 'archived' ? 'Archived' : 'Restored'} portfolio "${updated.name}"`
    );
    this.saveState();
    return updated;
  }

  async deletePortfolio(ownerId: string, workspaceId: string, portfolioId: string): Promise<void> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    this.state.portfolios = this.state.portfolios.filter(
      (p) => !(p.id === portfolioId && p.workspaceId === workspaceId && p.ownerId === ownerId)
    );
    this.state.accounts = this.state.accounts.map((a) =>
      a.portfolioId === portfolioId && a.workspaceId === workspaceId ? { ...a, portfolioId: null } : a
    );
    this.pushAudit(workspaceId, ownerId, 'portfolio', portfolioId, 'delete', 'Deleted portfolio');
    this.saveState();
  }

  async listAccounts(ownerId: string, workspaceId: string): Promise<Account[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return this.state.accounts
      .filter((a) => a.ownerId === ownerId && a.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createAccount(ownerId: string, workspaceId: string, input: AccountInput): Promise<Account> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = accountInputSchema.parse(input);
    const now = new Date().toISOString();
    const acc: Account = {
      id: genDemoId('acc'),
      workspaceId,
      portfolioId: valid.portfolioId,
      ownerId,
      name: valid.name,
      accountIdentifierMasked: valid.accountIdentifierMasked,
      accountType: valid.accountType,
      customCategory: valid.customCategory ?? null,
      status: valid.status,
      brokerId: valid.brokerId ?? null,
      brokerName: valid.brokerName,
      propFirmId: valid.propFirmId ?? null,
      propFirmName: valid.propFirmName,
      platformId: valid.platformId ?? null,
      platformName: valid.platformName,
      baseCurrency: valid.baseCurrency,
      timezone: valid.timezone,
      startingBalance: valid.startingBalance,
      verifiedBalanceSnapshot: valid.verifiedBalanceSnapshot,
      verifiedEquitySnapshot: valid.verifiedEquitySnapshot,
      snapshotAsOf: valid.snapshotAsOf,
      reconciliationNotes: valid.reconciliationNotes,
      openingDate: valid.openingDate,
      challengePhase: valid.challengePhase,
      profitTargetAmount: valid.profitTargetAmount,
      profitTargetPct: valid.profitTargetPct,
      maxDailyLossAmount: valid.maxDailyLossAmount,
      maxDailyLossPct: valid.maxDailyLossPct,
      maxOverallLossAmount: valid.maxOverallLossAmount,
      maxOverallLossPct: valid.maxOverallLossPct,
      drawdownMode: valid.drawdownMode,
      minTradingDays: valid.minTradingDays,
      maxTradingDays: valid.maxTradingDays,
      notes: valid.notes,
      tags: valid.tags,
      createdAt: now,
      updatedAt: now,
    };
    this.state.accounts.unshift(acc);
    this.pushAudit(workspaceId, ownerId, 'account', acc.id, 'create', `Created account "${acc.name}" (${acc.baseCurrency} ${acc.startingBalance})`);
    this.saveState();
    return acc;
  }

  async updateAccount(
    ownerId: string,
    workspaceId: string,
    accountId: string,
    input: AccountInput
  ): Promise<Account> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = accountInputSchema.parse(input);
    const idx = this.state.accounts.findIndex(
      (a) => a.id === accountId && a.workspaceId === workspaceId && a.ownerId === ownerId
    );
    if (idx === -1) throw new Error('Account not found.');
    const now = new Date().toISOString();
    const updated: Account = {
      ...this.state.accounts[idx],
      ...valid,
      updatedAt: now,
    };
    this.state.accounts[idx] = updated;
    this.pushAudit(workspaceId, ownerId, 'account', accountId, 'update', `Updated account "${updated.name}"`);
    this.saveState();
    return updated;
  }

  async setAccountStatus(
    ownerId: string,
    workspaceId: string,
    accountId: string,
    status: Account['status']
  ): Promise<Account> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const idx = this.state.accounts.findIndex(
      (a) => a.id === accountId && a.workspaceId === workspaceId && a.ownerId === ownerId
    );
    if (idx === -1) throw new Error('Account not found.');
    const now = new Date().toISOString();
    const updated: Account = {
      ...this.state.accounts[idx],
      status,
      updatedAt: now,
    };
    this.state.accounts[idx] = updated;
    this.pushAudit(
      workspaceId,
      ownerId,
      'account',
      accountId,
      status === 'archived' ? 'archive' : 'restore',
      `Changed account "${updated.name}" status to ${status}`
    );
    this.saveState();
    return updated;
  }

  async deleteAccount(ownerId: string, workspaceId: string, accountId: string): Promise<void> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    this.state.accounts = this.state.accounts.filter(
      (a) => !(a.id === accountId && a.workspaceId === workspaceId && a.ownerId === ownerId)
    );
    this.state.cashTransactions = this.state.cashTransactions.filter(
      (t) => !(t.accountId === accountId && t.workspaceId === workspaceId)
    );
    this.state.balanceSnapshots = this.state.balanceSnapshots.filter(
      (s) => !(s.accountId === accountId && s.workspaceId === workspaceId)
    );
    this.state.trades = this.state.trades.filter(
      (tr) => !(tr.accountId === accountId && tr.workspaceId === workspaceId)
    );
    this.pushAudit(workspaceId, ownerId, 'account', accountId, 'delete', 'Deleted account and associated ledger/trade records');
    this.saveState();
  }

  async listCashTransactions(ownerId: string, workspaceId: string): Promise<CashTransaction[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return this.state.cashTransactions
      .filter((t) => t.ownerId === ownerId && t.workspaceId === workspaceId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async createCashTransaction(
    ownerId: string,
    workspaceId: string,
    input: CashTransactionInput
  ): Promise<CashTransaction> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = cashTransactionInputSchema.parse(input);
    const now = new Date().toISOString();
    const tx: CashTransaction = {
      id: genDemoId('tx'),
      workspaceId,
      accountId: valid.accountId,
      ownerId,
      type: valid.type,
      amount: valid.amount,
      currency: valid.currency,
      grossAmount: valid.grossAmount,
      splitPct: valid.splitPct,
      occurredAt: valid.occurredAt,
      notes: valid.notes,
      createdAt: now,
      updatedAt: now,
    };
    this.state.cashTransactions.unshift(tx);
    this.pushAudit(workspaceId, ownerId, 'cash_transaction', tx.id, 'create', `Recorded ${tx.type} of ${tx.currency} ${tx.amount}`);
    this.saveState();
    return tx;
  }

  async updateCashTransaction(
    ownerId: string,
    workspaceId: string,
    transactionId: string,
    input: CashTransactionInput
  ): Promise<CashTransaction> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = cashTransactionInputSchema.parse(input);
    const idx = this.state.cashTransactions.findIndex(
      (t) => t.id === transactionId && t.workspaceId === workspaceId && t.ownerId === ownerId
    );
    if (idx === -1) throw new Error('Cash transaction not found.');
    const updated: CashTransaction = {
      ...this.state.cashTransactions[idx],
      type: valid.type,
      amount: valid.amount,
      currency: valid.currency,
      grossAmount: valid.grossAmount,
      splitPct: valid.splitPct,
      occurredAt: valid.occurredAt,
      notes: valid.notes,
      updatedAt: new Date().toISOString(),
    };
    this.state.cashTransactions[idx] = updated;
    this.pushAudit(workspaceId, ownerId, 'cash_transaction', transactionId, 'update', `Updated ${updated.type} (${updated.currency} ${updated.amount})`);
    this.saveState();
    return updated;
  }

  async deleteCashTransaction(ownerId: string, workspaceId: string, transactionId: string): Promise<void> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    this.state.cashTransactions = this.state.cashTransactions.filter(
      (t) => !(t.id === transactionId && t.workspaceId === workspaceId && t.ownerId === ownerId)
    );
    this.pushAudit(workspaceId, ownerId, 'cash_transaction', transactionId, 'delete', 'Deleted cash movement');
    this.saveState();
  }

  async listBalanceSnapshots(ownerId: string, workspaceId: string): Promise<BalanceSnapshot[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return this.state.balanceSnapshots
      .filter((s) => s.ownerId === ownerId && s.workspaceId === workspaceId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || b.createdAt.localeCompare(a.createdAt));
  }

  async recordBalanceSnapshot(
    ownerId: string,
    workspaceId: string,
    input: BalanceSnapshotInput,
    reconciliation: {
      calculatedLedgerBalance: string;
      reconciliationDelta: string;
      reconciliationStatus: 'reconciled' | 'discrepancy';
    }
  ): Promise<{ snapshot: BalanceSnapshot; account: Account }> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = balanceSnapshotInputSchema.parse(input);
    const accIdx = this.state.accounts.findIndex(
      (a) => a.id === valid.accountId && a.workspaceId === workspaceId && a.ownerId === ownerId
    );
    if (accIdx === -1) throw new Error('Account not found.');

    const now = new Date().toISOString();
    const snapshot: BalanceSnapshot = {
      id: genDemoId('snap'),
      workspaceId,
      accountId: valid.accountId,
      ownerId,
      balance: valid.balance,
      equity: valid.equity,
      capturedAt: valid.capturedAt,
      calculatedLedgerBalance: reconciliation.calculatedLedgerBalance,
      reconciliationDelta: reconciliation.reconciliationDelta,
      reconciliationStatus: reconciliation.reconciliationStatus,
      notes: valid.notes,
      createdAt: now,
    };
    this.state.balanceSnapshots.unshift(snapshot);

    const updatedAccount: Account = {
      ...this.state.accounts[accIdx],
      verifiedBalanceSnapshot: valid.balance,
      verifiedEquitySnapshot: valid.equity,
      snapshotAsOf: valid.capturedAt,
      reconciliationNotes: valid.notes,
      updatedAt: now,
    };
    this.state.accounts[accIdx] = updatedAccount;
    this.pushAudit(
      workspaceId,
      ownerId,
      'balance_snapshot',
      snapshot.id,
      'reconcile',
      `Recorded balance snapshot ${valid.balance} (${reconciliation.reconciliationStatus})`
    );
    this.saveState();
    return { snapshot, account: updatedAccount };
  }

  async listBrokers(ownerId: string, workspaceId: string): Promise<Broker[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return this.state.brokers
      .filter((b) => b.ownerId === ownerId && b.workspaceId === workspaceId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createBroker(ownerId: string, workspaceId: string, input: BrokerInput): Promise<Broker> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = brokerInputSchema.parse(input);
    const now = new Date().toISOString();
    const item: Broker = {
      id: genDemoId('brk'),
      workspaceId,
      ownerId,
      name: valid.name,
      website: valid.website,
      notes: valid.notes,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.state.brokers.push(item);
    this.pushAudit(workspaceId, ownerId, 'broker', item.id, 'create', `Added broker "${valid.name}"`);
    this.saveState();
    return item;
  }

  async updateBroker(ownerId: string, workspaceId: string, brokerId: string, input: BrokerInput): Promise<Broker> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = brokerInputSchema.parse(input);
    const idx = this.state.brokers.findIndex((b) => b.id === brokerId && b.workspaceId === workspaceId);
    if (idx === -1) throw new Error('Broker not found.');
    const updated: Broker = {
      ...this.state.brokers[idx],
      name: valid.name,
      website: valid.website,
      notes: valid.notes,
      updatedAt: new Date().toISOString(),
    };
    this.state.brokers[idx] = updated;
    this.pushAudit(workspaceId, ownerId, 'broker', brokerId, 'update', `Updated broker "${valid.name}"`);
    this.saveState();
    return updated;
  }

  async setBrokerStatus(
    ownerId: string,
    workspaceId: string,
    brokerId: string,
    status: WorkspaceStatus
  ): Promise<Broker> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const idx = this.state.brokers.findIndex((b) => b.id === brokerId && b.workspaceId === workspaceId);
    if (idx === -1) throw new Error('Broker not found.');
    const updated: Broker = { ...this.state.brokers[idx], status, updatedAt: new Date().toISOString() };
    this.state.brokers[idx] = updated;
    this.saveState();
    return updated;
  }

  async deleteBroker(ownerId: string, workspaceId: string, brokerId: string): Promise<void> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    this.state.brokers = this.state.brokers.filter((b) => !(b.id === brokerId && b.workspaceId === workspaceId));
    this.saveState();
  }

  async listTradingPlatforms(ownerId: string, workspaceId: string): Promise<TradingPlatform[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return this.state.platforms
      .filter((p) => p.ownerId === ownerId && p.workspaceId === workspaceId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createTradingPlatform(
    ownerId: string,
    workspaceId: string,
    input: TradingPlatformInput
  ): Promise<TradingPlatform> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = tradingPlatformInputSchema.parse(input);
    const now = new Date().toISOString();
    const item: TradingPlatform = {
      id: genDemoId('plt'),
      workspaceId,
      ownerId,
      name: valid.name,
      vendor: valid.vendor,
      notes: valid.notes,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.state.platforms.push(item);
    this.pushAudit(workspaceId, ownerId, 'platform', item.id, 'create', `Added platform "${valid.name}"`);
    this.saveState();
    return item;
  }

  async updateTradingPlatform(
    ownerId: string,
    workspaceId: string,
    platformId: string,
    input: TradingPlatformInput
  ): Promise<TradingPlatform> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = tradingPlatformInputSchema.parse(input);
    const idx = this.state.platforms.findIndex((p) => p.id === platformId && p.workspaceId === workspaceId);
    if (idx === -1) throw new Error('Trading platform not found.');
    const updated: TradingPlatform = {
      ...this.state.platforms[idx],
      name: valid.name,
      vendor: valid.vendor,
      notes: valid.notes,
      updatedAt: new Date().toISOString(),
    };
    this.state.platforms[idx] = updated;
    this.saveState();
    return updated;
  }

  async setTradingPlatformStatus(
    ownerId: string,
    workspaceId: string,
    platformId: string,
    status: WorkspaceStatus
  ): Promise<TradingPlatform> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const idx = this.state.platforms.findIndex((p) => p.id === platformId && p.workspaceId === workspaceId);
    if (idx === -1) throw new Error('Trading platform not found.');
    const updated: TradingPlatform = { ...this.state.platforms[idx], status, updatedAt: new Date().toISOString() };
    this.state.platforms[idx] = updated;
    this.saveState();
    return updated;
  }

  async deleteTradingPlatform(ownerId: string, workspaceId: string, platformId: string): Promise<void> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    this.state.platforms = this.state.platforms.filter((p) => !(p.id === platformId && p.workspaceId === workspaceId));
    this.saveState();
  }

  async listPropFirms(ownerId: string, workspaceId: string): Promise<PropFirm[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return this.state.propFirms
      .filter((f) => f.ownerId === ownerId && f.workspaceId === workspaceId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createPropFirm(ownerId: string, workspaceId: string, input: PropFirmInput): Promise<PropFirm> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = propFirmInputSchema.parse(input);
    const now = new Date().toISOString();
    const item: PropFirm = {
      id: genDemoId('firm'),
      workspaceId,
      ownerId,
      name: valid.name,
      website: valid.website,
      notes: valid.notes,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.state.propFirms.push(item);
    this.pushAudit(workspaceId, ownerId, 'prop_firm', item.id, 'create', `Added prop firm "${valid.name}"`);
    this.saveState();
    return item;
  }

  async updatePropFirm(ownerId: string, workspaceId: string, firmId: string, input: PropFirmInput): Promise<PropFirm> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = propFirmInputSchema.parse(input);
    const idx = this.state.propFirms.findIndex((f) => f.id === firmId && f.workspaceId === workspaceId);
    if (idx === -1) throw new Error('Prop firm not found.');
    const updated: PropFirm = {
      ...this.state.propFirms[idx],
      name: valid.name,
      website: valid.website,
      notes: valid.notes,
      updatedAt: new Date().toISOString(),
    };
    this.state.propFirms[idx] = updated;
    this.saveState();
    return updated;
  }

  async setPropFirmStatus(
    ownerId: string,
    workspaceId: string,
    firmId: string,
    status: WorkspaceStatus
  ): Promise<PropFirm> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const idx = this.state.propFirms.findIndex((f) => f.id === firmId && f.workspaceId === workspaceId);
    if (idx === -1) throw new Error('Prop firm not found.');
    const updated: PropFirm = { ...this.state.propFirms[idx], status, updatedAt: new Date().toISOString() };
    this.state.propFirms[idx] = updated;
    this.saveState();
    return updated;
  }

  async deletePropFirm(ownerId: string, workspaceId: string, firmId: string): Promise<void> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    this.state.propFirms = this.state.propFirms.filter((f) => !(f.id === firmId && f.workspaceId === workspaceId));
    this.saveState();
  }

  async listFXRates(ownerId: string, workspaceId: string): Promise<FXRateSnapshot[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return this.state.fxRates
      .filter((r) => r.ownerId === ownerId && r.workspaceId === workspaceId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  async createFXRate(ownerId: string, workspaceId: string, input: FXRateInput): Promise<FXRateSnapshot> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = fxRateInputSchema.parse(input);
    const now = new Date().toISOString();
    const rate: FXRateSnapshot = {
      id: genDemoId('fx'),
      workspaceId,
      ownerId,
      baseCurrency: valid.baseCurrency,
      quoteCurrency: valid.quoteCurrency,
      rate: valid.rate,
      capturedAt: valid.capturedAt,
      source: valid.source,
      notes: valid.notes,
      createdAt: now,
      updatedAt: now,
    };
    this.state.fxRates.unshift(rate);
    this.pushAudit(
      workspaceId,
      ownerId,
      'fx_rate',
      rate.id,
      'create',
      `Recorded FX rate ${rate.baseCurrency}/${rate.quoteCurrency} = ${rate.rate}`
    );
    this.saveState();
    return rate;
  }

  async updateFXRate(
    ownerId: string,
    workspaceId: string,
    rateId: string,
    input: FXRateInput
  ): Promise<FXRateSnapshot> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = fxRateInputSchema.parse(input);
    const idx = this.state.fxRates.findIndex((r) => r.id === rateId && r.workspaceId === workspaceId);
    if (idx === -1) throw new Error('FX rate snapshot not found.');
    const updated: FXRateSnapshot = {
      ...this.state.fxRates[idx],
      rate: valid.rate,
      capturedAt: valid.capturedAt,
      source: valid.source,
      notes: valid.notes,
      updatedAt: new Date().toISOString(),
    };
    this.state.fxRates[idx] = updated;
    this.saveState();
    return updated;
  }

  async deleteFXRate(ownerId: string, workspaceId: string, rateId: string): Promise<void> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    this.state.fxRates = this.state.fxRates.filter((r) => !(r.id === rateId && r.workspaceId === workspaceId));
    this.pushAudit(workspaceId, ownerId, 'fx_rate', rateId, 'delete', 'Deleted FX rate snapshot');
    this.saveState();
  }

  async listInstruments(ownerId: string, workspaceId: string): Promise<InstrumentSpecification[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return (this.state.instruments ?? [])
      .filter((i) => i.ownerId === ownerId && i.workspaceId === workspaceId)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  async createInstrument(
    ownerId: string,
    workspaceId: string,
    input: InstrumentSpecInput
  ): Promise<InstrumentSpecification> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = instrumentSpecInputSchema.parse(input);
    const now = new Date().toISOString();
    const item: InstrumentSpecification = {
      id: genDemoId('inst'),
      workspaceId,
      ownerId,
      symbol: valid.symbol,
      displayName: valid.displayName,
      assetClass: valid.assetClass,
      baseCurrency: valid.baseCurrency,
      quoteCurrency: valid.quoteCurrency,
      profitCurrency: valid.profitCurrency,
      contractSize: valid.contractSize,
      tickSize: valid.tickSize,
      pipSize: valid.pipSize,
      tickValue: valid.tickValue,
      quantityUnit: valid.quantityUnit,
      status: 'active',
      notes: valid.notes,
      createdAt: now,
      updatedAt: now,
    };
    this.state.instruments.push(item);
    this.pushAudit(workspaceId, ownerId, 'instrument', item.id, 'create', `Added instrument spec ${item.symbol}`);
    this.saveState();
    return item;
  }

  async updateInstrument(
    ownerId: string,
    workspaceId: string,
    instrumentId: string,
    input: InstrumentSpecInput
  ): Promise<InstrumentSpecification> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = instrumentSpecInputSchema.parse(input);
    const idx = this.state.instruments.findIndex(
      (i) => i.id === instrumentId && i.workspaceId === workspaceId && i.ownerId === ownerId
    );
    if (idx === -1) throw new Error('Instrument specification not found.');
    const updated: InstrumentSpecification = {
      ...this.state.instruments[idx],
      symbol: valid.symbol,
      displayName: valid.displayName,
      assetClass: valid.assetClass,
      baseCurrency: valid.baseCurrency,
      quoteCurrency: valid.quoteCurrency,
      profitCurrency: valid.profitCurrency,
      contractSize: valid.contractSize,
      tickSize: valid.tickSize,
      pipSize: valid.pipSize,
      tickValue: valid.tickValue,
      quantityUnit: valid.quantityUnit,
      notes: valid.notes,
      updatedAt: new Date().toISOString(),
    };
    this.state.instruments[idx] = updated;
    this.pushAudit(workspaceId, ownerId, 'instrument', instrumentId, 'update', `Updated instrument spec ${updated.symbol}`);
    this.saveState();
    return updated;
  }

  async setInstrumentStatus(
    ownerId: string,
    workspaceId: string,
    instrumentId: string,
    status: WorkspaceStatus
  ): Promise<InstrumentSpecification> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const idx = this.state.instruments.findIndex(
      (i) => i.id === instrumentId && i.workspaceId === workspaceId && i.ownerId === ownerId
    );
    if (idx === -1) throw new Error('Instrument specification not found.');
    const updated: InstrumentSpecification = {
      ...this.state.instruments[idx],
      status,
      updatedAt: new Date().toISOString(),
    };
    this.state.instruments[idx] = updated;
    this.pushAudit(
      workspaceId,
      ownerId,
      'instrument',
      instrumentId,
      status === 'archived' ? 'archive' : 'restore',
      `${status === 'archived' ? 'Archived' : 'Restored'} instrument spec ${updated.symbol}`
    );
    this.saveState();
    return updated;
  }

  async deleteInstrument(ownerId: string, workspaceId: string, instrumentId: string): Promise<void> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    this.state.instruments = this.state.instruments.filter(
      (i) => !(i.id === instrumentId && i.workspaceId === workspaceId && i.ownerId === ownerId)
    );
    this.pushAudit(workspaceId, ownerId, 'instrument', instrumentId, 'delete', 'Deleted instrument specification');
    this.saveState();
  }

  async listTrades(ownerId: string, workspaceId: string): Promise<Trade[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return (this.state.trades ?? [])
      .filter((t) => t.ownerId === ownerId && t.workspaceId === workspaceId)
      .sort((a, b) => (b.entryAt ?? b.createdAt).localeCompare(a.entryAt ?? a.createdAt));
  }

  async createTrade(
    ownerId: string,
    workspaceId: string,
    input: TradeInput,
    context: { portfolioId: string | null; accountCurrency: string }
  ): Promise<Trade> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = tradeInputSchema.parse(input);
    const now = new Date().toISOString();
    const trade: Trade = {
      id: genDemoId('trd'),
      workspaceId,
      portfolioId: context.portfolioId,
      accountId: valid.accountId,
      ownerId,
      externalTicketId: valid.externalTicketId,
      symbol: valid.symbol,
      instrumentId: valid.instrumentId,
      direction: valid.direction,
      status: valid.status,
      isArchived: valid.isArchived,
      session: valid.session,
      timeframes: valid.timeframes,
      timezone: valid.timezone,
      accountCurrency: context.accountCurrency,
      accountBalanceSnapshot: valid.accountBalanceSnapshot,
      entryAt: valid.entryAt,
      entryPrice: valid.entryPrice,
      quantity: valid.quantity,
      entryType: valid.entryType,
      leverage: valid.leverage,
      marginUsed: valid.marginUsed,
      entryRationale: valid.entryRationale,
      initialStopPrice: valid.initialStopPrice,
      actualStopPrice: valid.actualStopPrice,
      plannedTargetPrice: valid.plannedTargetPrice,
      plannedRiskAmount: valid.plannedRiskAmount,
      plannedRiskPct: valid.plannedRiskPct,
      actualRiskAmount: valid.actualRiskAmount,
      exitAt: valid.exitAt,
      exitPrice: valid.exitPrice,
      exitQuantity: valid.exitQuantity,
      exitReason: valid.exitReason,
      manualGrossPnl: valid.manualGrossPnl,
      fxConversionRate: valid.fxConversionRate,
      playbookId: null,
      setupId: null,
      setupTag: valid.setupTag,
      commission: valid.commission,
      swap: valid.swap,
      fees: valid.fees,
      slippage: valid.slippage,
      spread: valid.spread,
      marketConditions: valid.marketConditions,
      entryNotes: valid.entryNotes,
      reviewNotes: valid.reviewNotes,
      tags: valid.tags,
      createdAt: now,
      updatedAt: now,
    };
    this.state.trades.unshift(trade);
    this.pushAudit(
      workspaceId,
      ownerId,
      'trade',
      trade.id,
      'create',
      `Logged ${trade.status} ${trade.direction} trade on ${trade.symbol}`
    );
    this.saveState();
    return trade;
  }

  async updateTrade(
    ownerId: string,
    workspaceId: string,
    tradeId: string,
    input: TradeInput,
    context: { portfolioId: string | null; accountCurrency: string }
  ): Promise<Trade> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const valid = tradeInputSchema.parse(input);
    const idx = this.state.trades.findIndex(
      (t) => t.id === tradeId && t.workspaceId === workspaceId && t.ownerId === ownerId
    );
    if (idx === -1) throw new Error('Trade not found.');
    const updated: Trade = {
      ...this.state.trades[idx],
      portfolioId: context.portfolioId,
      accountId: valid.accountId,
      externalTicketId: valid.externalTicketId,
      symbol: valid.symbol,
      instrumentId: valid.instrumentId,
      direction: valid.direction,
      status: valid.status,
      isArchived: valid.isArchived,
      session: valid.session,
      timeframes: valid.timeframes,
      timezone: valid.timezone,
      accountCurrency: context.accountCurrency,
      accountBalanceSnapshot: valid.accountBalanceSnapshot,
      entryAt: valid.entryAt,
      entryPrice: valid.entryPrice,
      quantity: valid.quantity,
      entryType: valid.entryType,
      leverage: valid.leverage,
      marginUsed: valid.marginUsed,
      entryRationale: valid.entryRationale,
      initialStopPrice: valid.initialStopPrice,
      actualStopPrice: valid.actualStopPrice,
      plannedTargetPrice: valid.plannedTargetPrice,
      plannedRiskAmount: valid.plannedRiskAmount,
      plannedRiskPct: valid.plannedRiskPct,
      actualRiskAmount: valid.actualRiskAmount,
      exitAt: valid.exitAt,
      exitPrice: valid.exitPrice,
      exitQuantity: valid.exitQuantity,
      exitReason: valid.exitReason,
      manualGrossPnl: valid.manualGrossPnl,
      fxConversionRate: valid.fxConversionRate,
      setupTag: valid.setupTag,
      commission: valid.commission,
      swap: valid.swap,
      fees: valid.fees,
      slippage: valid.slippage,
      spread: valid.spread,
      marketConditions: valid.marketConditions,
      entryNotes: valid.entryNotes,
      reviewNotes: valid.reviewNotes,
      tags: valid.tags,
      updatedAt: new Date().toISOString(),
    };
    this.state.trades[idx] = updated;
    this.pushAudit(
      workspaceId,
      ownerId,
      'trade',
      tradeId,
      'update',
      `Updated ${updated.direction} trade on ${updated.symbol} (${updated.status})`
    );
    this.saveState();
    return updated;
  }

  async setTradeStatus(
    ownerId: string,
    workspaceId: string,
    tradeId: string,
    status: Trade['status']
  ): Promise<Trade> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const idx = this.state.trades.findIndex(
      (t) => t.id === tradeId && t.workspaceId === workspaceId && t.ownerId === ownerId
    );
    if (idx === -1) throw new Error('Trade not found.');
    const updated: Trade = {
      ...this.state.trades[idx],
      status,
      updatedAt: new Date().toISOString(),
    };
    this.state.trades[idx] = updated;
    this.pushAudit(workspaceId, ownerId, 'trade', tradeId, 'update', `Changed ${updated.symbol} status to ${status}`);
    this.saveState();
    return updated;
  }

  async setTradeArchived(
    ownerId: string,
    workspaceId: string,
    tradeId: string,
    isArchived: boolean
  ): Promise<Trade> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    const idx = this.state.trades.findIndex(
      (t) => t.id === tradeId && t.workspaceId === workspaceId && t.ownerId === ownerId
    );
    if (idx === -1) throw new Error('Trade not found.');
    const updated: Trade = {
      ...this.state.trades[idx],
      isArchived,
      updatedAt: new Date().toISOString(),
    };
    this.state.trades[idx] = updated;
    this.pushAudit(
      workspaceId,
      ownerId,
      'trade',
      tradeId,
      isArchived ? 'archive' : 'restore',
      `${isArchived ? 'Archived' : 'Restored'} ${updated.symbol} trade`
    );
    this.saveState();
    return updated;
  }

  async deleteTrade(ownerId: string, workspaceId: string, tradeId: string): Promise<void> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    this.state.trades = this.state.trades.filter(
      (t) => !(t.id === tradeId && t.workspaceId === workspaceId && t.ownerId === ownerId)
    );
    this.pushAudit(workspaceId, ownerId, 'trade', tradeId, 'delete', 'Deleted trade record');
    this.saveState();
  }

  async listAuditLogs(ownerId: string, workspaceId: string): Promise<AuditLog[]> {
    assertAuthorizedScope({ uid: ownerId, emailVerified: true }, DEMO_USER_UID);
    return this.state.auditLogs.filter((l) => l.ownerId === ownerId && l.workspaceId === workspaceId);
  }
}
