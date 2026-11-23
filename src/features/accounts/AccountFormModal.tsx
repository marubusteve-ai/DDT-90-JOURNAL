import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import type { Account, AccountStatus, AccountType, DrawdownMode } from '../../domain/models';
import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  accountInputSchema,
  COMMON_CURRENCIES,
  COMMON_TIMEZONES,
  DRAWDOWN_MODES,
  type AccountInput,
} from '../../domain/validation/accountValidation';

interface AccountFormModalProps {
  existingAccount?: Account | null;
  onClose: () => void;
  onSaved: (account: Account) => void;
}

const MANUAL_VALUE = '__manual__';

export function AccountFormModal({ existingAccount, onClose, onSaved }: AccountFormModalProps) {
  const {
    activeWorkspace,
    portfolios,
    brokers,
    platforms,
    propFirms,
    createAccount,
    updateAccount,
  } = useApp();

  const [name, setName] = useState(existingAccount?.name ?? '');
  const [accountIdentifierMasked, setAccountIdentifierMasked] = useState(
    existingAccount?.accountIdentifierMasked ?? ''
  );
  const [portfolioId, setPortfolioId] = useState(existingAccount?.portfolioId ?? '');
  const [accountType, setAccountType] = useState<AccountType>(
    existingAccount?.accountType ?? 'personal_live'
  );
  const [customCategory, setCustomCategory] = useState(existingAccount?.customCategory ?? '');
  const [status, setStatus] = useState<AccountStatus>(existingAccount?.status ?? 'active');

  const [brokerId, setBrokerId] = useState<string>(
    existingAccount?.brokerId
      ? existingAccount.brokerId
      : existingAccount?.brokerName
        ? MANUAL_VALUE
        : ''
  );
  const [brokerName, setBrokerName] = useState(existingAccount?.brokerName ?? '');

  const [propFirmId, setPropFirmId] = useState<string>(
    existingAccount?.propFirmId
      ? existingAccount.propFirmId
      : existingAccount?.propFirmName
        ? MANUAL_VALUE
        : ''
  );
  const [propFirmName, setPropFirmName] = useState(existingAccount?.propFirmName ?? '');

  const [platformId, setPlatformId] = useState<string>(
    existingAccount?.platformId
      ? existingAccount.platformId
      : existingAccount?.platformName
        ? MANUAL_VALUE
        : ''
  );
  const [platformName, setPlatformName] = useState(existingAccount?.platformName ?? '');

  const [baseCurrency, setBaseCurrency] = useState(
    existingAccount?.baseCurrency ?? activeWorkspace?.baseCurrency ?? 'USD'
  );
  const [timezone, setTimezone] = useState(
    existingAccount?.timezone ?? activeWorkspace?.timezone ?? 'UTC'
  );
  const [startingBalance, setStartingBalance] = useState(existingAccount?.startingBalance ?? '');
  const [verifiedBalanceSnapshot, setVerifiedBalanceSnapshot] = useState(
    existingAccount?.verifiedBalanceSnapshot ?? ''
  );
  const [verifiedEquitySnapshot, setVerifiedEquitySnapshot] = useState(
    existingAccount?.verifiedEquitySnapshot ?? ''
  );
  const [snapshotAsOf, setSnapshotAsOf] = useState(existingAccount?.snapshotAsOf ?? '');
  const [reconciliationNotes, setReconciliationNotes] = useState(
    existingAccount?.reconciliationNotes ?? ''
  );
  const [openingDate, setOpeningDate] = useState(existingAccount?.openingDate ?? '');
  const [challengePhase, setChallengePhase] = useState(existingAccount?.challengePhase ?? '');
  const [profitTargetAmount, setProfitTargetAmount] = useState(
    existingAccount?.profitTargetAmount ?? ''
  );
  const [profitTargetPct, setProfitTargetPct] = useState(existingAccount?.profitTargetPct ?? '');
  const [maxDailyLossAmount, setMaxDailyLossAmount] = useState(
    existingAccount?.maxDailyLossAmount ?? ''
  );
  const [maxDailyLossPct, setMaxDailyLossPct] = useState(existingAccount?.maxDailyLossPct ?? '');
  const [maxOverallLossAmount, setMaxOverallLossAmount] = useState(
    existingAccount?.maxOverallLossAmount ?? ''
  );
  const [maxOverallLossPct, setMaxOverallLossPct] = useState(
    existingAccount?.maxOverallLossPct ?? ''
  );
  const [drawdownMode, setDrawdownMode] = useState<DrawdownMode>(
    existingAccount?.drawdownMode ?? 'none'
  );
  const [minTradingDays, setMinTradingDays] = useState(
    existingAccount?.minTradingDays !== null && existingAccount?.minTradingDays !== undefined
      ? String(existingAccount.minTradingDays)
      : ''
  );
  const [maxTradingDays, setMaxTradingDays] = useState(
    existingAccount?.maxTradingDays !== null && existingAccount?.maxTradingDays !== undefined
      ? String(existingAccount.maxTradingDays)
      : ''
  );
  const [notes, setNotes] = useState(existingAccount?.notes ?? '');
  const [tagsRaw, setTagsRaw] = useState(existingAccount?.tags.join(', ') ?? '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const visiblePortfolios = useMemo(
    () =>
      portfolios.filter(
        (p) => p.status === 'active' || p.id === existingAccount?.portfolioId
      ),
    [existingAccount?.portfolioId, portfolios]
  );

  const visibleBrokers = useMemo(
    () =>
      brokers.filter((b) => b.status === 'active' || b.id === existingAccount?.brokerId),
    [brokers, existingAccount?.brokerId]
  );

  const visiblePropFirms = useMemo(
    () =>
      propFirms.filter((f) => f.status === 'active' || f.id === existingAccount?.propFirmId),
    [existingAccount?.propFirmId, propFirms]
  );

  const visiblePlatforms = useMemo(
    () =>
      platforms.filter((p) => p.status === 'active' || p.id === existingAccount?.platformId),
    [existingAccount?.platformId, platforms]
  );

  const handleBrokerSelect = (val: string) => {
    setBrokerId(val);
    if (val === '') {
      setBrokerName('');
    } else if (val === MANUAL_VALUE) {
      if (brokers.some((b) => b.name === brokerName)) {
        setBrokerName('');
      }
    } else {
      const match = brokers.find((b) => b.id === val);
      setBrokerName(match?.name ?? '');
    }
  };

  const handlePropFirmSelect = (val: string) => {
    setPropFirmId(val);
    if (val === '') {
      setPropFirmName('');
    } else if (val === MANUAL_VALUE) {
      if (propFirms.some((f) => f.name === propFirmName)) {
        setPropFirmName('');
      }
    } else {
      const match = propFirms.find((f) => f.id === val);
      setPropFirmName(match?.name ?? '');
    }
  };

  const handlePlatformSelect = (val: string) => {
    setPlatformId(val);
    if (val === '') {
      setPlatformName('');
    } else if (val === MANUAL_VALUE) {
      if (platforms.some((p) => p.name === platformName)) {
        setPlatformName('');
      }
    } else {
      const match = platforms.find((p) => p.id === val);
      setPlatformName(match?.name ?? '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError(null);

    const parsedTags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const resolvedBrokerId = brokerId && brokerId !== MANUAL_VALUE ? brokerId : null;
    const resolvedPropFirmId = propFirmId && propFirmId !== MANUAL_VALUE ? propFirmId : null;
    const resolvedPlatformId = platformId && platformId !== MANUAL_VALUE ? platformId : null;

    const candidate = {
      portfolioId: portfolioId || null,
      name,
      accountIdentifierMasked: accountIdentifierMasked || null,
      accountType,
      customCategory: customCategory || null,
      status,
      brokerId: resolvedBrokerId,
      brokerName: brokerName || null,
      propFirmId: resolvedPropFirmId,
      propFirmName: propFirmName || null,
      platformId: resolvedPlatformId,
      platformName: platformName || null,
      baseCurrency,
      timezone,
      startingBalance,
      verifiedBalanceSnapshot: verifiedBalanceSnapshot || null,
      verifiedEquitySnapshot: verifiedEquitySnapshot || null,
      snapshotAsOf: snapshotAsOf || null,
      reconciliationNotes: reconciliationNotes || null,
      openingDate: openingDate || null,
      challengePhase: challengePhase || null,
      profitTargetAmount: profitTargetAmount || null,
      profitTargetPct: profitTargetPct || null,
      maxDailyLossAmount: maxDailyLossAmount || null,
      maxDailyLossPct: maxDailyLossPct || null,
      maxOverallLossAmount: maxOverallLossAmount || null,
      maxOverallLossPct: maxOverallLossPct || null,
      drawdownMode,
      minTradingDays: minTradingDays === '' ? null : minTradingDays,
      maxTradingDays: maxTradingDays === '' ? null : maxTradingDays,
      notes: notes || null,
      tags: parsedTags,
    };

    const result = accountInputSchema.safeParse(candidate);
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
      const payload: AccountInput = result.data;
      const saved = existingAccount
        ? await updateAccount(existingAccount.id, payload)
        : await createAccount(payload);
      onSaved(saved);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      <div className="w-full max-w-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2
              id="account-modal-title"
              className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {existingAccount ? `Edit Account: ${existingAccount.name}` : 'New Trading Account'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure broker/prop-firm references, starting capital, risk thresholds, and optional
              verified snapshots.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto p-6 space-y-6">
          {submitError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 text-xs text-rose-700 dark:text-rose-300"
            >
              {submitError}
            </div>
          )}

          {/* Section 1: Core Identification */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5 w-full">
              1. Identification, Classification &amp; Reference Entities
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="acc-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Account Name *
                </label>
                <input
                  id="acc-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., FTMO 100K Swing"
                  className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="acc-masked-id" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Masked Account ID / Reference
                </label>
                <input
                  id="acc-masked-id"
                  type="text"
                  value={accountIdentifierMasked}
                  onChange={(e) => setAccountIdentifierMasked(e.target.value)}
                  placeholder="e.g., •••• 4821 (avoid full credentials)"
                  className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>

              <div>
                <label htmlFor="acc-type" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Account Type *
                </label>
                <select
                  id="acc-type"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as AccountType)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="acc-custom-category" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Custom Category Label {accountType === 'custom' ? '(Recommended)' : '(Optional)'}
                </label>
                <input
                  id="acc-custom-category"
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g., Algorithmic Replay, Copy Account"
                  className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
                {fieldErrors.customCategory && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {fieldErrors.customCategory}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="acc-status" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Status *
                </label>
                <select
                  id="acc-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AccountStatus)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  {ACCOUNT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="acc-portfolio" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Portfolio Group
                </label>
                <select
                  id="acc-portfolio"
                  value={portfolioId}
                  onChange={(e) => setPortfolioId(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  <option value="">Unassigned</option>
                  {visiblePortfolios.map((pf) => (
                    <option key={pf.id} value={pf.id}>
                      {pf.name} ({pf.baseCurrency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="acc-opening-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Opening Date
                </label>
                <input
                  id="acc-opening-date"
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                  className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>
            </div>

            {/* Broker, Prop Firm, Platform structured selectors + manual fallback */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="acc-broker-select" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Broker Reference
                </label>
                <select
                  id="acc-broker-select"
                  value={brokerId}
                  onChange={(e) => handleBrokerSelect(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  <option value="">None</option>
                  {visibleBrokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                  <option value={MANUAL_VALUE}>Custom / Manual entry...</option>
                </select>
                {brokerId === MANUAL_VALUE && (
                  <input
                    id="acc-broker"
                    type="text"
                    aria-label="Manual broker name"
                    value={brokerName}
                    onChange={(e) => setBrokerName(e.target.value)}
                    placeholder="Enter broker name"
                    className="w-full h-8 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="acc-propfirm-select" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Prop Firm Reference
                </label>
                <select
                  id="acc-propfirm-select"
                  value={propFirmId}
                  onChange={(e) => handlePropFirmSelect(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  <option value="">None</option>
                  {visiblePropFirms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                  <option value={MANUAL_VALUE}>Custom / Manual entry...</option>
                </select>
                {propFirmId === MANUAL_VALUE && (
                  <input
                    id="acc-propfirm"
                    type="text"
                    aria-label="Manual prop firm name"
                    value={propFirmName}
                    onChange={(e) => setPropFirmName(e.target.value)}
                    placeholder="Enter prop firm name"
                    className="w-full h-8 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="acc-platform-select" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Trading Platform Reference
                </label>
                <select
                  id="acc-platform-select"
                  value={platformId}
                  onChange={(e) => handlePlatformSelect(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  <option value="">None</option>
                  {visiblePlatforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value={MANUAL_VALUE}>Custom / Manual entry...</option>
                </select>
                {platformId === MANUAL_VALUE && (
                  <input
                    id="acc-platform"
                    type="text"
                    aria-label="Manual trading platform name"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    placeholder="e.g., cTrader, MT5, TWS"
                    className="w-full h-8 px-2.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                  />
                )}
              </div>
            </div>
          </fieldset>

          {/* Section 2: Capital & Reconciliation */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5 w-full">
              2. Capital, Currency &amp; Balance Reconciliation
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="acc-currency" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Base Currency *
                </label>
                <select
                  id="acc-currency"
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {fieldErrors.baseCurrency && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {fieldErrors.baseCurrency}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="acc-timezone" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Account Timezone *
                </label>
                <select
                  id="acc-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="acc-starting-balance" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Starting Balance *
                </label>
                <input
                  id="acc-starting-balance"
                  type="text"
                  inputMode="decimal"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  placeholder="e.g., 100000.00"
                  className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
                {fieldErrors.startingBalance && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {fieldErrors.startingBalance}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="acc-verified-balance" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Verified Balance Snapshot
                </label>
                <input
                  id="acc-verified-balance"
                  type="text"
                  inputMode="decimal"
                  value={verifiedBalanceSnapshot}
                  onChange={(e) => setVerifiedBalanceSnapshot(e.target.value)}
                  placeholder="Leave blank if unverified"
                  className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
                {fieldErrors.verifiedBalanceSnapshot && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {fieldErrors.verifiedBalanceSnapshot}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="acc-verified-equity" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Verified Equity Snapshot
                </label>
                <input
                  id="acc-verified-equity"
                  type="text"
                  inputMode="decimal"
                  value={verifiedEquitySnapshot}
                  onChange={(e) => setVerifiedEquitySnapshot(e.target.value)}
                  placeholder="Leave blank if unknown"
                  className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
                {fieldErrors.verifiedEquitySnapshot && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {fieldErrors.verifiedEquitySnapshot}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="acc-snapshot-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Snapshot Date
                </label>
                <input
                  id="acc-snapshot-date"
                  type="date"
                  value={snapshotAsOf}
                  onChange={(e) => setSnapshotAsOf(e.target.value)}
                  className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="acc-reconcile-notes" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reconciliation Notes
              </label>
              <input
                id="acc-reconcile-notes"
                type="text"
                value={reconciliationNotes}
                onChange={(e) => setReconciliationNotes(e.target.value)}
                placeholder="Explain any manual snapshot variance vs starting balance + cash movements"
                className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
            </div>
          </fieldset>

          {/* Section 3: Prop Firm & Risk Parameters */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5 w-full">
              3. Risk &amp; Challenge Parameters (Optional, User-Configurable)
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="acc-phase" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Challenge / Account Phase
                </label>
                <input
                  id="acc-phase"
                  type="text"
                  value={challengePhase}
                  onChange={(e) => setChallengePhase(e.target.value)}
                  placeholder="e.g., Phase 1, Funded"
                  className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="acc-drawdown-mode" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Drawdown Mode
                </label>
                <select
                  id="acc-drawdown-mode"
                  value={drawdownMode}
                  onChange={(e) => setDrawdownMode(e.target.value as DrawdownMode)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                >
                  {DRAWDOWN_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="acc-min-days" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Min Days
                  </label>
                  <input
                    id="acc-min-days"
                    type="number"
                    min={0}
                    value={minTradingDays}
                    onChange={(e) => setMinTradingDays(e.target.value)}
                    className="w-full h-9 px-2.5 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="acc-max-days" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Max Days
                  </label>
                  <input
                    id="acc-max-days"
                    type="number"
                    min={0}
                    value={maxTradingDays}
                    onChange={(e) => setMaxTradingDays(e.target.value)}
                    className="w-full h-9 px-2.5 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div>
                <label htmlFor="acc-pt-amt" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Target ($)
                </label>
                <input
                  id="acc-pt-amt"
                  type="text"
                  value={profitTargetAmount}
                  onChange={(e) => setProfitTargetAmount(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="acc-pt-pct" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Target (%)
                </label>
                <input
                  id="acc-pt-pct"
                  type="text"
                  value={profitTargetPct}
                  onChange={(e) => setProfitTargetPct(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="acc-dl-amt" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Daily Loss ($)
                </label>
                <input
                  id="acc-dl-amt"
                  type="text"
                  value={maxDailyLossAmount}
                  onChange={(e) => setMaxDailyLossAmount(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="acc-dl-pct" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Daily Loss (%)
                </label>
                <input
                  id="acc-dl-pct"
                  type="text"
                  value={maxDailyLossPct}
                  onChange={(e) => setMaxDailyLossPct(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="acc-ol-amt" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Max Loss ($)
                </label>
                <input
                  id="acc-ol-amt"
                  type="text"
                  value={maxOverallLossAmount}
                  onChange={(e) => setMaxOverallLossAmount(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="acc-ol-pct" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Max Loss (%)
                </label>
                <input
                  id="acc-ol-pct"
                  type="text"
                  value={maxOverallLossPct}
                  onChange={(e) => setMaxOverallLossPct(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            {(fieldErrors.profitTargetAmount ||
              fieldErrors.profitTargetPct ||
              fieldErrors.maxDailyLossAmount ||
              fieldErrors.maxDailyLossPct ||
              fieldErrors.maxOverallLossAmount ||
              fieldErrors.maxOverallLossPct ||
              fieldErrors.minTradingDays ||
              fieldErrors.maxTradingDays) && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {fieldErrors.profitTargetAmount ||
                  fieldErrors.profitTargetPct ||
                  fieldErrors.maxDailyLossAmount ||
                  fieldErrors.maxDailyLossPct ||
                  fieldErrors.maxOverallLossAmount ||
                  fieldErrors.maxOverallLossPct ||
                  fieldErrors.minTradingDays ||
                  fieldErrors.maxTradingDays}
              </p>
            )}
          </fieldset>

          {/* Section 4: Notes & Tags */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5 w-full">
              4. Tags &amp; Notes
            </legend>
            <div>
              <label htmlFor="acc-tags" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tags (comma-separated, max 10)
              </label>
              <input
                id="acc-tags"
                type="text"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="e.g., futures, london-session, swing"
                className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.tags && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.tags}</p>
              )}
            </div>
            <div>
              <label htmlFor="acc-notes" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Account Notes &amp; Custom Rule References
              </label>
              <textarea
                id="acc-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document overnight/weekend rules, news restrictions, or account conventions..."
                className="w-full p-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
              />
              {fieldErrors.notes && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.notes}</p>
              )}
            </div>
          </fieldset>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : existingAccount ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
