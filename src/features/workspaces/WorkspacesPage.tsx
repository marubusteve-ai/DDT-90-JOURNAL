import React, { useMemo, useState } from 'react';
import {
  Archive,
  Check,
  Edit3,
  Globe,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import {
  calculatePortfolioRollups,
  formatCurrencyAmount,
} from '../../domain/calculations/accountCalculations';
import type {
  Broker,
  FXRateSnapshot,
  Portfolio,
  PropFirm,
  TradingPlatform,
  Workspace,
} from '../../domain/models';
import {
  brokerInputSchema,
  COMMON_CURRENCIES,
  COMMON_TIMEZONES,
  fxRateInputSchema,
  portfolioInputSchema,
  propFirmInputSchema,
  tradingPlatformInputSchema,
  workspaceInputSchema,
} from '../../domain/validation/accountValidation';

type RefTab = 'brokers' | 'platforms' | 'prop_firms';

export function WorkspacesPage() {
  const {
    dataSourceMode,
    workspaces,
    activeWorkspace,
    portfolios,
    accounts,
    cashTransactions,
    brokers,
    platforms,
    propFirms,
    fxRates,
    selectWorkspace,
    createWorkspace,
    updateWorkspace,
    setWorkspaceStatus,
    createPortfolio,
    updatePortfolio,
    setPortfolioStatus,
    deletePortfolio,
    createBroker,
    updateBroker,
    setBrokerStatus,
    deleteBroker,
    createTradingPlatform,
    updateTradingPlatform,
    setTradingPlatformStatus,
    deleteTradingPlatform,
    createPropFirm,
    updatePropFirm,
    setPropFirmStatus,
    deletePropFirm,
    createFXRate,
    updateFXRate,
    deleteFXRate,
  } = useApp();

  // Workspace creation + inline edit state
  const [showArchivedWorkspaces, setShowArchivedWorkspaces] = useState(false);
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [editWsName, setEditWsName] = useState('');
  const [editWsDesc, setEditWsDesc] = useState('');
  const [editWsCurrency, setEditWsCurrency] = useState('USD');
  const [editWsTimezone, setEditWsTimezone] = useState('UTC');

  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [wsCurrency, setWsCurrency] = useState('USD');
  const [wsTimezone, setWsTimezone] = useState('UTC');
  const [wsError, setWsError] = useState<string | null>(null);
  const [wsBusy, setWsBusy] = useState(false);

  // Portfolio creation + inline edit + delete state
  const [editingPfId, setEditingPfId] = useState<string | null>(null);
  const [editPfName, setEditPfName] = useState('');
  const [editPfDesc, setEditPfDesc] = useState('');
  const [editPfCurrency, setEditPfCurrency] = useState('USD');
  const [confirmDeletePfId, setConfirmDeletePfId] = useState<string | null>(null);

  const [pfName, setPfName] = useState('');
  const [pfDesc, setPfDesc] = useState('');
  const [pfCurrency, setPfCurrency] = useState(activeWorkspace?.baseCurrency ?? 'USD');
  const [pfError, setPfError] = useState<string | null>(null);
  const [pfBusy, setPfBusy] = useState(false);

  // Reference Library tab + form state
  const [refTab, setRefTab] = useState<RefTab>('brokers');
  const [refName, setRefName] = useState('');
  const [refMeta, setRefMeta] = useState(''); // website or vendor
  const [refNotes, setRefNotes] = useState('');
  const [refEditingId, setRefEditingId] = useState<string | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [refBusy, setRefBusy] = useState(false);
  const [confirmDeleteRefId, setConfirmDeleteRefId] = useState<string | null>(null);

  // FX Rate Snapshot state
  const [fxBase, setFxBase] = useState('EUR');
  const [fxQuote, setFxQuote] = useState(activeWorkspace?.baseCurrency ?? 'USD');
  const [fxRateVal, setFxRateVal] = useState('');
  const [fxDate, setFxDate] = useState(new Date().toISOString().slice(0, 10));
  const [fxSource, setFxSource] = useState<'manual' | 'historical_feed' | 'broker_report'>('manual');
  const [fxNotes, setFxNotes] = useState('');
  const [editingFxId, setEditingFxId] = useState<string | null>(null);
  const [confirmDeleteFxId, setConfirmDeleteFxId] = useState<string | null>(null);
  const [fxError, setFxError] = useState<string | null>(null);
  const [fxBusy, setFxBusy] = useState(false);

  const visibleWorkspaces = useMemo(
    () => workspaces.filter((w) => showArchivedWorkspaces || w.status !== 'archived'),
    [showArchivedWorkspaces, workspaces]
  );

  const portfolioRollups = useMemo(
    () => calculatePortfolioRollups(portfolios, accounts, cashTransactions, fxRates),
    [accounts, cashTransactions, fxRates, portfolios]
  );

  const startEditWorkspace = (ws: Workspace) => {
    setEditingWsId(ws.id);
    setEditWsName(ws.name);
    setEditWsDesc(ws.description ?? '');
    setEditWsCurrency(ws.baseCurrency);
    setEditWsTimezone(ws.timezone);
    setWsError(null);
  };

  const handleSaveWorkspaceEdit = async (e: React.FormEvent, workspaceId: string) => {
    e.preventDefault();
    setWsError(null);
    const parsed = workspaceInputSchema.safeParse({
      name: editWsName,
      description: editWsDesc || null,
      baseCurrency: editWsCurrency,
      timezone: editWsTimezone,
    });
    if (!parsed.success) {
      setWsError(parsed.error.issues[0]?.message ?? 'Invalid workspace details.');
      return;
    }
    setWsBusy(true);
    try {
      await updateWorkspace(workspaceId, parsed.data);
      setEditingWsId(null);
    } catch (err) {
      setWsError(err instanceof Error ? err.message : 'Failed to update workspace.');
    } finally {
      setWsBusy(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setWsError(null);
    const parsed = workspaceInputSchema.safeParse({
      name: wsName,
      description: wsDesc || null,
      baseCurrency: wsCurrency,
      timezone: wsTimezone,
    });
    if (!parsed.success) {
      setWsError(parsed.error.issues[0]?.message ?? 'Invalid workspace input.');
      return;
    }
    setWsBusy(true);
    try {
      await createWorkspace(parsed.data);
      setWsName('');
      setWsDesc('');
    } catch (err) {
      setWsError(err instanceof Error ? err.message : 'Failed to create workspace.');
    } finally {
      setWsBusy(false);
    }
  };

  const startEditPortfolio = (pf: Portfolio) => {
    setEditingPfId(pf.id);
    setEditPfName(pf.name);
    setEditPfDesc(pf.description ?? '');
    setEditPfCurrency(pf.baseCurrency);
    setPfError(null);
  };

  const handleSavePortfolioEdit = async (e: React.FormEvent, portfolioId: string) => {
    e.preventDefault();
    setPfError(null);
    const parsed = portfolioInputSchema.safeParse({
      name: editPfName,
      description: editPfDesc || null,
      baseCurrency: editPfCurrency,
    });
    if (!parsed.success) {
      setPfError(parsed.error.issues[0]?.message ?? 'Invalid portfolio details.');
      return;
    }
    setPfBusy(true);
    try {
      await updatePortfolio(portfolioId, parsed.data);
      setEditingPfId(null);
    } catch (err) {
      setPfError(err instanceof Error ? err.message : 'Failed to update portfolio.');
    } finally {
      setPfBusy(false);
    }
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    setPfError(null);
    const parsed = portfolioInputSchema.safeParse({
      name: pfName,
      description: pfDesc || null,
      baseCurrency: pfCurrency,
    });
    if (!parsed.success) {
      setPfError(parsed.error.issues[0]?.message ?? 'Invalid portfolio input.');
      return;
    }
    setPfBusy(true);
    try {
      await createPortfolio(parsed.data);
      setPfName('');
      setPfDesc('');
    } catch (err) {
      setPfError(err instanceof Error ? err.message : 'Failed to create portfolio.');
    } finally {
      setPfBusy(false);
    }
  };

  const resetRefForm = () => {
    setRefEditingId(null);
    setRefName('');
    setRefMeta('');
    setRefNotes('');
    setRefError(null);
  };

  const handleSwitchRefTab = (tab: RefTab) => {
    setRefTab(tab);
    resetRefForm();
    setConfirmDeleteRefId(null);
  };

  const startEditRef = (item: Broker | TradingPlatform | PropFirm) => {
    setRefEditingId(item.id);
    setRefName(item.name);
    setRefMeta('website' in item ? item.website ?? '' : item.vendor ?? '');
    setRefNotes(item.notes ?? '');
    setRefError(null);
  };

  const handleSubmitRef = async (e: React.FormEvent) => {
    e.preventDefault();
    setRefError(null);
    setRefBusy(true);

    try {
      if (refTab === 'brokers') {
        const parsed = brokerInputSchema.safeParse({
          name: refName,
          website: refMeta || null,
          notes: refNotes || null,
        });
        if (!parsed.success) {
          setRefError(parsed.error.issues[0]?.message ?? 'Invalid broker input.');
          return;
        }
        if (refEditingId) {
          await updateBroker(refEditingId, parsed.data);
        } else {
          await createBroker(parsed.data);
        }
      } else if (refTab === 'platforms') {
        const parsed = tradingPlatformInputSchema.safeParse({
          name: refName,
          vendor: refMeta || null,
          notes: refNotes || null,
        });
        if (!parsed.success) {
          setRefError(parsed.error.issues[0]?.message ?? 'Invalid platform input.');
          return;
        }
        if (refEditingId) {
          await updateTradingPlatform(refEditingId, parsed.data);
        } else {
          await createTradingPlatform(parsed.data);
        }
      } else {
        const parsed = propFirmInputSchema.safeParse({
          name: refName,
          website: refMeta || null,
          notes: refNotes || null,
        });
        if (!parsed.success) {
          setRefError(parsed.error.issues[0]?.message ?? 'Invalid prop firm input.');
          return;
        }
        if (refEditingId) {
          await updatePropFirm(refEditingId, parsed.data);
        } else {
          await createPropFirm(parsed.data);
        }
      }
      resetRefForm();
    } catch (err) {
      setRefError(err instanceof Error ? err.message : 'Failed to save reference entry.');
    } finally {
      setRefBusy(false);
    }
  };

  const startEditFx = (item: FXRateSnapshot) => {
    setEditingFxId(item.id);
    setFxBase(item.baseCurrency);
    setFxQuote(item.quoteCurrency);
    setFxRateVal(item.rate);
    setFxDate(item.capturedAt.slice(0, 10));
    setFxSource(item.source);
    setFxNotes(item.notes ?? '');
    setFxError(null);
  };

  const resetFxForm = () => {
    setEditingFxId(null);
    setFxRateVal('');
    setFxNotes('');
    setFxError(null);
  };

  const handleSubmitFx = async (e: React.FormEvent) => {
    e.preventDefault();
    setFxError(null);
    const parsed = fxRateInputSchema.safeParse({
      baseCurrency: fxBase,
      quoteCurrency: fxQuote,
      rate: fxRateVal,
      capturedAt: fxDate,
      source: fxSource,
      notes: fxNotes || null,
    });
    if (!parsed.success) {
      setFxError(parsed.error.issues[0]?.message ?? 'Invalid FX rate snapshot.');
      return;
    }
    setFxBusy(true);
    try {
      if (editingFxId) {
        await updateFXRate(editingFxId, parsed.data);
      } else {
        await createFXRate(parsed.data);
      }
      resetFxForm();
    } catch (err) {
      setFxError(err instanceof Error ? err.message : 'Failed to save FX rate snapshot.');
    } finally {
      setFxBusy(false);
    }
  };

  const activeRefItems: ReadonlyArray<Broker | TradingPlatform | PropFirm> =
    refTab === 'brokers' ? brokers : refTab === 'platforms' ? platforms : propFirms;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50">
          Workspaces, Portfolios &amp; Reference Library
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Configure isolated workspaces, portfolio groups, broker/platform/prop-firm references, and
          explicit FX rate snapshots.
        </p>
      </div>

      {/* Isolation Status */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex items-start gap-3 text-xs">
        <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            Data Isolation Boundary:{' '}
            {dataSourceMode === 'firebase_cloud'
              ? 'Cloud Firestore (Owner-Enforced Security Rules)'
              : 'Isolated Local Demo Sandbox'}
          </div>
          <p className="mt-0.5 text-slate-600 dark:text-slate-400">
            Every workspace, portfolio, account, cash movement, snapshot, reference entity, and FX
            rate is scoped by <span className="font-mono">ownerId</span> and{' '}
            <span className="font-mono">workspaceId</span>.
          </p>
        </div>
      </div>

      {/* Row 1: Workspaces & Portfolios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Workspaces Panel */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Workspaces ({visibleWorkspaces.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Switch active scope or edit workspace currency &amp; timezone.
              </p>
            </div>
            {workspaces.some((w) => w.status === 'archived') && (
              <button
                type="button"
                onClick={() => setShowArchivedWorkspaces((v) => !v)}
                className="text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:underline shrink-0"
              >
                {showArchivedWorkspaces ? 'Hide Archived' : 'Show Archived'}
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
            {visibleWorkspaces.map((ws) => {
              const isCurrent = ws.id === activeWorkspace?.id;
              const isEditing = editingWsId === ws.id;
              return (
                <div key={ws.id} className="p-3 space-y-3 text-xs">
                  {isEditing ? (
                    <form
                      onSubmit={(e) => void handleSaveWorkspaceEdit(e, ws.id)}
                      className="space-y-2.5"
                    >
                      <input
                        type="text"
                        aria-label="Edit workspace name"
                        value={editWsName}
                        onChange={(e) => setEditWsName(e.target.value)}
                        className="w-full h-8 px-2.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          aria-label="Edit workspace base currency"
                          value={editWsCurrency}
                          onChange={(e) => setEditWsCurrency(e.target.value)}
                          className="h-8 px-2 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                        >
                          {COMMON_CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Edit workspace timezone"
                          value={editWsTimezone}
                          onChange={(e) => setEditWsTimezone(e.target.value)}
                          className="h-8 px-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                        >
                          {COMMON_TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        aria-label="Edit workspace description"
                        value={editWsDesc}
                        onChange={(e) => setEditWsDesc(e.target.value)}
                        placeholder="Optional description"
                        className="w-full h-8 px-2.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingWsId(null)}
                          className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={wsBusy}
                          className="px-2.5 py-1 rounded bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span className="truncate">{ws.name}</span>
                          {isCurrent && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                          {ws.status === 'archived' && (
                            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                              · Archived
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {ws.baseCurrency} · {ws.timezone}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditWorkspace(ws)}
                          aria-label={`Edit workspace ${ws.name}`}
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {workspaces.filter((w) => w.status === 'active').length > 1 ||
                        ws.status === 'archived' ? (
                          <button
                            type="button"
                            onClick={() =>
                              void setWorkspaceStatus(
                                ws.id,
                                ws.status === 'archived' ? 'active' : 'archived'
                              )
                            }
                            aria-label={
                              ws.status === 'archived'
                                ? `Restore workspace ${ws.name}`
                                : `Archive workspace ${ws.name}`
                            }
                            className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {ws.status === 'archived' ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={isCurrent || ws.status === 'archived'}
                          onClick={() => void selectWorkspace(ws.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45"
                        >
                          {isCurrent ? 'Active' : 'Switch'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => void handleCreateWorkspace(e)}
            className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800"
          >
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Create New Workspace
            </div>
            {wsError && <p className="text-xs text-rose-600 dark:text-rose-400">{wsError}</p>}
            <div>
              <label htmlFor="ws-name" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Workspace Name *
              </label>
              <input
                id="ws-name"
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                placeholder="e.g., Futures Prop Desk"
                className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ws-currency" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Base Currency
                </label>
                <select
                  id="ws-currency"
                  value={wsCurrency}
                  onChange={(e) => setWsCurrency(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ws-tz" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Timezone
                </label>
                <select
                  id="ws-tz"
                  value={wsTimezone}
                  onChange={(e) => setWsTimezone(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="ws-desc" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Description
              </label>
              <input
                id="ws-desc"
                type="text"
                value={wsDesc}
                onChange={(e) => setWsDesc(e.target.value)}
                placeholder="Optional scope notes"
                className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={wsBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{wsBusy ? 'Creating...' : 'Create Workspace'}</span>
            </button>
          </form>
        </section>

        {/* Portfolios & Rollups Panel */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Portfolios in {activeWorkspace?.name ?? 'Active Workspace'} ({portfolios.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Group related accounts and review consolidated portfolio capital rollups.
            </p>
          </div>

          {portfolios.length === 0 ? (
            <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              No portfolios created in this workspace yet. Accounts can still exist standalone or be
              assigned once a portfolio is added.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
              {portfolios.map((pf) => {
                const summary = portfolioRollups.find((r) => r.portfolioId === pf.id);
                const isEditing = editingPfId === pf.id;
                const isConfirmDelete = confirmDeletePfId === pf.id;
                return (
                  <div key={pf.id} className="p-3 space-y-2.5 text-xs">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => void handleSavePortfolioEdit(e, pf.id)}
                        className="space-y-2.5"
                      >
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            aria-label="Edit portfolio name"
                            value={editPfName}
                            onChange={(e) => setEditPfName(e.target.value)}
                            className="col-span-2 h-8 px-2.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                          />
                          <select
                            aria-label="Edit portfolio currency"
                            value={editPfCurrency}
                            onChange={(e) => setEditPfCurrency(e.target.value)}
                            className="h-8 px-2 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                          >
                            {COMMON_CURRENCIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="text"
                          aria-label="Edit portfolio description"
                          value={editPfDesc}
                          onChange={(e) => setEditPfDesc(e.target.value)}
                          placeholder="Optional description"
                          className="w-full h-8 px-2.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPfId(null)}
                            className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={pfBusy}
                            className="px-2.5 py-1 rounded bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <span className="truncate">{pf.name}</span>
                              {pf.status === 'archived' && (
                                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                  · Archived
                                </span>
                              )}
                            </div>
                            {pf.description && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {pf.description}
                              </div>
                            )}
                            <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {summary?.rollup.consolidatedCurrentBalance &&
                              summary.rollup.consolidatedCurrency
                                ? `Balance: ${formatCurrencyAmount(
                                    summary.rollup.consolidatedCurrentBalance,
                                    summary.rollup.consolidatedCurrency
                                  )}`
                                : summary?.rollup.currencyBuckets.length
                                  ? summary.rollup.currencyBuckets
                                      .map((b) =>
                                        formatCurrencyAmount(
                                          b.effectiveCurrentBalanceTotal,
                                          b.currency
                                        )
                                      )
                                      .join(' · ')
                                  : '0 accounts assigned'}
                              <span className="mx-1.5 text-slate-400">·</span>
                              {summary?.accountCount ?? 0} acc ({pf.baseCurrency})
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditPortfolio(pf)}
                              aria-label={`Edit portfolio ${pf.name}`}
                              className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void setPortfolioStatus(
                                  pf.id,
                                  pf.status === 'archived' ? 'active' : 'archived'
                                )
                              }
                              aria-label={
                                pf.status === 'archived'
                                  ? `Restore portfolio ${pf.name}`
                                  : `Archive portfolio ${pf.name}`
                              }
                              className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              {pf.status === 'archived' ? (
                                <RotateCcw className="w-3.5 h-3.5" />
                              ) : (
                                <Archive className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeletePfId((cur) => (cur === pf.id ? null : pf.id))
                              }
                              aria-label={`Delete portfolio ${pf.name}`}
                              className="p-1.5 rounded text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {isConfirmDelete && (
                          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-rose-800 dark:text-rose-200">
                              Delete portfolio? Assigned accounts will become unassigned.
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePfId(null)}
                                className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void deletePortfolio(pf.id).then(() =>
                                    setConfirmDeletePfId(null)
                                  );
                                }}
                                className="px-2 py-0.5 rounded bg-rose-600 text-white"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <form
            onSubmit={(e) => void handleCreatePortfolio(e)}
            className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800"
          >
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Add Portfolio Group
            </div>
            {pfError && <p className="text-xs text-rose-600 dark:text-rose-400">{pfError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="pf-name" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Portfolio Name *
                </label>
                <input
                  id="pf-name"
                  type="text"
                  value={pfName}
                  onChange={(e) => setPfName(e.target.value)}
                  placeholder="e.g., Funded Prop Capital"
                  className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="pf-currency" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Currency
                </label>
                <select
                  id="pf-currency"
                  value={pfCurrency}
                  onChange={(e) => setPfCurrency(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="pf-desc" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Description
              </label>
              <input
                id="pf-desc"
                type="text"
                value={pfDesc}
                onChange={(e) => setPfDesc(e.target.value)}
                placeholder="Optional portfolio description"
                className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={pfBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{pfBusy ? 'Adding...' : 'Add Portfolio'}</span>
            </button>
          </form>
        </section>
      </div>

      {/* Row 2: Reference Library (Brokers, Platforms, Prop Firms) + FX Rate Snapshots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Reference Library Panel */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Broker, Platform &amp; Prop-Firm Library
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Standardized workspace entities selectable when creating or editing accounts.
              </p>
            </div>
            <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleSwitchRefTab('brokers')}
                className={`px-2.5 py-1 rounded font-medium ${
                  refTab === 'brokers'
                    ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Brokers ({brokers.length})
              </button>
              <button
                type="button"
                onClick={() => handleSwitchRefTab('platforms')}
                className={`px-2.5 py-1 rounded font-medium ${
                  refTab === 'platforms'
                    ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Platforms ({platforms.length})
              </button>
              <button
                type="button"
                onClick={() => handleSwitchRefTab('prop_firms')}
                className={`px-2.5 py-1 rounded font-medium ${
                  refTab === 'prop_firms'
                    ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Prop Firms ({propFirms.length})
              </button>
            </div>
          </div>

          {activeRefItems.length === 0 ? (
            <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              No {refTab.replace('_', ' ')} added yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md max-h-64 overflow-y-auto">
              {activeRefItems.map((item) => {
                const sub = 'website' in item ? item.website : item.vendor;
                return (
                  <div key={item.id} className="p-3 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {item.name}
                          {item.status === 'archived' && (
                            <span className="ml-1.5 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                              · Archived
                            </span>
                          )}
                        </div>
                        {(sub || item.notes) && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {[sub, item.notes].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditRef(item)}
                          aria-label={`Edit ${item.name}`}
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextStatus = item.status === 'archived' ? 'active' : 'archived';
                            if (refTab === 'brokers') void setBrokerStatus(item.id, nextStatus);
                            else if (refTab === 'platforms')
                              void setTradingPlatformStatus(item.id, nextStatus);
                            else void setPropFirmStatus(item.id, nextStatus);
                          }}
                          aria-label={
                            item.status === 'archived'
                              ? `Restore ${item.name}`
                              : `Archive ${item.name}`
                          }
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {item.status === 'archived' ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteRefId((cur) => (cur === item.id ? null : item.id))
                          }
                          aria-label={`Delete ${item.name}`}
                          className="p-1.5 rounded text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {confirmDeleteRefId === item.id && (
                      <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-rose-800 dark:text-rose-200">
                          Delete {item.name} from reference library?
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRefId(null)}
                            className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const fn =
                                refTab === 'brokers'
                                  ? deleteBroker
                                  : refTab === 'platforms'
                                    ? deleteTradingPlatform
                                    : deletePropFirm;
                              void fn(item.id).then(() => setConfirmDeleteRefId(null));
                            }}
                            className="px-2 py-0.5 rounded bg-rose-600 text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <form
            onSubmit={(e) => void handleSubmitRef(e)}
            className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {refEditingId ? 'Edit' : 'Add'}{' '}
                {refTab === 'brokers'
                  ? 'Broker'
                  : refTab === 'platforms'
                    ? 'Trading Platform'
                    : 'Prop Firm'}
              </span>
              {refEditingId && (
                <button
                  type="button"
                  onClick={resetRefForm}
                  className="text-[11px] text-slate-500 hover:underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            {refError && <p className="text-xs text-rose-600 dark:text-rose-400">{refError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ref-name" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Name *
                </label>
                <input
                  id="ref-name"
                  type="text"
                  value={refName}
                  onChange={(e) => setRefName(e.target.value)}
                  placeholder={
                    refTab === 'brokers'
                      ? 'e.g., Pepperstone'
                      : refTab === 'platforms'
                        ? 'e.g., MetaTrader 5'
                        : 'e.g., FTMO'
                  }
                  className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="ref-meta" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {refTab === 'platforms' ? 'Vendor' : 'Website'}
                </label>
                <input
                  id="ref-meta"
                  type="text"
                  value={refMeta}
                  onChange={(e) => setRefMeta(e.target.value)}
                  placeholder={
                    refTab === 'platforms' ? 'e.g., MetaQuotes' : 'e.g., https://example.com'
                  }
                  className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div>
              <label htmlFor="ref-notes" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Notes
              </label>
              <input
                id="ref-notes"
                type="text"
                value={refNotes}
                onChange={(e) => setRefNotes(e.target.value)}
                placeholder="Commission tier, payout rules, or server conventions"
                className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={refBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {refBusy
                  ? 'Saving...'
                  : refEditingId
                    ? 'Save Changes'
                    : `Add ${
                        refTab === 'brokers'
                          ? 'Broker'
                          : refTab === 'platforms'
                            ? 'Platform'
                            : 'Prop Firm'
                      }`}
              </span>
            </button>
          </form>
        </section>

        {/* Manual FX Rate Snapshots */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-start gap-2.5">
            <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                FX Rate Snapshots ({fxRates.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-currency workspace and portfolio rollups never assume 1:1 parity. Record
                explicit exchange rates to enable consolidated reporting in{' '}
                <span className="font-mono">{activeWorkspace?.baseCurrency ?? 'USD'}</span>.
              </p>
            </div>
          </div>

          {fxRates.length === 0 ? (
            <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              No FX rate snapshots recorded yet. Multi-currency accounts will display partitioned
              currency buckets until FX rates are added.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md max-h-64 overflow-y-auto">
              {fxRates.map((fx) => (
                <div key={fx.id} className="p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        1 {fx.baseCurrency} = {fx.rate} {fx.quoteCurrency}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        {fx.capturedAt.slice(0, 10)} · {fx.source.replace(/_/g, ' ')}
                        {fx.notes ? ` · ${fx.notes}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditFx(fx)}
                        aria-label={`Edit FX rate ${fx.baseCurrency}/${fx.quoteCurrency}`}
                        className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteFxId((cur) => (cur === fx.id ? null : fx.id))
                        }
                        aria-label={`Delete FX rate ${fx.baseCurrency}/${fx.quoteCurrency}`}
                        className="p-1.5 rounded text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {confirmDeleteFxId === fx.id && (
                    <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-rose-800 dark:text-rose-200">
                        Remove {fx.baseCurrency}/{fx.quoteCurrency} rate snapshot?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteFxId(null)}
                          className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void deleteFXRate(fx.id).then(() => setConfirmDeleteFxId(null));
                          }}
                          className="px-2 py-0.5 rounded bg-rose-600 text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => void handleSubmitFx(e)}
            className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {editingFxId ? 'Edit FX Rate Snapshot' : 'Record FX Rate Snapshot'}
              </span>
              {editingFxId && (
                <button
                  type="button"
                  onClick={resetFxForm}
                  className="text-[11px] text-slate-500 hover:underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            {fxError && <p className="text-xs text-rose-600 dark:text-rose-400">{fxError}</p>}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="fx-base" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Base
                </label>
                <select
                  id="fx-base"
                  value={fxBase}
                  onChange={(e) => setFxBase(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="fx-quote" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Quote
                </label>
                <select
                  id="fx-quote"
                  value={fxQuote}
                  onChange={(e) => setFxQuote(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="fx-rate" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Rate *
                </label>
                <input
                  id="fx-rate"
                  type="text"
                  inputMode="decimal"
                  value={fxRateVal}
                  onChange={(e) => setFxRateVal(e.target.value)}
                  placeholder="e.g., 1.0850"
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fx-date" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  As-Of Date *
                </label>
                <input
                  id="fx-date"
                  type="date"
                  value={fxDate}
                  onChange={(e) => setFxDate(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="fx-source" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Rate Source
                </label>
                <select
                  id="fx-source"
                  value={fxSource}
                  onChange={(e) =>
                    setFxSource(e.target.value as 'manual' | 'historical_feed' | 'broker_report')
                  }
                  className="w-full h-9 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  <option value="manual">Manual Entry</option>
                  <option value="broker_report">Broker Statement</option>
                  <option value="historical_feed">Historical Feed</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="fx-notes" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Notes
              </label>
              <input
                id="fx-notes"
                type="text"
                value={fxNotes}
                onChange={(e) => setFxNotes(e.target.value)}
                placeholder="Optional settlement reference"
                className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={fxBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{fxBusy ? 'Saving...' : editingFxId ? 'Update FX Rate' : 'Save FX Rate'}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
