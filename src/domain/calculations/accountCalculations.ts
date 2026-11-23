import Decimal from 'decimal.js';
import type {
  Account,
  CashTransaction,
  FXRateSnapshot,
  InstrumentSpecification,
  Portfolio,
  Trade,
} from '../models';
import { calculateAccountTradeImpact } from './tradeCalculations';

/**
 * Central Financial Calculation & Ledger Engine — Stage 0 Contracts & Verified Account Math.
 *
 * Conventions:
 * 1. All currency arithmetic uses decimal.js (no IEEE-754 binary floating-point rounding drift).
 * 2. Unknown / missing values remain `null` and are NEVER silently coerced to 0.
 * 3. Multi-currency aggregation never assumes 1:1 parity; without explicit FXRateSnapshots,
 *    totals are partitioned by base currency and consolidated FX rollup is marked unavailable.
 * 4. Ledger reconciliation formula:
 *      Expected Ledger Balance = Starting Balance + Net Cash Movements + Realised Trade P&L (0 when 0 trades exist)
 *      Reconciliation Delta    = Verified Balance Snapshot - Expected Ledger Balance (when snapshot exists)
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type ReconciliationStatus = 'no_snapshot' | 'reconciled' | 'discrepancy';

export interface AccountLedgerSummary {
  accountId: string;
  currency: string;
  startingBalance: string;
  depositsTotal: string;
  withdrawalsTotal: string;
  payoutsTotal: string;
  feesTotal: string;
  adjustmentsTotal: string;
  netCashFlow: string;
  /** Null when trade journal engine / trade records are not yet active or uncalculated. */
  realisedTradePnl: string | null;
  tradeCount: number;
  /** Calculated balance from starting balance + cash movements (+ realised P&L if available). */
  calculatedLedgerBalance: string;
  verifiedBalanceSnapshot: string | null;
  verifiedEquitySnapshot: string | null;
  snapshotAsOf: string | null;
  /** Snapshot minus calculatedLedgerBalance; null if no verified snapshot recorded. */
  reconciliationDelta: string | null;
  reconciliationStatus: ReconciliationStatus;
  /** Effective display balance: verified snapshot if provided, otherwise calculatedLedgerBalance. */
  effectiveCurrentBalance: string;
  effectiveBalanceSource: 'verified_snapshot' | 'calculated_ledger';
}

export interface CurrencyRollupBucket {
  currency: string;
  accountCount: number;
  activeAccountCount: number;
  startingBalanceTotal: string;
  netCashFlowTotal: string;
  realisedTradePnlTotal: string;
  effectiveCurrentBalanceTotal: string;
  accountsWithSnapshots: number;
}

export interface WorkspaceFinancialRollup {
  totalAccounts: number;
  activeAccounts: number;
  archivedAccounts: number;
  /** Present only if all included accounts share a single currency OR verified FX rates cover all currencies. */
  consolidatedCurrency: string | null;
  consolidatedStartingBalance: string | null;
  consolidatedCurrentBalance: string | null;
  consolidatedNetCashFlow: string | null;
  consolidatedRealisedTradePnl: string | null;
  /** Explains why consolidated figure is unavailable if currencies are mixed without FX rates. */
  consolidationUnavailableReason: string | null;
  currencyBuckets: CurrencyRollupBucket[];
  tradeCount: number;
  closedTradeCount: number;
  openTradeCount: number;
  draftTradeCount: number;
  realisedPnlStatus: 'calculated' | 'no_trades_logged' | 'unavailable';
}

/**
 * Signed cash-flow contribution of a single CashTransaction to the account ledger.
 * - deposit: +amount (if positive input)
 * - adjustment: signed amount as entered (+ or -)
 * - transfer: signed amount as entered (+ or -)
 * - withdrawal: -abs(amount)
 * - payout: -abs(amount) (prop-firm payout removes funds from the trading account balance)
 * - fee: -abs(amount)
 */
export function getSignedCashMovement(tx: Pick<CashTransaction, 'type' | 'amount'>): Decimal {
  const amt = new Decimal(tx.amount);
  switch (tx.type) {
    case 'deposit':
      return amt.abs();
    case 'withdrawal':
    case 'payout':
    case 'fee':
      return amt.abs().negated();
    case 'adjustment':
    case 'transfer':
      return amt;
  }
}

export function calculateAccountLedger(
  account: Account,
  transactions: ReadonlyArray<CashTransaction>,
  options?: {
    tradeCount?: number;
    realisedTradePnl?: string | null;
  }
): AccountLedgerSummary {
  const accountTxs = transactions.filter((t) => t.accountId === account.id && t.currency === account.baseCurrency);
  const starting = new Decimal(account.startingBalance);

  let deposits = new Decimal(0);
  let withdrawals = new Decimal(0);
  let payouts = new Decimal(0);
  let fees = new Decimal(0);
  let adjustments = new Decimal(0);
  let netCashFlow = new Decimal(0);

  for (const tx of accountTxs) {
    const signed = getSignedCashMovement(tx);
    netCashFlow = netCashFlow.plus(signed);
    switch (tx.type) {
      case 'deposit':
        deposits = deposits.plus(signed);
        break;
      case 'withdrawal':
        withdrawals = withdrawals.plus(signed.abs());
        break;
      case 'payout':
        payouts = payouts.plus(signed.abs());
        break;
      case 'fee':
        fees = fees.plus(signed.abs());
        break;
      case 'adjustment':
      case 'transfer':
        adjustments = adjustments.plus(signed);
        break;
    }
  }

  const tradeCount = options?.tradeCount ?? 0;
  const realisedTradePnlStr = options?.realisedTradePnl ?? null;
  const realisedPnlDecimal = realisedTradePnlStr !== null ? new Decimal(realisedTradePnlStr) : new Decimal(0);

  const calculatedLedger = starting.plus(netCashFlow).plus(realisedPnlDecimal);

  let reconciliationDelta: string | null = null;
  let reconciliationStatus: ReconciliationStatus = 'no_snapshot';

  if (account.verifiedBalanceSnapshot !== null) {
    const snapshot = new Decimal(account.verifiedBalanceSnapshot);
    const delta = snapshot.minus(calculatedLedger);
    reconciliationDelta = delta.toFixed(2);
    reconciliationStatus = delta.abs().lte(new Decimal('0.005')) ? 'reconciled' : 'discrepancy';
  }

  const effectiveBalance =
    account.verifiedBalanceSnapshot !== null ? account.verifiedBalanceSnapshot : calculatedLedger.toFixed(2);

  return {
    accountId: account.id,
    currency: account.baseCurrency,
    startingBalance: starting.toFixed(2),
    depositsTotal: deposits.toFixed(2),
    withdrawalsTotal: withdrawals.toFixed(2),
    payoutsTotal: payouts.toFixed(2),
    feesTotal: fees.toFixed(2),
    adjustmentsTotal: adjustments.toFixed(2),
    netCashFlow: netCashFlow.toFixed(2),
    realisedTradePnl: realisedTradePnlStr,
    tradeCount,
    calculatedLedgerBalance: calculatedLedger.toFixed(2),
    verifiedBalanceSnapshot: account.verifiedBalanceSnapshot,
    verifiedEquitySnapshot: account.verifiedEquitySnapshot,
    snapshotAsOf: account.snapshotAsOf,
    reconciliationDelta,
    reconciliationStatus,
    effectiveCurrentBalance: effectiveBalance,
    effectiveBalanceSource: account.verifiedBalanceSnapshot !== null ? 'verified_snapshot' : 'calculated_ledger',
  };
}

export function calculateWorkspaceRollup(
  accounts: ReadonlyArray<Account>,
  transactions: ReadonlyArray<CashTransaction>,
  targetCurrency?: string,
  fxRates: ReadonlyArray<FXRateSnapshot> = [],
  trades: ReadonlyArray<Trade> = [],
  instruments: ReadonlyArray<InstrumentSpecification> = []
): WorkspaceFinancialRollup {
  const activeStatuses = new Set(['active', 'paused', 'passed']);
  const nonArchivedAccounts = accounts.filter((a) => a.status !== 'archived');
  const activeAccountsList = accounts.filter((a) => activeStatuses.has(a.status));
  const archivedCount = accounts.filter((a) => a.status === 'archived').length;

  let totalTradeCount = 0;
  let totalClosedTrades = 0;
  let totalOpenTrades = 0;
  let totalDraftTrades = 0;
  let hasCalculatedTradePnl = false;

  const bucketMap = new Map<
    string,
    {
      accountCount: number;
      activeAccountCount: number;
      starting: Decimal;
      netCashFlow: Decimal;
      realisedTradePnl: Decimal;
      effectiveBalance: Decimal;
      snapshots: number;
    }
  >();

  for (const acc of nonArchivedAccounts) {
    const impact =
      trades.length > 0
        ? calculateAccountTradeImpact(acc, trades, instruments, fxRates)
        : null;

    if (impact) {
      totalTradeCount += impact.totalActiveTrades;
      totalClosedTrades += impact.closedCount;
      totalOpenTrades += impact.openCount;
      totalDraftTrades += impact.draftCount;
      if (impact.realisedNetPnl !== null) {
        hasCalculatedTradePnl = true;
      }
    }

    const ledger = calculateAccountLedger(acc, transactions, {
      tradeCount: impact?.totalActiveTrades ?? 0,
      realisedTradePnl: impact?.realisedNetPnl ?? null,
    });

    const existing = bucketMap.get(acc.baseCurrency) ?? {
      accountCount: 0,
      activeAccountCount: 0,
      starting: new Decimal(0),
      netCashFlow: new Decimal(0),
      realisedTradePnl: new Decimal(0),
      effectiveBalance: new Decimal(0),
      snapshots: 0,
    };

    existing.accountCount += 1;
    if (activeStatuses.has(acc.status)) {
      existing.activeAccountCount += 1;
    }
    existing.starting = existing.starting.plus(ledger.startingBalance);
    existing.netCashFlow = existing.netCashFlow.plus(ledger.netCashFlow);
    if (ledger.realisedTradePnl !== null) {
      existing.realisedTradePnl = existing.realisedTradePnl.plus(ledger.realisedTradePnl);
    }
    existing.effectiveBalance = existing.effectiveBalance.plus(ledger.effectiveCurrentBalance);
    if (acc.verifiedBalanceSnapshot !== null) {
      existing.snapshots += 1;
    }
    bucketMap.set(acc.baseCurrency, existing);
  }

  const currencyBuckets: CurrencyRollupBucket[] = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, agg]) => ({
      currency,
      accountCount: agg.accountCount,
      activeAccountCount: agg.activeAccountCount,
      startingBalanceTotal: agg.starting.toFixed(2),
      netCashFlowTotal: agg.netCashFlow.toFixed(2),
      realisedTradePnlTotal: agg.realisedTradePnl.toFixed(2),
      effectiveCurrentBalanceTotal: agg.effectiveBalance.toFixed(2),
      accountsWithSnapshots: agg.snapshots,
    }));

  if (nonArchivedAccounts.length === 0) {
    return {
      totalAccounts: accounts.length,
      activeAccounts: activeAccountsList.length,
      archivedAccounts: archivedCount,
      consolidatedCurrency: targetCurrency ?? null,
      consolidatedStartingBalance: null,
      consolidatedCurrentBalance: null,
      consolidatedNetCashFlow: null,
      consolidatedRealisedTradePnl: null,
      consolidationUnavailableReason: 'No active or non-archived accounts configured.',
      currencyBuckets: [],
      tradeCount: 0,
      closedTradeCount: 0,
      openTradeCount: 0,
      draftTradeCount: 0,
      realisedPnlStatus: 'no_trades_logged',
    };
  }

  const pnlStatus: WorkspaceFinancialRollup['realisedPnlStatus'] =
    totalTradeCount === 0
      ? 'no_trades_logged'
      : hasCalculatedTradePnl
        ? 'calculated'
        : 'unavailable';

  // Single-currency fast path (no FX assumptions required)
  if (currencyBuckets.length === 1 && (!targetCurrency || currencyBuckets[0].currency === targetCurrency)) {
    const only = currencyBuckets[0];
    return {
      totalAccounts: accounts.length,
      activeAccounts: activeAccountsList.length,
      archivedAccounts: archivedCount,
      consolidatedCurrency: only.currency,
      consolidatedStartingBalance: only.startingBalanceTotal,
      consolidatedCurrentBalance: only.effectiveCurrentBalanceTotal,
      consolidatedNetCashFlow: only.netCashFlowTotal,
      consolidatedRealisedTradePnl: hasCalculatedTradePnl ? only.realisedTradePnlTotal : null,
      consolidationUnavailableReason: null,
      currencyBuckets,
      tradeCount: totalTradeCount,
      closedTradeCount: totalClosedTrades,
      openTradeCount: totalOpenTrades,
      draftTradeCount: totalDraftTrades,
      realisedPnlStatus: pnlStatus,
    };
  }

  // Multi-currency path: convert only if explicit FXRateSnapshots exist for every non-target bucket
  const destCurrency = targetCurrency ?? currencyBuckets[0].currency;
  let totalStart = new Decimal(0);
  let totalCurrent = new Decimal(0);
  let totalCash = new Decimal(0);
  let totalTradePnl = new Decimal(0);
  const missingPairs: string[] = [];

  for (const bucket of currencyBuckets) {
    if (bucket.currency === destCurrency) {
      totalStart = totalStart.plus(bucket.startingBalanceTotal);
      totalCurrent = totalCurrent.plus(bucket.effectiveCurrentBalanceTotal);
      totalCash = totalCash.plus(bucket.netCashFlowTotal);
      totalTradePnl = totalTradePnl.plus(bucket.realisedTradePnlTotal);
      continue;
    }

    const directRate = fxRates.find(
      (r) => r.baseCurrency === bucket.currency && r.quoteCurrency === destCurrency
    );
    const inverseRate = fxRates.find(
      (r) => r.baseCurrency === destCurrency && r.quoteCurrency === bucket.currency
    );

    if (directRate) {
      const rate = new Decimal(directRate.rate);
      totalStart = totalStart.plus(new Decimal(bucket.startingBalanceTotal).times(rate));
      totalCurrent = totalCurrent.plus(new Decimal(bucket.effectiveCurrentBalanceTotal).times(rate));
      totalCash = totalCash.plus(new Decimal(bucket.netCashFlowTotal).times(rate));
      totalTradePnl = totalTradePnl.plus(new Decimal(bucket.realisedTradePnlTotal).times(rate));
    } else if (inverseRate && !new Decimal(inverseRate.rate).isZero()) {
      const rate = new Decimal(1).div(inverseRate.rate);
      totalStart = totalStart.plus(new Decimal(bucket.startingBalanceTotal).times(rate));
      totalCurrent = totalCurrent.plus(new Decimal(bucket.effectiveCurrentBalanceTotal).times(rate));
      totalCash = totalCash.plus(new Decimal(bucket.netCashFlowTotal).times(rate));
      totalTradePnl = totalTradePnl.plus(new Decimal(bucket.realisedTradePnlTotal).times(rate));
    } else {
      missingPairs.push(`${bucket.currency}/${destCurrency}`);
    }
  }

  if (missingPairs.length > 0) {
    return {
      totalAccounts: accounts.length,
      activeAccounts: activeAccountsList.length,
      archivedAccounts: archivedCount,
      consolidatedCurrency: null,
      consolidatedStartingBalance: null,
      consolidatedCurrentBalance: null,
      consolidatedNetCashFlow: null,
      consolidatedRealisedTradePnl: null,
      consolidationUnavailableReason: `Multi-currency consolidation unavailable: missing FX rate for ${missingPairs.join(', ')}. Showing per-currency totals.`,
      currencyBuckets,
      tradeCount: totalTradeCount,
      closedTradeCount: totalClosedTrades,
      openTradeCount: totalOpenTrades,
      draftTradeCount: totalDraftTrades,
      realisedPnlStatus: totalTradeCount === 0 ? 'no_trades_logged' : 'unavailable',
    };
  }

  return {
    totalAccounts: accounts.length,
    activeAccounts: activeAccountsList.length,
    archivedAccounts: archivedCount,
    consolidatedCurrency: destCurrency,
    consolidatedStartingBalance: totalStart.toFixed(2),
    consolidatedCurrentBalance: totalCurrent.toFixed(2),
    consolidatedNetCashFlow: totalCash.toFixed(2),
    consolidatedRealisedTradePnl: hasCalculatedTradePnl ? totalTradePnl.toFixed(2) : null,
    consolidationUnavailableReason: null,
    currencyBuckets,
    tradeCount: totalTradeCount,
    closedTradeCount: totalClosedTrades,
    openTradeCount: totalOpenTrades,
    draftTradeCount: totalDraftTrades,
    realisedPnlStatus: pnlStatus,
  };
}


export type AccountHealthStatus = 'healthy' | 'warning' | 'critical' | 'breached' | 'archived' | 'unknown';
export type AccountHealthBasis =
  | 'verified_snapshot'
  | 'calculated_ledger'
  | 'status_override'
  | 'insufficient_data';

export interface AccountHealthEvaluation {
  status: AccountHealthStatus;
  basis: AccountHealthBasis;
  overallLossLimitResolved: string | null;
  profitTargetResolved: string | null;
  drawdownFromStart: string | null;
  drawdownUsedPctOfLimit: string | null;
  reconciliationWarning: boolean;
  summary: string;
}

export type AccountGroupBy = 'none' | 'portfolio' | 'account_type' | 'status' | 'currency' | 'provider';

export interface AccountGroupBucket {
  key: string;
  label: string;
  accounts: Account[];
  currencies: string[];
  /** Present when all accounts in group share one currency or FX rates cover conversion. */
  subtotalCurrency: string | null;
  subtotalCurrentBalance: string | null;
  subtotalStartingBalance: string | null;
}

export interface PortfolioRollupSummary {
  portfolioId: string | null;
  portfolioName: string;
  baseCurrency: string;
  status: 'active' | 'archived';
  accountCount: number;
  activeCount: number;
  rollup: WorkspaceFinancialRollup;
}

export interface AccountComparisonRow {
  account: Account;
  portfolioName: string | null;
  ledger: AccountLedgerSummary;
  health: AccountHealthEvaluation;
}

export function resolveAccountLossLimit(account: Account): string | null {
  if (account.maxOverallLossAmount !== null) {
    return new Decimal(account.maxOverallLossAmount).toFixed(2);
  }
  if (account.maxOverallLossPct !== null) {
    const start = new Decimal(account.startingBalance);
    const pct = new Decimal(account.maxOverallLossPct);
    return start.times(pct).div(100).toFixed(2);
  }
  return null;
}

export function resolveAccountProfitTarget(account: Account): string | null {
  if (account.profitTargetAmount !== null) {
    return new Decimal(account.profitTargetAmount).toFixed(2);
  }
  if (account.profitTargetPct !== null) {
    const start = new Decimal(account.startingBalance);
    const pct = new Decimal(account.profitTargetPct);
    return start.times(pct).div(100).toFixed(2);
  }
  return null;
}

/**
 * Deterministic Stage 1 Account Health Foundation.
 * Never fabricates intraday drawdown or trade metrics; evaluates strictly from:
 * - Account lifecycle status (archived / breached / failed)
 * - Configured overall loss limits (amount or % of starting balance)
 * - Effective current balance / lower verified equity snapshot vs starting balance (cash-adjusted when applicable)
 * - Balance reconciliation discrepancy state
 */
export function calculateAccountHealth(
  account: Account,
  ledger: AccountLedgerSummary
): AccountHealthEvaluation {
  const overallLossLimitResolved = resolveAccountLossLimit(account);
  const profitTargetResolved = resolveAccountProfitTarget(account);
  const reconciliationWarning = ledger.reconciliationStatus === 'discrepancy';

  if (account.status === 'archived') {
    return {
      status: 'archived',
      basis: 'status_override',
      overallLossLimitResolved,
      profitTargetResolved,
      drawdownFromStart: null,
      drawdownUsedPctOfLimit: null,
      reconciliationWarning,
      summary: 'Account is archived and excluded from active workspace capital totals.',
    };
  }

  if (account.status === 'breached' || account.status === 'failed') {
    return {
      status: 'breached',
      basis: 'status_override',
      overallLossLimitResolved,
      profitTargetResolved,
      drawdownFromStart: null,
      drawdownUsedPctOfLimit: null,
      reconciliationWarning,
      summary: `Account status is marked "${account.status}".`,
    };
  }

  const starting = new Decimal(ledger.startingBalance);
  const effectiveBal = new Decimal(ledger.effectiveCurrentBalance);
  const effectiveEq =
    ledger.verifiedEquitySnapshot !== null ? new Decimal(ledger.verifiedEquitySnapshot) : null;
  // Use the more conservative of verified balance vs verified equity when equity is lower
  const evaluationValue =
    effectiveEq !== null && effectiveEq.lt(effectiveBal) ? effectiveEq : effectiveBal;

  // Baseline capital incorporates non-trade deposits/withdrawals so depositing or withdrawing payouts
  // isn't misclassified as trading drawdown if startingBalance + netCashFlow is the adjusted capital base.
  // For prop payouts where payout removes profit/funds, drawdown vs startingBalance is compared carefully:
  // If evaluationValue < startingBalance (only when no net positive cash inflation), measure drop below startingBalance
  // minus deposits/withdrawals? Even simpler and safer in Stage 1: compare evaluationValue against (startingBalance + deposits - fees?):
  // Let's compare against startingBalance directly when netCashFlow == 0, or against expected ledger balance if no snapshot.
  // Specifically: trading loss relative to cash-adjusted capital = (starting + netCashFlow) - evaluationValue
  // Wait: if someone hasn't logged trades yet (Stage 1), calculatedLedger = starting + netCashFlow.
  // When a verified snapshot exists below calculatedLedger, unrealized/unlogged variance = calculatedLedger - evaluationValue.
  // And if calculatedLedger itself is below startingBalance due to fees/adjustments without deposits, raw drop from startingBalance also matters.
  // Let's take the greater of (0, calculatedLedger - evaluationValue) OR if no snapshot and raw balance < starting (only if not withdrawal/payout).
  const calculated = new Decimal(ledger.calculatedLedgerBalance);
  const unloggedDrawdown = Decimal.max(0, calculated.minus(evaluationValue));
  const rawBelowStart =
    ledger.payoutsTotal === '0.00' && ledger.withdrawalsTotal === '0.00'
      ? Decimal.max(0, starting.minus(evaluationValue))
      : new Decimal(0);
  const drawdownFromStartDec = Decimal.max(unloggedDrawdown, rawBelowStart);
  const drawdownFromStart = drawdownFromStartDec.toFixed(2);

  if (overallLossLimitResolved !== null && new Decimal(overallLossLimitResolved).gt(0)) {
    const limitDec = new Decimal(overallLossLimitResolved);
    const usedPctDec = drawdownFromStartDec.div(limitDec).times(100);
    const usedPct = usedPctDec.toFixed(1);

    let status: AccountHealthStatus = 'healthy';
    let summary = `${usedPct}% of max loss threshold used (${account.baseCurrency} ${drawdownFromStart} / ${overallLossLimitResolved}).`;

    if (usedPctDec.gte(100)) {
      status = 'breached';
      summary = `Drawdown (${account.baseCurrency} ${drawdownFromStart}) reached or exceeded max loss limit (${overallLossLimitResolved}).`;
    } else if (usedPctDec.gte(90)) {
      status = 'critical';
      summary = `Critical: ${usedPct}% of overall loss limit utilized.`;
    } else if (usedPctDec.gte(75) || reconciliationWarning) {
      status = 'warning';
      summary = reconciliationWarning
        ? `Warning: Snapshot variance (${ledger.reconciliationDelta}) detected; ${usedPct}% of loss limit used.`
        : `Warning: ${usedPct}% of overall loss limit utilized.`;
    }

    return {
      status,
      basis: ledger.effectiveBalanceSource,
      overallLossLimitResolved,
      profitTargetResolved,
      drawdownFromStart,
      drawdownUsedPctOfLimit: usedPct,
      reconciliationWarning,
      summary,
    };
  }

  if (reconciliationWarning) {
    return {
      status: 'warning',
      basis: ledger.effectiveBalanceSource,
      overallLossLimitResolved: null,
      profitTargetResolved,
      drawdownFromStart,
      drawdownUsedPctOfLimit: null,
      reconciliationWarning: true,
      summary: `Reconciliation discrepancy (${ledger.reconciliationDelta} ${account.baseCurrency}). Configure an overall loss limit to enable drawdown alerts.`,
    };
  }

  return {
    status: 'unknown',
    basis: 'insufficient_data',
    overallLossLimitResolved: null,
    profitTargetResolved,
    drawdownFromStart,
    drawdownUsedPctOfLimit: null,
    reconciliationWarning: false,
    summary: 'Configure a max overall loss limit ($ or %) to compute threshold health.',
  };
}

export function calculatePortfolioRollups(
  portfolios: ReadonlyArray<Portfolio>,
  accounts: ReadonlyArray<Account>,
  transactions: ReadonlyArray<CashTransaction>,
  fxRates: ReadonlyArray<FXRateSnapshot> = [],
  trades: ReadonlyArray<Trade> = [],
  instruments: ReadonlyArray<InstrumentSpecification> = []
): PortfolioRollupSummary[] {
  const summaries: PortfolioRollupSummary[] = portfolios.map((pf) => {
    const pfAccounts = accounts.filter((a) => a.portfolioId === pf.id);
    const rollup = calculateWorkspaceRollup(
      pfAccounts,
      transactions,
      pf.baseCurrency,
      fxRates,
      trades,
      instruments
    );
    return {
      portfolioId: pf.id,
      portfolioName: pf.name,
      baseCurrency: pf.baseCurrency,
      status: pf.status,
      accountCount: pfAccounts.length,
      activeCount: pfAccounts.filter((a) => a.status === 'active').length,
      rollup,
    };
  });

  const unassignedAccounts = accounts.filter((a) => !a.portfolioId);
  if (unassignedAccounts.length > 0) {
    summaries.push({
      portfolioId: null,
      portfolioName: 'Unassigned Accounts',
      baseCurrency: unassignedAccounts[0].baseCurrency,
      status: 'active',
      accountCount: unassignedAccounts.length,
      activeCount: unassignedAccounts.filter((a) => a.status === 'active').length,
      rollup: calculateWorkspaceRollup(
        unassignedAccounts,
        transactions,
        undefined,
        fxRates,
        trades,
        instruments
      ),
    });
  }

  return summaries;
}

export function groupAccounts(
  accounts: ReadonlyArray<Account>,
  transactions: ReadonlyArray<CashTransaction>,
  groupBy: AccountGroupBy,
  portfolios: ReadonlyArray<Portfolio>,
  targetCurrency?: string,
  fxRates: ReadonlyArray<FXRateSnapshot> = [],
  trades: ReadonlyArray<Trade> = [],
  instruments: ReadonlyArray<InstrumentSpecification> = []
): AccountGroupBucket[] {
  if (groupBy === 'none') {
    const rollup = calculateWorkspaceRollup(
      accounts,
      transactions,
      targetCurrency,
      fxRates,
      trades,
      instruments
    );
    return [
      {
        key: 'all',
        label: 'All Matching Accounts',
        accounts: [...accounts],
        currencies: rollup.currencyBuckets.map((b) => b.currency),
        subtotalCurrency: rollup.consolidatedCurrency,
        subtotalCurrentBalance: rollup.consolidatedCurrentBalance,
        subtotalStartingBalance: rollup.consolidatedStartingBalance,
      },
    ];
  }

  const pfMap = new Map<string, string>();
  for (const pf of portfolios) pfMap.set(pf.id, pf.name);

  const grouped = new Map<string, { label: string; accounts: Account[] }>();

  for (const acc of accounts) {
    let key = 'other';
    let label = 'Other';

    switch (groupBy) {
      case 'portfolio':
        key = acc.portfolioId ?? 'unassigned';
        label = acc.portfolioId ? pfMap.get(acc.portfolioId) ?? 'Unknown Portfolio' : 'Unassigned Portfolio';
        break;
      case 'account_type':
        key = acc.accountType;
        label = acc.customCategory
          ? `${acc.accountType.replace(/_/g, ' ')} (${acc.customCategory})`
          : acc.accountType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        break;
      case 'status':
        key = acc.status;
        label = acc.status.replace(/\b\w/g, (c) => c.toUpperCase());
        break;
      case 'currency':
        key = acc.baseCurrency;
        label = acc.baseCurrency;
        break;
      case 'provider':
        key = acc.propFirmName || acc.brokerName || 'unspecified';
        label = acc.propFirmName || acc.brokerName || 'No Broker / Prop Firm';
        break;
    }

    const bucket = grouped.get(key) ?? { label, accounts: [] };
    bucket.accounts.push(acc);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries()).map(([key, bucket]) => {
    const rollup = calculateWorkspaceRollup(
      bucket.accounts,
      transactions,
      targetCurrency,
      fxRates,
      trades,
      instruments
    );
    return {
      key,
      label: bucket.label,
      accounts: bucket.accounts,
      currencies: rollup.currencyBuckets.map((b) => b.currency),
      subtotalCurrency: rollup.consolidatedCurrency,
      subtotalCurrentBalance: rollup.consolidatedCurrentBalance,
      subtotalStartingBalance: rollup.consolidatedStartingBalance,
    };
  });
}

export function buildAccountComparisonRows(
  accounts: ReadonlyArray<Account>,
  transactions: ReadonlyArray<CashTransaction>,
  portfolios: ReadonlyArray<Portfolio>,
  trades: ReadonlyArray<Trade> = [],
  instruments: ReadonlyArray<InstrumentSpecification> = [],
  fxRates: ReadonlyArray<FXRateSnapshot> = []
): AccountComparisonRow[] {
  const pfMap = new Map<string, string>();
  for (const pf of portfolios) pfMap.set(pf.id, pf.name);

  return accounts.map((account) => {
    const impact =
      trades.length > 0
        ? calculateAccountTradeImpact(account, trades, instruments, fxRates)
        : null;
    const ledger = calculateAccountLedger(account, transactions, {
      tradeCount: impact?.totalActiveTrades ?? 0,
      realisedTradePnl: impact?.realisedNetPnl ?? null,
    });
    const health = calculateAccountHealth(account, ledger);
    return {
      account,
      portfolioName: account.portfolioId ? pfMap.get(account.portfolioId) ?? null : null,
      ledger,
      health,
    };
  });
}

export function formatCurrencyAmount(value: string | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '—';
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${new Decimal(value).toFixed(2)}`;
  }
}

export function formatSignedCurrencyAmount(value: string | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const dec = new Decimal(value);
  const formatted = formatCurrencyAmount(dec.abs().toFixed(2), currency);
  if (dec.gt(0)) return `+${formatted}`;
  if (dec.lt(0)) return `-${formatted}`;
  return formatted;
}
