import React from 'react';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import type { RouteDefinition } from '../../app/routes';

export function PlannedModulePage({ route }: { route: RouteDefinition }) {
  const { setActiveRoute } = useApp();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-amber-700 dark:text-amber-400">
            Scheduled for {route.targetStage} · Not Yet Active in Stage 0
          </div>
          <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50 mt-1">
            {route.label}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setActiveRoute('overview')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </button>
      </div>

      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-5">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {route.summary}
        </p>

        <div className="p-4 rounded-md bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
          In accordance with DDT-90 JOURNAL&apos;s progressive stage gates, this module is intentionally
          unimplemented during Stage 0 so no simulated metrics, fake broker feeds, or unverified
          calculations are presented as live functionality.
        </div>

        {route.plannedCapabilities && route.plannedCapabilities.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-display text-xs font-semibold text-slate-900 dark:text-slate-100">
              Planned Capabilities ({route.targetStage})
            </h2>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              {route.plannedCapabilities.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {route.stage0FoundationReady && route.stage0FoundationReady.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-xs font-semibold text-slate-900 dark:text-slate-100">
              Stage 0 Architectural Foundation Already Wired
            </h2>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              {route.stage0FoundationReady.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
