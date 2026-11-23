import React, { useEffect, useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { COMMON_CURRENCIES, COMMON_TIMEZONES } from '../../domain/validation/accountValidation';

export function SettingsPage() {
  const { authStatus, currentUser, userProfile, theme, setTheme, updatePreferences } = useApp();

  const [displayName, setDisplayName] = useState(
    userProfile?.displayName ?? currentUser?.displayName ?? ''
  );
  const [defaultCurrency, setDefaultCurrency] = useState(userProfile?.defaultCurrency ?? 'USD');
  const [timezone, setTimezone] = useState(userProfile?.timezone ?? 'UTC');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName);
      setDefaultCurrency(userProfile.defaultCurrency);
      setTimezone(userProfile.timezone);
    }
  }, [userProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await updatePreferences({
        displayName: displayName.trim() || 'Trader',
        defaultCurrency,
        timezone,
      });
      setSavedNotice(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50">
          Settings &amp; Preferences
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Configure appearance, display currency, timezone conventions, and view active persistence
          boundaries.
        </p>
      </div>

      {/* Appearance */}
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Terminal Theme
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Switch between refined dark mode and high-clarity light mode.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void setTheme('dark')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md border transition-colors ${
              theme === 'dark'
                ? 'border-sky-500 bg-sky-500/15 text-sky-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark Terminal</span>
          </button>
          <button
            type="button"
            onClick={() => void setTheme('light')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md border transition-colors ${
              theme === 'light'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light Terminal</span>
          </button>
        </div>
      </section>

      {/* Profile & Conventions */}
      <form
        onSubmit={(e) => void handleSave(e)}
        className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
      >
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Profile &amp; Regional Conventions
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Persisted per authenticated user profile (or Demo Sandbox session in Demo Mode).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pref-display-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Display Name
            </label>
            <input
              id="pref-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="pref-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Identity
            </label>
            <input
              id="pref-email"
              type="text"
              disabled
              value={currentUser?.email ?? 'Not provided'}
              className="w-full h-9 px-3 text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="pref-currency" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Default Display Currency
            </label>
            <select
              id="pref-currency"
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              className="w-full h-9 px-3 text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100"
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pref-tz" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Default Timezone
            </label>
            <select
              id="pref-tz"
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
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            {savedNotice && (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Preferences saved</span>
              </>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Architecture & Security Transparency */}
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-2 text-xs">
        <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
          Environment &amp; Persistence State
        </h2>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <span className="text-slate-500 dark:text-slate-400">Active Session Mode</span>
          <span className="font-mono text-right text-slate-900 dark:text-slate-100">
            {authStatus === 'demo_mode' ? 'Isolated Demo Mode (Local Session)' : 'Firebase Authenticated'}
          </span>
          <span className="text-slate-500 dark:text-slate-400">Cloud Database</span>
          <span className="font-mono text-right text-slate-900 dark:text-slate-100">
            Cloud Firestore (Owner-Scoped Rules)
          </span>
          <span className="text-slate-500 dark:text-slate-400">Offline Sync / IndexedDB</span>
          <span className="font-mono text-right text-slate-500 dark:text-slate-400">
            Planned (Stage 6)
          </span>
        </div>
      </section>
    </div>
  );
}
