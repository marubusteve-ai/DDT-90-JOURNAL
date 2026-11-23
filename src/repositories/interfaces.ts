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

export interface AuthorizationContext {
  uid: string;
  emailVerified: boolean;
}

export class AuthorizationBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationBoundaryError';
  }
}

export function assertAuthorizedScope(
  actor: AuthorizationContext | null,
  expectedOwnerId: string
): asserts actor is AuthorizationContext {
  if (!actor || !actor.uid) {
    throw new AuthorizationBoundaryError('Authentication required for this operation.');
  }
  if (!actor.emailVerified) {
    throw new AuthorizationBoundaryError('Verified email identity is required.');
  }
  if (actor.uid !== expectedOwnerId) {
    throw new AuthorizationBoundaryError('Cross-tenant access denied: workspace owner mismatch.');
  }
}

export interface IDataRepository {
  readonly mode: DataSourceMode;

  ensureUserProfile(user: User): Promise<UserProfile>;
  updateUserPreferences(
    uid: string,
    patch: Partial<Pick<UserProfile, 'theme' | 'defaultCurrency' | 'timezone' | 'activeWorkspaceId' | 'displayName'>>
  ): Promise<UserProfile>;

  listWorkspaces(ownerId: string): Promise<Workspace[]>;
  createWorkspace(ownerId: string, input: WorkspaceInput): Promise<Workspace>;
  updateWorkspace(ownerId: string, workspaceId: string, input: WorkspaceInput): Promise<Workspace>;
  setWorkspaceStatus(ownerId: string, workspaceId: string, status: WorkspaceStatus): Promise<Workspace>;

  listPortfolios(ownerId: string, workspaceId: string): Promise<Portfolio[]>;
  createPortfolio(ownerId: string, workspaceId: string, input: PortfolioInput): Promise<Portfolio>;
  updatePortfolio(
    ownerId: string,
    workspaceId: string,
    portfolioId: string,
    input: PortfolioInput
  ): Promise<Portfolio>;
  setPortfolioStatus(
    ownerId: string,
    workspaceId: string,
    portfolioId: string,
    status: WorkspaceStatus
  ): Promise<Portfolio>;
  deletePortfolio(ownerId: string, workspaceId: string, portfolioId: string): Promise<void>;

  listAccounts(ownerId: string, workspaceId: string): Promise<Account[]>;
  createAccount(ownerId: string, workspaceId: string, input: AccountInput): Promise<Account>;
  updateAccount(ownerId: string, workspaceId: string, accountId: string, input: AccountInput): Promise<Account>;
  setAccountStatus(
    ownerId: string,
    workspaceId: string,
    accountId: string,
    status: Account['status']
  ): Promise<Account>;
  deleteAccount(ownerId: string, workspaceId: string, accountId: string): Promise<void>;

  listCashTransactions(ownerId: string, workspaceId: string): Promise<CashTransaction[]>;
  createCashTransaction(
    ownerId: string,
    workspaceId: string,
    input: CashTransactionInput
  ): Promise<CashTransaction>;
  updateCashTransaction(
    ownerId: string,
    workspaceId: string,
    transactionId: string,
    input: CashTransactionInput
  ): Promise<CashTransaction>;
  deleteCashTransaction(ownerId: string, workspaceId: string, transactionId: string): Promise<void>;

  listBalanceSnapshots(ownerId: string, workspaceId: string): Promise<BalanceSnapshot[]>;
  recordBalanceSnapshot(
    ownerId: string,
    workspaceId: string,
    input: BalanceSnapshotInput,
    reconciliation: {
      calculatedLedgerBalance: string;
      reconciliationDelta: string;
      reconciliationStatus: 'reconciled' | 'discrepancy';
    }
  ): Promise<{ snapshot: BalanceSnapshot; account: Account }>;

  listBrokers(ownerId: string, workspaceId: string): Promise<Broker[]>;
  createBroker(ownerId: string, workspaceId: string, input: BrokerInput): Promise<Broker>;
  updateBroker(ownerId: string, workspaceId: string, brokerId: string, input: BrokerInput): Promise<Broker>;
  setBrokerStatus(ownerId: string, workspaceId: string, brokerId: string, status: WorkspaceStatus): Promise<Broker>;
  deleteBroker(ownerId: string, workspaceId: string, brokerId: string): Promise<void>;

  listTradingPlatforms(ownerId: string, workspaceId: string): Promise<TradingPlatform[]>;
  createTradingPlatform(
    ownerId: string,
    workspaceId: string,
    input: TradingPlatformInput
  ): Promise<TradingPlatform>;
  updateTradingPlatform(
    ownerId: string,
    workspaceId: string,
    platformId: string,
    input: TradingPlatformInput
  ): Promise<TradingPlatform>;
  setTradingPlatformStatus(
    ownerId: string,
    workspaceId: string,
    platformId: string,
    status: WorkspaceStatus
  ): Promise<TradingPlatform>;
  deleteTradingPlatform(ownerId: string, workspaceId: string, platformId: string): Promise<void>;

  listPropFirms(ownerId: string, workspaceId: string): Promise<PropFirm[]>;
  createPropFirm(ownerId: string, workspaceId: string, input: PropFirmInput): Promise<PropFirm>;
  updatePropFirm(ownerId: string, workspaceId: string, firmId: string, input: PropFirmInput): Promise<PropFirm>;
  setPropFirmStatus(
    ownerId: string,
    workspaceId: string,
    firmId: string,
    status: WorkspaceStatus
  ): Promise<PropFirm>;
  deletePropFirm(ownerId: string, workspaceId: string, firmId: string): Promise<void>;

  listFXRates(ownerId: string, workspaceId: string): Promise<FXRateSnapshot[]>;
  createFXRate(ownerId: string, workspaceId: string, input: FXRateInput): Promise<FXRateSnapshot>;
  updateFXRate(
    ownerId: string,
    workspaceId: string,
    rateId: string,
    input: FXRateInput
  ): Promise<FXRateSnapshot>;
  deleteFXRate(ownerId: string, workspaceId: string, rateId: string): Promise<void>;

  listInstruments(ownerId: string, workspaceId: string): Promise<InstrumentSpecification[]>;
  createInstrument(
    ownerId: string,
    workspaceId: string,
    input: InstrumentSpecInput
  ): Promise<InstrumentSpecification>;
  updateInstrument(
    ownerId: string,
    workspaceId: string,
    instrumentId: string,
    input: InstrumentSpecInput
  ): Promise<InstrumentSpecification>;
  setInstrumentStatus(
    ownerId: string,
    workspaceId: string,
    instrumentId: string,
    status: WorkspaceStatus
  ): Promise<InstrumentSpecification>;
  deleteInstrument(ownerId: string, workspaceId: string, instrumentId: string): Promise<void>;

  listTrades(ownerId: string, workspaceId: string): Promise<Trade[]>;
  createTrade(
    ownerId: string,
    workspaceId: string,
    input: TradeInput,
    context: { portfolioId: string | null; accountCurrency: string }
  ): Promise<Trade>;
  updateTrade(
    ownerId: string,
    workspaceId: string,
    tradeId: string,
    input: TradeInput,
    context: { portfolioId: string | null; accountCurrency: string }
  ): Promise<Trade>;
  setTradeStatus(
    ownerId: string,
    workspaceId: string,
    tradeId: string,
    status: Trade['status']
  ): Promise<Trade>;
  setTradeArchived(
    ownerId: string,
    workspaceId: string,
    tradeId: string,
    isArchived: boolean
  ): Promise<Trade>;
  deleteTrade(ownerId: string, workspaceId: string, tradeId: string): Promise<void>;

  listAuditLogs(ownerId: string, workspaceId: string): Promise<AuditLog[]>;
}

export interface AppPreferencesSnapshot {
  theme: ThemePreference;
}
