import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAccountComparisonRows,
  calculateAccountHealth,
  calculateAccountLedger,
  calculatePortfolioRollups,
  calculateWorkspaceRollup,
  groupAccounts,
} from '../domain/calculations/accountCalculations';
import type { Account, CashTransaction, FXRateSnapshot, Portfolio } from '../domain/models';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_1',
    workspaceId: 'ws_1',
    portfolioId: null,
    ownerId: 'user_1',
    name: 'Test Account',
    accountIdentifierMasked: null,
    accountType: 'personal_live',
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
    startingBalance: '10000.00',
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

function makeTx(overrides: Partial<CashTransaction> = {}): CashTransaction {
  return {
    id: 'tx_1',
    workspaceId: 'ws_1',
    accountId: 'acc_1',
    ownerId: 'user_1',
    type: 'deposit',
    amount: '100.00',
    currency: 'USD',
    grossAmount: null,
    splitPct: null,
    occurredAt: '2026-11-02',
    notes: null,
    createdAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    ...overrides,
  };
}

function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'pf_1',
    workspaceId: 'ws_1',
    ownerId: 'user_1',
    name: 'Prop Capital',
    description: null,
    baseCurrency: 'USD',
    status: 'active',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

test('calculateAccountLedger handles decimal-safe deposits, payouts, fees, and adjustments', () => {
  const account = makeAccount({ startingBalance: '100000.00' });
  const txs: CashTransaction[] = [
    makeTx({ id: 't1', type: 'deposit', amount: '0.10' }),
    makeTx({ id: 't2', type: 'deposit', amount: '0.20' }),
    makeTx({ id: 't3', type: 'payout', amount: '3200.00' }),
    makeTx({ id: 't4', type: 'fee', amount: '15.25' }),
    makeTx({ id: 't5', type: 'adjustment', amount: '-4.75' }),
  ];

  const ledger = calculateAccountLedger(account, txs);
  assert.equal(ledger.depositsTotal, '0.30');
  assert.equal(ledger.payoutsTotal, '3200.00');
  assert.equal(ledger.feesTotal, '15.25');
  assert.equal(ledger.adjustmentsTotal, '-4.75');
  assert.equal(ledger.netCashFlow, '-3219.70');
  assert.equal(ledger.calculatedLedgerBalance, '96780.30');
  assert.equal(ledger.reconciliationStatus, 'no_snapshot');
  assert.equal(ledger.reconciliationDelta, null);
  assert.equal(ledger.realisedTradePnl, null);
  assert.equal(ledger.effectiveBalanceSource, 'calculated_ledger');
});

test('calculateAccountLedger detects reconciled vs discrepancy snapshots without coercing missing values', () => {
  const reconciledAcc = makeAccount({
    startingBalance: '50000.00',
    verifiedBalanceSnapshot: '52500.00',
  });
  const txs = [makeTx({ id: 't1', type: 'deposit', amount: '2500.00' })];

  const ok = calculateAccountLedger(reconciledAcc, txs);
  assert.equal(ok.reconciliationStatus, 'reconciled');
  assert.equal(ok.reconciliationDelta, '0.00');
  assert.equal(ok.effectiveBalanceSource, 'verified_snapshot');

  const driftAcc = makeAccount({
    startingBalance: '50000.00',
    verifiedBalanceSnapshot: '51900.00',
  });
  const drift = calculateAccountLedger(driftAcc, txs);
  assert.equal(drift.reconciliationStatus, 'discrepancy');
  assert.equal(drift.reconciliationDelta, '-600.00');
});

test('calculateWorkspaceRollup refuses silent 1:1 mixing and converts with direct or inverse FX rates', () => {
  const usdAcc = makeAccount({ id: 'a1', baseCurrency: 'USD', startingBalance: '10000.00' });
  const eurAcc = makeAccount({ id: 'a2', baseCurrency: 'EUR', startingBalance: '10000.00' });

  const withoutFx = calculateWorkspaceRollup([usdAcc, eurAcc], [], 'USD');
  assert.equal(withoutFx.consolidatedCurrentBalance, null);
  assert.equal(withoutFx.currencyBuckets.length, 2);
  assert.ok(withoutFx.consolidationUnavailableReason?.includes('EUR/USD'));

  const directFx: FXRateSnapshot[] = [
    {
      id: 'fx_1',
      baseCurrency: 'EUR',
      quoteCurrency: 'USD',
      rate: '1.10',
      capturedAt: '2026-11-22T00:00:00.000Z',
      source: 'manual',
    },
  ];
  const withDirect = calculateWorkspaceRollup([usdAcc, eurAcc], [], 'USD', directFx);
  assert.equal(withDirect.consolidatedCurrency, 'USD');
  assert.equal(withDirect.consolidatedCurrentBalance, '21000.00');
  assert.equal(withDirect.consolidationUnavailableReason, null);

  // Inverse FX path: USD/JPY = 150 -> 150000 JPY = 1000 USD
  const jpyAcc = makeAccount({ id: 'a3', baseCurrency: 'JPY', startingBalance: '150000.00' });
  const inverseFx: FXRateSnapshot[] = [
    {
      id: 'fx_2',
      baseCurrency: 'USD',
      quoteCurrency: 'JPY',
      rate: '150',
      capturedAt: '2026-11-22',
      source: 'manual',
    },
  ];
  const withInverse = calculateWorkspaceRollup([usdAcc, jpyAcc], [], 'USD', inverseFx);
  assert.equal(withInverse.consolidatedCurrency, 'USD');
  assert.equal(withInverse.consolidatedCurrentBalance, '11000.00');
});

test('calculateAccountHealth evaluates healthy, warning, critical, breached, archived, unknown, and equity drawdown', () => {
  // 1. Unconfigured thresholds & reconciled -> unknown
  const unconfigured = makeAccount({ startingBalance: '50000.00' });
  const uHealth = calculateAccountHealth(unconfigured, calculateAccountLedger(unconfigured, []));
  assert.equal(uHealth.status, 'unknown');
  assert.equal(uHealth.basis, 'insufficient_data');

  // 2. Unconfigured thresholds + discrepancy -> warning
  const unconfWarn = makeAccount({
    startingBalance: '50000.00',
    verifiedBalanceSnapshot: '49500.00',
  });
  const uwHealth = calculateAccountHealth(unconfWarn, calculateAccountLedger(unconfWarn, []));
  assert.equal(uwHealth.status, 'warning');
  assert.equal(uwHealth.reconciliationWarning, true);

  // 3. Healthy (10% of $5,000 limit used)
  const healthyAcc = makeAccount({
    startingBalance: '50000.00',
    maxOverallLossPct: '10', // $5,000 limit
    verifiedBalanceSnapshot: '49500.00',
  });
  const hHealth = calculateAccountHealth(healthyAcc, calculateAccountLedger(healthyAcc, []));
  assert.equal(hHealth.overallLossLimitResolved, '5000.00');
  assert.equal(hHealth.status, 'warning'); // because snapshot < calculatedLedger triggers discrepancy warning too
  // Wait: if reconciled ledger + lower equity snapshot -> healthy if <75%! Let's verify exact case:
  const healthyEqAcc = makeAccount({
    startingBalance: '50000.00',
    maxOverallLossAmount: '5000.00',
    verifiedBalanceSnapshot: '50000.00',
    verifiedEquitySnapshot: '49000.00',
  });
  const eqHealth = calculateAccountHealth(healthyEqAcc, calculateAccountLedger(healthyEqAcc, []));
  assert.equal(eqHealth.status, 'healthy');
  assert.equal(eqHealth.drawdownFromStart, '1000.00');
  assert.equal(eqHealth.drawdownUsedPctOfLimit, '20.0');

  // 4. Warning at >=75% via lower equity snapshot
  const warnAcc = makeAccount({
    startingBalance: '50000.00',
    maxOverallLossAmount: '5000.00',
    verifiedBalanceSnapshot: '50000.00',
    verifiedEquitySnapshot: '46100.00',
  });
  const wHealth = calculateAccountHealth(warnAcc, calculateAccountLedger(warnAcc, []));
  assert.equal(wHealth.status, 'warning');
  assert.equal(wHealth.drawdownUsedPctOfLimit, '78.0');

  // 5. Critical at >=90%
  const critAcc = makeAccount({
    startingBalance: '50000.00',
    maxOverallLossAmount: '5000.00',
    verifiedBalanceSnapshot: '50000.00',
    verifiedEquitySnapshot: '45400.00',
  });
  const cHealth = calculateAccountHealth(critAcc, calculateAccountLedger(critAcc, []));
  assert.equal(cHealth.status, 'critical');
  assert.equal(cHealth.drawdownUsedPctOfLimit, '92.0');

  // 6. Breached at >=100% and status override
  const breachedAcc = makeAccount({
    startingBalance: '50000.00',
    maxOverallLossAmount: '5000.00',
    verifiedBalanceSnapshot: '44900.00',
  });
  const bHealth = calculateAccountHealth(breachedAcc, calculateAccountLedger(breachedAcc, []));
  assert.equal(bHealth.status, 'breached');

  const archivedAcc = makeAccount({ status: 'archived' });
  const aHealth = calculateAccountHealth(archivedAcc, calculateAccountLedger(archivedAcc, []));
  assert.equal(aHealth.status, 'archived');
});

test('groupAccounts, calculatePortfolioRollups, and buildAccountComparisonRows summarize Stage 1 views accurately', () => {
  const portfolios: Portfolio[] = [
    makePortfolio({ id: 'pf_prop', name: 'Prop Funded', baseCurrency: 'USD' }),
    makePortfolio({ id: 'pf_personal', name: 'Personal Desk', baseCurrency: 'USD' }),
  ];

  const a1 = makeAccount({
    id: 'a1',
    name: 'Funded 100K',
    portfolioId: 'pf_prop',
    accountType: 'prop_funded',
    propFirmName: 'FTMO',
    startingBalance: '100000.00',
  });
  const a2 = makeAccount({
    id: 'a2',
    name: 'IBKR Swing',
    portfolioId: 'pf_personal',
    accountType: 'personal_live',
    brokerName: 'Interactive Brokers',
    startingBalance: '25000.00',
  });
  const a3 = makeAccount({
    id: 'a3',
    name: 'Unassigned Paper',
    portfolioId: null,
    accountType: 'paper',
    startingBalance: '10000.00',
  });

  const pfRollups = calculatePortfolioRollups(portfolios, [a1, a2, a3], []);
  assert.equal(pfRollups.length, 3); // 2 portfolios + 1 Unassigned Accounts bucket
  assert.equal(pfRollups[0].rollup.consolidatedCurrentBalance, '100000.00');
  assert.equal(pfRollups[2].portfolioId, null);

  const byPortfolio = groupAccounts([a1, a2, a3], [], 'portfolio', portfolios, 'USD');
  assert.equal(byPortfolio.length, 3);

  const byProvider = groupAccounts([a1, a2, a3], [], 'provider', portfolios, 'USD');
  assert.equal(byProvider.length, 3);
  assert.ok(byProvider.some((g) => g.label === 'FTMO' && g.subtotalCurrentBalance === '100000.00'));

  const compRows = buildAccountComparisonRows([a1, a2], [], portfolios);
  assert.equal(compRows.length, 2);
  assert.equal(compRows[0].portfolioName, 'Prop Funded');
  assert.equal(compRows[1].portfolioName, 'Personal Desk');
});
