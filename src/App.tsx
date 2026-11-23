import React from 'react';
import { AppProvider, useApp } from './app/AppContext';
import { getRouteById } from './app/routes';
import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShellLayout } from './components/ShellLayout';
import { AccountsPage } from './features/accounts/AccountsPage';
import { OverviewPage } from './features/dashboard/OverviewPage';
import { PlannedModulePage } from './features/roadmap/PlannedModulePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TradeJournalPage } from './features/trades/TradeJournalPage';
import { WorkspacesPage } from './features/workspaces/WorkspacesPage';

function MainRouter() {
  const { authStatus, activeRoute } = useApp();

  if (authStatus === 'initializing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F17] text-xs text-slate-500 dark:text-slate-400">
        Verifying workspace session...
      </div>
    );
  }

  if (authStatus === 'signed_out') {
    return <AuthGate />;
  }

  const routeDef = getRouteById(activeRoute);

  return (
    <ShellLayout>
      {activeRoute === 'overview' && <OverviewPage />}
      {activeRoute === 'workspaces' && <WorkspacesPage />}
      {activeRoute === 'accounts' && <AccountsPage />}
      {activeRoute === 'journal' && <TradeJournalPage />}
      {activeRoute === 'settings' && <SettingsPage />}
      {!routeDef.implementedInStage0 && <PlannedModulePage route={routeDef} />}
    </ShellLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainRouter />
      </AppProvider>
    </ErrorBoundary>
  );
}
