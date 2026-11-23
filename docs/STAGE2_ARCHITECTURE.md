# Meridian Desk — Stage 2 Architecture: Trade Journal Core & Central Financial Engine

## 1. Scope & Capabilities
Stage 2 introduces the core Trade Journal, Instrument Specifications registry, and the Central Decimal-Safe Financial Engine (`decimal.js` precision 28, `ROUND_HALF_UP`). All trade metrics reconcile directly into Stage 1 Account Ledgers, Balance Snapshots, Overview KPIs, and Workspace/Portfolio Rollups.

## 2. Domain Entities & Persistence Paths
- **`InstrumentSpecification`** (`workspaces/{workspaceId}/instruments/{instrumentId}`):
  - Defines `symbol`, `assetClass`, `baseCurrency`, `quoteCurrency`, optional `profitCurrency`, `contractSize`, `tickSize`, `pipSize`, optional `tickValue`, `quantityUnit` (`lots` | `contracts` | `shares` | `units`), and `status` (`active` | `archived`).
  - Workspace-scoped and shared across trades; includes 1-click preset templates (`INSTRUMENT_PRESETS`) and inline creation directly inside `TradeFormModal`.
- **`Trade`** (`workspaces/{workspaceId}/trades/{tradeId}`):
  - Scoped to `workspaceId` and `accountId` (with `accountCurrency` & optional `portfolioId` synced from the linked account).
  - Lifecycle states: `draft` | `open` | `closed`, plus orthogonal `isArchived` boolean (`false` by default).
  - Optional-by-default entry fields (`entryAt`, `entryPrice`, `quantity`, `entryType`, `leverage`, `marginUsed`, `entryRationale`), separated risk fields (`initialStopPrice`, `actualStopPrice`, `plannedTargetPrice`, `plannedRiskAmount`, `plannedRiskPct`, `actualRiskAmount`), exit fields (`exitAt`, `exitPrice`, `exitQuantity`, `exitReason`, `manualGrossPnl`, `fxConversionRate`), execution costs (`commission`, `swap`, `fees`, `slippage`, `spread`), and context (`session`, `timeframes`, `setupTag`, `marketConditions`, `entryNotes`, `reviewNotes`, `tags`).

## 3. Central Calculation Engine Conventions (`/src/domain/calculations/tradeCalculations.ts`)
1. **Strict `null` Propagation**: Missing entry/exit prices, missing instrument specifications, or missing quote-to-account FX conversions preserve `null` with an explicit `unavailableReason` rather than coercing to `0`.
2. **Contract / Tick Math**:
   - When `tickValue` is configured (e.g., CME futures `NQ`: `$5.00` per `0.25` tick): `nativeAmount = (priceDiff / tickSize) * tickValue * qty`.
   - Otherwise: `nativeAmount = priceDiff * contractSize * qty`.
3. **FX Conversion Precedence**:
   1. `same_currency` (`profitCurrency === accountCurrency` -> `1`)
   2. `trade_override` (`trade.fxConversionRate`)
   3. `workspace_direct` (`FXRateSnapshot` matching `profitCurrency -> accountCurrency`)
   4. `workspace_inverse` (`1 / rate` from `FXRateSnapshot` matching `accountCurrency -> profitCurrency`)
   5. `missing_fx_rate` (`rate = null`, balance impact blocked)
4. **Initial Risk vs Actual Risk**:
   - `initialRiskAmount` anchors to `plannedRiskAmount` (if provided) or `initialStopPrice`. Moving `actualStopPrice` (e.g., to breakeven or widened stop) updates `actualRiskAmount` without rewriting `initialRiskAmount` or `netRMultiple`.
5. **Execution Costs & Net P&L**:
   - Positive `commission`, `fees`, `slippage`, and `swap` values represent costs subtracted from `grossPnl`. Negative values (e.g., positive overnight swap credit or fee rebate) credit `netPnl`.
6. **Breakeven Tolerance & Outcome**:
   - Closed trades with calculable `netPnl` resolve to `'breakeven'` when `|netPnl| <= 0.005`, `'win'` when `netPnl > 0.005`, and `'loss'` when `netPnl < -0.005`.
   - Win rate denominator includes all closed trades with calculable `netPnl` (`winCount / closedWithPnlCount`), while reporting `W / L / BE` counts explicitly.
7. **Ledger & Rollup Balance Impact**:
   - Strictly **non-archived `closed` trades with calculable `netPnl`** (`balanceImpactApplies === true`) feed `calculateAccountTradeImpact`, `calculateAccountLedger`, `recordBalanceSnapshot`, `calculatePortfolioRollups`, and `calculateWorkspaceRollup`.
   - Ledger formula: `Calculated Balance = Starting Balance + Net Cash Movements + Realised Trade Net P&L`.

## 4. Security & Isolation
- `firestore.rules` validates both `instruments` and `trades` schemas, verifies `isWorkspaceOwner(workspaceId)`, validates parent `accountId` ownership on trade creation, and enforces `resource.data.ownerId == request.auth.uid` on list queries.
- Account deletion cascades cleanly to associated trades in both `FirestoreRepository` and `DemoRepository`.

## 5. Trade Explorer & UI Architecture
- `TradeJournalPage`: 5-card live KPI strip, search query across symbols/tags/notes/accounts/setups, filters (archive scope, status, account, direction, symbol, outcome, session, date range), column sorting (`date`, `symbol`, `net_pnl`, `net_r`, `initial_risk`, `status`), client-side pagination (`10 / 25 / 50`), desktop table, mobile cards, and an `Instrument Specs` registry tab.
- `TradeFormModal`: Structured 5-section modal with sticky Live Financial Engine Preview updating keystroke-by-keystroke and inline `InstrumentFormModal` creation without losing trade form state.
- `TradeDetailModal`: Full calculation breakdown, Initial vs Actual Risk comparison, FX provenance, quick status & archive transitions, and delete confirmation.
