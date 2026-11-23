import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plug,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { useApp } from '../app/AppContext';
import { APP_ROUTES, getRouteById, type NavRouteId } from '../app/routes';

const ROUTE_ICONS: Record<NavRouteId, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  workspaces: Briefcase,
  accounts: CreditCard,
  journal: BookOpen,
  playbooks: Layers,
  risk: ShieldAlert,
  prop_firms: Trophy,
  analytics: BarChart3,
  psychology: Activity,
  reports: FileText,
  import_export: FileSpreadsheet,
  ai_coach: Bot,
  automation: Target,
  integrations: Plug,
  settings: Settings,
};

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const {
    authStatus,
    currentUser,
    workspaces,
    activeWorkspace,
    accounts,
    trades,
    activeAccountId,
    activeRoute,
    theme,
    errorMessage,
    setActiveRoute,
    setActiveAccountId,
    selectWorkspace,
    setTheme,
    logout,
    resetDemoSandbox,
    clearError,
  } = useApp();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentRouteDef = getRouteById(activeRoute);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const coreRoutes = useMemo(() => APP_ROUTES.filter((r) => r.group === 'core'), []);
  const roadmapRoutes = useMemo(() => APP_ROUTES.filter((r) => r.group === 'roadmap'), []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchingRoutes = APP_ROUTES.filter(
      (r) => !q || r.label.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)
    );
    const matchingAccounts = accounts.filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.brokerName ?? '').toLowerCase().includes(q) ||
        (a.propFirmName ?? '').toLowerCase().includes(q)
    );
    const matchingTrades = trades
      .filter(
        (t) =>
          !t.isArchived &&
          (!q ||
            t.symbol.toLowerCase().includes(q) ||
            (t.externalTicketId ?? '').toLowerCase().includes(q) ||
            (t.setupTag ?? '').toLowerCase().includes(q) ||
            t.direction.toLowerCase().includes(q))
      )
      .slice(0, 5);
    return { routes: matchingRoutes, accounts: matchingAccounts, trades: matchingTrades };
  }, [accounts, searchQuery, trades]);

  const handleSelectNav = (id: NavRouteId) => {
    setActiveRoute(id);
    setMobileNavOpen(false);
  };

  const renderNavItems = (collapsed: boolean) => (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-6 py-4">
        <div>
          {!collapsed && (
            <div className="px-4 pb-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Active Modules
            </div>
          )}
          <nav aria-label="Core navigation" className="space-y-0.5 px-2">
            {coreRoutes.map((route) => {
              const Icon = ROUTE_ICONS[route.id];
              const isActive = activeRoute === route.id;
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => handleSelectNav(route.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? route.label : undefined}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-sky-500/15 dark:text-sky-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{route.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4">
          {!collapsed && (
            <div className="px-4 pb-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Roadmap Modules (Stage 2+)
            </div>
          )}
          <nav aria-label="Planned roadmap modules" className="space-y-0.5 px-2">
            {roadmapRoutes.map((route) => {
              const Icon = ROUTE_ICONS[route.id];
              const isActive = activeRoute === route.id;
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => handleSelectNav(route.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? `${route.label} (${route.targetStage})` : undefined}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-medium'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    {!collapsed && <span className="truncate">{route.label}</span>}
                  </span>
                  {!collapsed && (
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                      {route.targetStage}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
        {!collapsed && currentUser && (
          <div className="px-1.5 py-1">
            <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
              {currentUser.displayName ?? 'Trader'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {authStatus === 'demo_mode'
                ? 'Isolated Demo Sandbox'
                : currentUser.email ?? 'Authenticated'}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <span>{authStatus === 'demo_mode' ? 'Exit Demo Mode' : 'Sign Out'}</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0E131D] transition-all duration-150 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80">
          {!sidebarCollapsed && (
            <span className="font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">
              DDT-90 JOURNAL
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{renderNavItems(sidebarCollapsed)}</div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[80vw] bg-white dark:bg-[#0E131D] border-r border-slate-200 dark:border-slate-800 flex flex-col h-full">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                DDT-90 JOURNAL
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderNavItems(false)}</div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {authStatus === 'demo_mode' && (
          <div
            data-testid="demo-mode-banner"
            className="px-4 sm:px-6 py-2 bg-amber-50 dark:bg-amber-950/35 border-b border-amber-200 dark:border-amber-900/60 flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <div className="text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Isolated Demo Mode</span>
              <span className="mx-1.5 text-amber-500" aria-hidden="true">
                ·
              </span>
              <span className="sm:hidden">Local sandbox only.</span>
              <span className="hidden sm:inline">
                Sandbox data is stored strictly in local session memory and never mixes with real
                Cloud Firestore workspaces.
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => void resetDemoSandbox()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Sandbox</span>
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="px-2.5 py-1 text-xs font-medium rounded bg-amber-900 text-white dark:bg-amber-400 dark:text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Exit Demo
              </button>
            </div>
          </div>
        )}

        {/* Top Bar */}
        <header className="h-14 px-4 sm:px-6 bg-white dark:bg-[#0E131D] border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="hidden sm:inline text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {activeWorkspace?.name ?? 'Workspace'}
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
                /
              </span>
              <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {currentRouteDef.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Workspace Switcher */}
            {workspaces.length > 0 && (
              <div className="hidden md:flex items-center">
                <label htmlFor="topbar-workspace-select" className="sr-only">
                  Active Workspace
                </label>
                <select
                  id="topbar-workspace-select"
                  value={activeWorkspace?.id ?? ''}
                  onChange={(e) => void selectWorkspace(e.target.value)}
                  className="h-8 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/40 max-w-[170px] truncate"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Account Scope Switcher */}
            <div className="hidden sm:flex items-center">
              <label htmlFor="topbar-account-select" className="sr-only">
                Active Account Scope
              </label>
              <select
                id="topbar-account-select"
                value={activeAccountId}
                onChange={(e) => setActiveAccountId(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/40 max-w-[190px] truncate"
              >
                <option value="all">All Accounts ({accounts.filter((a) => a.status !== 'archived').length})</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.baseCurrency})
                  </option>
                ))}
              </select>
            </div>

            {/* Command Search */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Open command search"
              className="h-8 px-2.5 inline-flex items-center gap-2 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Search</span>
              <span className="hidden xl:inline font-mono text-[10px] text-slate-400">⌘K</span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="mx-4 sm:mx-6 mt-4 p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 flex items-center justify-between gap-4 text-xs text-rose-800 dark:text-rose-200"
          >
            <span className="break-all">{errorMessage}</span>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/50 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>

      {/* Global Search / Command Palette Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/60"
          role="dialog"
          aria-modal="true"
          aria-label="Global command search"
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <label htmlFor="global-command-input" className="sr-only">
                Search modules and accounts
              </label>
              <input
                id="global-command-input"
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Jump to module or account..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 space-y-3">
              {searchResults.accounts.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Accounts
                  </div>
                  {searchResults.accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setActiveAccountId(acc.id);
                        setActiveRoute('accounts');
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="font-medium truncate">{acc.name}</span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                        {acc.baseCurrency} · {acc.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults.trades.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Recent Trades
                  </div>
                  {searchResults.trades.map((trd) => (
                    <button
                      key={trd.id}
                      type="button"
                      onClick={() => {
                        setActiveAccountId(trd.accountId);
                        setActiveRoute('journal');
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="font-medium truncate">
                        <span className="font-mono">{trd.symbol}</span> · {trd.direction.toUpperCase()}
                        {trd.setupTag ? ` · ${trd.setupTag}` : ''}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                        {trd.status}
                        {trd.entryAt ? ` · ${trd.entryAt.slice(0, 10)}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div>
                <div className="px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Navigation Modules
                </div>
                {searchResults.routes.map((route) => (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => {
                      setActiveRoute(route.id);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium">{route.label}</span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {route.implementedInStage0 ? 'Active' : route.targetStage}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
