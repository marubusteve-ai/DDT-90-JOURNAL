import React, { useMemo, useState } from 'react';
import { Archive, Edit3, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import type { InstrumentSpecification } from '../../domain/models';
import { INSTRUMENT_PRESETS } from '../../domain/validation/tradeValidation';
import { InstrumentFormModal } from './InstrumentFormModal';

export function InstrumentSpecsPanel() {
  const {
    instruments,
    trades,
    createInstrument,
    setInstrumentStatus,
    deleteInstrument,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
  const [modalMode, setModalMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingSpec, setEditingSpec] = useState<InstrumentSpecification | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importingPresets, setImportingPresets] = useState(false);

  const missingPresets = useMemo(() => {
    const existingSymbols = new Set(instruments.map((i) => i.symbol.toUpperCase()));
    return INSTRUMENT_PRESETS.filter((p) => !existingSymbols.has(p.symbol.toUpperCase()));
  }, [instruments]);

  const tradeCountBySpec = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trades) {
      if (t.instrumentId) {
        map.set(t.instrumentId, (map.get(t.instrumentId) ?? 0) + 1);
      }
    }
    return map;
  }, [trades]);

  const visibleSpecs = useMemo(() => {
    return instruments.filter((i) => statusFilter === 'all' || i.status === 'active');
  }, [instruments, statusFilter]);

  const handleImportMissingPresets = async () => {
    if (missingPresets.length === 0) return;
    setImportingPresets(true);
    try {
      for (const preset of missingPresets) {
        await createInstrument({
          symbol: preset.symbol,
          displayName: preset.displayName,
          assetClass: preset.assetClass,
          baseCurrency: preset.baseCurrency,
          quoteCurrency: preset.quoteCurrency,
          profitCurrency: preset.profitCurrency,
          contractSize: preset.contractSize,
          tickSize: preset.tickSize,
          pipSize: preset.pipSize,
          tickValue: preset.tickValue,
          quantityUnit: preset.quantityUnit,
          notes: preset.notes,
        });
      }
    } finally {
      setImportingPresets(false);
    }
  };

  const handleToggleStatus = async (spec: InstrumentSpecification) => {
    setBusyId(spec.id);
    try {
      await setInstrumentStatus(spec.id, spec.status === 'archived' ? 'active' : 'archived');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (specId: string) => {
    setBusyId(specId);
    try {
      await deleteInstrument(specId);
      setConfirmDeleteId(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Workspace Instrument Specifications ({instruments.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Contract multipliers, tick/pip sizes, and profit currencies used by the central decimal
            calculation engine.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="inst-status-filter" className="sr-only">
            Filter instrument specifications by status
          </label>
          <select
            id="inst-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'active' | 'all')}
            className="h-8 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-200"
          >
            <option value="active">Active Only</option>
            <option value="all">All ({instruments.length})</option>
          </select>

          {missingPresets.length > 0 && (
            <button
              type="button"
              disabled={importingPresets}
              onClick={() => void handleImportMissingPresets()}
              className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {importingPresets
                  ? 'Importing...'
                  : `Import Standard Presets (${missingPresets.length})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingSpec(null);
              setModalMode('create');
            }}
            className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Instrument Spec</span>
          </button>
        </div>
      </div>

      {visibleSpecs.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            No instrument specifications configured in this view yet. Add a custom specification or
            import the standard FX, Gold, Futures, Crypto, and Equity presets.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
            {visibleSpecs.map((spec) => (
              <div key={spec.id} className="p-4 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {spec.symbol}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {spec.displayName ?? spec.assetClass} · {spec.assetClass} ·{' '}
                      {spec.profitCurrency ?? spec.quoteCurrency}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      spec.status === 'active'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {spec.status === 'active' ? 'Active' : 'Archived'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono tabular-nums text-[11px] text-slate-700 dark:text-slate-300">
                  <div>Contract: {spec.contractSize} {spec.quantityUnit}</div>
                  <div>Tick: {spec.tickSize} / Pip: {spec.pipSize}</div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSpec(spec);
                      setModalMode('edit');
                    }}
                    className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busyId === spec.id}
                    onClick={() => void handleToggleStatus(spec)}
                    className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    {spec.status === 'archived' ? 'Restore' : 'Archive'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0E131D]">
                  <th className="py-2.5 px-4">Symbol</th>
                  <th className="py-2.5 px-3">Class / Unit</th>
                  <th className="py-2.5 px-3">Quote / Profit</th>
                  <th className="py-2.5 px-3 text-right">Contract Size</th>
                  <th className="py-2.5 px-3 text-right">Tick / Pip</th>
                  <th className="py-2.5 px-3 text-right">Tick Value</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {visibleSpecs.map((spec) => {
                  const linkedCount = tradeCountBySpec.get(spec.id) ?? 0;
                  return (
                    <React.Fragment key={spec.id}>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                        <td className="py-3 px-4">
                          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {spec.symbol}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {spec.displayName ?? 'Custom specification'}
                            {linkedCount > 0 ? ` · ${linkedCount} linked trade${linkedCount === 1 ? '' : 's'}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300 capitalize">
                          {spec.assetClass} · <span className="font-mono">{spec.quantityUnit}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                          {spec.quoteCurrency}
                          {spec.profitCurrency && spec.profitCurrency !== spec.quoteCurrency
                            ? ` → ${spec.profitCurrency}`
                            : ''}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {spec.contractSize}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {spec.tickSize} / {spec.pipSize}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {spec.tickValue ? `${spec.profitCurrency ?? spec.quoteCurrency} ${spec.tickValue}` : 'By contract'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-medium ${
                              spec.status === 'active'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {spec.status === 'active' ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSpec(spec);
                                setModalMode('edit');
                              }}
                              aria-label={`Edit instrument ${spec.symbol}`}
                              className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={busyId === spec.id}
                              onClick={() => void handleToggleStatus(spec)}
                              aria-label={
                                spec.status === 'archived'
                                  ? `Restore instrument ${spec.symbol}`
                                  : `Archive instrument ${spec.symbol}`
                              }
                              className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40"
                            >
                              {spec.status === 'archived' ? (
                                <RotateCcw className="w-3.5 h-3.5" />
                              ) : (
                                <Archive className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteId((cur) => (cur === spec.id ? null : spec.id))
                              }
                              aria-label={`Delete instrument ${spec.symbol}`}
                              className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {confirmDeleteId === spec.id && (
                        <tr className="bg-rose-50/80 dark:bg-rose-950/30">
                          <td colSpan={8} className="py-2.5 px-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="text-rose-800 dark:text-rose-200">
                                Delete specification <strong>{spec.symbol}</strong>? Existing trades
                                keep their symbol and prices, but price-based calculations will
                                require a matching specification.
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId === spec.id}
                                  onClick={() => void handleDelete(spec.id)}
                                  className="px-2.5 py-1 rounded bg-rose-600 text-white disabled:opacity-50"
                                >
                                  {busyId === spec.id ? 'Deleting...' : 'Confirm Delete'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalMode !== 'closed' && (
        <InstrumentFormModal
          existingInstrument={modalMode === 'edit' ? editingSpec : null}
          onClose={() => setModalMode('closed')}
        />
      )}
    </div>
  );
}
