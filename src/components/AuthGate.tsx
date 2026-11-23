import React, { useState } from 'react';
import { ArrowRight, Database, Lock, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useApp } from '../app/AppContext';

export function AuthGate() {
  const { signInWithGoogle, enterDemoMode, theme, setTheme, authError } = useApp();
  const [signingIn, setSigningIn] = useState(false);
  const [enteringDemo, setEnteringDemo] = useState(false);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      // authError state is surfaced in UI
    } finally {
      setSigningIn(false);
    }
  };

  const handleEnterDemo = async () => {
    setEnteringDemo(true);
    try {
      await enterDemoMode();
    } finally {
      setEnteringDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col justify-between">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-8 border-b border-slate-200 dark:border-slate-800/80">
        <span className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
          DDT-90 JOURNAL
        </span>
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <section className="lg:col-span-7 space-y-6">
          <div className="text-xs font-medium text-sky-700 dark:text-sky-400 tracking-wide">
            Stage 0 Foundation · Account Ledger & Workspace Core
          </div>
          <h1
            className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 max-w-xl"
            style={{ textWrap: 'balance' }}
          >
            Institutional-grade trading journal and performance operating system
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
            Built on one unified domain model for multi-account management, broker and prop-firm
            rules, decimal-safe ledger reconciliation, and isolated cloud workspaces.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800/80">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Owner-Scoped Rules</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Workspace and account isolation enforced directly in Firestore security rules.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <Database className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Decimal Ledger</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Starting balances, payouts, fees, and verified snapshots reconcile without float drift.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Isolated Demo Mode</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Evaluate Stage 0 workflows in a sandbox completely separate from real user data.
              </p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                Workspace Access
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Sign in with your verified Google account to persist workspaces and accounts in Cloud
                Firestore, or explore Stage 0 in Isolated Demo Mode.
              </p>
            </div>

            {authError && (
              <div
                role="alert"
                className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 text-xs text-rose-700 dark:text-rose-300"
              >
                {authError}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={signingIn || enteringDemo}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-md bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 hover:opacity-95 disabled:opacity-50 transition-opacity whitespace-nowrap"
              >
                <span>{signingIn ? 'Connecting to Google Auth...' : 'Sign in with Google'}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              <div className="relative py-2 flex items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                <span className="px-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  or evaluate locally
                </span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              </div>

              <button
                type="button"
                onClick={() => void handleEnterDemo()}
                disabled={signingIn || enteringDemo}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <span>{enteringDemo ? 'Initializing Sandbox...' : 'Enter Isolated Demo Mode'}</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <p>
                Demo Mode uses local session memory only and never writes to or mixes with your
                authenticated Cloud Firestore workspace.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-6 py-4 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>DDT-90 JOURNAL · Stage 0 Foundation</span>
        <span>Firebase Auth & Cloud Firestore Connected</span>
      </footer>
    </div>
  );
}
