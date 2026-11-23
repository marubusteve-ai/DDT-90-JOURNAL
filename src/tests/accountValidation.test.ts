import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountInputSchema,
  balanceSnapshotInputSchema,
  brokerInputSchema,
  cashTransactionInputSchema,
  fxRateInputSchema,
  propFirmInputSchema,
  tradingPlatformInputSchema,
} from '../domain/validation/accountValidation';

test('accountInputSchema accepts valid prop evaluation account configuration with reference IDs and custom category', () => {
  const res = accountInputSchema.safeParse({
    portfolioId: 'pf_1',
    name: 'FTMO 100K Phase 1',
    accountIdentifierMasked: '•••• 9012',
    accountType: 'prop_evaluation',
    customCategory: 'Swing Evaluation',
    status: 'active',
    brokerId: 'brk_1',
    brokerName: 'cTrader Demo',
    propFirmId: 'firm_1',
    propFirmName: 'FTMO',
    platformId: 'plt_1',
    platformName: 'cTrader',
    baseCurrency: 'usd',
    timezone: 'Europe/London',
    startingBalance: '100000.00',
    verifiedBalanceSnapshot: null,
    verifiedEquitySnapshot: null,
    snapshotAsOf: null,
    reconciliationNotes: null,
    openingDate: '2026-11-01',
    challengePhase: 'Phase 1',
    profitTargetAmount: '10000.00',
    profitTargetPct: '10.0',
    maxDailyLossAmount: '5000.00',
    maxDailyLossPct: '5.0',
    maxOverallLossAmount: '10000.00',
    maxOverallLossPct: '10.0',
    drawdownMode: 'static',
    minTradingDays: '4',
    maxTradingDays: null,
    notes: 'Standard evaluation rules',
    tags: ['fx', 'london'],
  });

  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.data.baseCurrency, 'USD');
    assert.equal(res.data.minTradingDays, 4);
    assert.equal(res.data.customCategory, 'Swing Evaluation');
    assert.equal(res.data.propFirmId, 'firm_1');
  }
});

test('accountInputSchema rejects empty name, negative starting balance, and >10 tags', () => {
  const res = accountInputSchema.safeParse({
    name: '   ',
    accountType: 'personal_live',
    status: 'active',
    baseCurrency: 'US',
    timezone: 'UTC',
    startingBalance: '-500',
    drawdownMode: 'none',
    tags: Array.from({ length: 11 }, (_, i) => `tag_${i}`),
  });

  assert.equal(res.success, false);
  if (!res.success) {
    const fields = new Set(res.error.issues.map((i) => String(i.path[0])));
    assert.ok(fields.has('name'));
    assert.ok(fields.has('baseCurrency'));
    assert.ok(fields.has('startingBalance'));
    assert.ok(fields.has('tags'));
  }
});

test('cashTransactionInputSchema rejects zero amount and invalid account IDs', () => {
  const zeroRes = cashTransactionInputSchema.safeParse({
    accountId: 'acc_valid_1',
    type: 'deposit',
    amount: '0',
    currency: 'USD',
    occurredAt: '2026-11-22',
  });
  assert.equal(zeroRes.success, false);

  const badIdRes = cashTransactionInputSchema.safeParse({
    accountId: 'bad/id$with!chars',
    type: 'deposit',
    amount: '500.00',
    currency: 'USD',
    occurredAt: '2026-11-22',
  });
  assert.equal(badIdRes.success, false);
});

test('Stage 1 reference schemas validate brokers, platforms, prop firms, and balance snapshots', () => {
  assert.equal(
    brokerInputSchema.safeParse({
      name: 'Interactive Brokers',
      website: 'https://www.interactivebrokers.com',
      notes: 'Primary equities/futures broker',
    }).success,
    true
  );
  assert.equal(brokerInputSchema.safeParse({ name: '' }).success, false);

  assert.equal(
    tradingPlatformInputSchema.safeParse({
      name: 'MetaTrader 5',
      vendor: 'MetaQuotes',
      notes: null,
    }).success,
    true
  );

  assert.equal(
    propFirmInputSchema.safeParse({
      name: 'FTMO',
      website: 'https://ftmo.com',
      notes: '10% profit target / 10% max loss',
    }).success,
    true
  );

  assert.equal(
    balanceSnapshotInputSchema.safeParse({
      accountId: 'acc_123',
      balance: '50420.15',
      equity: '50210.00',
      capturedAt: '2026-11-22',
      notes: 'Statement import check',
    }).success,
    true
  );
  assert.equal(
    balanceSnapshotInputSchema.safeParse({
      accountId: 'bad/id',
      balance: '100',
      capturedAt: '2026-11-22',
    }).success,
    false
  );
});

test('fxRateInputSchema accepts valid differing pairs and rejects identical currencies or zero rate', () => {
  const valid = fxRateInputSchema.safeParse({
    baseCurrency: 'eur',
    quoteCurrency: 'usd',
    rate: '1.0850',
    capturedAt: '2026-11-22',
    source: 'manual',
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.baseCurrency, 'EUR');
    assert.equal(valid.data.quoteCurrency, 'USD');
  }

  const sameCurrency = fxRateInputSchema.safeParse({
    baseCurrency: 'USD',
    quoteCurrency: 'USD',
    rate: '1.00',
    capturedAt: '2026-11-22',
  });
  assert.equal(sameCurrency.success, false);

  const zeroRate = fxRateInputSchema.safeParse({
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    rate: '0',
    capturedAt: '2026-11-22',
  });
  assert.equal(zeroRate.success, false);
});
