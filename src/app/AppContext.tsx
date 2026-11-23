import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import Decimal from 'decimal.js';
import type {
  Account,
  AuditLog,
  BalanceSnapshot,
  Broker,
  CashTransaction,
  DataSourceMode,
  FXRateSnapshot,
  InstrumentSpecification,
  Portfolio,
  PropFirm,
  ThemePreference,
  Trade,
  TradingPlatform,
  User,
  UserProfile,
  Workspace,
  WorkspaceStatus,
} from '../domain/models';
import type {
  AccountInput,
  BalanceSnapshotInput,
  BrokerInput,
  CashTransactionInput,
  FXRateInput,
  PortfolioInput,
  PropFirmInput,
  TradingPlatformInput,
  WorkspaceInput,
} from '../domain/validation/accountValidation';
import type { InstrumentSpecInput, TradeInput } from '../domain/validation/tradeValidation';
import { calculateAccountLedger } from '../domain/calculations/accountCalculations';
import { calculateAccountTradeImpact } from '../domain/calculations/tradeCalculations';
import { auth, googleProvider } from '../integrations/firebase/client';
import { DEMO_USER_UID, DemoRepository } from '../repositories/demoRepository';
import { FirestoreRepository } from '../repositories/firestoreRepository';
import type { IDataRepository } from '../repositories/interfaces';
import { APP_ROUTES, type NavRouteId } from './routes';

export type AuthStatus = 'initializing' | 'authenticated' | 'demo_mode' | 'signed_out';

interface AppContextValue {
  authStatus: AuthStatus;
  dataSourceMode: DataSourceMode | null;
  currentUser: User | null;
  userProfile: UserProfile | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  portfolios: Portfolio[];
  accounts: Account[];
  activeAccountId: string | 'all';
  cashTransactions: CashTransaction[];
  balanceSnapshots: BalanceSnapshot[];
  brokers: Broker[];
  platforms: TradingPlatform[];
  propFirms: PropFirm[];
  fxRates: FXRateSnapshot[];
  instruments: InstrumentSpecification[];
  trades: Trade[];
  auditLogs: AuditLog[];
  activeRoute: NavRouteId;
  theme: ThemePreference;
  isLoadingData: boolean;
  errorMessage: string | null;
  authError: string | null;

  setActiveRoute: (route: NavRouteId) => void;
  setActiveAccountId: (accountId: string | 'all') => void;
  setTheme: (theme: ThemePreference) => Promise<void>;
  clearError: () => void;

  signInWithGoogle: () => Promise<void>;
  enterDemoMode: () => Promise<void>;
  exitDemoMode: () => void;
  resetDemoSandbox: () => Promise<void>;
  logout: () => Promise<void>;

  selectWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (input: WorkspaceInput) => Promise<Workspace>;
  updateWorkspace: (workspaceId: string, input: WorkspaceInput) => Promise<Workspace>;
  setWorkspaceStatus: (workspaceId: string, status: WorkspaceStatus) => Promise<Workspace>;

  createPortfolio: (input: PortfolioInput) => Promise<Portfolio>;
  updatePortfolio: (portfolioId: string, input: PortfolioInput) => Promise<Portfolio>;
  setPortfolioStatus: (portfolioId: string, status: WorkspaceStatus) => Promise<Portfolio>;
  deletePortfolio: (portfolioId: string) => Promise<void>;

  createAccount: (input: AccountInput) => Promise<Account>;
  updateAccount: (accountId: string, input: AccountInput) => Promise<Account>;
  setAccountStatus: (accountId: string, status: Account['status']) => Promise<Account>;
  deleteAccount: (accountId: string) => Promise<void>;

  createCashTransaction: (input: CashTransactionInput) => Promise<CashTransaction>;
  updateCashTransaction: (transactionId: string, input: CashTransactionInput) => Promise<CashTransaction>;
  deleteCashTransaction: (transactionId: string) => Promise<void>;

  recordBalanceSnapshot: (input: BalanceSnapshotInput) => Promise<{ snapshot: BalanceSnapshot; account: Account }>;

  createBroker: (input: BrokerInput) => Promise<Broker>;
  updateBroker: (brokerId: string, input: BrokerInput) => Promise<Broker>;
  setBrokerStatus: (brokerId: string, status: WorkspaceStatus) => Promise<Broker>;
  deleteBroker: (brokerId: string) => Promise<void>;

  createTradingPlatform: (input: TradingPlatformInput) => Promise<TradingPlatform>;
  updateTradingPlatform: (platformId: string, input: TradingPlatformInput) => Promise<TradingPlatform>;
  setTradingPlatformStatus: (platformId: string, status: WorkspaceStatus) => Promise<TradingPlatform>;
  deleteTradingPlatform: (platformId: string) => Promise<void>;

  createPropFirm: (input: PropFirmInput) => Promise<PropFirm>;
  updatePropFirm: (firmId: string, input: PropFirmInput) => Promise<PropFirm>;
  setPropFirmStatus: (firmId: string, status: WorkspaceStatus) => Promise<PropFirm>;
  deletePropFirm: (firmId: string) => Promise<void>;

  createFXRate: (input: FXRateInput) => Promise<FXRateSnapshot>;
  updateFXRate: (rateId: string, input: FXRateInput) => Promise<FXRateSnapshot>;
  deleteFXRate: (rateId: string) => Promise<void>;

  createInstrument: (input: InstrumentSpecInput) => Promise<InstrumentSpecification>;
  updateInstrument: (instrumentId: string, input: InstrumentSpecInput) => Promise<InstrumentSpecification>;
  setInstrumentStatus: (instrumentId: string, status: WorkspaceStatus) => Promise<InstrumentSpecification>;
  deleteInstrument: (instrumentId: string) => Promise<void>;

  createTrade: (input: TradeInput) => Promise<Trade>;
  updateTrade: (tradeId: string, input: TradeInput) => Promise<Trade>;
  setTradeStatus: (tradeId: string, status: Trade['status']) => Promise<Trade>;
  setTradeArchived: (tradeId: string, isArchived: boolean) => Promise<Trade>;
  deleteTrade: (tradeId: string) => Promise<void>;

  updatePreferences: (
    patch: Partial<Pick<UserProfile, 'theme' | 'defaultCurrency' | 'timezone' | 'displayName'>>
  ) => Promise<void>;
  refreshWorkspaceData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const THEME_STORAGE_KEY = 'meridian_theme_pref_v1';
const DEMO_ACTIVE_KEY = 'meridian_demo_active_v1';

const firestoreRepo = new FirestoreRepository();
const demoRepo = new DemoRepository(true);

function readInitialTheme(): ThemePreference {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  }
  return 'dark';
}

function applyThemeToDom(theme: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function getInitialRouteFromLocation(): NavRouteId {
  if (typeof window === 'undefined') return 'overview';
  const path = window.location.pathname.replace(/\/+$/, '') || '/overview';
  const match = APP_ROUTES.find((r) => r.path === path);
  return match ? match.id : 'overview';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('initializing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | 'all'>('all');
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [balanceSnapshots, setBalanceSnapshots] = useState<BalanceSnapshot[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [platforms, setPlatforms] = useState<TradingPlatform[]>([]);
  const [propFirms, setPropFirms] = useState<PropFirm[]>([]);
  const [fxRates, setFxRates] = useState<FXRateSnapshot[]>([]);
  const [instruments, setInstruments] = useState<InstrumentSpecification[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeRoute, setActiveRouteState] = useState<NavRouteId>(getInitialRouteFromLocation);
  const [theme, setThemeState] = useState<ThemePreference>(readInitialTheme);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    applyThemeToDom(theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      setActiveRouteState(getInitialRouteFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setActiveRoute = useCallback((route: NavRouteId) => {
    setActiveRouteState(route);
    if (typeof window !== 'undefined') {
      const def = APP_ROUTES.find((r) => r.id === route);
      if (def && window.location.pathname !== def.path) {
        window.history.pushState(null, '', def.path);
      }
    }
  }, []);

  const getActiveRepository = useCallback((): IDataRepository | null => {
    if (authStatus === 'authenticated') return firestoreRepo;
    if (authStatus === 'demo_mode') return demoRepo;
    return null;
  }, [authStatus]);

  const loadWorkspaceContents = useCallback(
    async (repo: IDataRepository, ownerId: string, workspaceId: string) => {
      setIsLoadingData(true);
      setErrorMessage(null);
      try {
        const [pfs, accs, txs, snaps, brks, plts, firms, rates, insts, trds, logs] = await Promise.all([
          repo.listPortfolios(ownerId, workspaceId),
          repo.listAccounts(ownerId, workspaceId),
          repo.listCashTransactions(ownerId, workspaceId),
          repo.listBalanceSnapshots(ownerId, workspaceId),
          repo.listBrokers(ownerId, workspaceId),
          repo.listTradingPlatforms(ownerId, workspaceId),
          repo.listPropFirms(ownerId, workspaceId),
          repo.listFXRates(ownerId, workspaceId),
          repo.listInstruments(ownerId, workspaceId),
          repo.listTrades(ownerId, workspaceId),
          repo.listAuditLogs(ownerId, workspaceId),
        ]);
        setPortfolios(pfs);
        setAccounts(accs);
        setCashTransactions(txs);
        setBalanceSnapshots(snaps);
        setBrokers(brks);
        setPlatforms(plts);
        setPropFirms(firms);
        setFxRates(rates);
        setInstruments(insts);
        setTrades(trds);
        setAuditLogs(logs);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load workspace records.');
      } finally {
        setIsLoadingData(false);
      }
    },
    []
  );

  const bootstrapSession = useCallback(
    async (repo: IDataRepository, user: User) => {
      setIsLoadingData(true);
      setErrorMessage(null);
      try {
        const profile = await repo.ensureUserProfile(user);
        setUserProfile(profile);
        setThemeState(profile.theme);

        let userWorkspaces = await repo.listWorkspaces(user.uid);
        if (userWorkspaces.length === 0) {
          const initialWs = await repo.createWorkspace(user.uid, {
            name: 'Primary Trading Desk',
            description: 'Personal trading accounts and performance ledger.',
            baseCurrency: profile.defaultCurrency,
            timezone: profile.timezone,
          });
          userWorkspaces = [initialWs];
        }
        setWorkspaces(userWorkspaces);

        const targetWs =
          userWorkspaces.find((w) => w.id === profile.activeWorkspaceId && w.status === 'active') ??
          userWorkspaces.find((w) => w.status === 'active') ??
          userWorkspaces[0];
        setActiveWorkspaceId(targetWs.id);

        if (profile.activeWorkspaceId !== targetWs.id) {
          await repo.updateUserPreferences(user.uid, { activeWorkspaceId: targetWs.id });
        }

        await loadWorkspaceContents(repo, user.uid, targetWs.id);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to initialize workspace session.');
      } finally {
        setIsLoadingData(false);
      }
    },
    [loadWorkspaceContents]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(DEMO_ACTIVE_KEY);
        }
        const user: User = {
          uid: fbUser.uid,
          email: fbUser.email,
          emailVerified: fbUser.emailVerified,
          displayName: fbUser.displayName,
          photoUrl: fbUser.photoURL,
        };
        setCurrentUser(user);
        setAuthStatus('authenticated');
        await bootstrapSession(firestoreRepo, user);
      } else {
        const params =
          typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const autoDemo =
          params?.get('autostart') === '1' ||
          params?.get('demo') === '1' ||
          (typeof window !== 'undefined' && window.sessionStorage.getItem(DEMO_ACTIVE_KEY) === '1');

        if (autoDemo) {
          const demoUser: User = {
            uid: DEMO_USER_UID,
            email: 'demo-sandbox@meridian.local',
            emailVerified: true,
            displayName: 'Demo Sandbox',
            photoUrl: null,
          };
          setCurrentUser(demoUser);
          setAuthStatus('demo_mode');
          await bootstrapSession(demoRepo, demoUser);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
          setWorkspaces([]);
          setActiveWorkspaceId(null);
          setPortfolios([]);
          setAccounts([]);
          setCashTransactions([]);
          setBalanceSnapshots([]);
          setBrokers([]);
          setPlatforms([]);
          setPropFirms([]);
          setFxRates([]);
          setInstruments([]);
          setTrades([]);
          setAuditLogs([]);
          setAuthStatus('signed_out');
        }
      }
    });

    return () => unsubscribe();
  }, [bootstrapSession]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setAuthError(msg);
      throw err;
    }
  }, []);

  const enterDemoMode = useCallback(async () => {
    setAuthError(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(DEMO_ACTIVE_KEY, '1');
    }
    const demoUser: User = {
      uid: DEMO_USER_UID,
      email: 'demo-sandbox@meridian.local',
      emailVerified: true,
      displayName: 'Demo Sandbox',
      photoUrl: null,
    };
    setCurrentUser(demoUser);
    setAuthStatus('demo_mode');
    await bootstrapSession(demoRepo, demoUser);
  }, [bootstrapSession]);

  const exitDemoMode = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(DEMO_ACTIVE_KEY);
    }
    setCurrentUser(null);
    setUserProfile(null);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    setPortfolios([]);
    setAccounts([]);
    setActiveAccountId('all');
    setCashTransactions([]);
    setBalanceSnapshots([]);
    setBrokers([]);
    setPlatforms([]);
    setPropFirms([]);
    setFxRates([]);
    setInstruments([]);
    setTrades([]);
    setAuditLogs([]);
    setAuthStatus('signed_out');
  }, []);

  const resetDemoSandbox = useCallback(async () => {
    if (authStatus !== 'demo_mode' || !currentUser) return;
    demoRepo.resetDemoSandbox();
    setActiveAccountId('all');
    await bootstrapSession(demoRepo, currentUser);
  }, [authStatus, bootstrapSession, currentUser]);

  const logout = useCallback(async () => {
    if (authStatus === 'demo_mode') {
      exitDemoMode();
      return;
    }
    await signOut(auth);
  }, [authStatus, exitDemoMode]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );

  const refreshAuditLogs = useCallback(
    async (repo: IDataRepository, ownerId: string, wsId: string) => {
      const logs = await repo.listAuditLogs(ownerId, wsId);
      setAuditLogs(logs);
    },
    []
  );

  const selectWorkspace = useCallback(
    async (workspaceId: string) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser) return;
      setActiveWorkspaceId(workspaceId);
      setActiveAccountId('all');
      await repo.updateUserPreferences(currentUser.uid, { activeWorkspaceId: workspaceId });
      await loadWorkspaceContents(repo, currentUser.uid, workspaceId);
    },
    [currentUser, getActiveRepository, loadWorkspaceContents]
  );

  const createWorkspace = useCallback(
    async (input: WorkspaceInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser) throw new Error('Not authenticated.');
      const ws = await repo.createWorkspace(currentUser.uid, input);
      setWorkspaces((prev) => [...prev, ws]);
      await selectWorkspace(ws.id);
      return ws;
    },
    [currentUser, getActiveRepository, selectWorkspace]
  );

  const updateWorkspace = useCallback(
    async (workspaceId: string, input: WorkspaceInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser) throw new Error('Not authenticated.');
      const updated = await repo.updateWorkspace(currentUser.uid, workspaceId, input);
      setWorkspaces((prev) => prev.map((w) => (w.id === workspaceId ? updated : w)));
      await refreshAuditLogs(repo, currentUser.uid, workspaceId);
      return updated;
    },
    [currentUser, getActiveRepository, refreshAuditLogs]
  );

  const setWorkspaceStatus = useCallback(
    async (workspaceId: string, status: WorkspaceStatus) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser) throw new Error('Not authenticated.');
      const updated = await repo.setWorkspaceStatus(currentUser.uid, workspaceId, status);
      const nextList = workspaces.map((w) => (w.id === workspaceId ? updated : w));
      setWorkspaces(nextList);
      if (workspaceId === activeWorkspaceId && status === 'archived') {
        const fallback = nextList.find((w) => w.status === 'active');
        if (fallback) {
          await selectWorkspace(fallback.id);
        }
      } else {
        await refreshAuditLogs(repo, currentUser.uid, workspaceId);
      }
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs, selectWorkspace, workspaces]
  );

  const createPortfolio = useCallback(
    async (input: PortfolioInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const pf = await repo.createPortfolio(currentUser.uid, activeWorkspaceId, input);
      setPortfolios((prev) => [...prev, pf]);
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return pf;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const updatePortfolio = useCallback(
    async (portfolioId: string, input: PortfolioInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.updatePortfolio(currentUser.uid, activeWorkspaceId, portfolioId, input);
      setPortfolios((prev) => prev.map((p) => (p.id === portfolioId ? updated : p)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const setPortfolioStatus = useCallback(
    async (portfolioId: string, status: WorkspaceStatus) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.setPortfolioStatus(currentUser.uid, activeWorkspaceId, portfolioId, status);
      setPortfolios((prev) => prev.map((p) => (p.id === portfolioId ? updated : p)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const deletePortfolio = useCallback(
    async (portfolioId: string) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      await repo.deletePortfolio(currentUser.uid, activeWorkspaceId, portfolioId);
      setPortfolios((prev) => prev.filter((p) => p.id !== portfolioId));
      setAccounts((prev) =>
        prev.map((a) => (a.portfolioId === portfolioId ? { ...a, portfolioId: null } : a))
      );
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const refreshWorkspaceData = useCallback(async () => {
    const repo = getActiveRepository();
    if (!repo || !currentUser || !activeWorkspaceId) return;
    await loadWorkspaceContents(repo, currentUser.uid, activeWorkspaceId);
  }, [activeWorkspaceId, currentUser, getActiveRepository, loadWorkspaceContents]);

  const createAccount = useCallback(
    async (input: AccountInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const created = await repo.createAccount(currentUser.uid, activeWorkspaceId, input);
      setAccounts((prev) => [created, ...prev]);
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return created;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const updateAccount = useCallback(
    async (accountId: string, input: AccountInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.updateAccount(currentUser.uid, activeWorkspaceId, accountId, input);
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? updated : a)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const setAccountStatus = useCallback(
    async (accountId: string, status: Account['status']) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.setAccountStatus(currentUser.uid, activeWorkspaceId, accountId, status);
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? updated : a)));
      if (activeAccountId === accountId && status === 'archived') {
        setActiveAccountId('all');
      }
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeAccountId, activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const deleteAccount = useCallback(
    async (accountId: string) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      await repo.deleteAccount(currentUser.uid, activeWorkspaceId, accountId);
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      setCashTransactions((prev) => prev.filter((t) => t.accountId !== accountId));
      setBalanceSnapshots((prev) => prev.filter((s) => s.accountId !== accountId));
      setTrades((prev) => prev.filter((t) => t.accountId !== accountId));
      if (activeAccountId === accountId) {
        setActiveAccountId('all');
      }
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
    },
    [activeAccountId, activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const createCashTransaction = useCallback(
    async (input: CashTransactionInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const created = await repo.createCashTransaction(currentUser.uid, activeWorkspaceId, input);
      setCashTransactions((prev) => [created, ...prev]);
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return created;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const updateCashTransaction = useCallback(
    async (transactionId: string, input: CashTransactionInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.updateCashTransaction(currentUser.uid, activeWorkspaceId, transactionId, input);
      setCashTransactions((prev) => prev.map((t) => (t.id === transactionId ? updated : t)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const deleteCashTransaction = useCallback(
    async (transactionId: string) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      await repo.deleteCashTransaction(currentUser.uid, activeWorkspaceId, transactionId);
      setCashTransactions((prev) => prev.filter((t) => t.id !== transactionId));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const recordBalanceSnapshot = useCallback(
    async (input: BalanceSnapshotInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const account = accounts.find((a) => a.id === input.accountId);
      if (!account) throw new Error('Account not found.');
      const impact = calculateAccountTradeImpact(account, trades, instruments, fxRates);
      const ledger = calculateAccountLedger(account, cashTransactions, {
        tradeCount: impact.totalActiveTrades,
        realisedTradePnl: impact.realisedNetPnl,
      });
      const calcDec = new Decimal(ledger.calculatedLedgerBalance);
      const snapDec = new Decimal(input.balance);
      const deltaDec = snapDec.minus(calcDec);
      const status = deltaDec.abs().lte(new Decimal('0.005')) ? 'reconciled' : 'discrepancy';

      const result = await repo.recordBalanceSnapshot(currentUser.uid, activeWorkspaceId, input, {
        calculatedLedgerBalance: calcDec.toFixed(2),
        reconciliationDelta: deltaDec.toFixed(2),
        reconciliationStatus: status,
      });

      setBalanceSnapshots((prev) => [result.snapshot, ...prev]);
      setAccounts((prev) => prev.map((a) => (a.id === result.account.id ? result.account : a)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return result;
    },
    [
      accounts,
      activeWorkspaceId,
      cashTransactions,
      currentUser,
      fxRates,
      getActiveRepository,
      instruments,
      refreshAuditLogs,
      trades,
    ]
  );

  const createBroker = useCallback(
    async (input: BrokerInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const item = await repo.createBroker(currentUser.uid, activeWorkspaceId, input);
      setBrokers((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return item;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const updateBroker = useCallback(
    async (brokerId: string, input: BrokerInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.updateBroker(currentUser.uid, activeWorkspaceId, brokerId, input);
      setBrokers((prev) => prev.map((b) => (b.id === brokerId ? updated : b)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const setBrokerStatus = useCallback(
    async (brokerId: string, status: WorkspaceStatus) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.setBrokerStatus(currentUser.uid, activeWorkspaceId, brokerId, status);
      setBrokers((prev) => prev.map((b) => (b.id === brokerId ? updated : b)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const deleteBroker = useCallback(
    async (brokerId: string) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      await repo.deleteBroker(currentUser.uid, activeWorkspaceId, brokerId);
      setBrokers((prev) => prev.filter((b) => b.id !== brokerId));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const createTradingPlatform = useCallback(
    async (input: TradingPlatformInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const item = await repo.createTradingPlatform(currentUser.uid, activeWorkspaceId, input);
      setPlatforms((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return item;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const updateTradingPlatform = useCallback(
    async (platformId: string, input: TradingPlatformInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.updateTradingPlatform(currentUser.uid, activeWorkspaceId, platformId, input);
      setPlatforms((prev) => prev.map((p) => (p.id === platformId ? updated : p)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const setTradingPlatformStatus = useCallback(
    async (platformId: string, status: WorkspaceStatus) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.setTradingPlatformStatus(currentUser.uid, activeWorkspaceId, platformId, status);
      setPlatforms((prev) => prev.map((p) => (p.id === platformId ? updated : p)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const deleteTradingPlatform = useCallback(
    async (platformId: string) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      await repo.deleteTradingPlatform(currentUser.uid, activeWorkspaceId, platformId);
      setPlatforms((prev) => prev.filter((p) => p.id !== platformId));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const createPropFirm = useCallback(
    async (input: PropFirmInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const item = await repo.createPropFirm(currentUser.uid, activeWorkspaceId, input);
      setPropFirms((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return item;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const updatePropFirm = useCallback(
    async (firmId: string, input: PropFirmInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.updatePropFirm(currentUser.uid, activeWorkspaceId, firmId, input);
      setPropFirms((prev) => prev.map((f) => (f.id === firmId ? updated : f)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const setPropFirmStatus = useCallback(
    async (firmId: string, status: WorkspaceStatus) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.setPropFirmStatus(currentUser.uid, activeWorkspaceId, firmId, status);
      setPropFirms((prev) => prev.map((f) => (f.id === firmId ? updated : f)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const deletePropFirm = useCallback(
    async (firmId: string) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      await repo.deletePropFirm(currentUser.uid, activeWorkspaceId, firmId);
      setPropFirms((prev) => prev.filter((f) => f.id !== firmId));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const createFXRate = useCallback(
    async (input: FXRateInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const item = await repo.createFXRate(currentUser.uid, activeWorkspaceId, input);
      setFxRates((prev) => [item, ...prev]);
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return item;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const updateFXRate = useCallback(
    async (rateId: string, input: FXRateInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.updateFXRate(currentUser.uid, activeWorkspaceId, rateId, input);
      setFxRates((prev) => prev.map((r) => (r.id === rateId ? updated : r)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const deleteFXRate = useCallback(
    async (rateId: string) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      await repo.deleteFXRate(currentUser.uid, activeWorkspaceId, rateId);
      setFxRates((prev) => prev.filter((r) => r.id !== rateId));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const createInstrument = useCallback(
    async (input: InstrumentSpecInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const created = await repo.createInstrument(currentUser.uid, activeWorkspaceId, input);
      setInstruments((prev) => [...prev, created].sort((a, b) => a.symbol.localeCompare(b.symbol)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return created;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const updateInstrument = useCallback(
    async (instrumentId: string, input: InstrumentSpecInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.updateInstrument(currentUser.uid, activeWorkspaceId, instrumentId, input);
      setInstruments((prev) =>
        prev.map((i) => (i.id === instrumentId ? updated : i)).sort((a, b) => a.symbol.localeCompare(b.symbol))
      );
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const setInstrumentStatus = useCallback(
    async (instrumentId: string, status: WorkspaceStatus) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.setInstrumentStatus(currentUser.uid, activeWorkspaceId, instrumentId, status);
      setInstruments((prev) => prev.map((i) => (i.id === instrumentId ? updated : i)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const deleteInstrument = useCallback(
    async (instrumentId: string) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      await repo.deleteInstrument(currentUser.uid, activeWorkspaceId, instrumentId);
      setInstruments((prev) => prev.filter((i) => i.id !== instrumentId));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const createTrade = useCallback(
    async (input: TradeInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const account = accounts.find((a) => a.id === input.accountId);
      if (!account) throw new Error('Selected trading account was not found in workspace.');
      const created = await repo.createTrade(currentUser.uid, activeWorkspaceId, input, {
        portfolioId: account.portfolioId,
        accountCurrency: account.baseCurrency,
      });
      setTrades((prev) => [created, ...prev]);
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return created;
    },
    [accounts, activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const updateTrade = useCallback(
    async (tradeId: string, input: TradeInput) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const account = accounts.find((a) => a.id === input.accountId);
      if (!account) throw new Error('Selected trading account was not found in workspace.');
      const updated = await repo.updateTrade(currentUser.uid, activeWorkspaceId, tradeId, input, {
        portfolioId: account.portfolioId,
        accountCurrency: account.baseCurrency,
      });
      setTrades((prev) => prev.map((t) => (t.id === tradeId ? updated : t)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [accounts, activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const setTradeStatus = useCallback(
    async (tradeId: string, status: Trade['status']) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.setTradeStatus(currentUser.uid, activeWorkspaceId, tradeId, status);
      setTrades((prev) => prev.map((t) => (t.id === tradeId ? updated : t)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const setTradeArchived = useCallback(
    async (tradeId: string, isArchived: boolean) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      const updated = await repo.setTradeArchived(currentUser.uid, activeWorkspaceId, tradeId, isArchived);
      setTrades((prev) => prev.map((t) => (t.id === tradeId ? updated : t)));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
      return updated;
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const deleteTrade = useCallback(
    async (tradeId: string) => {
      const repo = getActiveRepository();
      if (!repo || !currentUser || !activeWorkspaceId) throw new Error('Workspace not selected.');
      await repo.deleteTrade(currentUser.uid, activeWorkspaceId, tradeId);
      setTrades((prev) => prev.filter((t) => t.id !== tradeId));
      await refreshAuditLogs(repo, currentUser.uid, activeWorkspaceId);
    },
    [activeWorkspaceId, currentUser, getActiveRepository, refreshAuditLogs]
  );

  const updatePreferences = useCallback(
    async (
      patch: Partial<Pick<UserProfile, 'theme' | 'defaultCurrency' | 'timezone' | 'displayName'>>
    ) => {
      if (patch.theme) {
        setThemeState(patch.theme);
      }
      const repo = getActiveRepository();
      if (!repo || !currentUser) return;
      const updated = await repo.updateUserPreferences(currentUser.uid, patch);
      setUserProfile(updated);
    },
    [currentUser, getActiveRepository]
  );

  const setTheme = useCallback(
    async (nextTheme: ThemePreference) => {
      setThemeState(nextTheme);
      const repo = getActiveRepository();
      if (repo && currentUser) {
        try {
          const updated = await repo.updateUserPreferences(currentUser.uid, { theme: nextTheme });
          setUserProfile(updated);
        } catch {
          // Non-fatal
        }
      }
    },
    [currentUser, getActiveRepository]
  );

  const dataSourceMode: DataSourceMode | null =
    authStatus === 'authenticated'
      ? 'firebase_cloud'
      : authStatus === 'demo_mode'
        ? 'isolated_demo'
        : null;

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setAuthError(null);
  }, []);

  const value: AppContextValue = {
    authStatus,
    dataSourceMode,
    currentUser,
    userProfile,
    workspaces,
    activeWorkspace,
    portfolios,
    accounts,
    activeAccountId,
    cashTransactions,
    balanceSnapshots,
    brokers,
    platforms,
    propFirms,
    fxRates,
    instruments,
    trades,
    auditLogs,
    activeRoute,
    theme,
    isLoadingData,
    errorMessage,
    authError,
    setActiveRoute,
    setActiveAccountId,
    setTheme,
    clearError,
    signInWithGoogle,
    enterDemoMode,
    exitDemoMode,
    resetDemoSandbox,
    logout,
    selectWorkspace,
    createWorkspace,
    updateWorkspace,
    setWorkspaceStatus,
    createPortfolio,
    updatePortfolio,
    setPortfolioStatus,
    deletePortfolio,
    createAccount,
    updateAccount,
    setAccountStatus,
    deleteAccount,
    createCashTransaction,
    updateCashTransaction,
    deleteCashTransaction,
    recordBalanceSnapshot,
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
    createInstrument,
    updateInstrument,
    setInstrumentStatus,
    deleteInstrument,
    createTrade,
    updateTrade,
    setTradeStatus,
    setTradeArchived,
    deleteTrade,
    updatePreferences,
    refreshWorkspaceData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
