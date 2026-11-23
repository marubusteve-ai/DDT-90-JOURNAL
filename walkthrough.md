# Security Summary

**Reviewed Files**: 6
**Issues Resolved**: 5

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Array Element Validation | `firestore.rules` | 165, 365, 397, 401 | `Account.tags` and `Trade.timeframes`, `marketConditions`, and `tags` only checked element `[0]` for string type and length, leaving later array elements unchecked. | Medium | Fixed | Added bounded list validation helpers (`isValidStringListMax8`, `isValidStringListMax10`, `isValidStringListMax16`) that validate every element up to the array limit. |
| Numeric & Financial Bounds | `firestore.rules` | 148, 181, 275, 323, 369 | `Account.startingBalance` allowed negative strings, `CashTransaction.amount` allowed `"0"`, and strictly positive rates/prices/contract sizes (`FXRateSnapshot.rate`, `InstrumentSpecification`, `Trade`) allowed `"0"`. | Medium | Fixed | Added `isValidStrictlyPositiveDecimal` and `isValidNonZeroSignedDecimal`, switched `startingBalance` to non-negative `isValidPositiveDecimal`, and blocked zero values on positive-only fields. |
| Closed Trade & Stage-3 Fields | `firestore.rules` | 389, 390, 402 | `isValidTrade` allowed creating or updating a `closed` trade with neither `exitPrice` nor `manualGrossPnl`, and permitted arbitrary IDs in unimplemented Stage-3 `playbookId`/`setupId` fields. | Medium | Fixed | Enforced the closed-trade exit requirement in `isValidTrade`, locked `playbookId`/`setupId` to `null`, and removed them from `update` allowlisted keys. |
| Cross-Reference & Email Integrity | `firestore.rules` | 413, 490, 764 | `UserProfile.activeWorkspaceId`, `Account.portfolioId`, `Trade.portfolioId`, and `Trade.instrumentId` did not verify target existence/ownership; `UserProfile.email` could be updated to an arbitrary string. | Medium | Fixed | Verified ownership on assigned/changed `activeWorkspaceId`, `portfolioId`, and `instrumentId`, and restricted `UserProfile.email` to the existing or verified token email. |
| Rule Evaluation Order | `firestore.rules` | 465, 497, 545, 596, 628, 660, 692, 736, 773 | Several `allow update` blocks ran `isWorkspaceOwner()` and `get()`/`exists()` reads before `affectedKeys().hasOnly()`, causing avoidable database reads on rejected updates. | Low | Fixed | Reordered all `allow update` blocks so auth, schema, immutability, timestamps, and `affectedKeys()` execute before relational `get()`/`exists()` checks. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Global Default-Deny & IDs | `firestore.rules` | Starts with a global `allow read, write: if false;` catch-all and enforces `^[a-zA-Z0-9_\-]+$` (`<= 128` chars) on every document path and ID field. |
| User PII Isolation | `firestore.rules` | Restricts `/users/{userId}` `get`, `create`, and `update` strictly to `request.auth.uid == userId`, disables `list` and `delete`, and requires `email_verified == true` for writes. |
| Workspace & Subcollection Isolation | `firestore.rules` | Enforces `ownerId == request.auth.uid` on workspace reads/writes, `isWorkspaceOwner(workspaceId)` on subcollection single-document operations, and `resource.data.ownerId == request.auth.uid` on every `allow list` without `get()`/`exists()`. |
| Immutable Audit & Reconciliation History | `firestore.rules` | Locks `/auditLogs` against updates and deletes (`false`) and `/balanceSnapshots` against updates (`false`). |
| Client Code & Server Surface | `src/`, `server.ts` | No hardcoded private keys, raw HTML rendering sinks, or dynamic code execution; `server.ts` exposes only non-sensitive `/api/health` and `/api/system/capabilities` metadata. |
| Dependency Audit | `bun.lock` | `bun audit` flagged a transitive `@grpc/grpc-js@1.9.16` dependency inside `firebase > @firebase/firestore` (Node.js gRPC transport, unused by the browser SPA and `server.ts`). |

## PoC Verification

### Unchecked Array Elements Beyond Index Zero
#### Summary
| Field | Value |
|---|---|
| Issue Type | Incomplete Array Element Validation |
| Impact | Medium |
| Affected File | `firestore.rules:165, 365, 397, 401` |
| Test Scenario | Authenticated owner submits a `Trade` or `Account` write with `tags: ["valid-tag", {"nested": "oversized-object"}, "x".repeat(5000)]`. |

#### How It Was Fixed
Replaced the index-`[0]`-only check with bounded helpers (`isValidStringListMax8`, `isValidStringListMax10`, `isValidStringListMax16`) that validate every possible array index up to each field's maximum length.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Payload arrives at `match /workspaces/{workspaceId}/trades/{tradeId}` `create` or `update` | Enters `isValidTrade(incoming(), workspaceId, tradeId)` |
| 2 | Reaches `isValidStringListMax10(data.tags, 1, 40)` at `firestore.rules:95` | Checks `items[0]`, then evaluates `items[1]` via `isValidStringItem` |
| 3 | `items[1] is string` evaluates to `false` (and oversized strings fail `size() <= 40`) | **Rejected with PERMISSION_DENIED** |

#### Conclusion
**Fix Verified** - Every element in `Account.tags`, `Trade.timeframes`, `Trade.marketConditions`, and `Trade.tags` must be a bounded string, preventing non-string or oversized payload injection past index `0`.

---

### Zero and Negative Financial Values Bypass
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Numeric Domain Validation |
| Impact | Medium |
| Affected File | `firestore.rules:44, 148, 181, 275, 323, 369` |
| Test Scenario | Authenticated owner writes `fxRates.rate: "0"`, `cashTransactions.amount: "0.00"`, `instruments.tickSize: "0"`, or `accounts.startingBalance: "-500"`. |

#### How It Was Fixed
Added `isValidStrictlyPositiveDecimal` (`!val.matches('^0+(\\.0+)?$')`) and `isValidNonZeroSignedDecimal` (`!val.matches('^-?0+(\\.0+)?$')`), and switched `Account.startingBalance` from signed decimal to non-negative `isValidPositiveDecimal`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Payload arrives at `fxRates`, `cashTransactions`, `instruments`, or `accounts` write rule | Enters entity validation helper |
| 2 | `isValidStrictlyPositiveDecimal("0")` or `isValidNonZeroSignedDecimal("0.00")` runs `!val.matches('^0+(\\.0+)?$')` | Regex match triggers negation (`false`) |
| 3 | `isValidPositiveDecimal("-500")` fails `^\d+(\.\d{1,8})?$` | **Rejected with PERMISSION_DENIED** |

#### Conclusion
**Fix Verified** - Zero-valued FX rates, instrument tick/contract sizes, zero-amount cash transactions, and negative starting balances are blocked at the Firestore rule layer.

---

### Closed Trade Without Exit Data & Stage-3 Foreign Keys
#### Summary
| Field | Value |
|---|---|
| Issue Type | State & Schema Integrity Bypass |
| Impact | Medium |
| Affected File | `firestore.rules:389, 390, 402, 764` |
| Test Scenario | Authenticated owner writes a `Trade` with `status: "closed"`, `exitPrice: null`, `manualGrossPnl: null`, and `playbookId: "arbitrary_id"`. |

#### How It Was Fixed
Added the closed-trade exit check to `isValidTrade`, locked `playbookId` and `setupId` to `null` while Stage-3 collections do not exist, and removed them from `trades` `update` `affectedKeys`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Payload arrives at `trades` `create` or `update` | Enters `isValidTrade(incoming(), workspaceId, tradeId)` |
| 2 | `(!('playbookId' in data) || data.playbookId == null)` evaluates to `false` for `"arbitrary_id"` | Blocked if Stage-3 fields are non-null |
| 3 | `(data.status != 'closed' || (('exitPrice' in data && data.exitPrice != null) || ('manualGrossPnl' in data && data.manualGrossPnl != null)))` evaluates to `false` | **Rejected with PERMISSION_DENIED** |

#### Conclusion
**Fix Verified** - Closed trades require either an exit price or manual gross P&L override, and unimplemented Stage-3 relation fields remain locked to `null`.

---

### Cross-Tenant Reference & User Email Spoofing
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unverified Relational Reference / Email Tampering |
| Impact | Medium |
| Affected File | `firestore.rules:413, 490, 764` |
| Test Scenario | User B updates `/users/userB` with `activeWorkspaceId: "ws_belonging_to_userA"` or `email: "victim@example.com"`, or assigns `Trade.instrumentId` to an ID outside their workspace. |

#### How It Was Fixed
Added `isWorkspaceOwner`, `isOwnedPortfolio`, and `isOwnedInstrument` verification when `activeWorkspaceId`, `portfolioId`, or `instrumentId` is newly set or changed, and constrained `UserProfile.email` updates to match the existing value or verified token email.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | User B submits `update` on `/users/userB` or `create`/`update` on `accounts`/`trades` with User A's ID | Passes static ID regex and schema check |
| 2 | Rule executes `isWorkspaceOwner("ws_userA")` or `isOwnedInstrument(workspaceId, incoming().instrumentId)` | `get(...).data.ownerId == request.auth.uid` (or `exists(...)`) evaluates to `false` |
| 3 | `UserProfile.email` mismatch against `existing().email` and `request.auth.token.email` evaluates to `false` | **Rejected with PERMISSION_DENIED** |

#### Conclusion
**Fix Verified** - Users cannot link profiles, accounts, or trades to workspaces, portfolios, or instruments they do not own, nor overwrite their profile email with an unverified address.

---

### Suboptimal Update Evaluation Order
#### Summary
| Field | Value |
|---|---|
| Issue Type | Excess Database Reads on Unauthorized/Invalid Updates |
| Impact | Low |
| Affected File | `firestore.rules:465-790` |
| Test Scenario | Authenticated owner submits an `update` with a disallowed shadow key (`affectedKeys` violation) on `accounts` or `trades`. |

#### How It Was Fixed
Moved `isWorkspaceOwner(workspaceId)` and relational `isOwnedAccount`/`isOwnedPortfolio`/`isOwnedInstrument` checks after all static validation, immutability, `request.time`, and `affectedKeys().hasOnly(...)` checks in every `allow update` block.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Update containing a disallowed key reaches `allow update` | Passes auth and `isValid[Entity]` if key is unrelated, or fails `hasOnly` immediately |
| 2 | `incoming().diff(existing()).affectedKeys().hasOnly(...)` short-circuits to `false` before `isWorkspaceOwner(...)` | **Rejected with 0 `get()`/`exists()` reads** |

#### Conclusion
**Fix Verified** - All `allow update` blocks enforce zero-read static and key-allowlist validation prior to relational lookups.
