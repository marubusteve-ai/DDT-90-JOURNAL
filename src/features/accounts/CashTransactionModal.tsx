import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import type { Account, CashTransaction, CashTransactionType } from '../../domain/models';
import {
  CASH_TRANSACTION_TYPES,
  cashTransactionInputSchema,
} from '../../domain/validation/accountValidation';

interface CashTransactionModalProps {
  account: Account;
  existingTransaction?: CashTransaction | null;
  onClose: () => void;
}

export function CashTransactionModal({
  account,
  existingTransaction,
  onClose,
}: CashTransactionModalProps) {
  const { createCashTransaction, updateCashTransaction } = useApp();

  const [type, setType] = useState<CashTransactionType>(
    existingTransaction?.type ?? 'deposit'
  );
  const [amount, setAmount] = useState(existingTransaction?.amount ?? '');
  const [grossAmount, setGrossAmount] = useState(existingTransaction?.grossAmount ?? '');
  const [splitPct, setSplitPct] = useState(existingTransaction?.splitPct ?? '');
  const [occurredAt, setOccurredAt] = useState(
    existingTransaction?.occurredAt ?? new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(existingTransaction?.notes ?? '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError(null);

    const result = cashTransactionInputSchema.safeParse({
      accountId: account.id,
      type,
      amount,
      currency: existingTransaction?.currency ?? account.baseCurrency,
      grossAmount: grossAmount || null,
      splitPct: splitPct || null,
      occurredAt,
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
      if (existingTransaction) {
        await updateCashTransaction(existingTransaction.id, result.data);
      } else {
        await createCashTransaction(result.data);
      }
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save cash movement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-tx-modal-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2
              id="cash-tx-modal-title"
              className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {existingTransaction ? 'Edit Cash Movement' : 'Record Cash Movement'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {account.name} · {existingTransaction?.currency ?? account.baseCurrency}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cash movement modal"
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

          <div>
            <label htmlFor="tx-type" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Movement Type
            </label>
            <select
              id="tx-type"
              value={type}
              onChange={(e) => setType(e.target.value as CashTransactionType)}
              className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
            >
              {CASH_TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {type === 'deposit' && 'Deposits credit the account ledger balance.'}
              {(type === 'withdrawal' || type === 'payout' || type === 'fee') &&
                'Enter a positive amount; withdrawals, payouts, and fees deduct from the account balance.'}
              {(type === 'adjustment' || type === 'transfer') &&
                'Supports positive or negative signed decimal values (e.g., -25.50 or 500.00).'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tx-amount" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Amount ({existingTransaction?.currency ?? account.baseCurrency}) *
              </label>
              <input
                id="tx-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 2500.00"
                className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.amount && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.amount}</p>
              )}
            </div>

            <div>
              <label htmlFor="tx-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date *
              </label>
              <input
                id="tx-date"
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.occurredAt && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.occurredAt}</p>
              )}
            </div>
          </div>

          {type === 'payout' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tx-gross" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Gross Payout ({existingTransaction?.currency ?? account.baseCurrency})
                </label>
                <input
                  id="tx-gross"
                  type="text"
                  inputMode="decimal"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  placeholder="Optional"
                  className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
                {fieldErrors.grossAmount && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {fieldErrors.grossAmount}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="tx-split" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Split %
                </label>
                <input
                  id="tx-split"
                  type="text"
                  inputMode="decimal"
                  value={splitPct}
                  onChange={(e) => setSplitPct(e.target.value)}
                  placeholder="e.g., 80"
                  className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
                {fieldErrors.splitPct && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {fieldErrors.splitPct}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="tx-notes" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <input
              id="tx-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reference or explanation"
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
              {submitting
                ? 'Saving...'
                : existingTransaction
                  ? 'Update Movement'
                  : 'Save Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
