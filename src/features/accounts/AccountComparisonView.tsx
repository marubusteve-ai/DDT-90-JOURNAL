import React from 'react';
import {
  AccountHealthText,
  AccountStatusText,
  formatAccountTypeLabel,
  ReconciliationStatusText,
} from '../../components/StatusText';
import {
  formatCurrencyAmount,
  formatSignedCurrencyAmount,
  type AccountComparisonRow,
} from '../../domain/calculations/accountCalculations';

interface AccountComparisonViewProps {
  allRows: AccountComparisonRow[];
  selectedIds: string[];
  onToggleSelect: (accountId: string) => void;
  onSelectTopFour: () => void;
  onClearSelection: () => void;
  onInspect: (accountId: string) => void;
}

export function AccountComparisonView({
  allRows,
  selectedIds,
  onToggleSelect,
  onSelectTopFour,
  onClearSelection,
  onInspect,
}: AccountComparisonViewProps) {
  const comparedRows = allRows.filter((r) => selectedIds.includes(r.account.id));

  return (
    <div className="space-y-4">
      {/* Selector Bar */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Side-by-Side Account Comparison ({comparedRows.length} selected)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select 2 or more accounts below to compare balances, thresholds, providers, and health
              metrics side-by-side.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSelectTopFour}
              className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Compare Visible (Up to 4)
            </button>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Clear ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {allRows.map((row) => {
            const checked = selectedIds.includes(row.account.id);
            return (
              <label
                key={row.account.id}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border cursor-pointer select-none transition-colors ${
                  checked
                    ? 'border-sky-500 bg-sky-500/10 text-slate-900 dark:text-slate-100'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleSelect(row.account.id)}
                  className="rounded border-slate-300 dark:border-slate-700"
                />
                <span className="font-medium">{row.account.name}</span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {row.account.baseCurrency}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Comparison Matrix */}
      {comparedRows.length < 2 ? (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Select at least 2 accounts above to view side-by-side comparison.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0E131D]">
                  <th className="py-3 px-4 font-medium text-slate-500 dark:text-slate-400 min-w-[160px]">
                    Metric
                  </th>
                  {comparedRows.map((row) => (
                    <th key={row.account.id} className="py-3 px-4 min-w-[190px]">
                      <button
                        type="button"
                        onClick={() => onInspect(row.account.id)}
                        className="text-left hover:text-sky-600 dark:hover:text-sky-400"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {row.account.name}
                        </div>
                        <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          {row.account.baseCurrency} · {row.portfolioName ?? 'Unassigned'}
                        </div>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">Classification</td>
                  {comparedRows.map((r) => (
                    <td key={r.account.id} className="py-2.5 px-4 text-slate-900 dark:text-slate-100">
                      {formatAccountTypeLabel(r.account.accountType)}
                      {r.account.customCategory ? ` · ${r.account.customCategory}` : ''}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">Lifecycle Status</td>
                  {comparedRows.map((r) => (
                    <td key={r.account.id} className="py-2.5 px-4">
                      <AccountStatusText status={r.account.status} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">Health Foundation</td>
                  {comparedRows.map((r) => (
                    <td key={r.account.id} className="py-2.5 px-4 space-y-0.5">
                      <div>
                        <AccountHealthText
                          status={r.health.status}
                          usedPct={r.health.drawdownUsedPctOfLimit}
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {r.health.summary}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                    Broker / Prop / Platform
                  </td>
                  {comparedRows.map((r) => (
                    <td key={r.account.id} className="py-2.5 px-4 text-slate-800 dark:text-slate-200">
                      {[r.account.propFirmName, r.account.brokerName, r.account.platformName]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">Starting Balance</td>
                  {comparedRows.map((r) => (
                    <td
                      key={r.account.id}
                      className="py-2.5 px-4 font-mono tabular-nums text-slate-900 dark:text-slate-100"
                    >
                      {formatCurrencyAmount(r.ledger.startingBalance, r.account.baseCurrency)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">Net Cash Flow</td>
                  {comparedRows.map((r) => (
                    <td
                      key={r.account.id}
                      className="py-2.5 px-4 font-mono tabular-nums text-slate-900 dark:text-slate-100"
                    >
                      {formatSignedCurrencyAmount(r.ledger.netCashFlow, r.account.baseCurrency)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                    Realised Trade P&amp;L
                  </td>
                  {comparedRows.map((r) => (
                    <td
                      key={r.account.id}
                      className={`py-2.5 px-4 font-mono tabular-nums ${
                        r.ledger.realisedTradePnl !== null
                          ? Number(r.ledger.realisedTradePnl) > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : Number(r.ledger.realisedTradePnl) < 0
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {r.ledger.realisedTradePnl !== null
                        ? formatSignedCurrencyAmount(
                            r.ledger.realisedTradePnl,
                            r.account.baseCurrency
                          )
                        : '0 closed'}
                      {r.ledger.tradeCount > 0 && (
                        <span className="ml-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          ({r.ledger.tradeCount})
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                    Current / Snapshot Balance
                  </td>
                  {comparedRows.map((r) => (
                    <td
                      key={r.account.id}
                      className="py-2.5 px-4 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100"
                    >
                      {formatCurrencyAmount(r.ledger.effectiveCurrentBalance, r.account.baseCurrency)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">Verified Equity</td>
                  {comparedRows.map((r) => (
                    <td
                      key={r.account.id}
                      className="py-2.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300"
                    >
                      {r.ledger.verifiedEquitySnapshot !== null
                        ? formatCurrencyAmount(r.ledger.verifiedEquitySnapshot, r.account.baseCurrency)
                        : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">Reconciliation</td>
                  {comparedRows.map((r) => (
                    <td key={r.account.id} className="py-2.5 px-4">
                      <ReconciliationStatusText status={r.ledger.reconciliationStatus} />
                      {r.ledger.reconciliationDelta !== null && (
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatSignedCurrencyAmount(
                            r.ledger.reconciliationDelta,
                            r.account.baseCurrency
                          )}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">Profit Target</td>
                  {comparedRows.map((r) => (
                    <td
                      key={r.account.id}
                      className="py-2.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300"
                    >
                      {r.health.profitTargetResolved
                        ? formatCurrencyAmount(r.health.profitTargetResolved, r.account.baseCurrency)
                        : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">Overall Loss Limit</td>
                  {comparedRows.map((r) => (
                    <td
                      key={r.account.id}
                      className="py-2.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300"
                    >
                      {r.health.overallLossLimitResolved
                        ? formatCurrencyAmount(
                            r.health.overallLossLimitResolved,
                            r.account.baseCurrency
                          )
                        : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                    Drawdown Mode · Timezone
                  </td>
                  {comparedRows.map((r) => (
                    <td key={r.account.id} className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      <span className="font-mono">{r.account.drawdownMode}</span> ·{' '}
                      <span>{r.account.timezone}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
