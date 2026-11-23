import React, { useState } from 'react';
import { Archive, Edit3, RotateCcw, Trash2, X } from 'lucide-react';
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
import type { TradeCalculatedMetrics } from '../../domain/calculations/tradeCalculations';
import type { Account, InstrumentSpecification, Trade } from '../../domain/models';

interface TradeDetailModalProps {
  trade: Trade;
  metrics: TradeCalculatedMetrics;
  account: Account | null;
  instrument: InstrumentSpecification | null;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
}

export function TradeDetailModal({
  trade,
  metrics,
  account,
  instrument,
  onClose,
  onEdit,
}: TradeDetailModalProps) {
  const { setTradeArchived, setTradeStatus, deleteTrade } = useApp();

  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleToggleArchive = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await setTradeArchived(trade.id, !trade.isArchived);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update archive state.');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkOpen = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await setTradeStatus(trade.id, 'open');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update trade state.');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkClosed = async () => {
    if (trade.exitPrice === null && trade.manualGrossPnl === null) {
      onEdit(trade);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await setTradeStatus(trade.id, 'closed');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to close trade.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await deleteTrade(trade.id);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete trade.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-detail-title"
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2
                id="trade-detail-title"
                className="font-display text-lg font-semibold font-mono text-slate-900 dark:text-slate-50"
              >
                {trade.symbol}
              </h2>
              <TradeDirectionText direction={trade.direction} />
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <TradeStatusText status={trade.status} isArchived={trade.isArchived} />
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <TradeOutcomeText outcome={metrics.outcome} />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>{account?.name ?? 'Unknown Account'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{trade.accountCurrency}</span>
              {trade.setupTag && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-700 dark:text-slate-300">{trade.setupTag}</span>
                </>
              )}
              {trade.externalTicketId && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">Ticket #{trade.externalTicketId}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {trade.status === 'draft' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleMarkOpen()}
                className="px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Mark Open
              </button>
            )}
            {trade.status !== 'closed' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleMarkClosed()}
                className="px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {trade.exitPrice === null && trade.manualGrossPnl === null
                  ? 'Add Exit & Close'
                  : 'Mark Closed'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(trade)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Trade</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleToggleArchive()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {trade.isArchived ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close trade detail modal"
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {actionError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 text-rose-700 dark:text-rose-300"
            >
              {actionError}
            </div>
          )}

          {metrics.unavailableReason && (
            <div className="p-3 rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">
              {metrics.unavailableReason}
            </div>
          )}

          {metrics.warnings.length > 0 && (
            <div className="p-3 rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 space-y-1">
              {metrics.warnings.map((w, idx) => (
                <div key={idx}>{w}</div>
              ))}
            </div>
          )}

          {/* Top Financial Headline Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Net P&amp;L</div>
              <div
                className={`mt-1 font-mono tabular-nums text-base font-semibold ${
                  metrics.netPnl !== null
                    ? Number(metrics.netPnl) > 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : Number(metrics.netPnl) < 0
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {metrics.netPnl !== null
                  ? formatSignedCurrencyAmount(metrics.netPnl, trade.accountCurrency)
                  : '—'}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {metrics.netPnlPct !== null ? `${metrics.netPnlPct}% of equity` : metrics.netPnlSource.replace(/_/g, ' ')}
              </div>
            </div>

            <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Net R Multiple</div>
              <div className="mt-1 font-mono tabular-nums text-base font-semibold text-slate-900 dark:text-slate-100">
                {metrics.netRMultiple !== null
                  ? `${Number(metrics.netRMultiple) > 0 ? '+' : ''}${metrics.netRMultiple}R`
                  : '—'}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {metrics.plannedRMultiple !== null
                  ? `Planned: +${metrics.plannedRMultiple}R`
                  : 'Gross R: ' + (metrics.grossRMultiple !== null ? `${metrics.grossRMultiple}R` : '—')}
              </div>
            </div>

            <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Initial Risk</div>
              <div className="mt-1 font-mono tabular-nums text-base font-semibold text-slate-900 dark:text-slate-100">
                {metrics.initialRiskAmount !== null
                  ? formatCurrencyAmount(metrics.initialRiskAmount, trade.accountCurrency)
                  : '—'}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {metrics.initialRiskPct !== null ? `${metrics.initialRiskPct}%` : 'No %'} ·{' '}
                {metrics.actualRiskAmount !== null
                  ? `Actual: ${formatCurrencyAmount(metrics.actualRiskAmount, trade.accountCurrency)}`
                  : 'Actual unchanged'}
              </div>
            </div>

            <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17]">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Account Balance Impact
              </div>
              <div className="mt-1 font-mono tabular-nums text-base font-semibold text-slate-900 dark:text-slate-100">
                {metrics.balanceImpactApplies && metrics.balanceImpact !== null
                  ? formatSignedCurrencyAmount(metrics.balanceImpact, trade.accountCurrency)
                  : 'No Impact'}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {metrics.balanceImpactApplies
                  ? 'Applied to account ledger'
                  : trade.isArchived
                    ? 'Excluded (Archived)'
                    : `Excluded (${trade.status})`}
              </div>
            </div>
          </div>

          {/* 3-Column Audit Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 space-y-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Execution &amp; Sizing
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Entry Time</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {trade.entryAt ? trade.entryAt.replace('T', ' ') : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Entry Price</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {trade.entryPrice ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Quantity</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {trade.quantity ? `${trade.quantity} ${instrument?.quantityUnit ?? 'units'}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Exit Time</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {trade.exitAt ? trade.exitAt.replace('T', ' ') : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Exit Price</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {trade.exitPrice ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Price Move</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {metrics.priceMove ?? '—'}
                    {metrics.realisedPips ? ` (${metrics.realisedPips} pips)` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Duration</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {metrics.holdingDurationLabel ?? '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 space-y-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Risk Anchors &amp; Targets
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Initial Stop Price</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {trade.initialStopPrice ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Initial Stop Dist.</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {metrics.initialStopDistance ?? '—'}
                    {metrics.initialStopPips ? ` (${metrics.initialStopPips}p)` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Actual Stop Price</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {trade.actualStopPrice ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Planned Target</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {trade.plannedTargetPrice ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Order / Session</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 capitalize">
                    {trade.entryType?.replace(/_/g, ' ') ?? '—'} ·{' '}
                    {trade.session?.replace(/_/g, ' ') ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Leverage / Margin</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {trade.leverage ? `${trade.leverage}x` : '—'} ·{' '}
                    {trade.marginUsed
                      ? formatCurrencyAmount(trade.marginUsed, trade.accountCurrency)
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 space-y-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                P&amp;L &amp; Cost Ledger
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Gross P&amp;L</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {metrics.grossPnl !== null
                      ? formatSignedCurrencyAmount(metrics.grossPnl, trade.accountCurrency)
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">FX Conversion</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {metrics.fxConversion?.rate
                      ? `${metrics.fxConversion.fromCurrency}/${metrics.fxConversion.toCurrency} @ ${Number(metrics.fxConversion.rate).toFixed(4)}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Commission</span>
                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {trade.commission ? formatCurrencyAmount(trade.commission, trade.accountCurrency) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Swap / Fees / Slip</span>
                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {[trade.swap, trade.fees, trade.slippage].some((v) => v !== null)
                      ? `${trade.swap ?? '0'} / ${trade.fees ?? '0'} / ${trade.slippage ?? '0'}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400">Total Costs</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {metrics.totalCosts !== null
                      ? formatCurrencyAmount(metrics.totalCosts, trade.accountCurrency)
                      : 'None recorded'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Net P&amp;L</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {metrics.netPnl !== null
                      ? formatSignedCurrencyAmount(metrics.netPnl, trade.accountCurrency)
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Qualitative Context & Notes */}
          <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Timeframes</div>
                <div className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                  {trade.timeframes.length > 0 ? trade.timeframes.join(' · ') : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Market Conditions</div>
                <div className="mt-0.5 text-slate-900 dark:text-slate-100">
                  {trade.marketConditions.length > 0 ? trade.marketConditions.join(' · ') : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Tags</div>
                <div className="mt-0.5 font-mono text-slate-700 dark:text-slate-300">
                  {trade.tags.length > 0 ? trade.tags.join(' · ') : '—'}
                </div>
              </div>
            </div>

            {trade.entryRationale && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/70">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Entry Rationale</div>
                <p className="mt-0.5 text-slate-800 dark:text-slate-200 leading-relaxed">
                  {trade.entryRationale}
                </p>
              </div>
            )}

            {trade.exitReason && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/70">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Exit Reason</div>
                <p className="mt-0.5 text-slate-800 dark:text-slate-200 leading-relaxed">
                  {trade.exitReason}
                </p>
              </div>
            )}

            {(trade.entryNotes || trade.reviewNotes) && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/70 grid grid-cols-1 md:grid-cols-2 gap-3">
                {trade.entryNotes && (
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Entry Notes</div>
                    <p className="mt-0.5 text-slate-700 dark:text-slate-300">{trade.entryNotes}</p>
                  </div>
                )}
                {trade.reviewNotes && (
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Review Notes</div>
                    <p className="mt-0.5 text-slate-700 dark:text-slate-300">{trade.reviewNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delete Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setConfirmDelete((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-rose-200 dark:border-rose-900/70 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Trade</span>
            </button>

            {confirmDelete && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-rose-700 dark:text-rose-300">
                  Permanently remove this trade record?
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleConfirmDelete()}
                  className="px-2.5 py-1 rounded bg-rose-600 text-white disabled:opacity-50"
                >
                  {busy ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
