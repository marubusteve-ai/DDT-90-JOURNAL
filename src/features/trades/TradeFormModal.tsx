import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { TradeOutcomeText } from '../../components/StatusText';
import {
  calculateAccountLedger,
  formatCurrencyAmount,
  formatSignedCurrencyAmount,
} from '../../domain/calculations/accountCalculations';
import {
  calculateAccountTradeImpact,
  calculateTradeMetrics,
  resolveInstrumentForTrade,
} from '../../domain/calculations/tradeCalculations';
import type {
  InstrumentSpecification,
  Trade,
  TradeDirection,
  TradeEntryType,
  TradeSession,
  TradeStatus,
} from '../../domain/models';
import {
  MARKET_CONDITION_OPTIONS,
  TIMEFRAME_OPTIONS,
  TRADE_DIRECTIONS,
  TRADE_ENTRY_TYPES,
  TRADE_SESSIONS,
  TRADE_STATUSES,
  tradeInputSchema,
} from '../../domain/validation/tradeValidation';
import { InstrumentFormModal } from './InstrumentFormModal';

interface TradeFormModalProps {
  existingTrade?: Trade | null;
  onClose: () => void;
  onSaved?: (trade: Trade) => void;
}

function cleanDecimalForPreview(raw: string, allowSigned = false): string | null {
  const t = raw.trim();
  if (!t) return null;
  const re = allowSigned ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/;
  if (!re.test(t)) return null;
  if (!allowSigned && Number(t) <= 0) return null;
  return t;
}

export function TradeFormModal({ existingTrade, onClose, onSaved }: TradeFormModalProps) {
  const {
    activeWorkspace,
    accounts,
    activeAccountId,
    cashTransactions,
    instruments,
    trades,
    fxRates,
    createTrade,
    updateTrade,
  } = useApp();

  const isEdit = Boolean(existingTrade);

  const defaultAccount = useMemo(() => {
    if (existingTrade) {
      return accounts.find((a) => a.id === existingTrade.accountId) ?? accounts[0] ?? null;
    }
    if (activeAccountId !== 'all') {
      const scoped = accounts.find((a) => a.id === activeAccountId);
      if (scoped) return scoped;
    }
    return accounts.find((a) => a.status === 'active') ?? accounts[0] ?? null;
  }, [accounts, activeAccountId, existingTrade]);

  const [accountId, setAccountId] = useState(defaultAccount?.id ?? '');
  const [symbol, setSymbol] = useState(existingTrade?.symbol ?? '');
  const [instrumentId, setInstrumentId] = useState(existingTrade?.instrumentId ?? '');
  const [direction, setDirection] = useState<TradeDirection>(existingTrade?.direction ?? 'long');
  const [status, setStatus] = useState<TradeStatus>(existingTrade?.status ?? 'closed');
  const [isArchived, setIsArchived] = useState(existingTrade?.isArchived ?? false);
  const [externalTicketId, setExternalTicketId] = useState(existingTrade?.externalTicketId ?? '');
  const [timezone, setTimezone] = useState(
    existingTrade?.timezone ?? defaultAccount?.timezone ?? activeWorkspace?.timezone ?? 'UTC'
  );
  const [session, setSession] = useState<TradeSession | ''>(existingTrade?.session ?? '');
  const [timeframes, setTimeframes] = useState<string[]>(existingTrade?.timeframes ?? []);
  const [accountBalanceSnapshot, setAccountBalanceSnapshot] = useState(
    existingTrade?.accountBalanceSnapshot ?? ''
  );

  // Entry Data
  const [entryAt, setEntryAt] = useState(existingTrade?.entryAt ?? new Date().toISOString().slice(0, 16));
  const [entryPrice, setEntryPrice] = useState(existingTrade?.entryPrice ?? '');
  const [quantity, setQuantity] = useState(existingTrade?.quantity ?? '');
  const [entryType, setEntryType] = useState<TradeEntryType | ''>(existingTrade?.entryType ?? 'market');
  const [leverage, setLeverage] = useState(existingTrade?.leverage ?? '');
  const [marginUsed, setMarginUsed] = useState(existingTrade?.marginUsed ?? '');
  const [entryRationale, setEntryRationale] = useState(existingTrade?.entryRationale ?? '');

  // Risk Management (Initial vs Actual)
  const [initialStopPrice, setInitialStopPrice] = useState(existingTrade?.initialStopPrice ?? '');
  const [actualStopPrice, setActualStopPrice] = useState(existingTrade?.actualStopPrice ?? '');
  const [plannedTargetPrice, setPlannedTargetPrice] = useState(
    existingTrade?.plannedTargetPrice ?? ''
  );
  const [plannedRiskAmount, setPlannedRiskAmount] = useState(
    existingTrade?.plannedRiskAmount ?? ''
  );
  const [plannedRiskPct, setPlannedRiskPct] = useState(existingTrade?.plannedRiskPct ?? '');
  const [actualRiskAmount, setActualRiskAmount] = useState(existingTrade?.actualRiskAmount ?? '');

  // Exit, FX & Execution Costs
  const [exitAt, setExitAt] = useState(existingTrade?.exitAt ?? '');
  const [exitPrice, setExitPrice] = useState(existingTrade?.exitPrice ?? '');
  const [exitQuantity, setExitQuantity] = useState(existingTrade?.exitQuantity ?? '');
  const [exitReason, setExitReason] = useState(existingTrade?.exitReason ?? '');
  const [manualGrossPnl, setManualGrossPnl] = useState(existingTrade?.manualGrossPnl ?? '');
  const [fxConversionRate, setFxConversionRate] = useState(existingTrade?.fxConversionRate ?? '');
  const [commission, setCommission] = useState(existingTrade?.commission ?? '');
  const [swap, setSwap] = useState(existingTrade?.swap ?? '');
  const [fees, setFees] = useState(existingTrade?.fees ?? '');
  const [slippage, setSlippage] = useState(existingTrade?.slippage ?? '');
  const [spread, setSpread] = useState(existingTrade?.spread ?? '');

  // Qualitative Context & Notes
  const [setupTag, setSetupTag] = useState(existingTrade?.setupTag ?? '');
  const [marketConditions, setMarketConditions] = useState<string[]>(
    existingTrade?.marketConditions ?? []
  );
  const [tagsText, setTagsText] = useState(existingTrade?.tags.join(', ') ?? '');
  const [entryNotes, setEntryNotes] = useState(existingTrade?.entryNotes ?? '');
  const [reviewNotes, setReviewNotes] = useState(existingTrade?.reviewNotes ?? '');

  const [showAddInstrument, setShowAddInstrument] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId]
  );

  const selectedAccountBalance = useMemo(() => {
    if (!selectedAccount) return null;
    const impact = calculateAccountTradeImpact(selectedAccount, trades, instruments, fxRates);
    const ledger = calculateAccountLedger(selectedAccount, cashTransactions, {
      tradeCount: impact.totalActiveTrades,
      realisedTradePnl: impact.realisedNetPnl,
    });
    return ledger.effectiveCurrentBalance;
  }, [cashTransactions, fxRates, instruments, selectedAccount, trades]);

  const resolvedInstrument = useMemo<InstrumentSpecification | null>(() => {
    return resolveInstrumentForTrade(
      { instrumentId: instrumentId || null, symbol: symbol.trim().toUpperCase() },
      instruments
    );
  }, [instrumentId, instruments, symbol]);

  const previewMetrics = useMemo(() => {
    const accountCurrency = selectedAccount?.baseCurrency ?? activeWorkspace?.baseCurrency ?? 'USD';
    const draftTrade: Trade = {
      id: existingTrade?.id ?? 'preview',
      workspaceId: activeWorkspace?.id ?? 'preview',
      portfolioId: selectedAccount?.portfolioId ?? null,
      accountId: selectedAccount?.id ?? 'preview',
      ownerId: 'preview',
      externalTicketId: externalTicketId || null,
      symbol: symbol.trim().toUpperCase() || 'SYMBOL',
      instrumentId: resolvedInstrument?.id ?? (instrumentId || null),
      direction,
      status,
      isArchived,
      session: session || null,
      timeframes,
      timezone: timezone || 'UTC',
      accountCurrency,
      accountBalanceSnapshot: cleanDecimalForPreview(accountBalanceSnapshot, false),
      entryAt: entryAt || null,
      entryPrice: cleanDecimalForPreview(entryPrice, false),
      quantity: cleanDecimalForPreview(quantity, false),
      entryType: entryType || null,
      leverage: cleanDecimalForPreview(leverage, false),
      marginUsed: cleanDecimalForPreview(marginUsed, false),
      entryRationale: entryRationale || null,
      initialStopPrice: cleanDecimalForPreview(initialStopPrice, false),
      actualStopPrice: cleanDecimalForPreview(actualStopPrice, false),
      plannedTargetPrice: cleanDecimalForPreview(plannedTargetPrice, false),
      plannedRiskAmount: cleanDecimalForPreview(plannedRiskAmount, false),
      plannedRiskPct: cleanDecimalForPreview(plannedRiskPct, false),
      actualRiskAmount: cleanDecimalForPreview(actualRiskAmount, false),
      exitAt: exitAt || null,
      exitPrice: cleanDecimalForPreview(exitPrice, false),
      exitQuantity: cleanDecimalForPreview(exitQuantity, false),
      exitReason: exitReason || null,
      manualGrossPnl: cleanDecimalForPreview(manualGrossPnl, true),
      fxConversionRate: cleanDecimalForPreview(fxConversionRate, false),
      playbookId: null,
      setupId: null,
      setupTag: setupTag || null,
      commission: cleanDecimalForPreview(commission, true),
      swap: cleanDecimalForPreview(swap, true),
      fees: cleanDecimalForPreview(fees, true),
      slippage: cleanDecimalForPreview(slippage, true),
      spread: cleanDecimalForPreview(spread, false),
      marketConditions,
      entryNotes: entryNotes || null,
      reviewNotes: reviewNotes || null,
      tags: [],
      createdAt: '',
      updatedAt: '',
    };

    return calculateTradeMetrics(draftTrade, resolvedInstrument, fxRates, {
      accountBalanceFallback: selectedAccount?.startingBalance ?? null,
    });
  }, [
    accountBalanceSnapshot,
    activeWorkspace?.baseCurrency,
    activeWorkspace?.id,
    actualRiskAmount,
    actualStopPrice,
    commission,
    direction,
    entryAt,
    entryNotes,
    entryPrice,
    entryRationale,
    entryType,
    existingTrade?.id,
    exitAt,
    exitPrice,
    exitQuantity,
    exitReason,
    externalTicketId,
    fees,
    fxConversionRate,
    fxRates,
    initialStopPrice,
    instrumentId,
    isArchived,
    leverage,
    manualGrossPnl,
    marginUsed,
    marketConditions,
    plannedRiskAmount,
    plannedRiskPct,
    plannedTargetPrice,
    quantity,
    resolvedInstrument,
    reviewNotes,
    selectedAccount,
    session,
    setupTag,
    slippage,
    spread,
    status,
    swap,
    symbol,
    timeframes,
    timezone,
  ]);

  const toggleListValue = (
    val: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => (prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]));
  };

  const handleSymbolChange = (nextRaw: string) => {
    const upper = nextRaw.toUpperCase();
    setSymbol(upper);
    const match = instruments.find((i) => i.symbol.toUpperCase() === upper.trim());
    if (match) {
      setInstrumentId(match.id);
    } else if (instrumentId) {
      const linked = instruments.find((i) => i.id === instrumentId);
      if (linked && linked.symbol.toUpperCase() !== upper.trim()) {
        setInstrumentId('');
      }
    }
  };

  const submitWithStatus = async (targetStatus: TradeStatus) => {
    setFieldErrors({});
    setSubmitError(null);

    const parsedTags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const effectiveInstrumentId =
      instrumentId || resolvedInstrument?.id || null;

    const payload = {
      accountId,
      instrumentId: effectiveInstrumentId,
      externalTicketId: externalTicketId || null,
      symbol,
      direction,
      status: targetStatus,
      isArchived,
      session: session || null,
      timeframes,
      timezone: timezone || 'UTC',
      accountBalanceSnapshot: accountBalanceSnapshot || null,
      entryAt: entryAt || null,
      entryPrice: entryPrice || null,
      quantity: quantity || null,
      entryType: entryType || null,
      leverage: leverage || null,
      marginUsed: marginUsed || null,
      entryRationale: entryRationale || null,
      initialStopPrice: initialStopPrice || null,
      actualStopPrice: actualStopPrice || null,
      plannedTargetPrice: plannedTargetPrice || null,
      plannedRiskAmount: plannedRiskAmount || null,
      plannedRiskPct: plannedRiskPct || null,
      actualRiskAmount: actualRiskAmount || null,
      exitAt: exitAt || null,
      exitPrice: exitPrice || null,
      exitQuantity: exitQuantity || null,
      exitReason: exitReason || null,
      manualGrossPnl: manualGrossPnl || null,
      fxConversionRate: fxConversionRate || null,
      setupTag: setupTag || null,
      commission: commission || null,
      swap: swap || null,
      fees: fees || null,
      slippage: slippage || null,
      spread: spread || null,
      marketConditions,
      entryNotes: entryNotes || null,
      reviewNotes: reviewNotes || null,
      tags: parsedTags,
    };

    const parsed = tradeInputSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const saved =
        isEdit && existingTrade
          ? await updateTrade(existingTrade.id, parsed.data)
          : await createTrade(parsed.data);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save trade record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-form-title"
    >
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2
              id="trade-form-title"
              className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {isEdit ? `Edit Trade: ${existingTrade?.symbol}` : 'Log Trade Execution'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Optional-by-default fields with live central decimal calculation preview for risk,
              costs, P&amp;L, and R multiples.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trade form"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitWithStatus(status);
          }}
          className="flex-1 overflow-y-auto p-5"
        >
          {submitError && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 text-xs text-rose-700 dark:text-rose-300"
            >
              {submitError}
            </div>
          )}

          {Object.keys(fieldErrors).length > 0 && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 text-xs text-rose-700 dark:text-rose-300"
            >
              Please review the highlighted fields below before saving.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Structured Sections */}
            <div className="lg:col-span-8 space-y-6">
              {/* 1. Core Identity */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  1. Account, Instrument &amp; Lifecycle
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label
                      htmlFor="trd-account"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Trading Account *
                    </label>
                    <select
                      id="trd-account"
                      value={accountId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setAccountId(nextId);
                        const acc = accounts.find((a) => a.id === nextId);
                        if (acc && !isEdit) setTimezone(acc.timezone);
                      }}
                      className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Select Account...</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.baseCurrency})
                        </option>
                      ))}
                    </select>
                    {fieldErrors.accountId && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                        {fieldErrors.accountId}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="trd-direction"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Direction *
                    </label>
                    <select
                      id="trd-direction"
                      value={direction}
                      onChange={(e) => setDirection(e.target.value as TradeDirection)}
                      className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    >
                      {TRADE_DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="trd-status"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Trade State *
                    </label>
                    <select
                      id="trd-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TradeStatus)}
                      className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    >
                      {TRADE_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="trd-symbol"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Symbol *
                    </label>
                    <input
                      id="trd-symbol"
                      type="text"
                      list="workspace-instrument-symbols"
                      value={symbol}
                      onChange={(e) => handleSymbolChange(e.target.value)}
                      placeholder="EURUSD, NQ, XAUUSD, AAPL"
                      className="w-full h-9 px-3 text-sm font-mono uppercase rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                    <datalist id="workspace-instrument-symbols">
                      {instruments.map((spec) => (
                        <option key={spec.id} value={spec.symbol}>
                          {spec.displayName ?? spec.assetClass}
                        </option>
                      ))}
                    </datalist>
                    {fieldErrors.symbol && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                        {fieldErrors.symbol}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="trd-instrument"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Instrument Specification
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        id="trd-instrument"
                        value={instrumentId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setInstrumentId(nextId);
                          const spec = instruments.find((i) => i.id === nextId);
                          if (spec && !symbol.trim()) setSymbol(spec.symbol);
                        }}
                        className="w-full h-9 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                      >
                        <option value="">Auto-match by Symbol</option>
                        {instruments.map((spec) => (
                          <option key={spec.id} value={spec.id}>
                            {spec.symbol} ({spec.contractSize} {spec.quantityUnit})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowAddInstrument(true)}
                        title="Create new instrument specification"
                        aria-label="Create new instrument specification"
                        className="h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="trd-ticket"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      External Ticket ID
                    </label>
                    <input
                      id="trd-ticket"
                      type="text"
                      value={externalTicketId}
                      onChange={(e) => setExternalTicketId(e.target.value)}
                      placeholder="Broker / platform order ID"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Inline Instrument Status Bar */}
                <div className="text-[11px] flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]">
                  {resolvedInstrument ? (
                    <span className="text-slate-700 dark:text-slate-300">
                      Spec linked: <strong className="font-mono">{resolvedInstrument.symbol}</strong> ·
                      Contract <span className="font-mono">{resolvedInstrument.contractSize}</span>{' '}
                      {resolvedInstrument.quantityUnit} · Profit{' '}
                      <span className="font-mono">
                        {resolvedInstrument.profitCurrency ?? resolvedInstrument.quoteCurrency}
                      </span>
                      {resolvedInstrument.tickValue
                        ? ` · Tick $${resolvedInstrument.tickValue} / ${resolvedInstrument.tickSize}`
                        : ''}
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300">
                      No matching instrument specification for {symbol.trim() || 'symbol'}. Add a
                      spec or enter Manual Gross P&amp;L.
                    </span>
                  )}
                  <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isArchived}
                      onChange={(e) => setIsArchived(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700"
                    />
                    <span>Archive Trade</span>
                  </label>
                </div>
              </section>

              {/* 2. Entry Data */}
              <section className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  2. Entry Execution Data
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="trd-entry-at"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Entry Date &amp; Time
                    </label>
                    <input
                      id="trd-entry-at"
                      type="datetime-local"
                      value={entryAt}
                      onChange={(e) => setEntryAt(e.target.value)}
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-entry-price"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Entry Price
                    </label>
                    <input
                      id="trd-entry-price"
                      type="text"
                      inputMode="decimal"
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)}
                      placeholder="e.g., 1.0842"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                    {fieldErrors.entryPrice && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                        {fieldErrors.entryPrice}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="trd-quantity"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Size ({resolvedInstrument?.quantityUnit ?? 'units'})
                    </label>
                    <input
                      id="trd-quantity"
                      type="text"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="e.g., 1.00"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                    {fieldErrors.quantity && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                        {fieldErrors.quantity}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="trd-entry-type"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Entry Type
                    </label>
                    <select
                      id="trd-entry-type"
                      value={entryType}
                      onChange={(e) => setEntryType(e.target.value as TradeEntryType | '')}
                      className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Unspecified</option>
                      {TRADE_ENTRY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="trd-session"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Session
                    </label>
                    <select
                      id="trd-session"
                      value={session}
                      onChange={(e) => setSession(e.target.value as TradeSession | '')}
                      className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Unspecified</option>
                      {TRADE_SESSIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="trd-leverage"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Leverage (x)
                    </label>
                    <input
                      id="trd-leverage"
                      type="text"
                      inputMode="decimal"
                      value={leverage}
                      onChange={(e) => setLeverage(e.target.value)}
                      placeholder="e.g., 20"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-margin"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Margin Used ({selectedAccount?.baseCurrency ?? 'USD'})
                    </label>
                    <input
                      id="trd-margin"
                      type="text"
                      inputMode="decimal"
                      value={marginUsed}
                      onChange={(e) => setMarginUsed(e.target.value)}
                      placeholder="Optional"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="trd-bal-snap"
                        className="text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        Account Balance at Entry ({selectedAccount?.baseCurrency ?? 'USD'})
                      </label>
                      {selectedAccountBalance && (
                        <button
                          type="button"
                          onClick={() => setAccountBalanceSnapshot(selectedAccountBalance)}
                          className="text-[11px] text-sky-700 dark:text-sky-400 hover:underline"
                        >
                          Use {formatCurrencyAmount(selectedAccountBalance, selectedAccount?.baseCurrency ?? 'USD')}
                        </button>
                      )}
                    </div>
                    <input
                      id="trd-bal-snap"
                      type="text"
                      inputMode="decimal"
                      value={accountBalanceSnapshot}
                      onChange={(e) => setAccountBalanceSnapshot(e.target.value)}
                      placeholder="Used as denominator for Risk % and Return %"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-timezone"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Execution Timezone *
                    </label>
                    <input
                      id="trd-timezone"
                      type="text"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="America/New_York"
                      className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Timeframes Analyzed
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TIMEFRAME_OPTIONS.map((tf) => {
                      const active = timeframes.includes(tf);
                      return (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => toggleListValue(tf, setTimeframes)}
                          aria-pressed={active}
                          className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                            active
                              ? 'border-sky-500 bg-sky-500/15 text-sky-800 dark:text-sky-300 font-semibold'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {tf}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="trd-rationale"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Entry Rationale / Thesis
                  </label>
                  <textarea
                    id="trd-rationale"
                    rows={2}
                    value={entryRationale}
                    onChange={(e) => setEntryRationale(e.target.value)}
                    placeholder="Structural trigger, key liquidity level, and confirmation reason..."
                    className="w-full p-2.5 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                  />
                </div>
              </section>

              {/* 3. Risk Management (Initial vs Actual) */}
              <section className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    3. Risk Anchors (Initial vs Actual)
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Initial Stop anchors R-multiples even if Actual Stop moves to breakeven.
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label
                      htmlFor="trd-initial-stop"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Initial Stop Price
                    </label>
                    <input
                      id="trd-initial-stop"
                      type="text"
                      inputMode="decimal"
                      value={initialStopPrice}
                      onChange={(e) => setInitialStopPrice(e.target.value)}
                      placeholder="Original invalidation"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-actual-stop"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Actual / Adjusted Stop Price
                    </label>
                    <input
                      id="trd-actual-stop"
                      type="text"
                      inputMode="decimal"
                      value={actualStopPrice}
                      onChange={(e) => setActualStopPrice(e.target.value)}
                      placeholder="After BE or trailing stop move"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-target"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Planned Target Price
                    </label>
                    <input
                      id="trd-target"
                      type="text"
                      inputMode="decimal"
                      value={plannedTargetPrice}
                      onChange={(e) => setPlannedTargetPrice(e.target.value)}
                      placeholder="Target for Planned R"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-planned-risk"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Manual Initial Risk ({selectedAccount?.baseCurrency ?? 'USD'})
                    </label>
                    <input
                      id="trd-planned-risk"
                      type="text"
                      inputMode="decimal"
                      value={plannedRiskAmount}
                      onChange={(e) => setPlannedRiskAmount(e.target.value)}
                      placeholder="Overrides calculated initial risk"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-planned-risk-pct"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Initial Risk % Override
                    </label>
                    <input
                      id="trd-planned-risk-pct"
                      type="text"
                      inputMode="decimal"
                      value={plannedRiskPct}
                      onChange={(e) => setPlannedRiskPct(e.target.value)}
                      placeholder="e.g., 1.00"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-actual-risk"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Manual Actual Risk ({selectedAccount?.baseCurrency ?? 'USD'})
                    </label>
                    <input
                      id="trd-actual-risk"
                      type="text"
                      inputMode="decimal"
                      value={actualRiskAmount}
                      onChange={(e) => setActualRiskAmount(e.target.value)}
                      placeholder="Overrides adjusted stop risk"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </section>

              {/* 4. Exit, FX & Execution Costs */}
              <section className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  4. Exit, FX Conversion &amp; Execution Costs
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="trd-exit-at"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Exit Date &amp; Time
                    </label>
                    <input
                      id="trd-exit-at"
                      type="datetime-local"
                      value={exitAt}
                      onChange={(e) => setExitAt(e.target.value)}
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-exit-price"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Exit Price {status === 'closed' && !manualGrossPnl ? '*' : ''}
                    </label>
                    <input
                      id="trd-exit-price"
                      type="text"
                      inputMode="decimal"
                      value={exitPrice}
                      onChange={(e) => setExitPrice(e.target.value)}
                      placeholder="Required for closed"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                    {fieldErrors.exitPrice && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                        {fieldErrors.exitPrice}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="trd-exit-qty"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Exit Quantity
                    </label>
                    <input
                      id="trd-exit-qty"
                      type="text"
                      inputMode="decimal"
                      value={exitQuantity}
                      onChange={(e) => setExitQuantity(e.target.value)}
                      placeholder="Defaults to entry qty"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                    {fieldErrors.exitQuantity && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                        {fieldErrors.exitQuantity}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="trd-manual-gross"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Manual Gross P&amp;L Override ({selectedAccount?.baseCurrency ?? 'USD'})
                    </label>
                    <input
                      id="trd-manual-gross"
                      type="text"
                      inputMode="decimal"
                      value={manualGrossPnl}
                      onChange={(e) => setManualGrossPnl(e.target.value)}
                      placeholder="Signed amount (e.g., 1250.00 or -420.50)"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-fx-rate"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Quote→Acct FX Rate
                    </label>
                    <input
                      id="trd-fx-rate"
                      type="text"
                      inputMode="decimal"
                      value={fxConversionRate}
                      onChange={(e) => setFxConversionRate(e.target.value)}
                      placeholder="Optional override"
                      className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="trd-exit-reason"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Exit Reason
                    </label>
                    <input
                      id="trd-exit-reason"
                      type="text"
                      value={exitReason}
                      onChange={(e) => setExitReason(e.target.value)}
                      placeholder="Target hit, SL, manual..."
                      className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label
                      htmlFor="trd-commission"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Commission
                    </label>
                    <input
                      id="trd-commission"
                      type="text"
                      inputMode="decimal"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-9 px-2.5 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="trd-swap"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Swap / Fin.
                    </label>
                    <input
                      id="trd-swap"
                      type="text"
                      inputMode="decimal"
                      value={swap}
                      onChange={(e) => setSwap(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-9 px-2.5 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="trd-fees"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Exchange Fees
                    </label>
                    <input
                      id="trd-fees"
                      type="text"
                      inputMode="decimal"
                      value={fees}
                      onChange={(e) => setFees(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-9 px-2.5 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="trd-slippage"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Slippage Cost
                    </label>
                    <input
                      id="trd-slippage"
                      type="text"
                      inputMode="decimal"
                      value={slippage}
                      onChange={(e) => setSlippage(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-9 px-2.5 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="trd-spread"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Spread (Price)
                    </label>
                    <input
                      id="trd-spread"
                      type="text"
                      inputMode="decimal"
                      value={spread}
                      onChange={(e) => setSpread(e.target.value)}
                      placeholder="0.0001"
                      className="w-full h-9 px-2.5 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </section>

              {/* 5. Context & Notes */}
              <section className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  5. Setup Context, Tags &amp; Notes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="trd-setup-tag"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Setup / Playbook Label
                    </label>
                    <input
                      id="trd-setup-tag"
                      type="text"
                      value={setupTag}
                      onChange={(e) => setSetupTag(e.target.value)}
                      placeholder="e.g., NY Opening Range Pullback"
                      className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="trd-tags"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Tags (comma-separated, max 10)
                    </label>
                    <input
                      id="trd-tags"
                      type="text"
                      value={tagsText}
                      onChange={(e) => setTagsText(e.target.value)}
                      placeholder="futures, A+, session-open"
                      className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Market Conditions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {MARKET_CONDITION_OPTIONS.map((mc) => {
                      const active = marketConditions.includes(mc);
                      return (
                        <button
                          key={mc}
                          type="button"
                          onClick={() => toggleListValue(mc, setMarketConditions)}
                          aria-pressed={active}
                          className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                            active
                              ? 'border-sky-500 bg-sky-500/15 text-sky-800 dark:text-sky-300 font-medium'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {mc}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="trd-entry-notes"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Execution Notes
                    </label>
                    <textarea
                      id="trd-entry-notes"
                      rows={2}
                      value={entryNotes}
                      onChange={(e) => setEntryNotes(e.target.value)}
                      placeholder="Stop adjustments, fills, or execution observations..."
                      className="w-full p-2.5 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="trd-review-notes"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Post-Trade Review Notes
                    </label>
                    <textarea
                      id="trd-review-notes"
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Rule adherence, mistake audit, or lessons..."
                      className="w-full p-2.5 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Sticky Live Central Calculation Preview */}
            <aside
              data-testid="trade-calc-preview"
              className="lg:col-span-4 lg:sticky lg:top-0 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] space-y-3.5 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Live Engine Preview
                </span>
                <TradeOutcomeText outcome={previewMetrics.outcome} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Initial Risk</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {previewMetrics.initialRiskAmount !== null
                      ? `${formatCurrencyAmount(
                          previewMetrics.initialRiskAmount,
                          previewMetrics.accountCurrency
                        )}${previewMetrics.initialRiskPct ? ` (${previewMetrics.initialRiskPct}%)` : ''}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Actual Risk (Moved SL)</span>
                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {previewMetrics.actualRiskAmount !== null
                      ? formatCurrencyAmount(
                          previewMetrics.actualRiskAmount,
                          previewMetrics.accountCurrency
                        )
                      : 'Not adjusted'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Planned R:R</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {previewMetrics.plannedRMultiple !== null
                      ? `${previewMetrics.plannedRMultiple}R`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Price Move</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {previewMetrics.priceMove ?? '—'}
                    {previewMetrics.realisedPips ? ` (${previewMetrics.realisedPips}p)` : ''}
                  </span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Gross P&amp;L</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {previewMetrics.grossPnl !== null
                      ? formatSignedCurrencyAmount(
                          previewMetrics.grossPnl,
                          previewMetrics.accountCurrency
                        )
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total Costs</span>
                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {previewMetrics.totalCosts !== null
                      ? formatCurrencyAmount(
                          previewMetrics.totalCosts,
                          previewMetrics.accountCurrency
                        )
                      : '0.00 (none)'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Net P&amp;L</span>
                  <span
                    className={`font-mono tabular-nums text-base font-semibold ${
                      previewMetrics.netPnl !== null
                        ? Number(previewMetrics.netPnl) > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : Number(previewMetrics.netPnl) < 0
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {previewMetrics.netPnl !== null
                      ? formatSignedCurrencyAmount(
                          previewMetrics.netPnl,
                          previewMetrics.accountCurrency
                        )
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Net R Multiple</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {previewMetrics.netRMultiple !== null
                      ? `${Number(previewMetrics.netRMultiple) > 0 ? '+' : ''}${previewMetrics.netRMultiple}R`
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">FX Conversion</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {previewMetrics.fxConversion?.rate
                      ? `${previewMetrics.fxConversion.fromCurrency}/${previewMetrics.fxConversion.toCurrency} = ${Number(previewMetrics.fxConversion.rate).toFixed(4)}`
                      : previewMetrics.profitCurrency
                        ? `${previewMetrics.profitCurrency}/${previewMetrics.accountCurrency} missing`
                        : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Account Ledger Impact</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {previewMetrics.balanceImpactApplies && previewMetrics.balanceImpact !== null
                      ? formatSignedCurrencyAmount(
                          previewMetrics.balanceImpact,
                          previewMetrics.accountCurrency
                        )
                      : 'No impact'}
                  </span>
                </div>
              </div>

              {previewMetrics.unavailableReason && (
                <div className="p-2.5 rounded border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-[11px] text-amber-800 dark:text-amber-300">
                  {previewMetrics.unavailableReason}
                </div>
              )}

              {previewMetrics.warnings.map((w, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-[11px] text-amber-800 dark:text-amber-300"
                >
                  {w}
                </div>
              ))}
            </aside>
          </div>

          {/* Modal Footer */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {selectedAccount
                ? `Posting to ${selectedAccount.name} (${selectedAccount.baseCurrency})`
                : 'Select an account to post trade.'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              {status !== 'draft' && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitWithStatus('draft')}
                  className="px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Save as Draft
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 disabled:opacity-50"
              >
                {submitting
                  ? 'Saving...'
                  : isEdit
                    ? 'Save Trade Changes'
                    : `Save ${status.charAt(0).toUpperCase() + status.slice(1)} Trade`}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showAddInstrument && (
        <InstrumentFormModal
          initialSymbol={symbol.trim().toUpperCase()}
          onClose={() => setShowAddInstrument(false)}
          onSaved={(spec) => {
            setSymbol(spec.symbol);
            setInstrumentId(spec.id);
          }}
        />
      )}
    </div>
  );
}
