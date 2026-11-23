import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAccountLedger,
  calculateWorkspaceRollup,
} from '../domain/calculations/accountCalculations';
import {
  calculateAccountTradeImpact,
  calculateAllTradeMetrics,
  calculateTradeAggregateSummary,
  calculateTradeMetrics,
  filterAndSortTrades,
  paginateItems,
} from '../domain/calculations/tradeCalculations';
import type {
  Account,
  CashTransaction,
  FXRateSnapshot,
  InstrumentSpecification,
  Trade,
} from '../domain/models';

function makeSpec(overrides: Partial<InstrumentSpecification> = {}): InstrumentSpecification {
  return {
    id: 'inst_eurusd',
    workspaceId: 'ws_1',
    ownerId: 'u_1',
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
    notes: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_1',
    workspaceId: 'ws_1',
    portfolioId: null,
    ownerId: 'u_1',
    name: 'Funded 100K',
    accountIdentifierMasked: null,
    accountType: 'prop_funded',
    customCategory: null,
    status: 'active',
    brokerId: null,
    brokerName: null,
    propFirmId: null,
    propFirmName: null,
    platformId: null,
    platformName: null,
    baseCurrency: 'USD',
    timezone: 'UTC',
    startingBalance: '100000.00',
    verifiedBalanceSnapshot: null,
    verifiedEquitySnapshot: null,
    snapshotAsOf: null,
    reconciliationNotes: null,
    openingDate: null,
    challengePhase: null,
    profitTargetAmount: null,
    profitTargetPct: null,
    maxDailyLossAmount: null,
    maxDailyLossPct: null,
    maxOverallLossAmount: null,
    maxOverallLossPct: null,
    drawdownMode: 'none',
    minTradingDays: null,
    maxTradingDays: null,
    notes: null,
    tags: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'trd_1',
    workspaceId: 'ws_1',
    portfolioId: null,
    accountId: 'acc_1',
    ownerId: 'u_1',
    externalTicketId: null,
    symbol: 'EURUSD',
    instrumentId: 'inst_eurusd',
    direction: 'long',
    status: 'closed',
    isArchived: false,
    session: 'london',
    timeframes: ['M15'],
    timezone: 'UTC',
    accountCurrency: 'USD',
    accountBalanceSnapshot: '100000.00',
    entryAt: '2026-11-18T08:00',
    entryPrice: '1.0800',
    quantity: '1.00',
    entryType: 'limit',
    leverage: null,
    marginUsed: null,
    entryRationale: null,
    initialStopPrice: '1.0780',
    actualStopPrice: '1.0780',
    plannedTargetPrice: '1.0860',
    plannedRiskAmount: null,
    plannedRiskPct: null,
    actualRiskAmount: null,
    exitAt: '2026-11-18T11:30',
    exitPrice: '1.0860',
    exitQuantity: '1.00',
    exitReason: null,
    manualGrossPnl: null,
    fxConversionRate: null,
    playbookId: null,
    setupId: null,
    setupTag: null,
    commission: null,
    swap: null,
    fees: null,
    slippage: null,
    spread: null,
    marketConditions: [],
    entryNotes: null,
    reviewNotes: null,
    tags: [],
    createdAt: '2026-11-18T08:00:00.000Z',
    updatedAt: '2026-11-18T11:30:00.000Z',
    ...overrides,
  };
}

test('calculateTradeMetrics computes decimal-safe FX long/short P&L, pips, ticks, costs, and R multiples', () => {
  const eurusd = makeSpec();
  // Long 1.50 lots EURUSD: +50 pips = +$750.00 gross; commission 10.50; initial risk 20 pips = $300 -> 2.50R gross, 2.47R net
  const longWin = makeTrade({
    entryPrice: '1.0810',
    exitPrice: '1.0860',
    quantity: '1.50',
    exitQuantity: '1.50',
    initialStopPrice: '1.0790',
    actualStopPrice: '1.0810', // Moved to breakeven — must NOT overwrite Initial Risk denominator!
    plannedTargetPrice: '1.0860',
    commission: '10.50',
    accountBalanceSnapshot: '50000.00',
  });

  const m = calculateTradeMetrics(longWin, eurusd);
  assert.equal(m.realisedPips, '50.00');
  assert.equal(m.realisedTicks, '500.00');
  assert.equal(m.initialStopPips, '20.00');
  assert.equal(m.initialRiskAmount, '300.00');
  assert.equal(m.initialRiskPct, '0.60');
  assert.equal(m.actualRiskAmount, '0.00'); // Moved to breakeven
  assert.equal(m.plannedRMultiple, '2.50');
  assert.equal(m.grossPnl, '750.00');
  assert.equal(m.totalCosts, '10.50');
  assert.equal(m.netPnl, '739.50');
  assert.equal(m.grossRMultiple, '2.50');
  assert.equal(m.netRMultiple, '2.47');
  assert.equal(m.outcome, 'win');
  assert.equal(m.balanceImpactApplies, true);
  assert.equal(m.balanceImpact, '739.50');
  assert.equal(m.holdingDurationLabel, '3h 30m');

  // Short trade with negative swap (financing credit)
  const shortWin = makeTrade({
    direction: 'short',
    entryPrice: '1.0900',
    exitPrice: '1.0880',
    quantity: '1.00',
    initialStopPrice: '1.0910',
    commission: '7.00',
    swap: '-2.50', // Credit reduces total costs to 4.50
  });
  const sm = calculateTradeMetrics(shortWin, eurusd);
  assert.equal(sm.grossPnl, '200.00');
  assert.equal(sm.totalCosts, '4.50');
  assert.equal(sm.netPnl, '195.50');
  assert.equal(sm.netRMultiple, '1.96');
});

test('calculateTradeMetrics handles Futures tickValue, Commodities, Equities, and Manual Gross P&L override', () => {
  const nqSpec = makeSpec({
    id: 'inst_nq',
    symbol: 'NQ',
    assetClass: 'futures',
    quoteCurrency: 'USD',
    profitCurrency: 'USD',
    contractSize: '20',
    tickSize: '0.25',
    pipSize: '0.25',
    tickValue: '5.00',
    quantityUnit: 'contracts',
  });

  // Matches seeded trd_demo_nq_win: +75 pts * 2 contracts * $20/pt = +$3,000 gross; $12 costs -> $2,988 net; risk 25 pts * 2 * $20 = $1,000 -> 2.99R
  const nqWin = makeTrade({
    symbol: 'NQ',
    instrumentId: 'inst_nq',
    direction: 'long',
    entryPrice: '20400.00',
    exitPrice: '20475.00',
    quantity: '2',
    exitQuantity: '2',
    initialStopPrice: '20375.00',
    commission: '8.40',
    fees: '3.60',
  });
  const nm = calculateTradeMetrics(nqWin, nqSpec);
  assert.equal(nm.initialRiskAmount, '1000.00');
  assert.equal(nm.grossPnl, '3000.00');
  assert.equal(nm.totalCosts, '12.00');
  assert.equal(nm.netPnl, '2988.00');
  assert.equal(nm.netRMultiple, '2.99');

  // Commodities: XAUUSD short 0.50 lots from 2645 -> 2662 = -17 * 100 * 0.50 = -850 gross; 4.50 + 12.00 = 16.50 costs -> -866.50 net
  const xauSpec = makeSpec({
    id: 'inst_xau',
    symbol: 'XAUUSD',
    assetClass: 'commodities',
    contractSize: '100',
    tickSize: '0.01',
    pipSize: '0.1',
  });
  const xauLoss = makeTrade({
    symbol: 'XAUUSD',
    instrumentId: 'inst_xau',
    direction: 'short',
    entryPrice: '2645.00',
    exitPrice: '2662.00',
    quantity: '0.50',
    exitQuantity: '0.50',
    initialStopPrice: '2655.00',
    actualStopPrice: '2662.00',
    commission: '4.50',
    swap: '12.00',
  });
  const xm = calculateTradeMetrics(xauLoss, xauSpec);
  assert.equal(xm.initialRiskAmount, '500.00');
  assert.equal(xm.actualRiskAmount, '850.00'); // Widened stop increased actual risk
  assert.equal(xm.grossPnl, '-850.00');
  assert.equal(xm.netPnl, '-866.50');
  assert.equal(xm.netRMultiple, '-1.73'); // Anchored to initial risk 500
  assert.equal(xm.outcome, 'loss');

  // Equities with manualGrossPnl override
  const aaplSpec = makeSpec({
    id: 'inst_aapl',
    symbol: 'AAPL',
    assetClass: 'equities',
    contractSize: '1',
    tickSize: '0.01',
    pipSize: '0.01',
    quantityUnit: 'shares',
  });
  const aaplManual = makeTrade({
    symbol: 'AAPL',
    instrumentId: 'inst_aapl',
    entryPrice: null,
    exitPrice: null,
    quantity: null,
    manualGrossPnl: '412.75',
    plannedRiskAmount: '200.00',
    fees: '2.75',
  });
  const am = calculateTradeMetrics(aaplManual, aaplSpec);
  assert.equal(am.grossPnlSource, 'manual_override');
  assert.equal(am.grossPnl, '412.75');
  assert.equal(am.netPnl, '410.00');
  assert.equal(am.netRMultiple, '2.05');
});

test('calculateTradeMetrics converts quote currency via workspace/inverse FX or trade override, and never coerces missing FX or spec to 0', () => {
  const usdjpy = makeSpec({
    id: 'inst_usdjpy',
    symbol: 'USDJPY',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    profitCurrency: 'JPY',
    contractSize: '100000',
    tickSize: '0.001',
    pipSize: '0.01',
  });

  // 1. Missing FX rate -> netPnl & grossPnl must be null (NEVER 0)
  const jpyTradeNoFx = makeTrade({
    symbol: 'USDJPY',
    instrumentId: 'inst_usdjpy',
    entryPrice: '150.000',
    exitPrice: '151.000', // +100 pips = +100,000 JPY
    quantity: '1.00',
    accountCurrency: 'USD',
  });
  const missingFxMetrics = calculateTradeMetrics(jpyTradeNoFx, usdjpy, []);
  assert.equal(missingFxMetrics.grossPnlNative, '100000.00');
  assert.equal(missingFxMetrics.grossPnl, null);
  assert.equal(missingFxMetrics.netPnl, null);
  assert.equal(missingFxMetrics.grossPnlSource, 'missing_fx_rate');
  assert.equal(missingFxMetrics.balanceImpactApplies, false);
  assert.ok(missingFxMetrics.unavailableReason?.includes('JPY/USD'));

  // 2. Inverse workspace FX rate (USD/JPY = 150 -> JPY/USD = 1/150 -> 100,000 JPY * 1/150 = 666.67 USD)
  const fxRates: FXRateSnapshot[] = [
    {
      id: 'fx_usdjpy',
      baseCurrency: 'USD',
      quoteCurrency: 'JPY',
      rate: '150',
      capturedAt: '2026-11-22',
      source: 'manual',
    },
  ];
  const convertedMetrics = calculateTradeMetrics(jpyTradeNoFx, usdjpy, fxRates);
  assert.equal(convertedMetrics.fxConversion?.source, 'workspace_inverse');
  assert.equal(convertedMetrics.grossPnl, '666.67');
  assert.equal(convertedMetrics.netPnl, '666.67');

  // 3. Trade-specific fxConversionRate override takes precedence
  const tradeOverride = makeTrade({
    ...jpyTradeNoFx,
    fxConversionRate: '0.0065',
  });
  const overrideMetrics = calculateTradeMetrics(tradeOverride, usdjpy, fxRates);
  assert.equal(overrideMetrics.fxConversion?.source, 'trade_override');
  assert.equal(overrideMetrics.grossPnl, '650.00');

  // 4. Missing instrument spec
  const noSpecMetrics = calculateTradeMetrics(makeTrade(), null, fxRates);
  assert.equal(noSpecMetrics.instrumentMatched, false);
  assert.equal(noSpecMetrics.netPnl, null);
  assert.equal(noSpecMetrics.outcome, 'unknown');
  assert.ok(noSpecMetrics.unavailableReason?.includes('Instrument Specification'));
});

test('breakeven threshold, draft/open/archived isolation, and ledger + rollup integration work accurately', () => {
  const nqSpec = makeSpec({
    id: 'inst_nq',
    symbol: 'NQ',
    assetClass: 'futures',
    contractSize: '20',
    tickSize: '0.25',
    pipSize: '0.25',
    tickValue: '5.00',
    quantityUnit: 'contracts',
  });
  const account = makeAccount({
    id: 'acc_funded',
    startingBalance: '100000.00',
    verifiedBalanceSnapshot: '99250.00',
  });
  const payout: CashTransaction = {
    id: 'tx_payout',
    workspaceId: 'ws_1',
    accountId: 'acc_funded',
    ownerId: 'u_1',
    type: 'payout',
    amount: '3200.00',
    currency: 'USD',
    grossAmount: '4000.00',
    splitPct: '80',
    occurredAt: '2026-11-18',
    notes: null,
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  };

  const trades: Trade[] = [
    // +$2,988.00 net
    makeTrade({
      id: 't_win',
      accountId: 'acc_funded',
      symbol: 'NQ',
      instrumentId: 'inst_nq',
      direction: 'long',
      status: 'closed',
      entryPrice: '20400.00',
      exitPrice: '20475.00',
      quantity: '2',
      exitQuantity: '2',
      initialStopPrice: '20375.00',
      commission: '8.40',
      fees: '3.60',
    }),
    // -$538.00 net (-520 gross - 18 costs) -> sum = +$2,450.00
    makeTrade({
      id: 't_loss',
      accountId: 'acc_funded',
      symbol: 'NQ',
      instrumentId: 'inst_nq',
      direction: 'short',
      status: 'closed',
      entryPrice: '20520.00',
      exitPrice: '20546.00',
      quantity: '1',
      initialStopPrice: '20545.00',
      commission: '4.20',
      fees: '1.80',
      slippage: '12.00',
    }),
    // Breakeven trade within +/-0.005 -> $0.00 net
    makeTrade({
      id: 't_be',
      accountId: 'acc_funded',
      symbol: 'NQ',
      instrumentId: 'inst_nq',
      direction: 'long',
      status: 'closed',
      entryPrice: '20500.00',
      exitPrice: '20500.25', // +$5.00 gross
      quantity: '1',
      commission: '5.00', // net = $0.00
    }),
    // Open trade (must NOT affect balance)
    makeTrade({
      id: 't_open',
      accountId: 'acc_funded',
      symbol: 'NQ',
      instrumentId: 'inst_nq',
      status: 'open',
      exitPrice: null,
    }),
    // Draft trade (must NOT affect balance)
    makeTrade({
      id: 't_draft',
      accountId: 'acc_funded',
      symbol: 'NQ',
      instrumentId: 'inst_nq',
      status: 'draft',
      exitPrice: null,
    }),
    // Archived closed trade (must NOT affect balance!)
    makeTrade({
      id: 't_archived',
      accountId: 'acc_funded',
      symbol: 'NQ',
      instrumentId: 'inst_nq',
      status: 'closed',
      isArchived: true,
      manualGrossPnl: '-5000.00',
    }),
  ];

  const impact = calculateAccountTradeImpact(account, trades, [nqSpec]);
  assert.equal(impact.totalActiveTrades, 5);
  assert.equal(impact.archivedCount, 1);
  assert.equal(impact.closedCount, 3);
  assert.equal(impact.winCount, 1);
  assert.equal(impact.lossCount, 1);
  assert.equal(impact.breakevenCount, 1);
  assert.equal(impact.realisedNetPnl, '2450.00');
  // Win rate includes BE in denominator: 1 / 3 = 33.3%
  assert.equal(impact.winRatePct, '33.3');

  const ledger = calculateAccountLedger(account, [payout], {
    tradeCount: impact.totalActiveTrades,
    realisedTradePnl: impact.realisedNetPnl,
  });
  // 100,000 - 3,200 + 2,450 = 99,250 -> matches verified snapshot 99,250.00
  assert.equal(ledger.calculatedLedgerBalance, '99250.00');
  assert.equal(ledger.reconciliationStatus, 'reconciled');
  assert.equal(ledger.reconciliationDelta, '0.00');

  const rollup = calculateWorkspaceRollup([account], [payout], 'USD', [], trades, [nqSpec]);
  assert.equal(rollup.consolidatedRealisedTradePnl, '2450.00');
  assert.equal(rollup.consolidatedCurrentBalance, '99250.00');
  assert.equal(rollup.realisedPnlStatus, 'calculated');
});

test('filterAndSortTrades, calculateTradeAggregateSummary, and paginateItems behave deterministically', () => {
  const eurusd = makeSpec();
  const trades: Trade[] = [
    makeTrade({
      id: 't1',
      symbol: 'EURUSD',
      entryAt: '2026-11-10T09:00',
      entryPrice: '1.0800',
      exitPrice: '1.0840', // +400
      tags: ['breakout'],
      setupTag: 'London BOS',
    }),
    makeTrade({
      id: 't2',
      symbol: 'EURUSD',
      direction: 'short',
      entryAt: '2026-11-12T09:00',
      entryPrice: '1.0900',
      exitPrice: '1.0920', // -200
      tags: ['counter'],
    }),
    makeTrade({
      id: 't3',
      symbol: 'EURUSD',
      status: 'open',
      entryAt: '2026-11-15T09:00',
      exitPrice: null,
      exitAt: null,
    }),
    makeTrade({
      id: 't4',
      symbol: 'EURUSD',
      isArchived: true,
      entryAt: '2026-11-01T09:00',
      manualGrossPnl: '100.00',
    }),
  ];

  const metricsMap = calculateAllTradeMetrics(trades, [eurusd]);
  const summary = calculateTradeAggregateSummary(trades, metricsMap, 'USD');
  assert.equal(summary.totalTrades, 3);
  assert.equal(summary.archivedCount, 1);
  assert.equal(summary.closedWithPnlCount, 2);
  assert.equal(summary.consolidatedNetPnl, '200.00');
  assert.equal(summary.profitFactor, '2.00');

  const filteredWin = filterAndSortTrades(
    trades,
    metricsMap,
    { outcome: 'win', archiveScope: 'active_only', searchQuery: 'London' },
    { field: 'net_pnl', direction: 'desc' }
  );
  assert.equal(filteredWin.length, 1);
  assert.equal(filteredWin[0].id, 't1');

  const archivedOnly = filterAndSortTrades(
    trades,
    metricsMap,
    { archiveScope: 'archived_only' },
    { field: 'date', direction: 'desc' }
  );
  assert.equal(archivedOnly.length, 1);
  assert.equal(archivedOnly[0].id, 't4');

  const sortedByNetPnl = filterAndSortTrades(
    trades,
    metricsMap,
    { archiveScope: 'active_only' },
    { field: 'net_pnl', direction: 'desc' }
  );
  assert.deepEqual(
    sortedByNetPnl.map((t) => t.id),
    ['t1', 't2', 't3']
  );

  const page2 = paginateItems(['a', 'b', 'c', 'd', 'e'], 2, 2);
  assert.deepEqual(page2.items, ['c', 'd']);
  assert.equal(page2.totalPages, 3);
  assert.equal(page2.startIndex, 2);
  assert.equal(page2.endIndex, 4);
});
