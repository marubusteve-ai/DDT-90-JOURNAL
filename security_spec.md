# Firestore Security Specification — Stage 1 & Stage 2

## 1. Data Invariants
1. **User PII Isolation**: `/users/{userId}` can only be read, created, or updated by `request.auth.uid == userId`. No blanket `isSignedIn()` reads or collection `list` queries are permitted on `/users`. `email` cannot be spoofed to an arbitrary address, and `activeWorkspaceId` updates must point to `null` or a workspace owned by `request.auth.uid`.
2. **Workspace Ownership Root**: `/workspaces/{workspaceId}` can only be created when `ownerId == request.auth.uid`, `email_verified == true`, and `createdAt == request.time`. Only the owner can `get`, `list` (enforced via `resource.data.ownerId == request.auth.uid`), or `update` it.
3. **Master Gate Subcollection Sync**: All subcollections under `/workspaces/{workspaceId}/...` (`portfolios`, `accounts`, `cashTransactions`, `balanceSnapshots`, `brokers`, `platforms`, `propFirms`, `fxRates`, `instruments`, `trades`, `auditLogs`) verify parent ownership via `get(/databases/$(database)/documents/workspaces/$(workspaceId)).data.ownerId == request.auth.uid` on single-document operations (`get`, `create`, `update`, `delete`).
4. **Query Enforcer (No Client Delegation)**: Every `allow list` on workspaces and subcollections explicitly enforces `resource.data.ownerId == request.auth.uid` without calling `get()` or `exists()`.
5. **Relational & Financial Integrity**:
   - `CashTransaction`, `BalanceSnapshot`, and `Trade` creation (and `Trade` account reassignment) verify that the referenced `accountId` exists under `/workspaces/{workspaceId}/accounts/{accountId}` and belongs to the same `ownerId`.
   - Assigning or changing `Account.portfolioId`, `Trade.portfolioId`, or `Trade.instrumentId` to a non-empty ID verifies the target document exists in the same workspace and belongs to `request.auth.uid`.
   - `BalanceSnapshot` and `AuditLog` entries are immutable after creation (`allow update: if false` — `BalanceSnapshot` may be deleted only by verified owner, `AuditLog` cannot be updated or deleted).
   - `FXRateSnapshot` enforces non-identical `baseCurrency != quoteCurrency` and strictly positive decimal `rate` (`> 0`).
   - `CashTransaction` enforces non-zero signed decimal `amount`.
   - `Account` records forbid negative `startingBalance`, validate every element (`0..9`) of `tags` (`<= 10`, strings 1..40 chars), and preserve `ownerId`, `workspaceId`, `id`, and `createdAt` immutably on update.
   - `InstrumentSpecification` enforces strictly positive decimals (`> 0`) for `contractSize`, `tickSize`, `pipSize`, and optional `tickValue`, plus strict symbol regex.
   - `Trade` enforces status enums (`draft`, `open`, `closed`), closed-trade exit requirement (`exitPrice != null || manualGrossPnl != null`), strictly positive decimals (`> 0`) for prices/quantities/FX rate, bounded arrays with full per-element string/length validation (`timeframes <= 8`, `marketConditions <= 16`, `tags <= 10`), Stage-3 null lock on `playbookId`/`setupId`, and immutable `id`, `workspaceId`, `ownerId`, and `createdAt`.
6. **Temporal & Evaluation Order Integrity**: `createdAt == request.time` on `create`; `updatedAt == request.time` and `createdAt == existing().createdAt` on `update`. Static validation and `affectedKeys()` checks always run before relational `get()`/`exists()` reads.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Workspace Read**: `get(/workspaces/ws-1)` with `auth == null`.
2. **Cross-Tenant Account Read**: User B (`uid: "user-b"`) calls `get(/workspaces/ws-user-a/accounts/acc-1)`.
3. **Blanket Collection Scrape**: User B calls `list(/workspaces)` or `list(/workspaces/ws-user-a/accounts)` or `list(/workspaces/ws-user-a/brokers)` without `where("ownerId", "==", "user-b")`.
4. **Identity Spoofing on Workspace Create**: User B creates `/workspaces/ws-spoof` with `ownerId: "user-a"`.
5. **Unverified Email Write**: User with `email_verified: false` attempts to create a workspace, account, or broker reference.
6. **Shadow / Ghost Field Injection on Account Create**: Authenticated owner creates an account including an undeclared field `isVerifiedByBroker: true`.
7. **Shadow Update / Immutable Field Tampering**: Authenticated owner updates an account, portfolio, trade, or cash transaction attempting to change `ownerId`, `workspaceId`, or `createdAt`.
8. **ID Poisoning**: Authenticated owner attempts to create `/workspaces/ws-1/accounts/bad$id!with/invalidchars` or a 200-char ID.
9. **Value Poisoning (Oversized String / Invalid Decimal / Closed Trade Without Exit)**: Owner updates `startingBalance` to `"-100"`, `fxRates.rate` to `"0"` or `baseCurrency == quoteCurrency`, `cashTransactions.amount` to `"0"`, `instruments.tickSize` to `"0"`, or creates a `closed` trade with both `exitPrice: null` and `manualGrossPnl: null`.
10. **Array Exhaustion & Nested-Element Poisoning**: Owner creates an account or trade with `tags` containing 15 items (limit 10), `tags[0]` as an integer `123`, or `tags[1]` / `marketConditions[3]` as an oversized string or object.
11. **Orphaned / Cross-Tenant Reference Injection**: Owner creates a `cashTransaction`, `balanceSnapshot`, or `trade` referencing a non-existent `accountId`, or sets `portfolioId` / `instrumentId` / `activeWorkspaceId` to another user's or non-existent ID.
12. **Immutable Log / Snapshot Tampering**: Owner attempts to `update` or `delete` `/workspaces/ws-1/auditLogs/log-1`, or `update` `/workspaces/ws-1/balanceSnapshots/snap-1`.

