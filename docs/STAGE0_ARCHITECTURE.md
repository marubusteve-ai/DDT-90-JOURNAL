# Meridian Desk — Stage 0 Architecture & Documentation

## 1. Stage 0 Scope & Honest Boundaries
Meridian Desk is a personal trading journal and performance operating system built in progressive stages. **Stage 0** delivers the foundational architecture and a verified vertical slice:
- Real Firebase Authentication (Google Sign-In) and Cloud Firestore persistence with owner-scoped security rules.
- Explicit **Isolated Demo Mode** running strictly in local session memory (`sessionStorage` + in-memory store), completely isolated from real user workspaces.
- Responsive institutional trading terminal shell (`ShellLayout`), dark/light theme support, workspace/account context switchers, and `Cmd+K` global search.
- Full Account CRUD (create, edit, select, reconcile snapshot, archive/restore) and Cash Movement recording (deposits, withdrawals, prop payouts, fees, adjustments).
- Stage 0 Dashboard driven strictly by persisted account records and the central `decimal.js` financial calculation engine.

**Intentionally Deferred to Stage 1+**: Trade Journal capture, multi-target/partial-exit trade calculations, Playbook/Checklist engine, Risk calculators, Prop-Firm rule engine, Performance Analytics charts, Psychology tracking, CSV/JSON import-export, Reports, AI Trading Coach, Automation, and IndexedDB offline sync. Planned modules render an honest Stage Roadmap page with zero fake metrics or dead controls.

## 2. Folder Structure
- `server.ts` — Express + Vite full-stack server entrypoint (`/api/health`, `/api/system/capabilities`).
- `src/app/` — `AppContext.tsx` (central state), `routes.ts` (15-route registry & stage metadata).
- `src/domain/` — `models.ts` (Stage 0 + future-stage TypeScript contracts), `validation/accountValidation.ts` (Zod schemas synced with `firebase-blueprint.json`), `calculations/accountCalculations.ts` (`decimal.js` ledger & multi-currency rollup engine).
- `src/repositories/` — `interfaces.ts` (`IDataRepository`, `assertAuthorizedScope`), `firestoreRepository.ts`, `demoRepository.ts`.
- `src/integrations/firebase/` — `client.ts` (Firebase app, Auth, Firestore DB ID, `testConnection`, `handleFirestoreError`).
- `src/components/` — `AuthGate.tsx`, `ShellLayout.tsx`, `ErrorBoundary.tsx`, `StatusText.tsx`.
- `src/features/` — `dashboard/OverviewPage.tsx`, `accounts/AccountsPage.tsx`, `accounts/AccountFormModal.tsx`, `accounts/CashTransactionModal.tsx`, `workspaces/WorkspacesPage.tsx`, `settings/SettingsPage.tsx`, `roadmap/PlannedModulePage.tsx`.
- `src/tests/` — Deterministic `node:test` suites (`accountCalculations.test.ts`, `accountValidation.test.ts`, `authAndIsolation.test.ts`, `firestore.rules.test.ts`).

## 3. Persistence & Security Decisions
- **Firestore Hierarchy**:
  - `/users/{userId}` — PII-isolated user profile & preferences (owner read/write only, `list` disabled).
  - `/workspaces/{workspaceId}` — Top-level workspace root owned by `ownerId`.
  - `/workspaces/{workspaceId}/portfolios/{portfolioId}` — Account portfolio groups.
  - `/workspaces/{workspaceId}/accounts/{accountId}` — Trading accounts.
  - `/workspaces/{workspaceId}/cashTransactions/{transactionId}` — Non-trade cash ledger movements.
  - `/workspaces/{workspaceId}/auditLogs/{logId}` — Append-only audit log (`update`/`delete` denied).
- **Security Rules (`firestore.rules`)**: Enforces verified email (`request.auth.token.email_verified == true`), strict field allowlists (`hasOnly`), decimal/currency regex guards, immutable `ownerId`/`createdAt`, Master Gate `get()` parent ownership checks, and rule-level `resource.data.ownerId == request.auth.uid` on `list` queries.
- **Monetary Precision**: Monetary fields are stored as decimal strings (`^-?\d+(\.\d{1,8})?$`) and computed via `decimal.js` to prevent IEEE-754 floating-point drift.

## 4. Financial Conventions (Stage 0)
- `Expected Ledger Balance = Starting Balance + Net Cash Movements + Realised Trade P&L (0 when 0 trades exist)`.
- `Reconciliation Delta = Verified Balance Snapshot - Expected Ledger Balance` (null when no snapshot has been recorded).
- Missing or unverified numbers remain `null` and render as `—` or `"Not recorded"`—never silently coerced to `0`.
- Multi-currency accounts are grouped by `baseCurrency`. Consolidated multi-currency totals are marked unavailable unless explicit `FXRateSnapshot` conversions exist for all currencies.

## 5. Next-Stage Roadmap (Recommended Next Step: Stage 1)
1. **Stage 1 — Core Trade Journal & Trade Execution Ledger**: Implement manual Trade CRUD, multi-entry fills, dynamic `TP1..TPn` planned targets, separate partial/final exits, stop-loss management timeline, and trade-level `decimal.js` P&L / R-multiple calculations linked to Stage 0 accounts.
2. **Stage 2 — Playbooks, Checklists & Risk Management Centre**.
3. **Stage 3 — Prop-Firm Rule Engine & Performance Analytics**.
4. **Stage 4 — Psychology, CSV Import/Export & Professional Reports**.
5. **Stage 5 — Grounded AI Trading Coach & Automation Rules**.
6. **Stage 6 — Broker/Platform Adapters, IndexedDB Offline Sync & PWA Hardening**.
