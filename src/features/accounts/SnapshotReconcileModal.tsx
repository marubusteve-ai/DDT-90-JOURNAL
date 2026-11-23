import React, { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { X } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import {
  formatCurrencyAmount,
  formatSignedCurrencyAmount,
  type AccountLedgerSummary,
} from '../../domain/calculations/accountCalculations';
import type { Account } from '../../domain/models';
import {
  balanceSnapshotInputSchema,
  SIGNED_DECIMAL_PATTERN,
} from '../../domain/validation/accountValidation';

interface SnapshotReconcileModalProps {
  account: Account;
  ledger: AccountLedgerSummary;
  onClose: () => void;
}

export function SnapshotReconcileModal({
  account,
  ledger,
  onClose,
}: SnapshotReconcileModalProps) {
  const { recordBalanceSnapshot } = useApp();

  const [balance, setBalance] = useState(
    account.verifiedBalanceSnapshot ?? ledger.calculatedLedgerBalance
  );
  const [equity, setEquity] = useState(account.verifiedEquitySnapshot ?? '');
  const [capturedAt, setCapturedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const preview = useMemo(() => {
    const trimmed = balance.trim();
    if (!trimmed || !SIGNED_DECIMAL_PATTERN.test(trimmed)) {
      return null;
    }
    const snapDec = new Decimal(trimmed);
    const calcDec = new Decimal(ledger.calculatedLedgerBalance);
    const deltaDec = snapDec.minus(calcDec);
    const reconciled = deltaDec.abs().lte(new Decimal('0.005'));
    return {
      delta: deltaDec.toFixed(2),
      reconciled,
    };
  }, [balance, ledger.calculatedLedgerBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError(null);

    const result = balanceSnapshotInputSchema.safeParse({
      accountId: account.id,
      balance,
      equity: equity || null,
      capturedAt,
      notes: notes || null,
    });

    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      await recordBalanceSnapshot(result.data);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to record balance snapshot.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-modal-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2
              id="snapshot-modal-title"
              className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              Record Verified Balance Snapshot
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {account.name} · {account.baseCurrency}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close snapshot modal"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          {submitError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 text-xs text-rose-700 dark:text-rose-300"
            >
              {submitError}
            </div>
          )}

          {/* Live Reconciliation Preview */}
          <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Calculated Ledger Balance</span>
              <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {formatCurrencyAmount(ledger.calculatedLedgerBalance, account.baseCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Projected Reconciliation Delta</span>
              <span
                className={`font-mono tabular-nums font-medium ${
                  preview === null
                    ? 'text-slate-400'
                    : preview.reconciled
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {preview === null
                  ? '—'
                  : formatSignedCurrencyAmount(preview.delta, account.baseCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Projected Status</span>
              <span
                className={`font-medium ${
                  preview === null
                    ? 'text-slate-400'
                    : preview.reconciled
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {preview === null
                  ? 'Enter valid balance'
                  : preview.reconciled
                    ? 'Reconciled'
                    : 'Discrepancy (Audit Recorded)'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="snap-balance" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Verified Balance ({account.baseCurrency}) *
              </label>
              <input
                id="snap-balance"
                type="text"
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="e.g., 50000.00"
                className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.balance && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.balance}</p>
              )}
            </div>

            <div>
              <label htmlFor="snap-equity" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Verified Equity (Optional)
              </label>
              <input
                id="snap-equity"
                type="text"
                inputMode="decimal"
                value={equity}
                onChange={(e) => setEquity(e.target.value)}
                placeholder="Optional"
                className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.equity && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.equity}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="snap-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Snapshot Date *
            </label>
            <input
              id="snap-date"
              type="date"
              value={capturedAt}
              onChange={(e) => setCapturedAt(e.target.value)}
              className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
            />
            {fieldErrors.capturedAt && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.capturedAt}</p>
            )}
          </div>

          <div>
            <label htmlFor="snap-notes" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reconciliation Notes
            </label>
            <input
              id="snap-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain statement source or variance"
              className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Snapshot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
