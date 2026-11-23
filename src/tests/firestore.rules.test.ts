import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules enforces Eight Pillars and matches Stage 1 firebase-blueprint.json collections', () => {
  const rules = fs.readFileSync(rulesPath, 'utf-8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8')) as {
    firestore: Record<string, unknown>;
  };

  // Global default-deny safety net
  assert.ok(rules.includes('match /{document=**} {\n      allow read, write: if false;'));

  // Verified email and ID regex hardening
  assert.ok(rules.includes('request.auth.token.email_verified == true'));
  assert.ok(rules.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"));

  // Every collection in Stage 1 + Stage 2 blueprint has a match block in firestore.rules
  const expectedRulesBlocks = [
    'match /users/{userId}',
    'match /workspaces/{workspaceId}',
    'match /portfolios/{portfolioId}',
    'match /accounts/{accountId}',
    'match /cashTransactions/{transactionId}',
    'match /balanceSnapshots/{snapshotId}',
    'match /brokers/{brokerId}',
    'match /platforms/{platformId}',
    'match /propFirms/{firmId}',
    'match /fxRates/{rateId}',
    'match /auditLogs/{logId}',
    'match /instruments/{instrumentId}',
    'match /trades/{tradeId}',
  ];

  for (const block of expectedRulesBlocks) {
    assert.ok(rules.includes(block), `Missing rules block: ${block}`);
  }

  assert.ok(blueprint.firestore['/users/{userId}']);
  assert.ok(blueprint.firestore['/workspaces/{workspaceId}']);
  assert.ok(blueprint.firestore['/workspaces/{workspaceId}/balanceSnapshots/{snapshotId}']);
  assert.ok(blueprint.firestore['/workspaces/{workspaceId}/brokers/{brokerId}']);
  assert.ok(blueprint.firestore['/workspaces/{workspaceId}/platforms/{platformId}']);
  assert.ok(blueprint.firestore['/workspaces/{workspaceId}/propFirms/{firmId}']);
  assert.ok(blueprint.firestore['/workspaces/{workspaceId}/fxRates/{rateId}']);
  assert.ok(blueprint.firestore['/workspaces/{workspaceId}/instruments/{instrumentId}']);
  assert.ok(blueprint.firestore['/workspaces/{workspaceId}/trades/{tradeId}']);

  // Master Gate parent workspace check
  assert.ok(rules.includes('isWorkspaceOwner(workspaceId)'));

  // Query Enforcer: list rules evaluate resource.data.ownerId directly
  const listMatches = rules.match(/allow list:[^\n]+/g) ?? [];
  assert.ok(listMatches.length >= 12);
  for (const ruleLine of listMatches) {
    if (ruleLine.includes('false')) continue;
    assert.ok(
      ruleLine.includes('resource.data.ownerId == request.auth.uid'),
      `Unsafe list rule found: ${ruleLine}`
    );
  }

  // Audit logs and balanceSnapshots history are immutable (only create/delete where appropriate; auditLogs never updated/deleted)
  assert.ok(rules.includes('match /auditLogs/{logId}'));
  assert.ok(rules.includes('allow update: if false;\n        allow delete: if false;'));

  // Total Array Guarding: all bounded elements (0..7, 0..9, 0..15) are validated
  assert.ok(rules.includes('isValidStringListMax8(data.timeframes, 1, 16)'));
  assert.ok(rules.includes('isValidStringListMax10(data.tags, 1, 40)'));
  assert.ok(rules.includes('isValidStringListMax16(data.marketConditions, 1, 40)'));
  assert.ok(rules.includes('items[7]'));
  assert.ok(rules.includes('items[9]'));
  assert.ok(rules.includes('items[15]'));

  // Strictly positive (> 0) and non-zero decimal guards, non-negative startingBalance, closed trade invariant
  assert.ok(rules.includes('isValidStrictlyPositiveDecimal(data.rate)'));
  assert.ok(rules.includes('isValidStrictlyPositiveDecimal(data.contractSize)'));
  assert.ok(rules.includes('isValidNonZeroSignedDecimal(data.amount)'));
  assert.ok(rules.includes('isValidPositiveDecimal(data.startingBalance)'));
  assert.ok(rules.includes("data.status != 'closed'"));
  assert.ok(rules.includes('isOwnedPortfolio(workspaceId,'));
  assert.ok(rules.includes('isOwnedAccount(workspaceId,'));
  assert.ok(rules.includes('isOwnedInstrument(workspaceId,'));
});

test('FirestoreRepository aligns createWorkspace sequencing, list queries, and user profile defaults with firestore.rules', () => {
  const repoPath = path.resolve(process.cwd(), 'src/repositories/firestoreRepository.ts');
  const repoSource = fs.readFileSync(repoPath, 'utf-8');

  // Extract createWorkspace method body and confirm it commits wsRef via setDoc before appendAuditLog
  const createWsStart = repoSource.indexOf('async createWorkspace(');
  const createWsEnd = repoSource.indexOf('async updateWorkspace(', createWsStart);
  assert.ok(createWsStart !== -1 && createWsEnd > createWsStart);
  const createWsBody = repoSource.slice(createWsStart, createWsEnd);

  assert.equal(
    createWsBody.includes('writeBatch('),
    false,
    'createWorkspace must not batch workspace and auditLog creation together while auditLogs rule checks exists(workspace)'
  );
  const setDocIdx = createWsBody.indexOf('await setDoc(wsRef, wsPayload)');
  const appendLogIdx = createWsBody.indexOf('await this.appendAuditLog(');
  assert.ok(setDocIdx !== -1 && appendLogIdx > setDocIdx);

  // Confirm list* queries do not mix where('ownerId', ...) with orderBy(...) that require composite indexes
  assert.equal(
    repoSource.includes('orderBy('),
    false,
    'FirestoreRepository list queries should sort client-side after where(ownerId) to avoid missing composite index errors'
  );

  // Confirm ensureUserProfile trims displayName with non-empty fallback
  assert.ok(repoSource.includes("user.displayName?.trim()"));
  assert.ok(repoSource.includes("'Trader'"));
});

