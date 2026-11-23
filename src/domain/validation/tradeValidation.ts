import { z } from 'zod';
import type {
  AssetClass,
  QuantityUnit,
  TradeDirection,
  TradeEntryType,
  TradeSession,
  TradeStatus,
} from '../models';
import {
  CURRENCY_PATTERN,
  ID_PATTERN,
  POSITIVE_DECIMAL_PATTERN,
  PCT_DECIMAL_PATTERN,
  SIGNED_DECIMAL_PATTERN,
} from './accountValidation';

export const SYMBOL_PATTERN = /^[A-Z0-9._/\-]{1,32}$/;

export const ASSET_CLASSES: ReadonlyArray<{ value: AssetClass; label: string }> = [
  { value: 'forex', label: 'Forex' },
  { value: 'indices', label: 'Indices' },
  { value: 'commodities', label: 'Commodities' },
  { value: 'futures', label: 'Futures' },
  { value: 'equities', label: 'Equities' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'options', label: 'Options' },
  { value: 'custom', label: 'Custom' },
];

export const QUANTITY_UNITS: ReadonlyArray<{ value: QuantityUnit; label: string }> = [
  { value: 'lots', label: 'Lots' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'shares', label: 'Shares' },
  { value: 'units', label: 'Units' },
];

export const TRADE_STATUSES: ReadonlyArray<{ value: TradeStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

export const TRADE_DIRECTIONS: ReadonlyArray<{ value: TradeDirection; label: string }> = [
  { value: 'long', label: 'Long (Buy)' },
  { value: 'short', label: 'Short (Sell)' },
];

export const TRADE_SESSIONS: ReadonlyArray<{ value: TradeSession; label: string }> = [
  { value: 'asia', label: 'Asia' },
  { value: 'london', label: 'London' },
  { value: 'new_york', label: 'New York' },
  { value: 'overlap', label: 'London / NY Overlap' },
  { value: 'custom', label: 'Custom' },
];

export const TRADE_ENTRY_TYPES: ReadonlyArray<{ value: TradeEntryType; label: string }> = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
  { value: 'stop_limit', label: 'Stop-Limit' },
  { value: 'scale_in', label: 'Scale-In' },
  { value: 'custom', label: 'Custom' },
];

export const TIMEFRAME_OPTIONS = [
  'M1',
  'M5',
  'M15',
  'M30',
  'H1',
  'H4',
  'D1',
  'W1',
] as const;

export const MARKET_CONDITION_OPTIONS = [
  'Bullish',
  'Bearish',
  'Neutral',
  'Trending',
  'Range-Bound',
  'Breakout',
  'Breakdown',
  'Pullback',
  'Reversal',
  'High Volatility',
  'Low Volatility',
  'Session Overlap',
  'Liquidity Sweep',
  'News Event',
  'Economic Data',
  'Risk-On',
  'Risk-Off',
] as const;

export interface InstrumentPreset {
  symbol: string;
  displayName: string;
  assetClass: AssetClass;
  baseCurrency: string | null;
  quoteCurrency: string;
  profitCurrency: string | null;
  contractSize: string;
  tickSize: string;
  pipSize: string;
  tickValue: string | null;
  quantityUnit: QuantityUnit;
  notes: string;
}

export const INSTRUMENT_PRESETS: ReadonlyArray<InstrumentPreset> = [
  {
    symbol: 'EURUSD',
    displayName: 'Euro / US Dollar',
    assetClass: 'forex',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    profitCurrency: 'USD',
    contractSize: '100000',
    tickSize: '0.00001',
    pipSize: '0.0001',
    tickValue: null,
    quantityUnit: 'lots',
    notes: 'Standard FX lot = 100,000 EUR ($10/pip per 1.00 lot).',
  },
  {
    symbol: 'GBPUSD',
    displayName: 'British Pound / US Dollar',
    assetClass: 'forex',
    baseCurrency: 'GBP',
    quoteCurrency: 'USD',
    profitCurrency: 'USD',
    contractSize: '100000',
    tickSize: '0.00001',
    pipSize: '0.0001',
    tickValue: null,
    quantityUnit: 'lots',
    notes: 'Standard FX lot = 100,000 GBP ($10/pip per 1.00 lot).',
  },
  {
    symbol: 'USDJPY',
    displayName: 'US Dollar / Japanese Yen',
    assetClass: 'forex',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    profitCurrency: 'JPY',
    contractSize: '100000',
    tickSize: '0.001',
    pipSize: '0.01',
    tickValue: null,
    quantityUnit: 'lots',
    notes: 'Standard FX lot = 100,000 USD quoted in JPY (requires JPY conversion for non-JPY accounts).',
  },
  {
    symbol: 'XAUUSD',
    displayName: 'Spot Gold / US Dollar',
    assetClass: 'commodities',
    baseCurrency: 'XAU',
    quoteCurrency: 'USD',
    profitCurrency: 'USD',
    contractSize: '100',
    tickSize: '0.01',
    pipSize: '0.1',
    tickValue: null,
    quantityUnit: 'lots',
    notes: 'Standard spot gold contract = 100 troy oz per 1.00 lot.',
  },
  {
    symbol: 'NQ',
    displayName: 'E-mini Nasdaq-100 Futures',
    assetClass: 'futures',
    baseCurrency: null,
    quoteCurrency: 'USD',
    profitCurrency: 'USD',
    contractSize: '20',
    tickSize: '0.25',
    pipSize: '0.25',
    tickValue: '5.00',
    quantityUnit: 'contracts',
    notes: 'CME E-mini Nasdaq-100: $20/point ($5.00 per 0.25 tick) per contract.',
  },
  {
    symbol: 'ES',
    displayName: 'E-mini S&P 500 Futures',
    assetClass: 'futures',
    baseCurrency: null,
    quoteCurrency: 'USD',
    profitCurrency: 'USD',
    contractSize: '50',
    tickSize: '0.25',
    pipSize: '0.25',
    tickValue: '12.50',
    quantityUnit: 'contracts',
    notes: 'CME E-mini S&P 500: $50/point ($12.50 per 0.25 tick) per contract.',
  },
  {
    symbol: 'BTCUSD',
    displayName: 'Bitcoin / US Dollar',
    assetClass: 'crypto',
    baseCurrency: 'BTC',
    quoteCurrency: 'USD',
    profitCurrency: 'USD',
    contractSize: '1',
    tickSize: '0.01',
    pipSize: '1',
    tickValue: null,
    quantityUnit: 'units',
    notes: '1 unit = 1 BTC linear USD-settled.',
  },
  {
    symbol: 'AAPL',
    displayName: 'Apple Inc. Equity',
    assetClass: 'equities',
    baseCurrency: null,
    quoteCurrency: 'USD',
    profitCurrency: 'USD',
    contractSize: '1',
    tickSize: '0.01',
    pipSize: '0.01',
    tickValue: null,
    quantityUnit: 'shares',
    notes: 'US equity spot share specification (1 contract unit = 1 share).',
  },
];

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalDecimalString = (pattern: RegExp, max: number, label: string, positiveOnly = false) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .nullable()
    .refine(
      (v) => !v || v.length === 0 || pattern.test(v),
      `${label} must be a valid decimal number`
    )
    .refine(
      (v) => !v || v.length === 0 || !positiveOnly || Number(v) > 0,
      `${label} must be greater than zero`
    )
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalCurrency = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .nullable()
  .refine((v) => !v || v.length === 0 || CURRENCY_PATTERN.test(v), 'Must be a 3-letter ISO currency code')
  .transform((v) => (v && v.length > 0 ? v : null));

export const instrumentSpecInputSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Instrument symbol is required')
    .max(32, 'Symbol must be 32 characters or fewer')
    .regex(SYMBOL_PATTERN, 'Symbol may contain uppercase letters, numbers, and . _ / -'),
  displayName: optionalTrimmedString(80),
  assetClass: z.enum([
    'forex',
    'indices',
    'commodities',
    'crypto',
    'equities',
    'futures',
    'options',
    'custom',
  ]),
  baseCurrency: optionalTrimmedString(12),
  quoteCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CURRENCY_PATTERN, 'Quote currency must be a 3-letter ISO code (e.g., USD)'),
  profitCurrency: optionalCurrency,
  contractSize: z
    .string()
    .trim()
    .min(1, 'Contract size is required')
    .max(24)
    .regex(POSITIVE_DECIMAL_PATTERN, 'Contract size must be a positive decimal')
    .refine((v) => Number(v) > 0, 'Contract size must be greater than zero'),
  tickSize: z
    .string()
    .trim()
    .min(1, 'Tick size is required')
    .max(24)
    .regex(POSITIVE_DECIMAL_PATTERN, 'Tick size must be a positive decimal')
    .refine((v) => Number(v) > 0, 'Tick size must be greater than zero'),
  pipSize: z
    .string()
    .trim()
    .min(1, 'Pip size is required')
    .max(24)
    .regex(POSITIVE_DECIMAL_PATTERN, 'Pip size must be a positive decimal')
    .refine((v) => Number(v) > 0, 'Pip size must be greater than zero'),
  tickValue: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Tick value', true),
  quantityUnit: z.enum(['lots', 'contracts', 'shares', 'units']),
  notes: optionalTrimmedString(500),
});

export const tradeInputSchema = z
  .object({
    accountId: z
      .string()
      .trim()
      .min(1, 'Account is required')
      .max(128)
      .regex(ID_PATTERN, 'Invalid account identifier'),
    instrumentId: optionalTrimmedString(128).refine(
      (v) => v === null || ID_PATTERN.test(v),
      'Invalid instrument identifier'
    ),
    externalTicketId: optionalTrimmedString(64),
    symbol: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, 'Symbol is required')
      .max(32, 'Symbol must be 32 characters or fewer')
      .regex(SYMBOL_PATTERN, 'Symbol may contain letters, numbers, and . _ / -'),
    direction: z.enum(['long', 'short']),
    status: z.enum(['draft', 'open', 'closed']),
    isArchived: z.boolean().default(false),
    session: z
      .enum(['asia', 'london', 'new_york', 'overlap', 'custom'])
      .optional()
      .nullable()
      .transform((v) => v ?? null),
    timeframes: z
      .array(z.string().trim().min(1).max(16))
      .max(8, 'Maximum 8 timeframes allowed')
      .default([]),
    timezone: z.string().trim().min(1, 'Timezone is required').max(64),
    accountBalanceSnapshot: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Account balance snapshot', true),
    entryAt: optionalTrimmedString(40),
    entryPrice: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Entry price', true),
    quantity: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Position size / quantity', true),
    entryType: z
      .enum(['market', 'limit', 'stop', 'stop_limit', 'scale_in', 'custom'])
      .optional()
      .nullable()
      .transform((v) => v ?? null),
    leverage: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 16, 'Leverage', true),
    marginUsed: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Margin used', false),
    entryRationale: optionalTrimmedString(1000),
    initialStopPrice: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Initial stop price', true),
    actualStopPrice: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Actual stop price', true),
    plannedTargetPrice: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Planned target price', true),
    plannedRiskAmount: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Initial planned risk', false),
    plannedRiskPct: optionalDecimalString(PCT_DECIMAL_PATTERN, 16, 'Initial planned risk %', false),
    actualRiskAmount: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Actual risk', false),
    exitAt: optionalTrimmedString(40),
    exitPrice: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Exit price', true),
    exitQuantity: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Exit quantity', true),
    exitReason: optionalTrimmedString(500),
    manualGrossPnl: optionalDecimalString(SIGNED_DECIMAL_PATTERN, 24, 'Manual gross P&L', false),
    fxConversionRate: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'FX conversion rate', true),
    setupTag: optionalTrimmedString(80),
    commission: optionalDecimalString(SIGNED_DECIMAL_PATTERN, 24, 'Commission', false),
    swap: optionalDecimalString(SIGNED_DECIMAL_PATTERN, 24, 'Swap / financing', false),
    fees: optionalDecimalString(SIGNED_DECIMAL_PATTERN, 24, 'Fees', false),
    slippage: optionalDecimalString(SIGNED_DECIMAL_PATTERN, 24, 'Slippage', false),
    spread: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Spread', false),
    marketConditions: z
      .array(z.string().trim().min(1).max(40))
      .max(16, 'Maximum 16 market conditions allowed')
      .default([]),
    entryNotes: optionalTrimmedString(1000),
    reviewNotes: optionalTrimmedString(1500),
    tags: z
      .array(z.string().trim().min(1).max(40))
      .max(10, 'Maximum 10 tags allowed')
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'closed' && data.exitPrice === null && data.manualGrossPnl === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exitPrice'],
        message: 'Closed trades require either an Exit Price or a Manual Gross P&L override (save as Draft or Open otherwise).',
      });
    }
    if (data.exitQuantity !== null && data.quantity !== null && Number(data.exitQuantity) > Number(data.quantity)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exitQuantity'],
        message: 'Exit quantity cannot exceed entry position quantity.',
      });
    }
  });

export type InstrumentSpecInput = z.infer<typeof instrumentSpecInputSchema>;
export type TradeInput = z.infer<typeof tradeInputSchema>;
