import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAuthorizedScope,
  AuthorizationBoundaryError,
} from '../repositories/interfaces';
import { DEMO_USER_UID, DemoRepository } from '../repositories/demoRepository';

test('assertAuthorizedScope blocks unauthenticated, unverified, and cross-tenant actors', () => {
  assert.throws(
    () => assertAuthorizedScope(null, 'user_a'),
    AuthorizationBoundaryError
  );

  assert.throws(
    () => assertAuthorizedScope({ uid: 'user_a', emailVerified: false }, 'user_a'),
    AuthorizationBoundaryError
  );

  assert.throws(
    () => assertAuthorizedScope({ uid: 'user_b', emailVerified: true }, 'user_a'),
    AuthorizationBoundaryError
  );

  assert.doesNotThrow(() =>
    assertAuthorizedScope({ uid: 'user_a', emailVerified: true }, 'user_a')
  );
});

test('DemoRepository enforces DEMO_USER_UID scope and supports full Stage 1 workspace, portfolio, account, cash, snapshot, reference, and FX CRUD', async () => {
  const repo = new DemoRepository(false);

  // Cross-tenant attempt against DemoRepository must fail
  await assert.rejects(
    () => repo.listWorkspaces('real_firebase_user_uid'),
    AuthorizationBoundaryError
  );

  const workspaces = await repo.listWorkspaces(DEMO_USER_UID);
  assert.equal(workspaces.length, 1);
  const wsId = workspaces[0].id;

  // Update & archive/restore workspace
  const newWs = await repo.createWorkspace(DEMO_USER_UID, {
    name: 'Secondary Desk',
    description: 'Testing isolation',
    baseCurrency: 'EUR',
    timezone: 'Europe/Berlin',
  });
  const updatedWs = await repo.updateWorkspace(DEMO_USER_UID, newWs.id, {
    name: 'Secondary Desk v2',
    description: null,
    baseCurrency: 'EUR',
    timezone: 'Europe/Berlin',
  });
  assert.equal(updatedWs.name, 'Secondary Desk v2');
  const archivedWs = await repo.setWorkspaceStatus(DEMO_USER_UID, newWs.id, 'archived');
  assert.equal(archivedWs.status, 'archived');

  // Create reference library entities + FX rate
  const broker = await repo.createBroker(DEMO_USER_UID, wsId, {
    name: 'Pepperstone',
    website: 'https://pepperstone.com',
    notes: 'Razor tier',
  });
  const platform = await repo.createTradingPlatform(DEMO_USER_UID, wsId, {
    name: 'MetaTrader 5',
    vendor: 'MetaQuotes',
    notes: null,
  });
  const propFirm = await repo.createPropFirm(DEMO_USER_UID, wsId, {
    name: 'FTMO',
    website: 'https://ftmo.com',
    notes: null,
  });
  const fx = await repo.createFXRate(DEMO_USER_UID, wsId, {
    baseCurrency: 'GBP',
    quoteCurrency: 'USD',
    rate: '1.2750',
    capturedAt: '2026-11-22',
    source: 'manual',
    notes: 'QA check',
  });
  assert.equal(fx.baseCurrency, 'GBP');

  // Portfolio create, edit, delete unassigning accounts
  const pf = await repo.createPortfolio(DEMO_USER_UID, wsId, {
    name: 'Temp Portfolio',
    description: null,
    baseCurrency: 'USD',
  });
  const pfEdited = await repo.updatePortfolio(DEMO_USER_UID, wsId, pf.id, {
    name: 'Temp Portfolio Edited',
    description: 'Updated',
    baseCurrency: 'USD',
  });
  assert.equal(pfEdited.name, 'Temp Portfolio Edited');

  const created = await repo.createAccount(DEMO_USER_UID, wsId, {
    portfolioId: pf.id,
    name: 'QA Test Account',
    accountIdentifierMasked: '•••• 7777',
    accountType: 'forward_test',
    customCategory: 'Systematic',
    status: 'active',
    brokerId: broker.id,
    brokerName: broker.name,
    propFirmId: propFirm.id,
    propFirmName: propFirm.name,
    platformId: platform.id,
    platformName: platform.name,
    baseCurrency: 'USD',
    timezone: 'UTC',
    startingBalance: '20000.00',
    verifiedBalanceSnapshot: null,
    verifiedEquitySnapshot: null,
    snapshotAsOf: null,
    reconciliationNotes: null,
    openingDate: '2026-11-20',
    challengePhase: null,
    profitTargetAmount: null,
    profitTargetPct: null,
    maxDailyLossAmount: null,
    maxDailyLossPct: null,
    maxOverallLossAmount: '2000.00',
    maxOverallLossPct: null,
    drawdownMode: 'static',
    minTradingDays: null,
    maxTradingDays: null,
    notes: null,
    tags: ['qa'],
  });

  // Delete portfolio and verify account becomes unassigned (portfolioId === null)
  await repo.deletePortfolio(DEMO_USER_UID, wsId, pf.id);
  const accountsAfterPfDelete = await repo.listAccounts(DEMO_USER_UID, wsId);
  const unassignedAcc = accountsAfterPfDelete.find((a) => a.id === created.id);
  assert.equal(unassignedAcc?.portfolioId, null);

  // Cash transaction create, update, and delete
  const tx = await repo.createCashTransaction(DEMO_USER_UID, wsId, {
    accountId: created.id,
    type: 'deposit',
    amount: '1500.00',
    currency: 'USD',
    grossAmount: null,
    splitPct: null,
    occurredAt: '2026-11-21',
    notes: 'Top up',
  });
  const txUpdated = await repo.updateCashTransaction(DEMO_USER_UID, wsId, tx.id, {
    accountId: created.id,
    type: 'deposit',
    amount: '2000.00',
    currency: 'USD',
    grossAmount: null,
    splitPct: null,
    occurredAt: '2026-11-21',
    notes: 'Corrected amount',
  });
  assert.equal(txUpdated.amount, '2000.00');

  // Record BalanceSnapshot and verify snapshot history + account verified snapshot updated
  const snapRes = await repo.recordBalanceSnapshot(
    DEMO_USER_UID,
    wsId,
    {
      accountId: created.id,
      balance: '22000.00',
      equity: '21950.00',
      capturedAt: '2026-11-22',
      notes: 'Reconciled after deposit edit',
    },
    {
      calculatedLedgerBalance: '22000.00',
      reconciliationDelta: '0.00',
      reconciliationStatus: 'reconciled',
    }
  );
  assert.equal(snapRes.snapshot.reconciliationStatus, 'reconciled');
  assert.equal(snapRes.account.verifiedBalanceSnapshot, '22000.00');

  const snapshots = await repo.listBalanceSnapshots(DEMO_USER_UID, wsId);
  assert.ok(snapshots.some((s) => s.id === snapRes.snapshot.id));

  // Delete cash transaction & account cascade
  await repo.deleteCashTransaction(DEMO_USER_UID, wsId, tx.id);
  await repo.deleteAccount(DEMO_USER_UID, wsId, created.id);

  const remainingAccounts = await repo.listAccounts(DEMO_USER_UID, wsId);
  assert.equal(remainingAccounts.some((a) => a.id === created.id), false);

  const remainingSnaps = await repo.listBalanceSnapshots(DEMO_USER_UID, wsId);
  assert.equal(remainingSnaps.some((s) => s.accountId === created.id), false);
});

test('DemoRepository supports Stage 2 instrument & trade CRUD, archive/restore, account delete cascade, and cross-tenant isolation', async () => {
  const repo = new DemoRepository(false);
  const workspaces = await repo.listWorkspaces(DEMO_USER_UID);
  const wsId = workspaces[0].id;

  // Cross-tenant blocks for instruments and trades
  await assert.rejects(
    () => repo.listInstruments('intruder_uid', wsId),
    AuthorizationBoundaryError
  );
  await assert.rejects(
    () => repo.listTrades('intruder_uid', wsId),
    AuthorizationBoundaryError
  );
  await assert.rejects(
    () =>
      repo.createTrade(
        'intruder_uid',
        wsId,
        {
          accountId: 'acc_demo_funded_100k',
          symbol: 'EURUSD',
          direction: 'long',
          status: 'draft',
          isArchived: false,
          timeframes: [],
          timezone: 'UTC',
          marketConditions: [],
          tags: [],
        } as never,
        { portfolioId: null, accountCurrency: 'USD' }
      ),
    AuthorizationBoundaryError
  );

  // Instrument create -> update -> archive -> delete
  const inst = await repo.createInstrument(DEMO_USER_UID, wsId, {
    symbol: 'usdjpy',
    displayName: 'USD / JPY',
    assetClass: 'forex',
    baseCurrency: 'USD',
    quoteCurrency: 'jpy',
    profitCurrency: 'jpy',
    contractSize: '100000',
    tickSize: '0.001',
    pipSize: '0.01',
    tickValue: null,
    quantityUnit: 'lots',
    notes: 'QA Yen pair',
  });
  assert.equal(inst.symbol, 'USDJPY');
  assert.equal(inst.quoteCurrency, 'JPY');

  const instArchived = await repo.setInstrumentStatus(DEMO_USER_UID, wsId, inst.id, 'archived');
  assert.equal(instArchived.status, 'archived');

  // Create isolated account for cascade check
  const tempAcc = await repo.createAccount(DEMO_USER_UID, wsId, {
    portfolioId: null,
    name: 'Trade Cascade Temp',
    accountIdentifierMasked: null,
    accountType: 'paper',
    customCategory: null,
    status: 'active',
    brokerId: null,
    brokerName: null,
    propFirmId: null,
    propFirmName: null,
    platformId: null,
    platformName: null,
    baseCurrency: 'USD',
    timezone: 'UTC',
    startingBalance: '10000.00',
    verifiedBalanceSnapshot: null,
    verifiedEquitySnapshot: null,
    snapshotAsOf: null,
    reconciliationNotes: null,
    openingDate: null,
    challengePhase: null,
    profitTargetAmount: null,
    profitTargetPct: null,
    maxDailyLossAmount: null,
    maxDailyLossPct: null,
    maxOverallLossAmount: null,
    maxOverallLossPct: null,
    drawdownMode: 'none',
    minTradingDays: null,
    maxTradingDays: null,
    notes: null,
    tags: [],
  });

  // Trade create (draft) -> update (closed) -> archive -> restore -> delete
  const draftTrade = await repo.createTrade(
    DEMO_USER_UID,
    wsId,
    {
      accountId: tempAcc.id,
      instrumentId: inst.id,
      externalTicketId: null,
      symbol: 'USDJPY',
      direction: 'long',
      status: 'draft',
      isArchived: false,
      session: 'asia',
      timeframes: ['H1'],
      timezone: 'UTC',
      accountBalanceSnapshot: '10000.00',
      entryAt: '2026-11-22T02:00',
      entryPrice: '154.000',
      quantity: '0.50',
      entryType: 'limit',
      leverage: null,
      marginUsed: null,
      entryRationale: 'Initial draft setup',
      initialStopPrice: '153.500',
      actualStopPrice: null,
      plannedTargetPrice: '155.000',
      plannedRiskAmount: null,
      plannedRiskPct: null,
      actualRiskAmount: null,
      exitAt: null,
      exitPrice: null,
      exitQuantity: null,
      exitReason: null,
      manualGrossPnl: null,
      fxConversionRate: '0.00649',
      setupTag: 'Tokyo Open',
      commission: null,
      swap: null,
      fees: null,
      slippage: null,
      spread: null,
      marketConditions: ['Trending'],
      entryNotes: null,
      reviewNotes: null,
      tags: ['fx'],
    },
    { portfolioId: null, accountCurrency: 'USD' }
  );
  assert.equal(draftTrade.status, 'draft');

  const closedTrade = await repo.updateTrade(
    DEMO_USER_UID,
    wsId,
    draftTrade.id,
    {
      accountId: tempAcc.id,
      instrumentId: inst.id,
      externalTicketId: null,
      symbol: 'USDJPY',
      direction: 'long',
      status: 'closed',
      isArchived: false,
      session: 'asia',
      timeframes: ['H1'],
      timezone: 'UTC',
      accountBalanceSnapshot: '10000.00',
      entryAt: '2026-11-22T02:00',
      entryPrice: '154.000',
      quantity: '0.50',
      entryType: 'limit',
      leverage: null,
      marginUsed: null,
      entryRationale: 'Closed target hit',
      initialStopPrice: '153.500',
      actualStopPrice: '153.500',
      plannedTargetPrice: '155.000',
      plannedRiskAmount: null,
      plannedRiskPct: null,
      actualRiskAmount: null,
      exitAt: '2026-11-22T06:00',
      exitPrice: '155.000',
      exitQuantity: '0.50',
      exitReason: 'Target hit',
      manualGrossPnl: null,
      fxConversionRate: '0.00649',
      setupTag: 'Tokyo Open',
      commission: '3.50',
      swap: null,
      fees: null,
      slippage: null,
      spread: null,
      marketConditions: ['Trending'],
      entryNotes: null,
      reviewNotes: 'Clean trade.',
      tags: ['fx'],
    },
    { portfolioId: null, accountCurrency: 'USD' }
  );
  assert.equal(closedTrade.status, 'closed');

  const archivedTrade = await repo.setTradeArchived(DEMO_USER_UID, wsId, draftTrade.id, true);
  assert.equal(archivedTrade.isArchived, true);

  const restoredTrade = await repo.setTradeArchived(DEMO_USER_UID, wsId, draftTrade.id, false);
  assert.equal(restoredTrade.isArchived, false);

  // Account deletion must cascade-delete trades belonging to tempAcc
  await repo.deleteAccount(DEMO_USER_UID, wsId, tempAcc.id);
  const tradesAfterDelete = await repo.listTrades(DEMO_USER_UID, wsId);
  assert.equal(tradesAfterDelete.some((t) => t.accountId === tempAcc.id), false);

  await repo.deleteInstrument(DEMO_USER_UID, wsId, inst.id);
});

