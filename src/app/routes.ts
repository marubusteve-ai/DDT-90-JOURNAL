export type NavRouteId =
  | 'overview'
  | 'workspaces'
  | 'accounts'
  | 'journal'
  | 'playbooks'
  | 'risk'
  | 'prop_firms'
  | 'analytics'
  | 'psychology'
  | 'reports'
  | 'import_export'
  | 'ai_coach'
  | 'automation'
  | 'integrations'
  | 'settings';

export interface RouteDefinition {
  id: NavRouteId;
  path: string;
  label: string;
  group: 'core' | 'roadmap';
  implementedInStage0: boolean;
  targetStage: string;
  summary: string;
  plannedCapabilities?: string[];
  stage0FoundationReady?: string[];
}

export const APP_ROUTES: ReadonlyArray<RouteDefinition> = [
  {
    id: 'overview',
    path: '/overview',
    label: 'Overview',
    group: 'core',
    implementedInStage0: true,
    targetStage: 'Stage 1',
    summary: 'Consolidated portfolio balances, FX-aware rollups, account health summary, and ledger reconciliation.',
  },
  {
    id: 'workspaces',
    path: '/workspaces',
    label: 'Workspaces & Portfolios',
    group: 'core',
    implementedInStage0: true,
    targetStage: 'Stage 1',
    summary: 'Workspace lifecycle, portfolio management, broker/platform/prop-firm references, and FX rate snapshots.',
  },
  {
    id: 'accounts',
    path: '/accounts',
    label: 'Accounts',
    group: 'core',
    implementedInStage0: true,
    targetStage: 'Stage 1',
    summary: 'Account CRUD, grouping & comparison, cash movements, snapshot reconciliation, and health monitoring.',
  },
  {
    id: 'journal',
    path: '/journal',
    label: 'Trade Journal',
    group: 'core',
    implementedInStage0: true,
    targetStage: 'Stage 2',
    summary: 'Trade creation/edit/archive/delete, Explorer search/filter/sort/pagination, instrument specs, and central decimal P&L/R engine.',
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    group: 'core',
    implementedInStage0: true,
    targetStage: 'Stage 1',
    summary: 'Theme, display currency, timezone preferences, and persistence configuration.',
  },
  {
    id: 'playbooks',
    path: '/playbooks',
    label: 'Playbooks & Setups',
    group: 'roadmap',
    implementedInStage0: false,
    targetStage: 'Stage 2',
    summary: 'Setup library, weighted entry checklists, invalidation rules, and process quality rubrics.',
    plannedCapabilities: [
      'Structured entry/exit/management models per setup',
      'Required & optional weighted checklist items with score contribution',
      'Separate scores for setup quality, execution quality, and profitability',
    ],
    stage0FoundationReady: [
      'Playbook, Setup, and ChecklistItem contracts defined in domain models',
    ],
  },
  {
    id: 'risk',
    path: '/risk',
    label: 'Risk Management',
    group: 'roadmap',
    implementedInStage0: false,
    targetStage: 'Stage 2',
    summary: 'Position-size calculator, daily/weekly risk budgets, exposure monitoring, and health thresholds.',
    plannedCapabilities: [
      'Instrument-aware lot/contract size and R-multiple planner',
      'Healthy / Warning / Critical risk capacity thresholds',
      'Realised vs floating drawdown monitoring',
    ],
    stage0FoundationReady: [
      'Account risk thresholds (max daily loss, max overall loss, drawdown mode) stored on Accounts',
    ],
  },
  {
    id: 'prop_firms',
    path: '/prop-firms',
    label: 'Prop-Firm Manager',
    group: 'roadmap',
    implementedInStage0: false,
    targetStage: 'Stage 3',
    summary: 'Versioned rule sets, challenge phase tracking, consistency checks, and payout milestones.',
    plannedCapabilities: [
      'Editable user-configurable rule sets with effective dates and versions',
      'Static and trailing drawdown compliance tracking',
      'Side-by-side challenge comparison dashboards',
    ],
    stage0FoundationReady: [
      'PropFirmRuleSet, PropFirmRule, and ChallengePhase domain contracts defined',
      'Prop evaluation/verification/funded account metadata captured in Stage 0',
    ],
  },
  {
    id: 'analytics',
    path: '/analytics',
    label: 'Performance Analytics',
    group: 'roadmap',
    implementedInStage0: false,
    targetStage: 'Stage 3',
    summary: 'Expectancy, profit factor, session/setup heatmaps, drawdown curves, and MFE/MAE analysis.',
    plannedCapabilities: [
      'Cross-filtered equity, balance, and drawdown curves',
      'Win/loss, R-distribution, and holding-duration histograms',
      'Sample-size gated Sharpe, Sortino, Calmar, and Ulcer metrics',
    ],
    stage0FoundationReady: [
      'Central decimal.js calculation engine initialized with account ledger math',
    ],
  },
  {
    id: 'psychology',
    path: '/psychology',
    label: 'Psychology & Behaviour',
    group: 'roadmap',
    implementedInStage0: false,
    targetStage: 'Stage 4',
    summary: 'Emotional state logging, mistake taxonomy, rule adherence correlation, and post-trade reflections.',
    plannedCapabilities: [
      'Pre-trade and post-trade behavioural reflection capture',
      'Configurable mistake categories with measured financial impact',
      'Rule adherence vs performance breakdown',
    ],
    stage0FoundationReady: [
      'PsychologyEntry and MistakeCategory contracts defined in domain models',
    ],
  },
  {
    id: 'reports',
    path: '/reports',
    label: 'Reports',
    group: 'roadmap',
    implementedInStage0: false,
    targetStage: 'Stage 4',
    summary: 'Period, account, prop-compliance, payout, and print-ready performance reports.',
    plannedCapabilities: [
      'Daily, weekly, monthly, quarterly, and custom period summaries',
      'Reconciled CSV, JSON, and print-ready report exports',
    ],
    stage0FoundationReady: [
      'Unified calculation engine ensures future reports match dashboard figures',
    ],
  },
  {
    id: 'import_export',
    path: '/import-export',
    label: 'Import / Export',
    group: 'roadmap',
    implementedInStage0: false,
    targetStage: 'Stage 4',
    summary: 'Multi-step CSV column mapping, duplicate detection, JSON backups, and safe rollback.',
    plannedCapabilities: [
      'Schema detection, preview, timezone/decimal mapping, and pre-import validation',
      'Duplicate detection via external ticket IDs and matching criteria',
      'Full JSON workspace backup & restore',
    ],
    stage0FoundationReady: [
      'ImportJob contract defined in domain models',
    ],
  },
  {
    id: 'ai_coach',
    path: '/ai-coach',
    label: 'AI Trading Coach',
    group: 'roadmap',
    implementedInStage0: false,
    targetStage: 'Stage 5',
    summary: 'Grounded journal Q&A, period reviews, and pattern analysis powered by server-side Gemini API.',
    plannedCapabilities: [
      'Natural-language queries grounded strictly in verified user records',
      'Structured output separating Observed Data, Calculated Metric, Interpretation, and Recommendation',
      'Sample-size disclosures and review history',
    ],
    stage0FoundationReady: [
      'Server runtime (`server.ts`) and AIReview domain contract prepared',
    ],
  },
  {
    id: 'automation',
    path: '/automation',
    label: 'Goals & Automation',
    group: 'roadmap',
    implementedInStage0: false,
    targetStage: 'Stage 5',
    summary: 'WHEN/THEN rule triggers, risk-budget alerts, milestones, and notification preferences.',
    plannedCapabilities: [
      'Risk and prop-rule warning triggers',
      'Process and journaling consistency goals',
      'Quiet hours and duplicate-suppression controls',
    ],
    stage0FoundationReady: [
      'AutomationRule domain contract defined',
    ],
  },
  {
    id: 'integrations',
    path: '/integrations',
    label: 'Integrations',
    group: 'roadmap',
    implementedInStage0: false,
    targetStage: 'Stage 6',
    summary: 'Broker, platform (MT4/MT5/cTrader), and offline IndexedDB sync adapters.',
    plannedCapabilities: [
      'Adapter architecture for broker statement parsers and platform connectors',
      'IndexedDB offline queue & synchronization engine',
    ],
    stage0FoundationReady: [
      'Repository abstraction (`IDataRepository`) decouples UI from persistence adapters',
    ],
  },
];

export function getRouteById(id: NavRouteId): RouteDefinition {
  return APP_ROUTES.find((r) => r.id === id) ?? APP_ROUTES[0];
}
