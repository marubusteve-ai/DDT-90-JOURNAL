import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import {
  AccountHealthText,
  AccountStatusText,
  formatAccountTypeLabel,
  ReconciliationStatusText,
} from '../../components/StatusText';
import {
  calculateAccountHealth,
  calculateAccountLedger,
  calculatePortfolioRollups,
  calculateWorkspaceRollup,
  formatCurrencyAmount,
  formatSignedCurrencyAmount,
} from '../../domain/calculations/accountCalculations';
import {
  calculateAccountTradeImpact,
  calculateAllTradeMetrics,
  calculateTradeAggregateSummary,
} from '../../domain/calculations/tradeCalculations';
import type { Account } from '../../domain/models';
import { AccountFormModal } from '../accounts/AccountFormModal';

type DateRangePreset = 'all_time' | '30d' | '90d' | 'ytd';

export function OverviewPage() {
  const {
    activeWorkspace,
    portfolios,
    accounts,
    activeAccountId,
    setActiveAccountId,
    cashTransactions,
    fxRates,
    instruments,
    trades,
    auditLogs,
    setActiveRoute,
    userProfile,
    isLoadingData,
  } = useApp();

  const [portfolioFilter, setPortfolioFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangePreset>('all_time');
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  const scopedAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (activeAccountId !== 'all' && acc.id !== activeAccountId) return false;
      if (portfolioFilter !== 'all' && acc.portfolioId !== portfolioFilter) return false;
      return true;
    });
  }, [accounts, activeAccountId, portfolioFilter]);

  const dateCutoffIso = useMemo(() => {
    const now = new Date();
    if (dateRange === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d.toISOString().slice(0, 10);
    }
    if (dateRange === '90d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return d.toISOString().slice(0, 10);
    }
    if (dateRange === 'ytd') {
      return `${now.getFullYear()}-01-01`;
    }
    return null;
  }, [dateRange]);

  const scopedTransactions = useMemo(() => {
    const accountIds = new Set(scopedAccounts.map((a) => a.id));
    return cashTransactions.filter((tx) => {
      if (!accountIds.has(tx.accountId)) return false;
      if (dateCutoffIso && tx.occurredAt < dateCutoffIso) return false;
      return true;
    });
  }, [cashTransactions, dateCutoffIso, scopedAccounts]);

  const scopedTrades = useMemo(() => {
    const accountIds = new Set(scopedAccounts.map((a) => a.id));
    return trades.filter((t) => {
      if (!accountIds.has(t.accountId)) return false;
      const dateStr = (t.entryAt ?? t.exitAt ?? t.createdAt).slice(0, 10);
      if (dateCutoffIso && dateStr < dateCutoffIso) return false;
      return true;
    });
  }, [dateCutoffIso, scopedAccounts, trades]);

  const targetCurrency = activeWorkspace?.baseCurrency ?? userProfile?.defaultCurrency ?? 'USD';

  const rollup = useMemo(
    () =>
      calculateWorkspaceRollup(
        scopedAccounts,
        scopedTransactions,
        targetCurrency,
        fxRates,
        scopedTrades,
        instruments
      ),
    [fxRates, instruments, scopedAccounts, scopedTrades, scopedTransactions, targetCurrency]
  );

  const accountLedgers = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateAccountLedger>>();
    for (const acc of scopedAccounts) {
      const impact = calculateAccountTradeImpact(acc, scopedTrades, instruments, fxRates);
      map.set(
        acc.id,
        calculateAccountLedger(acc, scopedTransactions, {
          tradeCount: impact.totalActiveTrades,
          realisedTradePnl: impact.realisedNetPnl,
        })
      );
    }
    return map;
  }, [fxRates, instruments, scopedAccounts, scopedTrades, scopedTransactions]);

  const healthCounts = useMemo(() => {
    const counts = { healthy: 0, warning: 0, critical: 0, breached: 0, unknown: 0, archived: 0 };
    for (const acc of scopedAccounts) {
      const ledger = accountLedgers.get(acc.id) ?? calculateAccountLedger(acc, scopedTransactions);
      const health = calculateAccountHealth(acc, ledger);
      counts[health.status] += 1;
    }
    return counts;
  }, [accountLedgers, scopedAccounts, scopedTransactions]);

  const portfolioSummaries = useMemo(
    () =>
      calculatePortfolioRollups(
        portfolios,
        scopedAccounts,
        scopedTransactions,
        fxRates,
        scopedTrades,
        instruments
      ),
    [fxRates, instruments, portfolios, scopedAccounts, scopedTrades, scopedTransactions]
  );

  const tradeMetricsMap = useMemo(
    () => calculateAllTradeMetrics(scopedTrades, instruments, fxRates, scopedAccounts),
    [fxRates, instruments, scopedAccounts, scopedTrades]
  );

  const tradeSummary = useMemo(
    () => calculateTradeAggregateSummary(scopedTrades, tradeMetricsMap, targetCurrency, fxRates),
    [fxRates, scopedTrades, targetCurrency, tradeMetricsMap]
  );

  const handleDrillDownAccount = (acc: Account) => {
    setActiveAccountId(acc.id);
    setActiveRoute('accounts');
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Foundation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50">
            Performance &amp; Ledger Overview
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Reconciled from persisted workspace accounts, cash movements, snapshots, and FX rate
            records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div>
            <label htmlFor="overview-portfolio-filter" className="sr-only">
              Filter by portfolio
            </label>
            <select
              id="overview-portfolio-filter"
              value={portfolioFilter}
              onChange={(e) => setPortfolioFilter(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Portfolios</option>
              {portfolios.map((pf) => (
                <option key={pf.id} value={pf.id}>
                  {pf.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="overview-date-filter" className="sr-only">
              Filter cash ledger window
            </label>
            <select
              id="overview-date-filter"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
              className="h-8 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200"
            >
              <option value="all_time">Lifetime Ledger</option>
              <option value="ytd">Year to Date</option>
              <option value="90d">Last 90 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateAccount(true)}
            className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Grid */}
      {isLoadingData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="h-24 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Current Balance / Snapshot
            </div>
            <div
              data-testid="kpi-current-balance"
              className="mt-2 font-mono tabular-nums text-xl font-semibold text-slate-900 dark:text-slate-50"
            >
              {rollup.consolidatedCurrentBalance !== null && rollup.consolidatedCurrency
                ? formatCurrencyAmount(rollup.consolidatedCurrentBalance, rollup.consolidatedCurrency)
                : 'Multi-Currency'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {rollup.consolidatedCurrency
                ? `Consolidated in ${rollup.consolidatedCurrency}`
                : 'See currency breakdown below'}
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Starting Capital
            </div>
            <div
              data-testid="kpi-starting-balance"
              className="mt-2 font-mono tabular-nums text-xl font-semibold text-slate-900 dark:text-slate-50"
            >
              {rollup.consolidatedStartingBalance !== null && rollup.consolidatedCurrency
                ? formatCurrencyAmount(rollup.consolidatedStartingBalance, rollup.consolidatedCurrency)
                : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Across {scopedAccounts.filter((a) => a.status !== 'archived').length} non-archived accounts
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Net Cash Movements
            </div>
            <div
              data-testid="kpi-net-cash-flow"
              className="mt-2 font-mono tabular-nums text-xl font-semibold text-slate-900 dark:text-slate-50"
            >
              {rollup.consolidatedNetCashFlow !== null && rollup.consolidatedCurrency
                ? formatSignedCurrencyAmount(rollup.consolidatedNetCashFlow, rollup.consolidatedCurrency)
                : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {scopedTransactions.length} ledger movement{scopedTransactions.length === 1 ? '' : 's'} in range
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Account Health Coverage
            </div>
            <div
              data-testid="kpi-account-count"
              className="mt-2 font-mono tabular-nums text-xl font-semibold text-slate-900 dark:text-slate-50"
            >
              {healthCounts.healthy}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                {' '}
                healthy / {rollup.totalAccounts}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {healthCounts.warning} warn · {healthCounts.critical + healthCounts.breached} crit/breach ·{' '}
              {healthCounts.unknown} unconf.
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Realised Trade Net P&amp;L
            </div>
            <div
              data-testid="kpi-realised-pnl"
              className={`mt-2 font-mono tabular-nums text-xl font-semibold ${
                tradeSummary.consolidatedNetPnl !== null
                  ? Number(tradeSummary.consolidatedNetPnl) > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : Number(tradeSummary.consolidatedNetPnl) < 0
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-slate-900 dark:text-slate-50'
                  : 'text-slate-900 dark:text-slate-50'
              }`}
            >
              {tradeSummary.consolidatedNetPnl !== null && tradeSummary.consolidatedCurrency
                ? formatSignedCurrencyAmount(
                    tradeSummary.consolidatedNetPnl,
                    tradeSummary.consolidatedCurrency
                  )
                : tradeSummary.closedWithPnlCount > 0
                  ? 'Multi-Currency'
                  : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {tradeSummary.totalTrades} active ({tradeSummary.closedCount} closed · {tradeSummary.openCount} open ·{' '}
              {tradeSummary.draftCount} draft)
            </div>
          </div>
        </div>
      )}

      {/* Multi-Currency Transparency Notice (shown only when FX conversion is incomplete) */}
      {rollup.consolidationUnavailableReason && rollup.currencyBuckets.length > 0 && (
        <div className="bg-white dark:bg-[#111827] border border-amber-200 dark:border-amber-900/60 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {rollup.consolidationUnavailableReason}
            </div>
            <button
              type="button"
              onClick={() => setActiveRoute('workspaces')}
              className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
            >
              Manage FX Rates →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {rollup.currencyBuckets.map((bucket) => (
              <div
                key={bucket.currency}
                className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E131D] text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                  <span className="font-mono">{bucket.currency}</span>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    {bucket.accountCount} account{bucket.accountCount === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-2 font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrencyAmount(bucket.effectiveCurrentBalanceTotal, bucket.currency)}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  Start: {formatCurrencyAmount(bucket.startingBalanceTotal, bucket.currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Split: Accounts Overview Table + Portfolio / Audit Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-8 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Persisted Account Balances, Health &amp; Reconciliation
            </h2>
            <button
              type="button"
              onClick={() => setActiveRoute('accounts')}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline whitespace-nowrap"
            >
              <span>Manage Accounts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {scopedAccounts.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                No accounts exist in the current scope yet. Create an account to begin tracking
                capital and ledger balances.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateAccount(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {scopedAccounts.map((acc) => {
                  const ledger =
                    accountLedgers.get(acc.id) ?? calculateAccountLedger(acc, scopedTransactions);
                  const health = calculateAccountHealth(acc, ledger);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleDrillDownAccount(acc)}
                      className="w-full p-4 text-left space-y-2 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {acc.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatAccountTypeLabel(acc.accountType)} · {acc.baseCurrency}
                          </div>
                        </div>
                        <div className="text-right space-y-0.5 shrink-0">
                          <AccountStatusText status={acc.status} />
                          <div>
                            <AccountHealthText
                              status={health.status}
                              usedPct={health.drawdownUsedPctOfLimit}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrencyAmount(ledger.effectiveCurrentBalance, acc.baseCurrency)}
                        </span>
                        <ReconciliationStatusText status={ledger.reconciliationStatus} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0E131D]">
                      <th className="py-2.5 px-4">Account</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Health</th>
                      <th className="py-2.5 px-3 text-right">Starting</th>
                      <th className="py-2.5 px-3 text-right">Trade P&amp;L</th>
                      <th className="py-2.5 px-3 text-right">Current / Snapshot</th>
                      <th className="py-2.5 px-4">Reconciliation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs">
                    {scopedAccounts.map((acc) => {
                      const ledger =
                        accountLedgers.get(acc.id) ?? calculateAccountLedger(acc, scopedTransactions);
                      const health = calculateAccountHealth(acc, ledger);
                      return (
                        <tr
                          key={acc.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleDrillDownAccount(acc)}
                              className="text-left hover:text-sky-600 dark:hover:text-sky-400"
                            >
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {acc.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {formatAccountTypeLabel(acc.accountType)} ·{' '}
                                <span className="font-mono">{acc.baseCurrency}</span>
                              </div>
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <AccountStatusText status={acc.status} />
                          </td>
                          <td className="py-3 px-3">
                            <AccountHealthText
                              status={health.status}
                              usedPct={health.drawdownUsedPctOfLimit}
                            />
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {formatCurrencyAmount(ledger.startingBalance, acc.baseCurrency)}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-mono tabular-nums ${
                              ledger.realisedTradePnl !== null
                                ? Number(ledger.realisedTradePnl) > 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : Number(ledger.realisedTradePnl) < 0
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-slate-700 dark:text-slate-300'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {ledger.realisedTradePnl !== null
                              ? formatSignedCurrencyAmount(ledger.realisedTradePnl, acc.baseCurrency)
                              : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrencyAmount(ledger.effectiveCurrentBalance, acc.baseCurrency)}
                          </td>
                          <td className="py-3 px-4">
                            <ReconciliationStatusText status={ledger.reconciliationStatus} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Right Column: Portfolio Breakdown + Stage Status + Audit Trail */}
        <aside className="xl:col-span-4 space-y-6">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Portfolio Capital Breakdown
              </h2>
              <button
                type="button"
                onClick={() => setActiveRoute('workspaces')}
                className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
              >
                Manage
              </button>
            </div>
            {portfolioSummaries.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No portfolios or accounts assigned in this scope.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {portfolioSummaries.map((pf) => (
                  <div
                    key={pf.portfolioId ?? 'unassigned'}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {pf.portfolioName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {pf.accountCount} account{pf.accountCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 text-right shrink-0">
                      {pf.rollup.consolidatedCurrentBalance && pf.rollup.consolidatedCurrency
                        ? formatCurrencyAmount(
                            pf.rollup.consolidatedCurrentBalance,
                            pf.rollup.consolidatedCurrency
                          )
                        : pf.rollup.currencyBuckets.length > 0
                          ? pf.rollup.currencyBuckets
                              .map((b) =>
                                formatCurrencyAmount(b.effectiveCurrentBalanceTotal, b.currency)
                              )
                              .join(' · ')
                          : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Stage 2 Trade Engine Metrics
              </h2>
              <button
                type="button"
                onClick={() => setActiveRoute('journal')}
                className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline whitespace-nowrap"
              >
                Open Journal →
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Win Rate (Closed)</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {tradeSummary.winRatePct !== null
                    ? `${tradeSummary.winRatePct}% (${tradeSummary.winCount}W/${tradeSummary.lossCount}L/${tradeSummary.breakevenCount}BE)`
                    : 'No closed trades'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Average Net R</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {tradeSummary.averageNetR !== null
                    ? `${Number(tradeSummary.averageNetR) > 0 ? '+' : ''}${tradeSummary.averageNetR}R`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Profit Factor</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {tradeSummary.profitFactor ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Expectancy / Trade</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {tradeSummary.expectancy !== null && tradeSummary.consolidatedCurrency
                    ? formatSignedCurrencyAmount(
                        tradeSummary.expectancy,
                        tradeSummary.consolidatedCurrency
                      )
                    : '—'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">FX Rate Snapshots</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {fxRates.length} configured
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
              Derived in decimal precision from non-archived closed trades. Equity curves, session
              heatmaps, and playbooks unlock in Stage 3.
            </p>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Audit Log ({auditLogs.length})
            </h2>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Workspace activity events will appear here automatically.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-60 overflow-y-auto">
                {auditLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="py-2 text-xs">
                    <div className="text-slate-800 dark:text-slate-200">{log.summary}</div>
                    <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {log.action} · {log.createdAt.slice(0, 19).replace('T', ' ')} UTC
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {showCreateAccount && (
        <AccountFormModal
          onClose={() => setShowCreateAccount(false)}
          onSaved={(saved) => {
            setShowCreateAccount(false);
            setActiveAccountId(saved.id);
          }}
        />
      )}
    </div>
  );
}
