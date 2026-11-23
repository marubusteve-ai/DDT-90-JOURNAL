# Meridian Desk — Stage 1 Architecture

## Overview
Stage 1 completes **Workspace, Portfolio, Reference Library, Ledger Reconciliation, Multi-Currency FX, and Account Health Foundation** while keeping strict scope discipline (no fabricated trade analytics, no placeholder equity curves, and no silent 1:1 currency mixing).

## 1. Active Stage 1 Domain Entities
All persisted entities are tenant-isolated by `ownerId` and `workspaceId` under `/workspaces/{workspaceId}/...` in Cloud Firestore (with full parity in `DemoRepository` for Isolated Demo Mode):
- `Workspace`: Multi-workspace switching, inline editing (`name`, `description`, `baseCurrency`, `timezone`), and archive/restore lifecycle.
- `Portfolio`: Create, edit, archive/restore, and safe delete (batch-unassigns linked accounts `portfolioId -> null`), plus `calculatePortfolioRollups`.
- `Account`: Full CRUD (`personal_live`, `personal_demo`, `prop_evaluation`, `prop_verification`, `prop_funded`, `backtest`, `forward_test`, `paper`, `custom`), `customCategory`, structured links (`brokerId`/`brokerName`, `propFirmId`/`propFirmName`, `platformId`/`platformName`), archive/restore, and cascading delete (cleans linked cash movements and balance snapshots).
- `CashTransaction`: Full CRUD (`deposit`, `withdrawal`, `payout` with optional gross/split %, `fee`, `adjustment`, `transfer`).
- `BalanceSnapshot`: Immutable verification snapshots recording `balance`, optional `equity`, `capturedAt`, `calculatedLedgerBalance`, `reconciliationDelta`, and `reconciliationStatus`, atomically synced to the parent `Account`'s `verifiedBalanceSnapshot` / `verifiedEquitySnapshot` / `snapshotAsOf`.
- `Broker`, `TradingPlatform`, `PropFirm`: Workspace-scoped reference libraries with Create, Edit, Archive/Restore, and Delete.
- `FXRateSnapshot`: Explicit user-recorded currency exchange rates (`baseCurrency`, `quoteCurrency`, `rate`, `capturedAt`, `source`). Multi-currency rollups refuse silent 1:1 parity and only consolidate when direct or inverse FX snapshots cover every non-target currency bucket.
- `AuditLog`: Immutable workspace audit trail covering every create, update, archive, restore, reconcile, and delete action.

## 2. Deterministic Account Health Foundation
Implemented in `calculateAccountHealth` (`src/domain/calculations/accountCalculations.ts`) using `decimal.js`:
- **Status Overrides**: `archived` -> `archived`; `breached` or `failed` -> `breached`.
- **Missing-Threshold Honesty**: If `maxOverallLossAmount` and `maxOverallLossPct` are both unconfigured, health returns `unknown` (`insufficient_data`), unless a reconciliation discrepancy triggers `warning`.
- **Threshold Utilization**: Resolves absolute or percentage overall loss limit against `startingBalance`, compares the more conservative of `effectiveCurrentBalance` vs `verifiedEquitySnapshot` against expected capital, and classifies:
  - `< 75%` and reconciled -> `healthy`
  - `>= 75%` or reconciliation discrepancy -> `warning`
  - `>= 90%` -> `critical`
  - `>= 100%` -> `breached`

## 3. Grouping & Side-by-Side Comparison
- `groupAccounts`: Partitions filtered accounts by `none`, `portfolio`, `account_type`, `status`, `currency`, or `provider`, calculating group subtotals (or explicit multi-currency labels when unconvertible).
- `AccountComparisonView`: Side-by-side matrix comparing selected accounts across classification, status, health, providers, capital, cash flow, reconciliation, profit targets, loss limits, drawdown mode, and timezone.

## 4. Stage 2 Readiness
`Trade`, `TradeExecution`, `Playbook`, `Setup`, and `Journal` schemas remain defined in `src/domain/models.ts` and `OverviewPage.tsx` transparently discloses that trade capture and trade-derived analytics unlock in Stage 2.
