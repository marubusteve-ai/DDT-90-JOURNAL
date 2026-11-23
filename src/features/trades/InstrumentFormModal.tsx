import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import type { AssetClass, InstrumentSpecification, QuantityUnit } from '../../domain/models';
import {
  ASSET_CLASSES,
  INSTRUMENT_PRESETS,
  instrumentSpecInputSchema,
  QUANTITY_UNITS,
} from '../../domain/validation/tradeValidation';

interface InstrumentFormModalProps {
  existingInstrument?: InstrumentSpecification | null;
  initialSymbol?: string;
  onClose: () => void;
  onSaved?: (spec: InstrumentSpecification) => void;
}

export function InstrumentFormModal({
  existingInstrument,
  initialSymbol,
  onClose,
  onSaved,
}: InstrumentFormModalProps) {
  const { createInstrument, updateInstrument } = useApp();
  const isEdit = Boolean(existingInstrument);

  const [symbol, setSymbol] = useState(existingInstrument?.symbol ?? initialSymbol ?? '');
  const [displayName, setDisplayName] = useState(existingInstrument?.displayName ?? '');
  const [assetClass, setAssetClass] = useState<AssetClass>(
    existingInstrument?.assetClass ?? 'forex'
  );
  const [baseCurrency, setBaseCurrency] = useState(existingInstrument?.baseCurrency ?? '');
  const [quoteCurrency, setQuoteCurrency] = useState(existingInstrument?.quoteCurrency ?? 'USD');
  const [profitCurrency, setProfitCurrency] = useState(
    existingInstrument?.profitCurrency ?? 'USD'
  );
  const [contractSize, setContractSize] = useState(existingInstrument?.contractSize ?? '100000');
  const [tickSize, setTickSize] = useState(existingInstrument?.tickSize ?? '0.00001');
  const [pipSize, setPipSize] = useState(existingInstrument?.pipSize ?? '0.0001');
  const [tickValue, setTickValue] = useState(existingInstrument?.tickValue ?? '');
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>(
    existingInstrument?.quantityUnit ?? 'lots'
  );
  const [notes, setNotes] = useState(existingInstrument?.notes ?? '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleApplyPreset = (presetSymbol: string) => {
    const preset = INSTRUMENT_PRESETS.find((p) => p.symbol === presetSymbol);
    if (!preset) return;
    setSymbol(preset.symbol);
    setDisplayName(preset.displayName);
    setAssetClass(preset.assetClass);
    setBaseCurrency(preset.baseCurrency ?? '');
    setQuoteCurrency(preset.quoteCurrency);
    setProfitCurrency(preset.profitCurrency ?? preset.quoteCurrency);
    setContractSize(preset.contractSize);
    setTickSize(preset.tickSize);
    setPipSize(preset.pipSize);
    setTickValue(preset.tickValue ?? '');
    setQuantityUnit(preset.quantityUnit);
    setNotes(preset.notes);
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError(null);

    const parsed = instrumentSpecInputSchema.safeParse({
      symbol,
      displayName: displayName || null,
      assetClass,
      baseCurrency: baseCurrency || null,
      quoteCurrency,
      profitCurrency: profitCurrency || null,
      contractSize,
      tickSize,
      pipSize,
      tickValue: tickValue || null,
      quantityUnit,
      notes: notes || null,
    });

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
        isEdit && existingInstrument
          ? await updateInstrument(existingInstrument.id, parsed.data)
          : await createInstrument(parsed.data);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save instrument specification.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instrument-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2
              id="instrument-modal-title"
              className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {isEdit
                ? `Edit Instrument: ${existingInstrument?.symbol}`
                : 'New Instrument Specification'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Defines contract multiplier, tick/pip precision, and profit currency for exact P&amp;L
              and R-multiple calculations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close instrument modal"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto p-5 space-y-5">
          {submitError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 text-xs text-rose-700 dark:text-rose-300"
            >
              {submitError}
            </div>
          )}

          {!isEdit && (
            <div className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Optional: pre-fill from a standard contract template
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="inst-preset-select" className="sr-only">
                  Load instrument preset
                </label>
                <select
                  id="inst-preset-select"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleApplyPreset(e.target.value);
                  }}
                  className="h-8 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200"
                >
                  <option value="">Choose Preset Template...</option>
                  {INSTRUMENT_PRESETS.map((p) => (
                    <option key={p.symbol} value={p.symbol}>
                      {p.symbol} — {p.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="inst-symbol"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Symbol *
              </label>
              <input
                id="inst-symbol"
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g., EURUSD, NQ, AAPL"
                className="w-full h-9 px-3 text-sm font-mono uppercase rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.symbol && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.symbol}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="inst-asset-class"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Asset Class *
              </label>
              <select
                id="inst-asset-class"
                value={assetClass}
                onChange={(e) => setAssetClass(e.target.value as AssetClass)}
                className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              >
                {ASSET_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="inst-unit"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Quantity Unit *
              </label>
              <select
                id="inst-unit"
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value as QuantityUnit)}
                className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              >
                {QUANTITY_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="inst-display-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Display Name
              </label>
              <input
                id="inst-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., E-mini Nasdaq-100 Futures"
                className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="inst-base-ccy"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Base Asset / Currency
              </label>
              <input
                id="inst-base-ccy"
                type="text"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
                placeholder="EUR, XAU, BTC"
                className="w-full h-9 px-3 text-sm font-mono uppercase rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="inst-quote-ccy"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Quote Currency *
              </label>
              <input
                id="inst-quote-ccy"
                type="text"
                value={quoteCurrency}
                onChange={(e) => setQuoteCurrency(e.target.value.toUpperCase())}
                placeholder="USD, JPY, EUR"
                maxLength={3}
                className="w-full h-9 px-3 text-sm font-mono uppercase rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.quoteCurrency && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.quoteCurrency}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="inst-profit-ccy"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Profit / Settlement Currency
              </label>
              <input
                id="inst-profit-ccy"
                type="text"
                value={profitCurrency}
                onChange={(e) => setProfitCurrency(e.target.value.toUpperCase())}
                placeholder="Defaults to Quote"
                maxLength={3}
                className="w-full h-9 px-3 text-sm font-mono uppercase rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.profitCurrency && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.profitCurrency}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="inst-contract-size"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Contract Size (Units / Lot) *
              </label>
              <input
                id="inst-contract-size"
                type="text"
                inputMode="decimal"
                value={contractSize}
                onChange={(e) => setContractSize(e.target.value)}
                placeholder="100000"
                className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.contractSize && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.contractSize}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="inst-tick-size"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Tick Size *
              </label>
              <input
                id="inst-tick-size"
                type="text"
                inputMode="decimal"
                value={tickSize}
                onChange={(e) => setTickSize(e.target.value)}
                placeholder="0.00001"
                className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.tickSize && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.tickSize}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="inst-pip-size"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Pip / Point Size *
              </label>
              <input
                id="inst-pip-size"
                type="text"
                inputMode="decimal"
                value={pipSize}
                onChange={(e) => setPipSize(e.target.value)}
                placeholder="0.0001"
                className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.pipSize && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.pipSize}
                </p>
              )}
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="inst-tick-value"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Tick Value Override (Optional — used for Futures, e.g. $5.00 per tick on NQ)
              </label>
              <input
                id="inst-tick-value"
                type="text"
                inputMode="decimal"
                value={tickValue}
                onChange={(e) => setTickValue(e.target.value)}
                placeholder="Leave blank to compute from Price Move × Contract Size × Qty"
                className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.tickValue && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.tickValue}
                </p>
              )}
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="inst-notes"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Specification Notes
              </label>
              <input
                id="inst-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Broker contract details, session rules, or multiplier reference"
                className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
            </div>
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
              className="px-4 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : isEdit
                  ? 'Save Specification'
                  : 'Create Specification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
