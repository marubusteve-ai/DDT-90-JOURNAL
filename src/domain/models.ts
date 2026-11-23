/**
 * Unified Domain Model for Meridian Desk
 * Stage 0 active entities + future-stage architectural contracts.
 * Monetary amounts are stored as decimal strings to avoid binary floating-point drift.
 */

export type DataSourceMode = 'firebase_cloud' | 'isolated_demo';

export type ThemePreference = 'dark' | 'light';

export type AccountType =
  | 'personal_live'
  | 'personal_demo'
  | 'prop_evaluation'
  | 'prop_verification'
  | 'prop_funded'
  | 'backtest'
  | 'forward_test'
  | 'paper'
  | 'custom';

export type AccountStatus =
  | 'active'
  | 'paused'
  | 'passed'
  | 'failed'
  | 'breached'
  | 'archived'
  | 'custom';

export type DrawdownMode =
  | 'none'
  | 'static'
  | 'trailing_eod'
  | 'trailing_intraday'
  | 'custom';

export type CashTransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'payout'
  | 'fee'
  | 'adjustment'
  | 'transfer';

export type WorkspaceStatus = 'active' | 'archived';

// ---------------------------------------------------------------------------
// Stage 0 Active Entities
// ---------------------------------------------------------------------------

export interface User {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoUrl: string | null;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string;
  photoUrl: string | null;
  theme: ThemePreference;
  defaultCurrency: string;
  timezone: string;
  activeWorkspaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  timezone: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
}

export interface Portfolio {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  workspaceId: string;
  portfolioId: string | null;
  ownerId: string;
  name: string;
  accountIdentifierMasked: string | null;
  accountType: AccountType;
  customCategory?: string | null;
  status: AccountStatus;
  brokerId?: string | null;
  brokerName: string | null;
  propFirmId?: string | null;
  propFirmName: string | null;
  platformId?: string | null;
  platformName: string | null;
  baseCurrency: string;
  timezone: string;
  startingBalance: string;
  verifiedBalanceSnapshot: string | null;
  verifiedEquitySnapshot: string | null;
  snapshotAsOf: string | null;
  reconciliationNotes: string | null;
  openingDate: string | null;
  challengePhase: string | null;
  profitTargetAmount: string | null;
  profitTargetPct: string | null;
  maxDailyLossAmount: string | null;
  maxDailyLossPct: string | null;
  maxOverallLossAmount: string | null;
  maxOverallLossPct: string | null;
  drawdownMode: DrawdownMode;
  minTradingDays: number | null;
  maxTradingDays: number | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CashTransaction {
  id: string;
  workspaceId: string;
  accountId: string;
  ownerId: string;
  type: CashTransactionType;
  amount: string;
  currency: string;
  grossAmount: string | null;
  splitPct: string | null;
  occurredAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceSnapshot {
  id: string;
  workspaceId: string;
  accountId: string;
  ownerId: string;
  balance: string;
  equity: string | null;
  capturedAt: string;
  calculatedLedgerBalance: string;
  reconciliationDelta: string;
  reconciliationStatus: 'reconciled' | 'discrepancy';
  notes: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  ownerId: string;
  entityType:
    | 'workspace'
    | 'portfolio'
    | 'account'
    | 'cash_transaction'
    | 'balance_snapshot'
    | 'broker'
    | 'platform'
    | 'prop_firm'
    | 'fx_rate'
    | 'instrument'
    | 'trade';
  entityId: string;
  action: 'create' | 'update' | 'archive' | 'restore' | 'reconcile' | 'delete';
  summary: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Stage 1 Reference Registry & Multi-Currency FX Contracts
// ---------------------------------------------------------------------------

export interface Broker {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  website: string | null;
  notes: string | null;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TradingPlatform {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  vendor: string | null;
  notes: string | null;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PropFirm {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  website: string | null;
  notes: string | null;
  defaultRuleSetId?: string | null;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FXRateSnapshot {
  id: string;
  workspaceId?: string;
  ownerId?: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  capturedAt: string;
  source: 'manual' | 'historical_feed' | 'broker_report';
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Future-Stage Architectural Domain Contracts (Stage 2+ Extension Points)
// ---------------------------------------------------------------------------

export interface PropFirmRuleSet {
  id: string;
  propFirmId: string;
  version: string;
  effectiveDate: string;
  isUserConfigurableTemplate: boolean;
  rules: PropFirmRule[];
}

export interface PropFirmRule {
  id: string;
  ruleSetId: string;
  type:
    | 'profit_target'
    | 'daily_loss_limit'
    | 'overall_drawdown'
    | 'consistency'
    | 'min_trading_days'
    | 'max_trading_days'
    | 'news_restriction'
    | 'overnight_restriction'
    | 'weekend_restriction'
    | 'exposure_limit'
    | 'custom';
  name: string;
  description: string | null;
  threshold: string | null;
  unit: 'amount' | 'percentage' | 'days' | 'boolean' | 'custom';
  calculationMethod: string;
  dayResetTimezone: string;
  warningThreshold: string | null;
  breachThreshold: string | null;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

export interface ChallengePhase {
  id: string;
  accountId: string;
  ruleSetId: string;
  phaseName: string;
  startedAt: string;
  completedAt: string | null;
  status: 'in_progress' | 'passed' | 'failed' | 'breached';
}

export type AssetClass =
  | 'forex'
  | 'indices'
  | 'commodities'
  | 'crypto'
  | 'equities'
  | 'futures'
  | 'options'
  | 'custom';

export type QuantityUnit = 'lots' | 'contracts' | 'shares' | 'units';

export interface InstrumentSpecification {
  id: string;
  workspaceId: string;
  ownerId: string;
  symbol: string;
  displayName: string | null;
  assetClass: AssetClass;
  baseCurrency: string | null;
  quoteCurrency: string;
  profitCurrency: string | null;
  contractSize: string;
  tickSize: string;
  pipSize: string;
  tickValue: string | null;
  quantityUnit: QuantityUnit;
  status: WorkspaceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TradeDirection = 'long' | 'short';
export type TradeStatus = 'draft' | 'open' | 'closed';
export type TradeSession = 'asia' | 'london' | 'new_york' | 'overlap' | 'custom';
export type TradeEntryType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'scale_in' | 'custom';
export type TradeOutcome = 'win' | 'loss' | 'breakeven' | 'open' | 'draft' | 'unknown';

export interface Trade {
  id: string;
  workspaceId: string;
  portfolioId: string | null;
  accountId: string;
  ownerId: string;
  externalTicketId: string | null;
  symbol: string;
  instrumentId: string | null;
  direction: TradeDirection;
  status: TradeStatus;
  isArchived: boolean;
  session: TradeSession | null;
  timeframes: string[];
  timezone: string;
  accountCurrency: string;
  accountBalanceSnapshot: string | null;
  entryAt: string | null;
  entryPrice: string | null;
  quantity: string | null;
  entryType: TradeEntryType | null;
  leverage: string | null;
  marginUsed: string | null;
  entryRationale: string | null;
  initialStopPrice: string | null;
  actualStopPrice: string | null;
  plannedTargetPrice: string | null;
  plannedRiskAmount: string | null;
  plannedRiskPct: string | null;
  actualRiskAmount: string | null;
  exitAt: string | null;
  exitPrice: string | null;
  exitQuantity: string | null;
  exitReason: string | null;
  manualGrossPnl: string | null;
  fxConversionRate: string | null;
  playbookId: string | null;
  setupId: string | null;
  setupTag: string | null;
  commission: string | null;
  swap: string | null;
  fees: string | null;
  slippage: string | null;
  spread: string | null;
  marketConditions: string[];
  entryNotes: string | null;
  reviewNotes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TradeExecution {
  id: string;
  tradeId: string;
  accountId: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  executedAt: string;
  commission: string | null;
  fees: string | null;
}

export interface PlannedTarget {
  id: string;
  tradeId: string;
  orderIndex: number;
  targetPrice: string | null;
  plannedClosePct: string | null;
  plannedRMultiple: string | null;
  status: 'planned' | 'reached' | 'missed' | 'cancelled' | 'modified';
  rationale: string | null;
}

export interface TradeExit {
  id: string;
  tradeId: string;
  exitedAt: string;
  exitPrice: string;
  quantity: string;
  outcomeLabel: 'win' | 'partial_win' | 'breakeven' | 'loss' | 'partial_loss' | 'custom';
  realisedGrossPnl: string | null;
  realisedNetPnl: string | null;
  reason: string | null;
}

export interface StopLossEvent {
  id: string;
  tradeId: string;
  occurredAt: string;
  eventType: 'initial' | 'move_to_breakeven' | 'trailing_update' | 'partial_reduction' | 'removed' | 'manual_adjustment';
  previousStopPrice: string | null;
  newStopPrice: string | null;
  notes: string | null;
}

export interface MarketContext {
  id: string;
  tradeId: string;
  conditions: string[];
  higherTimeframeNotes: string | null;
  thesis: string | null;
}

export interface Playbook {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface Setup {
  id: string;
  playbookId: string;
  name: string;
  entryModel: string | null;
  exitModel: string | null;
  invalidationRules: string | null;
}

export interface ChecklistItem {
  id: string;
  setupId: string;
  label: string;
  required: boolean;
  weight: number;
}

export interface PsychologyEntry {
  id: string;
  workspaceId: string;
  tradeId: string | null;
  emotionalStates: string[];
  confidenceScore: number | null;
  disciplineScore: number | null;
  reflection: string | null;
}

export interface MistakeCategory {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
}

export interface CustomFieldDefinition {
  id: string;
  workspaceId: string;
  entityType: 'trade' | 'account';
  label: string;
  fieldType: 'text' | 'number' | 'select' | 'boolean' | 'date';
  required: boolean;
}

export interface DashboardLayout {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  widgets: Array<{ id: string; type: string; colSpan: number; order: number }>;
}

export interface ImportJob {
  id: string;
  workspaceId: string;
  accountId: string;
  fileName: string;
  status: 'pending' | 'validated' | 'completed' | 'failed' | 'rolled_back';
  totalRows: number;
  importedRows: number;
  errorRows: number;
}

export interface AutomationRule {
  id: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  triggerCondition: string;
  permittedAction: string;
}

export interface AIReview {
  id: string;
  workspaceId: string;
  scopeSummary: string;
  sampleSize: number;
  observedData: string;
  calculatedMetrics: string;
  interpretation: string;
  recommendation: string;
  createdAt: string;
}
