import React, { useMemo, useState } from 'react';
import {
  Archive,
  Camera,
  Check,
  Columns,
  Edit3,
  ListFilter,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import {
  AccountHealthText,
  AccountStatusText,
  formatAccountTypeLabel,
  ReconciliationStatusText,
} from '../../components/StatusText';
import {
  buildAccountComparisonRows,
  calculateAccountHealth,
  calculateAccountLedger,
  formatCurrencyAmount,
  formatSignedCurrencyAmount,
  groupAccounts,
  type AccountGroupBy,
} from '../../domain/calculations/accountCalculations';
import { calculateAccountTradeImpact } from '../../domain/calculations/tradeCalculations';
import type { Account, AccountStatus, CashTransaction } from '../../domain/models';
import { ACCOUNT_STATUSES } from '../../domain/validation/accountValidation';
import { AccountComparisonView } from './AccountComparisonView';
import { AccountFormModal } from './AccountFormModal';
import { CashTransactionModal } from './CashTransactionModal';
import { SnapshotReconcileModal } from './SnapshotReconcileModal';

const GROUP_OPTIONS: ReadonlyArray<{ value: AccountGroupBy; label: string }> = [
  { value: 'none', label: 'Flat List (No Grouping)' },
  { value: 'portfolio', label: 'Group by Portfolio' },
  { value: 'account_type', label: 'Group by Account Type' },
  { value: 'status', label: 'Group by Status' },
  { value: 'currency', label: 'Group by Currency' },
  { value: 'provider', label: 'Group by Broker / Prop Firm' },
];

export function AccountsPage() {
  const {
    activeWorkspace,
    accounts,
    portfolios,
    cashTransactions,
    balanceSnapshots,
    fxRates,
    instruments,
    trades,
    activeAccountId,
    setActiveAccountId,
    setActiveRoute,
    setAccountStatus,
    deleteAccount,
    deleteCashTransaction,
    isLoadingData,
  } = useApp();

  const [viewMode, setViewMode] = useState<'ledger' | 'compare'>('ledger');
  const [groupBy, setGroupBy] = useState<AccountGroupBy>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'non_archived' | 'all' | AccountStatus>('non_archived');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const [modalMode, setModalMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [cashModalAccount, setCashModalAccount] = useState<Account | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null);

  const [snapshotModalAccount, setSnapshotModalAccount] = useState<Account | null>(null);

  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [confirmDeleteAccountId, setConfirmDeleteAccountId] = useState<string | null>(null);
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);
  const [busyTxId, setBusyTxId] = useState<string | null>(null);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (statusFilter === 'non_archived' && acc.status === 'archived') return false;
      if (statusFilter !== 'non_archived' && statusFilter !== 'all' && acc.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        acc.name.toLowerCase().includes(q) ||
        (acc.brokerName ?? '').toLowerCase().includes(q) ||
        (acc.propFirmName ?? '').toLowerCase().includes(q) ||
        (acc.platformName ?? '').toLowerCase().includes(q) ||
        (acc.customCategory ?? '').toLowerCase().includes(q) ||
        acc.baseCurrency.toLowerCase().includes(q)
      );
    });
  }, [accounts, searchQuery, statusFilter]);

  const impactByAccountId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateAccountTradeImpact>>();
    for (const acc of accounts) {
      map.set(acc.id, calculateAccountTradeImpact(acc, trades, instruments, fxRates));
    }
    return map;
  }, [accounts, fxRates, instruments, trades]);

  const groupedBuckets = useMemo(
    () =>
      groupAccounts(
        filteredAccounts,
        cashTransactions,
        groupBy,
        portfolios,
        activeWorkspace?.baseCurrency,
        fxRates,
        trades,
        instruments
      ),
    [
      activeWorkspace?.baseCurrency,
      cashTransactions,
      filteredAccounts,
      fxRates,
      groupBy,
      instruments,
      portfolios,
      trades,
    ]
  );

  const comparisonRows = useMemo(
    () =>
      buildAccountComparisonRows(
        filteredAccounts,
        cashTransactions,
        portfolios,
        trades,
        instruments,
        fxRates
      ),
    [cashTransactions, filteredAccounts, fxRates, instruments, portfolios, trades]
  );

  const inspectedAccount = useMemo(() => {
    if (activeAccountId !== 'all') {
      const found = accounts.find((a) => a.id === activeAccountId);
      if (found) return found;
    }
    return filteredAccounts[0] ?? accounts[0] ?? null;
  }, [accounts, activeAccountId, filteredAccounts]);

  const inspectedImpact = useMemo(() => {
    if (!inspectedAccount) return null;
    return impactByAccountId.get(inspectedAccount.id) ?? null;
  }, [impactByAccountId, inspectedAccount]);

  const inspectedLedger = useMemo(() => {
    if (!inspectedAccount) return null;
    return calculateAccountLedger(inspectedAccount, cashTransactions, {
      tradeCount: inspectedImpact?.totalActiveTrades ?? 0,
      realisedTradePnl: inspectedImpact?.realisedNetPnl ?? null,
    });
  }, [cashTransactions, inspectedAccount, inspectedImpact]);

  const inspectedHealth = useMemo(() => {
    if (!inspectedAccount || !inspectedLedger) return null;
    return calculateAccountHealth(inspectedAccount, inspectedLedger);
  }, [inspectedAccount, inspectedLedger]);

  const inspectedTransactions = useMemo(() => {
    if (!inspectedAccount) return [];
    return cashTransactions.filter((t) => t.accountId === inspectedAccount.id);
  }, [cashTransactions, inspectedAccount]);

  const inspectedSnapshots = useMemo(() => {
    if (!inspectedAccount) return [];
    return balanceSnapshots.filter((s) => s.accountId === inspectedAccount.id);
  }, [balanceSnapshots, inspectedAccount]);

  const portfolioNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of portfolios) m.set(p.id, p.name);
    return m;
  }, [portfolios]);

  const handleToggleArchive = async (acc: Account) => {
    setBusyAccountId(acc.id);
    try {
      const nextStatus: AccountStatus = acc.status === 'archived' ? 'active' : 'archived';
      await setAccountStatus(acc.id, nextStatus);
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleConfirmDeleteAccount = async (accountId: string) => {
    setBusyAccountId(accountId);
    try {
      await deleteAccount(accountId);
      setCompareIds((prev) => prev.filter((id) => id !== accountId));
      setConfirmDeleteAccountId(null);
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleConfirmDeleteTransaction = async (txId: string) => {
    setBusyTxId(txId);
    try {
      await deleteCashTransaction(txId);
      setConfirmDeleteTxId(null);
    } finally {
      setBusyTxId(null);
    }
  };

  const toggleCompareSelection = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenCompare = () => {
    if (compareIds.length < 2 && filteredAccounts.length >= 2) {
      setCompareIds(filteredAccounts.slice(0, 4).map((a) => a.id));
    }
    setViewMode('compare');
  };

  const snapshotModalLedger = useMemo(() => {
    if (!snapshotModalAccount) return null;
    const impact = impactByAccountId.get(snapshotModalAccount.id);
    return calculateAccountLedger(snapshotModalAccount, cashTransactions, {
      tradeCount: impact?.totalActiveTrades ?? 0,
      realisedTradePnl: impact?.realisedNetPnl ?? null,
    });
  }, [cashTransactions, impactByAccountId, snapshotModalAccount]);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50">
            Trading Accounts
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Manage personal, evaluation, funded, and test accounts with independent cash ledgers,
            balance snapshots, reconciliation, and health monitoring.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-0.5"
            role="tablist"
            aria-label="Accounts view mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'ledger'}
              onClick={() => setViewMode('ledger')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'ledger'
                  ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ledger View
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'compare'}
              onClick={handleOpenCompare}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'compare'
                  ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Compare ({compareIds.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setModalMode('create');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {/* Filter & Grouping Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="accounts-search" className="sr-only">
              Search accounts
            </label>
            <input
              id="accounts-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name, broker, prop firm..."
              className="h-8 pl-8 pr-3 w-full sm:w-60 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>

          <label htmlFor="accounts-status-filter" className="sr-only">
            Filter by account status
          </label>
          <select
            id="accounts-status-filter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'non_archived' | 'all' | AccountStatus)
            }
            className="h-8 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200"
          >
            <option value="non_archived">
              Non-Archived ({accounts.filter((a) => a.status !== 'archived').length})
            </option>
            <option value="all">All Statuses ({accounts.length})</option>
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {viewMode === 'ledger' && (
            <div className="inline-flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
              <label htmlFor="accounts-group-by" className="sr-only">
                Group accounts by
              </label>
              <select
                id="accounts-group-by"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as AccountGroupBy)}
                className="h-8 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200"
              >
                {GROUP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          Showing {filteredAccounts.length} of {accounts.length} accounts
        </div>
      </div>

      {/* Loading / Empty / Main Content */}
      {isLoadingData ? (
        <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg">
          Loading account records...
        </div>
      ) : accounts.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            No trading accounts configured yet
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Create your first live, demo, prop-firm evaluation, or backtest account to track
            starting capital, cash movements, and verified balance snapshots.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setModalMode('create');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Account</span>
          </button>
        </div>
      ) : viewMode === 'compare' ? (
        <AccountComparisonView
          allRows={comparisonRows}
          selectedIds={compareIds}
          onToggleSelect={toggleCompareSelection}
          onSelectTopFour={() => setCompareIds(filteredAccounts.slice(0, 4).map((a) => a.id))}
          onClearSelection={() => setCompareIds([])}
          onInspect={(accountId) => {
            setActiveAccountId(accountId);
            setViewMode('ledger');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Accounts Data Grid (supports flat & grouped views) */}
          <div className="xl:col-span-8 space-y-4">
            {filteredAccounts.length === 0 ? (
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No accounts match your current filters.
              </div>
            ) : (
              groupedBuckets.map((bucket) => (
                <div
                  key={bucket.key}
                  className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
                >
                  {groupBy !== 'none' && (
                    <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E131D] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {bucket.label}
                        <span className="ml-2 font-mono font-normal text-[11px] text-slate-500 dark:text-slate-400">
                          {bucket.accounts.length} account{bucket.accounts.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                        {bucket.subtotalCurrentBalance !== null && bucket.subtotalCurrency
                          ? `Subtotal: ${formatCurrencyAmount(
                              bucket.subtotalCurrentBalance,
                              bucket.subtotalCurrency
                            )}`
                          : `Multi-currency (${bucket.currencies.join(', ')})`}
                      </div>
                    </div>
                  )}

                  {/* Mobile Compact Card List */}
                  <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                    {bucket.accounts.map((acc) => {
                      const impact = impactByAccountId.get(acc.id);
                      const ledger = calculateAccountLedger(acc, cashTransactions, {
                        tradeCount: impact?.totalActiveTrades ?? 0,
                        realisedTradePnl: impact?.realisedNetPnl ?? null,
                      });
                      const health = calculateAccountHealth(acc, ledger);
                      const isSelected = activeAccountId === acc.id;
                      const isCheckedForCompare = compareIds.includes(acc.id);
                      return (
                        <div
                          key={acc.id}
                          className={`p-4 space-y-3 ${
                            isSelected ? 'bg-sky-50/70 dark:bg-sky-950/20' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isCheckedForCompare}
                                onChange={() => toggleCompareSelection(acc.id)}
                                aria-label={`Select ${acc.name} for comparison`}
                                className="mt-1 rounded border-slate-300 dark:border-slate-700"
                              />
                              <button
                                type="button"
                                onClick={() => setActiveAccountId(isSelected ? 'all' : acc.id)}
                                className="text-left min-w-0"
                              >
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {acc.name}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {formatAccountTypeLabel(acc.accountType)} · {acc.baseCurrency}
                                </div>
                              </button>
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

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Current Balance
                              </div>
                              <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                                {formatCurrencyAmount(ledger.effectiveCurrentBalance, acc.baseCurrency)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Reconciliation
                              </div>
                              <ReconciliationStatusText status={ledger.reconciliationStatus} />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/70">
                            <button
                              type="button"
                              onClick={() => setSnapshotModalAccount(acc)}
                              className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              Snapshot
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTransaction(null);
                                setCashModalAccount(acc);
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              Cash
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAccount(acc);
                                setModalMode('edit');
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={busyAccountId === acc.id}
                              onClick={() => void handleToggleArchive(acc)}
                              className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40"
                            >
                              {acc.status === 'archived' ? 'Restore' : 'Archive'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop High-Density Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0E131D]">
                          <th className="py-2.5 pl-3 pr-1 w-7">
                            <span className="sr-only">Compare</span>
                          </th>
                          <th className="py-2.5 px-2.5">Account</th>
                          <th className="py-2.5 px-2.5">Status / Health</th>
                          <th className="py-2.5 px-2.5 text-right">Starting</th>
                          <th className="py-2.5 px-2.5 text-right">Net Cash</th>
                          <th className="py-2.5 px-2.5 text-right">Current</th>
                          <th className="py-2.5 px-2.5">Reconcile</th>
                          <th className="py-2.5 pl-2 pr-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs">
                        {bucket.accounts.map((acc) => {
                          const impact = impactByAccountId.get(acc.id);
                          const ledger = calculateAccountLedger(acc, cashTransactions, {
                            tradeCount: impact?.totalActiveTrades ?? 0,
                            realisedTradePnl: impact?.realisedNetPnl ?? null,
                          });
                          const health = calculateAccountHealth(acc, ledger);
                          const isSelected = activeAccountId === acc.id;
                          const isCheckedForCompare = compareIds.includes(acc.id);
                          return (
                            <tr
                              key={acc.id}
                              className={`transition-colors ${
                                isSelected
                                  ? 'bg-sky-50/70 dark:bg-sky-950/20'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'
                              }`}
                            >
                              <td className="py-3 pl-3 pr-1 align-middle">
                                <input
                                  type="checkbox"
                                  checked={isCheckedForCompare}
                                  onChange={() => toggleCompareSelection(acc.id)}
                                  aria-label={`Select ${acc.name} for comparison`}
                                  className="rounded border-slate-300 dark:border-slate-700"
                                />
                              </td>
                              <td className="py-3 px-2.5">
                                <button
                                  type="button"
                                  onClick={() => setActiveAccountId(isSelected ? 'all' : acc.id)}
                                  className="text-left group"
                                >
                                  <div className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 flex items-center gap-1.5">
                                    <span>{acc.name}</span>
                                    {isSelected && (
                                      <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    <span>{formatAccountTypeLabel(acc.accountType)}</span>
                                    {(acc.propFirmName || acc.brokerName) && (
                                      <>
                                        <span className="mx-1" aria-hidden="true">
                                          ·
                                        </span>
                                        <span>{acc.propFirmName ?? acc.brokerName}</span>
                                      </>
                                    )}
                                    <span className="mx-1" aria-hidden="true">
                                      ·
                                    </span>
                                    <span className="font-mono">{acc.baseCurrency}</span>
                                  </div>
                                </button>
                              </td>
                              <td className="py-3 px-2.5">
                                <div className="leading-tight space-y-0.5">
                                  <div>
                                    <AccountStatusText status={acc.status} />
                                  </div>
                                  <div>
                                    <AccountHealthText
                                      status={health.status}
                                      usedPct={health.drawdownUsedPctOfLimit}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                                {formatCurrencyAmount(ledger.startingBalance, acc.baseCurrency)}
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                                {formatSignedCurrencyAmount(ledger.netCashFlow, acc.baseCurrency)}
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">
                                {formatCurrencyAmount(ledger.effectiveCurrentBalance, acc.baseCurrency)}
                              </td>
                              <td className="py-3 px-2.5">
                                <ReconciliationStatusText status={ledger.reconciliationStatus} />
                              </td>
                              <td className="py-3 pl-2 pr-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setSnapshotModalAccount(acc)}
                                    title={`Record balance snapshot for ${acc.name}`}
                                    aria-label={`Record balance snapshot for ${acc.name}`}
                                    className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTransaction(null);
                                      setCashModalAccount(acc);
                                    }}
                                    title={`Record cash movement for ${acc.name}`}
                                    aria-label={`Record cash movement for ${acc.name}`}
                                    className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                                  >
                                    <Wallet className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingAccount(acc);
                                      setModalMode('edit');
                                    }}
                                    title={`Edit ${acc.name}`}
                                    aria-label={`Edit ${acc.name}`}
                                    className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyAccountId === acc.id}
                                    onClick={() => void handleToggleArchive(acc)}
                                    title={
                                      acc.status === 'archived'
                                        ? `Restore ${acc.name}`
                                        : `Archive ${acc.name}`
                                    }
                                    aria-label={
                                      acc.status === 'archived'
                                        ? `Restore ${acc.name}`
                                        : `Archive ${acc.name}`
                                    }
                                    className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40"
                                  >
                                    {acc.status === 'archived' ? (
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    ) : (
                                      <Archive className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selected Account Ledger, Health & Reconciliation Inspector */}
          <aside className="xl:col-span-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
            {inspectedAccount && inspectedLedger && inspectedHealth ? (
              <>
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Account Ledger Inspector
                    </div>
                    <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                      {inspectedAccount.name}
                    </h2>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <AccountStatusText status={inspectedAccount.status} />
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatAccountTypeLabel(inspectedAccount.accountType)}
                        {inspectedAccount.customCategory
                          ? ` (${inspectedAccount.customCategory})`
                          : ''}
                      </span>
                      {inspectedAccount.portfolioId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {portfolioNameMap.get(inspectedAccount.portfolioId) ?? 'Portfolio'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccount(inspectedAccount);
                        setModalMode('edit');
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Account Health Foundation */}
                <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Account Health
                    </span>
                    <AccountHealthText
                      status={inspectedHealth.status}
                      usedPct={inspectedHealth.drawdownUsedPctOfLimit}
                    />
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {inspectedHealth.summary}
                  </p>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                    Basis: {inspectedHealth.basis.replace(/_/g, ' ')}
                    {inspectedHealth.drawdownFromStart !== null
                      ? ` · Drawdown: ${formatCurrencyAmount(
                          inspectedHealth.drawdownFromStart,
                          inspectedAccount.baseCurrency
                        )}`
                      : ''}
                  </div>
                </div>

                {/* Reconciliation Breakdown */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Balance Reconciliation
                    </span>
                    <button
                      type="button"
                      onClick={() => setSnapshotModalAccount(inspectedAccount)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Record Snapshot</span>
                    </button>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/70">
                    <span className="text-slate-600 dark:text-slate-400">Starting Balance</span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatCurrencyAmount(
                        inspectedLedger.startingBalance,
                        inspectedAccount.baseCurrency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/70">
                    <span className="text-slate-600 dark:text-slate-400">Net Cash Movements</span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatSignedCurrencyAmount(
                        inspectedLedger.netCashFlow,
                        inspectedAccount.baseCurrency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/70 gap-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      Realised Trade P&amp;L
                      {inspectedLedger.tradeCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAccountId(inspectedAccount.id);
                            setActiveRoute('journal');
                          }}
                          className="ml-1.5 text-[11px] text-sky-700 dark:text-sky-400 hover:underline"
                        >
                          ({inspectedLedger.tradeCount} trade{inspectedLedger.tradeCount === 1 ? '' : 's'})
                        </button>
                      )}
                    </span>
                    <span
                      className={`font-mono tabular-nums ${
                        inspectedLedger.realisedTradePnl !== null
                          ? Number(inspectedLedger.realisedTradePnl) > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : Number(inspectedLedger.realisedTradePnl) < 0
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {inspectedLedger.realisedTradePnl !== null
                        ? formatSignedCurrencyAmount(
                            inspectedLedger.realisedTradePnl,
                            inspectedAccount.baseCurrency
                          )
                        : '0 closed trades'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/70">
                    <span className="text-slate-600 dark:text-slate-400">
                      Calculated Ledger Balance
                    </span>
                    <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrencyAmount(
                        inspectedLedger.calculatedLedgerBalance,
                        inspectedAccount.baseCurrency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/70">
                    <span className="text-slate-600 dark:text-slate-400">Verified Snapshot</span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {inspectedLedger.verifiedBalanceSnapshot !== null
                        ? formatCurrencyAmount(
                            inspectedLedger.verifiedBalanceSnapshot,
                            inspectedAccount.baseCurrency
                          )
                        : 'Not recorded'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400">
                      Reconciliation Status
                    </span>
                    <span className="flex items-center gap-2">
                      <ReconciliationStatusText status={inspectedLedger.reconciliationStatus} />
                      {inspectedLedger.reconciliationDelta !== null && (
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          (
                          {formatSignedCurrencyAmount(
                            inspectedLedger.reconciliationDelta,
                            inspectedAccount.baseCurrency
                          )}
                          )
                        </span>
                      )}
                    </span>
                  </div>
                  {inspectedAccount.reconciliationNotes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      {inspectedAccount.reconciliationNotes}
                    </p>
                  )}
                </div>

                {/* Snapshot History */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Snapshot History ({inspectedSnapshots.length})
                    </span>
                  </div>
                  {inspectedSnapshots.length === 0 ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      No historical snapshot entries logged yet. Click &ldquo;Record Snapshot&rdquo;
                      to audit balance against ledger.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/70 max-h-40 overflow-y-auto">
                      {inspectedSnapshots.map((snap) => (
                        <div key={snap.id} className="py-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrencyAmount(snap.balance, inspectedAccount.baseCurrency)}
                              {snap.equity
                                ? ` · Eq ${formatCurrencyAmount(
                                    snap.equity,
                                    inspectedAccount.baseCurrency
                                  )}`
                                : ''}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                              {snap.capturedAt}
                              {snap.notes ? ` · ${snap.notes}` : ''}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <ReconciliationStatusText status={snap.reconciliationStatus} />
                            <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                              {formatSignedCurrencyAmount(
                                snap.reconciliationDelta,
                                inspectedAccount.baseCurrency
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Risk & Prop Parameters Summary */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Rule &amp; Provider Details
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="text-slate-500 dark:text-slate-400">Broker / Prop / Platform</div>
                    <div className="text-right text-slate-800 dark:text-slate-200 truncate">
                      {[
                        inspectedAccount.propFirmName,
                        inspectedAccount.brokerName,
                        inspectedAccount.platformName,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">Drawdown Mode</div>
                    <div className="text-right font-mono text-slate-800 dark:text-slate-200">
                      {inspectedAccount.drawdownMode}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">Profit Target</div>
                    <div className="text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {inspectedHealth.profitTargetResolved
                        ? formatCurrencyAmount(
                            inspectedHealth.profitTargetResolved,
                            inspectedAccount.baseCurrency
                          )
                        : '—'}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">Daily Loss Limit</div>
                    <div className="text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {inspectedAccount.maxDailyLossAmount
                        ? formatCurrencyAmount(
                            inspectedAccount.maxDailyLossAmount,
                            inspectedAccount.baseCurrency
                          )
                        : inspectedAccount.maxDailyLossPct
                          ? `${inspectedAccount.maxDailyLossPct}%`
                          : '—'}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">Overall Loss Limit</div>
                    <div className="text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {inspectedHealth.overallLossLimitResolved
                        ? formatCurrencyAmount(
                            inspectedHealth.overallLossLimitResolved,
                            inspectedAccount.baseCurrency
                          )
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Cash Movements History (Full CRUD) */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Cash Ledger ({inspectedTransactions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTransaction(null);
                        setCashModalAccount(inspectedAccount);
                      }}
                      className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                    >
                      + Record Movement
                    </button>
                  </div>

                  {inspectedTransactions.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No deposits, withdrawals, payouts, or fees recorded on this account yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/70 max-h-60 overflow-y-auto">
                      {inspectedTransactions.map((tx) => (
                        <div key={tx.id} className="py-2 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                                {tx.type}
                                {tx.type === 'payout' && tx.splitPct ? (
                                  <span className="ml-1.5 font-mono text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                    ({tx.splitPct}% split)
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                {tx.occurredAt}
                                {tx.notes ? ` · ${tx.notes}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                                {tx.type === 'withdrawal' ||
                                tx.type === 'payout' ||
                                tx.type === 'fee'
                                  ? `-${formatCurrencyAmount(tx.amount, tx.currency)}`
                                  : `+${formatCurrencyAmount(tx.amount, tx.currency)}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTransaction(tx);
                                  setCashModalAccount(inspectedAccount);
                                }}
                                aria-label={`Edit cash movement from ${tx.occurredAt}`}
                                className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteTxId((cur) => (cur === tx.id ? null : tx.id))
                                }
                                aria-label={`Delete cash movement from ${tx.occurredAt}`}
                                className="p-1 rounded text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {confirmDeleteTxId === tx.id && (
                            <div className="flex items-center justify-between gap-2 p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 text-[11px]">
                              <span className="text-rose-800 dark:text-rose-300">
                                Remove movement from ledger?
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTxId(null)}
                                  className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={busyTxId === tx.id}
                                  onClick={() => void handleConfirmDeleteTransaction(tx.id)}
                                  className="px-2 py-0.5 rounded bg-rose-600 text-white disabled:opacity-50"
                                >
                                  {busyTxId === tx.id ? 'Removing...' : 'Confirm'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Account Lifecycle Footer (Archive / Delete with Inline Confirm) */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={busyAccountId === inspectedAccount.id}
                      onClick={() => void handleToggleArchive(inspectedAccount)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                    >
                      {inspectedAccount.status === 'archived' ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore Account</span>
                        </>
                      ) : (
                        <>
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive Account</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDeleteAccountId((cur) =>
                          cur === inspectedAccount.id ? null : inspectedAccount.id
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-rose-200 dark:border-rose-900/70 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {confirmDeleteAccountId === inspectedAccount.id && (
                    <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 space-y-2">
                      <p className="text-[11px] text-rose-800 dark:text-rose-200">
                        Permanently delete <strong>{inspectedAccount.name}</strong> and its{' '}
                        {inspectedTransactions.length} cash movement(s),{' '}
                        {inspectedSnapshots.length} snapshot(s), and{' '}
                        {trades.filter((t) => t.accountId === inspectedAccount.id).length} trade(s)?
                        This cannot be undone.
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAccountId(null)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busyAccountId === inspectedAccount.id}
                          onClick={() => void handleConfirmDeleteAccount(inspectedAccount.id)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded bg-rose-600 text-white disabled:opacity-50"
                        >
                          {busyAccountId === inspectedAccount.id
                            ? 'Deleting...'
                            : 'Confirm Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Select an account to inspect its ledger, health, and reconciliation details.
              </div>
            )}
          </aside>
        </div>
      )}

      {modalMode !== 'closed' && (
        <AccountFormModal
          existingAccount={modalMode === 'edit' ? editingAccount : null}
          onClose={() => setModalMode('closed')}
          onSaved={(saved) => {
            setModalMode('closed');
            setActiveAccountId(saved.id);
          }}
        />
      )}

      {cashModalAccount && (
        <CashTransactionModal
          account={cashModalAccount}
          existingTransaction={editingTransaction}
          onClose={() => {
            setCashModalAccount(null);
            setEditingTransaction(null);
          }}
        />
      )}

      {snapshotModalAccount && snapshotModalLedger && (
        <SnapshotReconcileModal
          account={snapshotModalAccount}
          ledger={snapshotModalLedger}
          onClose={() => setSnapshotModalAccount(null)}
        />
      )}
    </div>
  );
}
