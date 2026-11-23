import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTRUMENT_PRESETS,
  instrumentSpecInputSchema,
  tradeInputSchema,
} from '../domain/validation/tradeValidation';

test('instrumentSpecInputSchema validates all built-in INSTRUMENT_PRESETS and normalizes case', () => {
  for (const preset of INSTRUMENT_PRESETS) {
    const parsed = instrumentSpecInputSchema.safeParse({
      symbol: preset.symbol.toLowerCase(),
      displayName: preset.displayName,
      assetClass: preset.assetClass,
      baseCurrency: preset.baseCurrency,
      quoteCurrency: preset.quoteCurrency.toLowerCase(),
      profitCurrency: preset.profitCurrency?.toLowerCase() ?? null,
      contractSize: preset.contractSize,
      tickSize: preset.tickSize,
      pipSize: preset.pipSize,
      tickValue: preset.tickValue,
      quantityUnit: preset.quantityUnit,
      notes: preset.notes,
    });
    assert.equal(parsed.success, true, `Preset ${preset.symbol} should validate cleanly`);
    if (parsed.success) {
      assert.equal(parsed.data.symbol, preset.symbol);
      assert.equal(parsed.data.quoteCurrency, preset.quoteCurrency);
    }
  }
});

test('instrumentSpecInputSchema rejects invalid symbol characters, zero/negative contract/tick/pip sizes, and bad quote currency', () => {
  const res = instrumentSpecInputSchema.safeParse({
    symbol: 'EUR USD!',
    assetClass: 'forex',
    quoteCurrency: 'US',
    contractSize: '0',
    tickSize: '-0.0001',
    pipSize: '0',
    tickValue: '0',
    quantityUnit: 'lots',
  });

  assert.equal(res.success, false);
  if (!res.success) {
    const fields = new Set(res.error.issues.map((i) => String(i.path[0])));
    assert.ok(fields.has('symbol'));
    assert.ok(fields.has('quoteCurrency'));
    assert.ok(fields.has('contractSize'));
    assert.ok(fields.has('tickSize'));
    assert.ok(fields.has('pipSize'));
    assert.ok(fields.has('tickValue'));
  }
});

test('tradeInputSchema supports optional-by-default drafts and open trades without exit prices', () => {
  const draft = tradeInputSchema.safeParse({
    accountId: 'acc_demo_eval_50k',
    symbol: 'eurusd',
    direction: 'long',
    status: 'draft',
    timezone: 'Europe/London',
  });
  assert.equal(draft.success, true);
  if (draft.success) {
    assert.equal(draft.data.symbol, 'EURUSD');
    assert.equal(draft.data.entryPrice, null);
    assert.equal(draft.data.exitPrice, null);
    assert.equal(draft.data.isArchived, false);
  }

  const open = tradeInputSchema.safeParse({
    accountId: 'acc_demo_eval_50k',
    symbol: 'NQ',
    direction: 'short',
    status: 'open',
    timezone: 'America/New_York',
    entryPrice: '20500.00',
    quantity: '2',
  });
  assert.equal(open.success, true);
});

test('tradeInputSchema requires exitPrice or manualGrossPnl when status is closed and validates partial exit quantity', () => {
  const missingCloseData = tradeInputSchema.safeParse({
    accountId: 'acc_1',
    symbol: 'EURUSD',
    direction: 'long',
    status: 'closed',
    timezone: 'UTC',
    entryPrice: '1.0800',
    quantity: '1.0',
  });
  assert.equal(missingCloseData.success, false);

  const closedWithExit = tradeInputSchema.safeParse({
    accountId: 'acc_1',
    symbol: 'EURUSD',
    direction: 'long',
    status: 'closed',
    timezone: 'UTC',
    entryPrice: '1.0800',
    quantity: '1.0',
    exitPrice: '1.0850',
  });
  assert.equal(closedWithExit.success, true);

  const closedWithManualGross = tradeInputSchema.safeParse({
    accountId: 'acc_1',
    symbol: 'EURUSD',
    direction: 'long',
    status: 'closed',
    timezone: 'UTC',
    manualGrossPnl: '-125.50',
  });
  assert.equal(closedWithManualGross.success, true);

  const overExitQty = tradeInputSchema.safeParse({
    accountId: 'acc_1',
    symbol: 'EURUSD',
    direction: 'long',
    status: 'closed',
    timezone: 'UTC',
    entryPrice: '1.0800',
    quantity: '1.0',
    exitPrice: '1.0850',
    exitQuantity: '1.5',
  });
  assert.equal(overExitQty.success, false);
});

test('tradeInputSchema enforces max 10 tags and max 8 timeframes', () => {
  const res = tradeInputSchema.safeParse({
    accountId: 'acc_1',
    symbol: 'AAPL',
    direction: 'long',
    status: 'draft',
    timezone: 'America/New_York',
    tags: Array.from({ length: 11 }, (_, idx) => `tag_${idx}`),
    timeframes: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'],
  });
  assert.equal(res.success, false);
  if (!res.success) {
    const fields = new Set(res.error.issues.map((i) => String(i.path[0])));
    assert.ok(fields.has('tags'));
    assert.ok(fields.has('timeframes'));
  }
});
