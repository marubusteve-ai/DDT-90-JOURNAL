import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import {
  TradeDirectionText,
  TradeOutcomeText,
  TradeStatusText,
} from '../../components/StatusText';
import {
  formatCurrencyAmount,
  formatSignedCurrencyAmount,
} from '../../domain/calculations/accountCalculations';
import {
  calculateAllTradeMetrics,
  calculateTradeAggregateSummary,
  filterAndSortTrades,
  paginateItems,
  resolveInstrumentForTrade,
  type SortDirection,
  type TradeFilterCriteria,
  type TradeSortField,
} from '../../domain/calculations/tradeCalculations';
import type { Trade, TradeDirection, TradeSession, TradeStatus } from '../../domain/models';
import { TRADE_SESSIONS } from '../../domain/validation/tradeValidation';
import { InstrumentSpecsPanel } from './InstrumentSpecsPanel';
import { TradeDetailModal } from './TradeDetailModal';
import { TradeFormModal } from './TradeFormModal';

export function TradeJournalPage() {
  const {
    activeWorkspace,
    accounts,
    activeAccountId,
    setActiveAccountId,
    instruments,
    trades,
    fxRates,
    setTradeArchived,
    isLoadingData,
    setActiveRoute,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'explorer' | 'instruments'>('explorer');

  // Explorer filters, sort & pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveScope, setArchiveScope] = useState<'active_only' | 'archived_only' | 'all'>(
    'active_only'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | TradeStatus>('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | TradeDirection>('all');
  const [symbolFilter, setSymbolFilter] = useState<string>('all');
  const [sessionFilter, setSessionFilter] = useState<'all' | TradeSession>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<TradeFilterCriteria['outcome']>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<TradeSortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [inspectedTradeId, setInspectedTradeId] = useState<string | null>(null);
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null);

  const accountById = useMemo(() => {
    const map = new Map<string, (typeof accounts)[number]>();
    for (const acc of accounts) map.set(acc.id, acc);
    return map;
  }, [accounts]);

  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of accounts) map.set(acc.id, acc.name);
    return map;
  }, [accounts]);

  const metricsById = useMemo(
    () => calculateAllTradeMetrics(trades, instruments, fxRates, accounts),
    [accounts, fxRates, instruments, trades]
  );

  const uniqueSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const t of trades) set.add(t.symbol);
    return Array.from(set).sort();
  }, [trades]);

  const filteredTrades = useMemo(
    () =>
      filterAndSortTrades(
        trades,
        metricsById,
        {
          searchQuery,
          accountId: activeAccountId,
          archiveScope,
          status: statusFilter,
          direction: directionFilter,
          symbol: symbolFilter,
          session: sessionFilter,
          outcome: outcomeFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
        { field: sortField, direction: sortDirection },
        accountNameMap
      ),
    [
      accountNameMap,
      activeAccountId,
      archiveScope,
      dateFrom,
      dateTo,
      directionFilter,
      metricsById,
      outcomeFilter,
      searchQuery,
      sessionFilter,
      sortDirection,
      sortField,
      statusFilter,
      symbolFilter,
      trades,
    ]
  );

  const pagination = useMemo(
    () => paginateItems(filteredTrades, page, pageSize),
    [filteredTrades, page, pageSize]
  );

  const targetCurrency = activeWorkspace?.baseCurrency ?? 'USD';

  const summary = useMemo(
    () => calculateTradeAggregateSummary(filteredTrades, metricsById, targetCurrency, fxRates),
    [filteredTrades, fxRates, metricsById, targetCurrency]
  );

  const hasCustomFilters =
    searchQuery.trim() !== '' ||
    archiveScope !== 'active_only' ||
    statusFilter !== 'all' ||
    directionFilter !== 'all' ||
    symbolFilter !== 'all' ||
    sessionFilter !== 'all' ||
    outcomeFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    activeAccountId !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setArchiveScope('active_only');
    setStatusFilter('all');
    setDirectionFilter('all');
    setSymbolFilter('all');
    setSessionFilter('all');
    setOutcomeFilter('all');
    setDateFrom('');
    setDateTo('');
    setActiveAccountId('all');
    setPage(1);
  };

  const handleSortClick = (field: TradeSortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'symbol' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const handleToggleArchive = async (trade: Trade) => {
    setBusyTradeId(trade.id);
    try {
      await setTradeArchived(trade.id, !trade.isArchived);
    } finally {
      setBusyTradeId(null);
    }
  };

  const inspectedTrade = useMemo(
    () => (inspectedTradeId ? trades.find((t) => t.id === inspectedTradeId) ?? null : null),
    [inspectedTradeId, trades]
  );

  const renderSortIcon = (field: TradeSortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-1" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50">
            Trade Journal &amp; Financial Engine
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Capture executions, inspect risk and R multiples, manage instrument specs, and sync
            realised P&amp;L to account ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-0.5"
            role="tablist"
            aria-label="Trade journal sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'explorer'}
              onClick={() => setActiveTab('explorer')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === 'explorer'
                  ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Trade Explorer ({trades.filter((t) => !t.isArchived).length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'instruments'}
              onClick={() => setActiveTab('instruments')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === 'instruments'
                  ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Instrument Specs ({instruments.length})
            </button>
          </div>

          <button
            type="button"
            disabled={accounts.length === 0}
            onClick={() => {
              setEditingTrade(null);
              setFormMode('create');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Trade</span>
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center space-y-3">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Create a trading account first
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Every trade links to a persisted trading account so P&amp;L, currency conversion, and
            ledger reconciliation remain strictly accurate.
          </p>
          <button
            type="button"
            onClick={() => setActiveRoute('accounts')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950"
          >
            Go to Accounts
          </button>
        </div>
      ) : activeTab === 'instruments' ? (
        <InstrumentSpecsPanel />
      ) : (
        <>
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Realised Net P&amp;L
              </div>
              <div
                data-testid="journal-kpi-net-pnl"
                className={`mt-1.5 font-mono tabular-nums text-lg font-semibold ${
                  summary.consolidatedNetPnl !== null
                    ? Number(summary.consolidatedNetPnl) > 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : Number(summary.consolidatedNetPnl) < 0
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {summary.consolidatedNetPnl !== null && summary.consolidatedCurrency
                  ? formatSignedCurrencyAmount(
                      summary.consolidatedNetPnl,
                      summary.consolidatedCurrency
                    )
                  : summary.closedWithPnlCount > 0
                    ? 'Multi-Currency'
                    : '—'}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Gross:{' '}
                {summary.consolidatedGrossPnl && summary.consolidatedCurrency
                  ? formatSignedCurrencyAmount(
                      summary.consolidatedGrossPnl,
                      summary.consolidatedCurrency
                    )
                  : '—'}
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Win Rate (Closed)
              </div>
              <div
                data-testid="journal-kpi-win-rate"
                className="mt-1.5 font-mono tabular-nums text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {summary.winRatePct !== null ? `${summary.winRatePct}%` : '—'}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {summary.winCount}W · {summary.lossCount}L · {summary.breakevenCount}BE
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Avg Net R / Expectancy
              </div>
              <div className="mt-1.5 font-mono tabular-nums text-lg font-semibold text-slate-900 dark:text-slate-100">
                {summary.averageNetR !== null
                  ? `${Number(summary.averageNetR) > 0 ? '+' : ''}${summary.averageNetR}R`
                  : '—'}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Exp:{' '}
                {summary.expectancy && summary.consolidatedCurrency
                  ? formatSignedCurrencyAmount(summary.expectancy, summary.consolidatedCurrency)
                  : '—'}
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Profit Factor / Costs
              </div>
              <div className="mt-1.5 font-mono tabular-nums text-lg font-semibold text-slate-900 dark:text-slate-100">
                {summary.profitFactor ?? '—'}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Costs:{' '}
                {summary.consolidatedCostsTotal && summary.consolidatedCurrency
                  ? formatCurrencyAmount(
                      summary.consolidatedCostsTotal,
                      summary.consolidatedCurrency
                    )
                  : '—'}
              </div>
            </div>

            <div className="col-span-2 lg:col-span-1 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Filtered Trades
              </div>
              <div
                data-testid="journal-kpi-count"
                className="mt-1.5 font-mono tabular-nums text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {filteredTrades.length}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {summary.closedCount} closed · {summary.openCount} open · {summary.draftCount} draft
                {summary.archivedCount > 0 ? ` · ${summary.archivedCount} arch` : ''}
              </div>
            </div>
          </div>

          {/* Search, Filter & Sort Toolbar */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <label htmlFor="journal-search" className="sr-only">
                  Search trades
                </label>
                <input
                  id="journal-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search symbol, ticket, setup, notes, tags, account..."
                  className="h-8 pl-8 pr-3 w-full text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
                  <label htmlFor="journal-sort-field" className="sr-only">
                    Sort trades by
                  </label>
                  <select
                    id="journal-sort-field"
                    value={sortField}
                    onChange={(e) => {
                      setSortField(e.target.value as TradeSortField);
                      setPage(1);
                    }}
                    className="h-8 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                  >
                    <option value="date">Sort: Date</option>
                    <option value="net_pnl">Sort: Net P&amp;L</option>
                    <option value="net_r">Sort: Net R</option>
                    <option value="initial_risk">Sort: Initial Risk</option>
                    <option value="symbol">Sort: Symbol</option>
                    <option value="status">Sort: Status</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  aria-label={`Sort direction: ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
                  className="h-8 px-2.5 inline-flex items-center gap-1 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-700 dark:text-slate-200"
                >
                  {sortDirection === 'asc' ? (
                    <>
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>Asc</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>Desc</span>
                    </>
                  )}
                </button>

                {hasCustomFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="h-8 px-2.5 text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline whitespace-nowrap"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              <div className="col-span-2 sm:col-span-2 lg:col-span-2 min-w-0">
                <label htmlFor="journal-account-filter" className="sr-only">
                  Filter by account
                </label>
                <select
                  id="journal-account-filter"
                  value={activeAccountId}
                  onChange={(e) => {
                    setActiveAccountId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-8 px-2 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Accounts</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="journal-archive-filter" className="sr-only">
                  Filter archive state
                </label>
                <select
                  id="journal-archive-filter"
                  value={archiveScope}
                  onChange={(e) => {
                    setArchiveScope(e.target.value as 'active_only' | 'archived_only' | 'all');
                    setPage(1);
                  }}
                  className="w-full h-8 px-2 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                >
                  <option value="active_only">Active Trades</option>
                  <option value="archived_only">Archived Only</option>
                  <option value="all">All (Inc. Archived)</option>
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="journal-status-filter" className="sr-only">
                  Filter by trade state
                </label>
                <select
                  id="journal-status-filter"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as 'all' | TradeStatus);
                    setPage(1);
                  }}
                  className="w-full h-8 px-2 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All States</option>
                  <option value="closed">Closed</option>
                  <option value="open">Open</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="journal-direction-filter" className="sr-only">
                  Filter by direction
                </label>
                <select
                  id="journal-direction-filter"
                  value={directionFilter}
                  onChange={(e) => {
                    setDirectionFilter(e.target.value as 'all' | TradeDirection);
                    setPage(1);
                  }}
                  className="w-full h-8 px-2 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                >
                  <option value="all">Long &amp; Short</option>
                  <option value="long">Long Only</option>
                  <option value="short">Short Only</option>
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="journal-symbol-filter" className="sr-only">
                  Filter by symbol
                </label>
                <select
                  id="journal-symbol-filter"
                  value={symbolFilter}
                  onChange={(e) => {
                    setSymbolFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-8 px-2 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Symbols</option>
                  {uniqueSymbols.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="journal-outcome-filter" className="sr-only">
                  Filter by outcome
                </label>
                <select
                  id="journal-outcome-filter"
                  value={outcomeFilter}
                  onChange={(e) => {
                    setOutcomeFilter(e.target.value as TradeFilterCriteria['outcome']);
                    setPage(1);
                  }}
                  className="w-full h-8 px-2 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Outcomes</option>
                  <option value="win">Wins</option>
                  <option value="loss">Losses</option>
                  <option value="breakeven">Breakeven</option>
                  <option value="open_or_draft">Open / Draft</option>
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="journal-session-filter" className="sr-only">
                  Filter by session
                </label>
                <select
                  id="journal-session-filter"
                  value={sessionFilter}
                  onChange={(e) => {
                    setSessionFilter(e.target.value as 'all' | TradeSession);
                    setPage(1);
                  }}
                  className="w-full h-8 px-2 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Sessions</option>
                  {TRADE_SESSIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 sm:col-span-1 lg:col-span-1 min-w-0 flex items-center gap-1.5">
                <label
                  htmlFor="journal-date-from"
                  className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0"
                >
                  From
                </label>
                <input
                  id="journal-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  title="From date"
                  className="min-w-0 flex-1 w-full h-8 px-2 text-[11px] font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="col-span-2 sm:col-span-1 lg:col-span-1 min-w-0 flex items-center gap-1.5">
                <label
                  htmlFor="journal-date-to"
                  className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0"
                >
                  To
                </label>
                <input
                  id="journal-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  title="To date"
                  className="min-w-0 flex-1 w-full h-8 px-2 text-[11px] font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Explorer Content */}
          {isLoadingData ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg">
              Loading trade journal records...
            </div>
          ) : trades.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                No trades logged in this workspace yet
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Log your first draft, open, or closed trade to activate central decimal risk, R
                multiple, and account ledger impact tracking.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingTrade(null);
                  setFormMode('create');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log First Trade</span>
              </button>
            </div>
          ) : pagination.totalItems === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg space-y-2.5">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                No trades match your current filters or search query.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {pagination.items.map((trade) => {
                  const m = metricsById.get(trade.id)!;
                  const acc = accountById.get(trade.accountId);
                  return (
                    <div key={trade.id} className="p-4 space-y-2.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setInspectedTradeId(trade.id)}
                          className="text-left min-w-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-sm text-slate-900 dark:text-slate-100">
                              {trade.symbol}
                            </span>
                            <TradeDirectionText direction={trade.direction} />
                            <TradeStatusText status={trade.status} isArchived={trade.isArchived} />
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {(trade.entryAt ?? trade.createdAt).slice(0, 16).replace('T', ' ')} ·{' '}
                            {acc?.name ?? 'Account'}
                          </div>
                        </button>
                        <div className="text-right shrink-0">
                          <div
                            className={`font-mono tabular-nums font-semibold ${
                              m.netPnl !== null
                                ? Number(m.netPnl) > 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : Number(m.netPnl) < 0
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-slate-900 dark:text-slate-100'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {m.netPnl !== null
                              ? formatSignedCurrencyAmount(m.netPnl, trade.accountCurrency)
                              : '—'}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                            {m.netRMultiple !== null
                              ? `${Number(m.netRMultiple) > 0 ? '+' : ''}${m.netRMultiple}R`
                              : m.outcome}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>
                          {trade.entryPrice ?? '—'} → {trade.exitPrice ?? 'Open'}
                        </span>
                        <span>
                          Risk:{' '}
                          {m.initialRiskAmount
                            ? formatCurrencyAmount(m.initialRiskAmount, trade.accountCurrency)
                            : '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/70">
                        <button
                          type="button"
                          onClick={() => setInspectedTradeId(trade.id)}
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTrade(trade);
                            setFormMode('edit');
                          }}
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busyTradeId === trade.id}
                          onClick={() => void handleToggleArchive(trade)}
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          {trade.isArchived ? 'Restore' : 'Archive'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop High-Density Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0E131D]">
                      <th className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleSortClick('date')}
                          className="hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                        >
                          Entry Date{renderSortIcon('date')}
                        </button>
                      </th>
                      <th className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleSortClick('symbol')}
                          className="hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                        >
                          Symbol / Setup{renderSortIcon('symbol')}
                        </button>
                      </th>
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3">Side / Qty</th>
                      <th className="py-2.5 px-3 font-mono">Entry → Exit</th>
                      <th className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSortClick('initial_risk')}
                          className="hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                        >
                          Init Risk{renderSortIcon('initial_risk')}
                        </button>
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSortClick('net_pnl')}
                          className="hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                        >
                          Net P&amp;L{renderSortIcon('net_pnl')}
                        </button>
                      </th>
                      <th className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSortClick('net_r')}
                          className="hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                        >
                          Net R{renderSortIcon('net_r')}
                        </button>
                      </th>
                      <th className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleSortClick('status')}
                          className="hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                        >
                          State / Outcome{renderSortIcon('status')}
                        </button>
                      </th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                    {pagination.items.map((trade) => {
                      const m = metricsById.get(trade.id)!;
                      const acc = accountById.get(trade.accountId);
                      const spec = resolveInstrumentForTrade(trade, instruments);
                      const dateLabel = (trade.entryAt ?? trade.exitAt ?? trade.createdAt)
                        .slice(0, 16)
                        .replace('T', ' ');
                      return (
                        <tr
                          key={trade.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                        >
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            <div>{dateLabel.slice(0, 10)}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">
                              {dateLabel.slice(11) || trade.timezone}
                              {trade.session ? ` · ${trade.session.replace('_', ' ')}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => setInspectedTradeId(trade.id)}
                              className="text-left group"
                            >
                              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                                {trade.symbol}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                {trade.setupTag ??
                                  (trade.externalTicketId ? `#${trade.externalTicketId}` : '—')}
                              </div>
                            </button>
                          </td>
                          <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                            <div className="truncate max-w-[150px]">{acc?.name ?? 'Account'}</div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {trade.accountCurrency}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div>
                              <TradeDirectionText direction={trade.direction} />
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                              {trade.quantity
                                ? `${trade.quantity} ${
                                    Number(trade.quantity) === 1
                                      ? (spec?.quantityUnit ?? 'units').replace(/s$/, '')
                                      : (spec?.quantityUnit ?? 'units')
                                  }`
                                : '—'}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            <div>{trade.entryPrice ?? '—'}</div>
                            <div className="text-slate-500 dark:text-slate-400">
                              → {trade.exitPrice ?? (trade.manualGrossPnl ? 'Manual' : 'Open')}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {m.initialRiskAmount !== null
                              ? formatCurrencyAmount(m.initialRiskAmount, trade.accountCurrency)
                              : '—'}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                              m.netPnl !== null
                                ? Number(m.netPnl) > 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : Number(m.netPnl) < 0
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-slate-900 dark:text-slate-100'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            <div>
                              {m.netPnl !== null
                                ? formatSignedCurrencyAmount(m.netPnl, trade.accountCurrency)
                                : '—'}
                            </div>
                            {m.totalCosts !== null && (
                              <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                                Cost {formatCurrencyAmount(m.totalCosts, trade.accountCurrency)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {m.netRMultiple !== null
                              ? `${Number(m.netRMultiple) > 0 ? '+' : ''}${m.netRMultiple}R`
                              : '—'}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div>
                              <TradeStatusText status={trade.status} isArchived={trade.isArchived} />
                            </div>
                            <div>
                              <TradeOutcomeText outcome={m.outcome} />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => setInspectedTradeId(trade.id)}
                                title={`Inspect ${trade.symbol} trade`}
                                aria-label={`Inspect ${trade.symbol} trade`}
                                className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTrade(trade);
                                  setFormMode('edit');
                                }}
                                title={`Edit ${trade.symbol} trade`}
                                aria-label={`Edit ${trade.symbol} trade`}
                                className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={busyTradeId === trade.id}
                                onClick={() => void handleToggleArchive(trade)}
                                title={
                                  trade.isArchived
                                    ? `Restore ${trade.symbol} trade`
                                    : `Archive ${trade.symbol} trade`
                                }
                                aria-label={
                                  trade.isArchived
                                    ? `Restore ${trade.symbol} trade`
                                    : `Archive ${trade.symbol} trade`
                                }
                                className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40"
                              >
                                {trade.isArchived ? (
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

              {/* Pagination Footer */}
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="font-mono">
                  Showing {pagination.startIndex + 1}–{pagination.endIndex} of {pagination.totalItems}{' '}
                  trade{pagination.totalItems === 1 ? '' : 's'}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="journal-page-size" className="text-[11px]">
                      Rows:
                    </label>
                    <select
                      id="journal-page-size"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="h-7 px-2 text-xs font-mono rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Previous trades page"
                      className="h-7 px-2 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-mono text-[11px]">
                      Page {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      aria-label="Next trades page"
                      className="h-7 px-2 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {formMode !== 'closed' && (
        <TradeFormModal
          existingTrade={formMode === 'edit' ? editingTrade : null}
          onClose={() => {
            setFormMode('closed');
            setEditingTrade(null);
          }}
        />
      )}

      {inspectedTrade && (
        <TradeDetailModal
          trade={inspectedTrade}
          metrics={metricsById.get(inspectedTrade.id)!}
          account={accountById.get(inspectedTrade.accountId) ?? null}
          instrument={resolveInstrumentForTrade(inspectedTrade, instruments)}
          onClose={() => setInspectedTradeId(null)}
          onEdit={(trd) => {
            setInspectedTradeId(null);
            setEditingTrade(trd);
            setFormMode('edit');
          }}
        />
      )}
    </div>
  );
}
