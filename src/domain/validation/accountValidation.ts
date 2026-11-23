import { z } from 'zod';
import type { AccountStatus, AccountType, CashTransactionType, DrawdownMode } from '../models';

/**
 * Validation schemas synchronized verbatim with firebase-blueprint.json boundaries.
 */
export const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const SIGNED_DECIMAL_PATTERN = /^-?\d+(\.\d{1,8})?$/;
export const POSITIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,8})?$/;
export const PCT_DECIMAL_PATTERN = /^\d+(\.\d{1,4})?$/;

export const ACCOUNT_TYPES: ReadonlyArray<{ value: AccountType; label: string }> = [
  { value: 'personal_live', label: 'Personal Live' },
  { value: 'personal_demo', label: 'Personal Demo' },
  { value: 'prop_evaluation', label: 'Prop Evaluation / Challenge' },
  { value: 'prop_verification', label: 'Prop Verification' },
  { value: 'prop_funded', label: 'Funded Prop Account' },
  { value: 'backtest', label: 'Backtest' },
  { value: 'forward_test', label: 'Forward Test' },
  { value: 'paper', label: 'Paper Trading' },
  { value: 'custom', label: 'Custom' },
];

export const ACCOUNT_STATUSES: ReadonlyArray<{ value: AccountStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'breached', label: 'Breached' },
  { value: 'archived', label: 'Archived' },
  { value: 'custom', label: 'Custom' },
];

export const DRAWDOWN_MODES: ReadonlyArray<{ value: DrawdownMode; label: string }> = [
  { value: 'none', label: 'None / Not Applicable' },
  { value: 'static', label: 'Static Drawdown' },
  { value: 'trailing_eod', label: 'Trailing (End of Day)' },
  { value: 'trailing_intraday', label: 'Trailing (Intraday Equity)' },
  { value: 'custom', label: 'Custom' },
];

export const CASH_TRANSACTION_TYPES: ReadonlyArray<{ value: CashTransactionType; label: string }> = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'payout', label: 'Prop Payout' },
  { value: 'fee', label: 'Account Fee' },
  { value: 'adjustment', label: 'Manual Adjustment' },
  { value: 'transfer', label: 'Internal Transfer' },
];

export const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SGD'] as const;

export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
] as const;

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalDecimalString = (pattern: RegExp, max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .nullable()
    .refine(
      (v) => !v || v.length === 0 || pattern.test(v),
      `${label} must be a valid decimal number (up to 8 decimal places)`
    )
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalInt = (max: number, label: string) =>
  z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : NaN;
    })
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= max), {
      message: `${label} must be a whole number between 0 and ${max}`,
    });

export const workspaceInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Workspace name is required')
    .max(80, 'Workspace name must be 80 characters or fewer'),
  description: optionalTrimmedString(300),
  baseCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CURRENCY_PATTERN, 'Base currency must be a 3-letter ISO code (e.g., USD)'),
  timezone: z.string().trim().min(1, 'Timezone is required').max(64),
});

export const portfolioInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Portfolio name is required')
    .max(80, 'Portfolio name must be 80 characters or fewer'),
  description: optionalTrimmedString(300),
  baseCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CURRENCY_PATTERN, 'Base currency must be a 3-letter ISO code'),
});

export const accountInputSchema = z.object({
  portfolioId: optionalTrimmedString(128),
  name: z
    .string()
    .trim()
    .min(1, 'Account name is required')
    .max(80, 'Account name must be 80 characters or fewer'),
  accountIdentifierMasked: optionalTrimmedString(32),
  accountType: z.enum([
    'personal_live',
    'personal_demo',
    'prop_evaluation',
    'prop_verification',
    'prop_funded',
    'backtest',
    'forward_test',
    'paper',
    'custom',
  ]),
  customCategory: optionalTrimmedString(60),
  status: z.enum(['active', 'paused', 'passed', 'failed', 'breached', 'archived', 'custom']),
  brokerId: optionalTrimmedString(128),
  brokerName: optionalTrimmedString(80),
  propFirmId: optionalTrimmedString(128),
  propFirmName: optionalTrimmedString(80),
  platformId: optionalTrimmedString(128),
  platformName: optionalTrimmedString(64),
  baseCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CURRENCY_PATTERN, 'Base currency must be a 3-letter ISO code (e.g., USD)'),
  timezone: z.string().trim().min(1, 'Timezone is required').max(64),
  startingBalance: z
    .string()
    .trim()
    .min(1, 'Starting balance is required')
    .max(24, 'Starting balance is too long')
    .regex(SIGNED_DECIMAL_PATTERN, 'Starting balance must be a valid decimal number')
    .refine((v) => Number(v) >= 0, 'Starting balance cannot be negative'),
  verifiedBalanceSnapshot: optionalDecimalString(SIGNED_DECIMAL_PATTERN, 24, 'Verified balance snapshot'),
  verifiedEquitySnapshot: optionalDecimalString(SIGNED_DECIMAL_PATTERN, 24, 'Verified equity snapshot'),
  snapshotAsOf: optionalTrimmedString(40),
  reconciliationNotes: optionalTrimmedString(500),
  openingDate: optionalTrimmedString(32),
  challengePhase: optionalTrimmedString(40),
  profitTargetAmount: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Profit target amount'),
  profitTargetPct: optionalDecimalString(PCT_DECIMAL_PATTERN, 16, 'Profit target %'),
  maxDailyLossAmount: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Max daily loss amount'),
  maxDailyLossPct: optionalDecimalString(PCT_DECIMAL_PATTERN, 16, 'Max daily loss %'),
  maxOverallLossAmount: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Max overall loss amount'),
  maxOverallLossPct: optionalDecimalString(PCT_DECIMAL_PATTERN, 16, 'Max overall loss %'),
  drawdownMode: z.enum(['none', 'static', 'trailing_eod', 'trailing_intraday', 'custom']),
  minTradingDays: optionalInt(3650, 'Minimum trading days'),
  maxTradingDays: optionalInt(3650, 'Maximum trading days'),
  notes: optionalTrimmedString(1000),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(10, 'Maximum 10 tags allowed')
    .default([]),
});

export const cashTransactionInputSchema = z.object({
  accountId: z.string().trim().min(1, 'Account is required').regex(ID_PATTERN, 'Invalid account identifier'),
  type: z.enum(['deposit', 'withdrawal', 'payout', 'fee', 'adjustment', 'transfer']),
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .max(24)
    .regex(SIGNED_DECIMAL_PATTERN, 'Amount must be a valid decimal number')
    .refine((v) => Number(v) !== 0, 'Cash transaction amount cannot be zero'),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CURRENCY_PATTERN, 'Currency must be a 3-letter ISO code'),
  grossAmount: optionalDecimalString(POSITIVE_DECIMAL_PATTERN, 24, 'Gross amount'),
  splitPct: optionalDecimalString(PCT_DECIMAL_PATTERN, 16, 'Split %'),
  occurredAt: z.string().trim().min(1, 'Transaction date is required').max(40),
  notes: optionalTrimmedString(500),
});

export const brokerInputSchema = z.object({
  name: z.string().trim().min(1, 'Broker name is required').max(80, 'Broker name must be 80 characters or fewer'),
  website: optionalTrimmedString(200),
  notes: optionalTrimmedString(500),
});

export const tradingPlatformInputSchema = z.object({
  name: z.string().trim().min(1, 'Platform name is required').max(80, 'Platform name must be 80 characters or fewer'),
  vendor: optionalTrimmedString(80),
  notes: optionalTrimmedString(500),
});

export const propFirmInputSchema = z.object({
  name: z.string().trim().min(1, 'Prop firm name is required').max(80, 'Prop firm name must be 80 characters or fewer'),
  website: optionalTrimmedString(200),
  notes: optionalTrimmedString(500),
});

export const balanceSnapshotInputSchema = z.object({
  accountId: z.string().trim().min(1, 'Account is required').regex(ID_PATTERN, 'Invalid account identifier'),
  balance: z
    .string()
    .trim()
    .min(1, 'Verified balance snapshot is required')
    .max(24, 'Balance must be 24 characters or fewer')
    .regex(SIGNED_DECIMAL_PATTERN, 'Balance must be a valid decimal number'),
  equity: optionalDecimalString(SIGNED_DECIMAL_PATTERN, 24, 'Verified equity snapshot'),
  capturedAt: z.string().trim().min(1, 'Snapshot date is required').max(40),
  notes: optionalTrimmedString(500),
});

export const fxRateInputSchema = z
  .object({
    baseCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(CURRENCY_PATTERN, 'Base currency must be a 3-letter ISO code'),
    quoteCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(CURRENCY_PATTERN, 'Quote currency must be a 3-letter ISO code'),
    rate: z
      .string()
      .trim()
      .min(1, 'FX rate is required')
      .max(24)
      .regex(POSITIVE_DECIMAL_PATTERN, 'FX rate must be a positive decimal number')
      .refine((v) => Number(v) > 0, 'FX rate must be greater than zero'),
    capturedAt: z.string().trim().min(1, 'Rate date is required').max(40),
    source: z.enum(['manual', 'historical_feed', 'broker_report']).default('manual'),
    notes: optionalTrimmedString(300),
  })
  .refine((d) => d.baseCurrency !== d.quoteCurrency, {
    message: 'Base and quote currencies must differ.',
    path: ['quoteCurrency'],
  });

export type WorkspaceInput = z.infer<typeof workspaceInputSchema>;
export type PortfolioInput = z.infer<typeof portfolioInputSchema>;
export type AccountInput = z.infer<typeof accountInputSchema>;
export type CashTransactionInput = z.infer<typeof cashTransactionInputSchema>;
export type BrokerInput = z.infer<typeof brokerInputSchema>;
export type TradingPlatformInput = z.infer<typeof tradingPlatformInputSchema>;
export type PropFirmInput = z.infer<typeof propFirmInputSchema>;
export type BalanceSnapshotInput = z.infer<typeof balanceSnapshotInputSchema>;
export type FXRateInput = z.infer<typeof fxRateInputSchema>;
