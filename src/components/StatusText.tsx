import React from 'react';
import { ACCOUNT_STATUSES, ACCOUNT_TYPES } from '../domain/validation/accountValidation';
import type {
  AccountStatus,
  AccountType,
  TradeDirection,
  TradeOutcome,
  TradeStatus,
} from '../domain/models';
import type { ReconciliationStatus } from '../domain/calculations/accountCalculations';

export function formatAccountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function formatAccountStatusLabel(status: AccountStatus): string {
  return ACCOUNT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function AccountStatusText({ status }: { status: AccountStatus }) {
  const colorMap: Record<AccountStatus, string> = {
    active: 'text-emerald-700 dark:text-emerald-400',
    passed: 'text-sky-700 dark:text-sky-400',
    paused: 'text-amber-700 dark:text-amber-400',
    failed: 'text-rose-700 dark:text-rose-400',
    breached: 'text-rose-700 dark:text-rose-400',
    archived: 'text-slate-500 dark:text-slate-400',
    custom: 'text-slate-700 dark:text-slate-300',
  };

  return (
    <span className={`text-xs font-medium whitespace-nowrap ${colorMap[status]}`}>
      {formatAccountStatusLabel(status)}
    </span>
  );
}

export function ReconciliationStatusText({ status }: { status: ReconciliationStatus }) {
  if (status === 'reconciled') {
    return (
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        Reconciled
      </span>
    );
  }
  if (status === 'discrepancy') {
    return (
      <span className="text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
        Discrepancy
      </span>
    );
  }
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
      No snapshot
    </span>
  );
}

export function AccountHealthText({
  status,
  usedPct,
}: {
  status: 'healthy' | 'warning' | 'critical' | 'breached' | 'archived' | 'unknown';
  usedPct?: string | null;
}) {
  const map: Record<typeof status, { label: string; cls: string }> = {
    healthy: { label: 'Healthy', cls: 'text-emerald-700 dark:text-emerald-400' },
    warning: { label: 'Warning', cls: 'text-amber-700 dark:text-amber-400' },
    critical: { label: 'Critical', cls: 'text-rose-700 dark:text-rose-400' },
    breached: { label: 'Breached', cls: 'text-rose-700 dark:text-rose-400 font-semibold' },
    archived: { label: 'Archived', cls: 'text-slate-500 dark:text-slate-400' },
    unknown: { label: 'Unconfigured', cls: 'text-slate-500 dark:text-slate-400' },
  };
  const cfg = map[status];
  return (
    <span className={`text-xs font-medium whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
      {usedPct ? (
        <span className="ml-1 font-mono tabular-nums text-[11px] opacity-85">({usedPct}%)</span>
      ) : null}
    </span>
  );
}

export function TradeDirectionText({ direction }: { direction: TradeDirection }) {
  return (
    <span
      className={`text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${
        direction === 'long'
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-rose-700 dark:text-rose-400'
      }`}
    >
      {direction}
    </span>
  );
}

export function TradeStatusText({
  status,
  isArchived = false,
}: {
  status: TradeStatus;
  isArchived?: boolean;
}) {
  const map: Record<TradeStatus, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'text-slate-500 dark:text-slate-400' },
    open: { label: 'Open', cls: 'text-sky-700 dark:text-sky-400' },
    closed: { label: 'Closed', cls: 'text-slate-900 dark:text-slate-100' },
  };
  const cfg = map[status];
  return (
    <span className={`text-xs font-medium whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
      {isArchived ? (
        <span className="ml-1 text-[11px] font-normal text-slate-400 dark:text-slate-500">
          · Archived
        </span>
      ) : null}
    </span>
  );
}

export function TradeOutcomeText({ outcome }: { outcome: TradeOutcome }) {
  const map: Record<TradeOutcome, { label: string; cls: string }> = {
    win: { label: 'Win', cls: 'text-emerald-700 dark:text-emerald-400' },
    loss: { label: 'Loss', cls: 'text-rose-700 dark:text-rose-400' },
    breakeven: { label: 'Breakeven', cls: 'text-slate-600 dark:text-slate-300' },
    open: { label: 'Open', cls: 'text-sky-700 dark:text-sky-400' },
    draft: { label: 'Draft', cls: 'text-slate-500 dark:text-slate-400' },
    unknown: { label: 'Unreconciled', cls: 'text-amber-700 dark:text-amber-400' },
  };
  const cfg = map[outcome];
  return (
    <span className={`text-xs font-medium whitespace-nowrap ${cfg.cls}`}>{cfg.label}</span>
  );
}

