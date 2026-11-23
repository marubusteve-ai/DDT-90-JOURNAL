import Decimal from 'decimal.js';
import type {
  Account,
  FXRateSnapshot,
  InstrumentSpecification,
  Trade,
  TradeDirection,
  TradeOutcome,
  TradeSession,
  TradeStatus,
} from '../models';

/**
 * Central Financial Calculation Engine — Stage 2 Trade & Balance Impact Module.
 *
 * Documented Financial Conventions:
 * 1. Arithmetic uses decimal.js (precision 28, ROUND_HALF_UP) so currency, price, lot, and R math
 *    never suffer IEEE-754 floating-point drift.
 * 2. Missing source inputs remain `null` with an explicit status/reason — NEVER coerced to 0.
 * 3. Breakeven trade threshold: |netPnl| <= 0.005 in account currency (half-cent tolerance).
 * 4. Win rate denominator: closed trades with calculable Net P&L (breakevens included in denominator,
 *    reported separately as W / L / BE counts).
 * 5. Initial Risk is anchored to `initialStopPrice` (or explicit `plannedRiskAmount`) and serves as
 *    the primary R-multiple denominator (Net R = Net P&L / Initial Risk). Actual Risk tracks
 *    adjusted/current stop exposure separately.
 * 6. Costs (`commission`, `swap`, `fees`, `slippage`) are positive cost magnitudes subtracted from
 *    Gross P&L (a negative swap/rebate credits Net P&L).
 * 7. Only non-archived `closed` trades with calculable Net P&L impact account ledger balance.
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type TradeCalculationSource =
  | 'calculated_from_prices'
  | 'manual_override'
  | 'insufficient_data'
  | 'missing_fx_rate';

export interface ResolvedFxConversion {
  rate: string | null;
  source: 'same_currency' | 'trade_override' | 'workspace_direct' | 'workspace_inverse' | 'missing_fx_rate';
  fromCurrency: string;
  toCurrency: string;
}

export interface TradeCalculatedMetrics {
  tradeId: string;
  accountCurrency: string;
  instrumentSymbol: string;
  instrumentMatched: boolean;
  profitCurrency: string | null;
  fxConversion: ResolvedFxConversion | null;

  /** Signed price difference in quote points (positive = favorable move). */
  priceMove: string | null;
  realisedPips: string | null;
  realisedTicks: string | null;

  initialStopDistance: string | null;
  initialStopPips: string | null;
  initialStopTicks: string | null;
  initialRiskNative: string | null;
  initialRiskAmount: string | null;
  initialRiskPct: string | null;
  initialRiskSource: 'manual_planned' | 'calculated_from_initial_stop' | 'insufficient_data' | 'missing_fx_rate';

  actualStopDistance: string | null;
  actualRiskAmount: string | null;
  actualRiskPct: string | null;
  actualRiskSource: 'manual_actual' | 'calculated_from_actual_stop' | 'not_adjusted' | 'missing_fx_rate';

  plannedRewardAmount: string | null;
  plannedRMultiple: string | null;

  grossPnlNative: string | null;
  grossPnl: string | null;
  grossPnlSource: TradeCalculationSource;

  totalCosts: string | null;
  hasCostInputs: boolean;

  netPnl: string | null;
  netPnlPct: string | null;
  netPnlSource: 'gross_minus_costs' | 'gross_no_costs_recorded' | 'unavailable';

  grossRMultiple: string | null;
  netRMultiple: string | null;
  outcome: TradeOutcome;

  /** Realised impact applied to account ledger balance (null unless closed & non-archived). */
  balanceImpact: string | null;
  balanceImpactApplies: boolean;

  holdingDurationMinutes: number | null;
  holdingDurationLabel: string | null;
  warnings: string[];
  unavailableReason: string | null;
}

export interface AccountTradeImpactSummary {
  accountId: string;
  currency: string;
  totalActiveTrades: number;
  draftCount: number;
  openCount: number;
  closedCount: number;
  archivedCount: number;
  closedWithPnlCount: number;
  unreconciledClosedCount: number;
  realisedGrossPnl: string | null;
  realisedCostsTotal: string | null;
  realisedNetPnl: string | null;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRatePct: string | null;
  profitFactor: string | null;
  expectancy: string | null;
  averageNetR: string | null;
}

export interface TradeCurrencyBucket {
  currency: string;
  tradeCount: number;
  closedWithPnlCount: number;
  grossPnl: string;
  totalCosts: string;
  netPnl: string;
}

export interface TradeAggregateSummary {
  totalTrades: number;
  draftCount: number;
  openCount: number;
  closedCount: number;
  archivedCount: number;
  closedWithPnlCount: number;
  unreconciledClosedCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRatePct: string | null;
  profitFactor: string | null;
  expectancy: string | null;
  averageNetR: string | null;
  consolidatedCurrency: string | null;
  consolidatedGrossPnl: string | null;
  consolidatedCostsTotal: string | null;
  consolidatedNetPnl: string | null;
  consolidationUnavailableReason: string | null;
  currencyBuckets: TradeCurrencyBucket[];
}

const BREAKEVEN_TOLERANCE = new Decimal('0.005');

export function resolveInstrumentForTrade(
  trade: Pick<Trade, 'instrumentId' | 'symbol'>,
  instruments: ReadonlyArray<InstrumentSpecification>
): InstrumentSpecification | null {
  if (trade.instrumentId) {
    const byId = instruments.find((i) => i.id === trade.instrumentId);
    if (byId) return byId;
  }
  const sym = trade.symbol.trim().toUpperCase();
  return instruments.find((i) => i.symbol.toUpperCase() === sym && i.status === 'active')
    ?? instruments.find((i) => i.symbol.toUpperCase() === sym)
    ?? null;
}

export function resolveQuoteToAccountFxRate(
  fromCurrency: string,
  toCurrency: string,
  explicitTradeRate: string | null | undefined,
  fxRates: ReadonlyArray<FXRateSnapshot>
): ResolvedFxConversion {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();

  if (from === to) {
    return { rate: '1', source: 'same_currency', fromCurrency: from, toCurrency: to };
  }

  if (explicitTradeRate && new Decimal(explicitTradeRate).gt(0)) {
    return { rate: explicitTradeRate, source: 'trade_override', fromCurrency: from, toCurrency: to };
  }

  const direct = fxRates.find((r) => r.baseCurrency === from && r.quoteCurrency === to);
  if (direct && new Decimal(direct.rate).gt(0)) {
    return { rate: direct.rate, source: 'workspace_direct', fromCurrency: from, toCurrency: to };
  }

  const inverse = fxRates.find((r) => r.baseCurrency === to && r.quoteCurrency === from);
  if (inverse && new Decimal(inverse.rate).gt(0)) {
    return {
      rate: new Decimal(1).div(inverse.rate).toString(),
      source: 'workspace_inverse',
      fromCurrency: from,
      toCurrency: to,
    };
  }

  return { rate: null, source: 'missing_fx_rate', fromCurrency: from, toCurrency: to };
}

function calculateQuoteAmount(
  priceDiff: Decimal,
  quantity: Decimal,
  instrument: InstrumentSpecification
): Decimal {
  const tickSize = new Decimal(instrument.tickSize);
  if (instrument.tickValue !== null && tickSize.gt(0)) {
    return priceDiff.div(tickSize).times(instrument.tickValue).times(quantity);
  }
  return priceDiff.times(instrument.contractSize).times(quantity);
}

function formatHoldingDuration(entryAt: string | null, exitAt: string | null): {
  minutes: number | null;
  label: string | null;
} {
  if (!entryAt || !exitAt) return { minutes: null, label: null };
  const startMs = Date.parse(entryAt);
  const endMs = Date.parse(exitAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return { minutes: null, label: null };
  }
  const totalMinutes = Math.round((endMs - startMs) / 60000);
  if (totalMinutes < 60) {
    return { minutes: totalMinutes, label: `${totalMinutes}m` };
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours < 24) {
    return { minutes: totalMinutes, label: mins > 0 ? `${hours}h ${mins}m` : `${hours}h` };
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return { minutes: totalMinutes, label: remHours > 0 ? `${days}d ${remHours}h` : `${days}d` };
}

function signedPriceDifference(direction: TradeDirection, fromPrice: Decimal, toPrice: Decimal): Decimal {
  return direction === 'long' ? toPrice.minus(fromPrice) : fromPrice.minus(toPrice);
}

export function calculateTradeMetrics(
  trade: Trade,
  instrument: InstrumentSpecification | null,
  fxRates: ReadonlyArray<FXRateSnapshot> = [],
  options?: { accountBalanceFallback?: string | null }
): TradeCalculatedMetrics {
  const warnings: string[] = [];
  const accountCurrency = trade.accountCurrency;
  const profitCurrency = instrument ? (instrument.profitCurrency ?? instrument.quoteCurrency) : null;
  const fxConversion = profitCurrency
    ? resolveQuoteToAccountFxRate(profitCurrency, accountCurrency, trade.fxConversionRate, fxRates)
    : null;

  const balanceDenomStr = trade.accountBalanceSnapshot ?? options?.accountBalanceFallback ?? null;
  const balanceDenom =
    balanceDenomStr !== null && new Decimal(balanceDenomStr).gt(0)
      ? new Decimal(balanceDenomStr)
      : null;

  const entryPriceDec = trade.entryPrice !== null ? new Decimal(trade.entryPrice) : null;
  const exitPriceDec = trade.exitPrice !== null ? new Decimal(trade.exitPrice) : null;
  const entryQtyDec = trade.quantity !== null ? new Decimal(trade.quantity) : null;
  const effectiveExitQtyDec =
    trade.exitQuantity !== null ? new Decimal(trade.exitQuantity) : entryQtyDec;

  const initialStopDec = trade.initialStopPrice !== null ? new Decimal(trade.initialStopPrice) : null;
  const actualStopDec = trade.actualStopPrice !== null ? new Decimal(trade.actualStopPrice) : null;
  const targetDec = trade.plannedTargetPrice !== null ? new Decimal(trade.plannedTargetPrice) : null;

  // 1. Initial Risk (never overwritten by later stop moves)
  let initialStopDistance: string | null = null;
  let initialStopPips: string | null = null;
  let initialStopTicks: string | null = null;
  let initialRiskNative: string | null = null;
  let initialRiskAmount: string | null = null;
  let initialRiskSource: TradeCalculatedMetrics['initialRiskSource'] = 'insufficient_data';

  let rawInitialStopDistDec: Decimal | null = null;
  if (entryPriceDec !== null && initialStopDec !== null) {
    const stopMove =
      trade.direction === 'long'
        ? entryPriceDec.minus(initialStopDec)
        : initialStopDec.minus(entryPriceDec);
    if (stopMove.lt(0)) {
      warnings.push('Initial stop price is on the profitable side of entry.');
    }
    rawInitialStopDistDec = Decimal.max(0, stopMove);
    initialStopDistance = rawInitialStopDistDec.toFixed(6).replace(/\.?0+$/, '');
    if (instrument) {
      initialStopPips = rawInitialStopDistDec.div(instrument.pipSize).toFixed(2);
      initialStopTicks = rawInitialStopDistDec.div(instrument.tickSize).toFixed(2);
    }
  }

  if (trade.plannedRiskAmount !== null) {
    initialRiskAmount = new Decimal(trade.plannedRiskAmount).toFixed(2);
    initialRiskSource = 'manual_planned';
  } else if (rawInitialStopDistDec !== null && entryQtyDec !== null && instrument) {
    const nativeRisk = calculateQuoteAmount(rawInitialStopDistDec, entryQtyDec, instrument);
    initialRiskNative = nativeRisk.toFixed(2);
    if (fxConversion?.rate !== null && fxConversion?.rate !== undefined) {
      initialRiskAmount = nativeRisk.times(fxConversion.rate).toFixed(2);
      initialRiskSource = 'calculated_from_initial_stop';
    } else {
      initialRiskSource = 'missing_fx_rate';
    }
  }

  let initialRiskPct: string | null = null;
  if (trade.plannedRiskPct !== null) {
    initialRiskPct = new Decimal(trade.plannedRiskPct).toFixed(2);
  } else if (initialRiskAmount !== null && balanceDenom !== null) {
    initialRiskPct = new Decimal(initialRiskAmount).div(balanceDenom).times(100).toFixed(2);
  }

  // 2. Actual Risk (reflects moved/adjusted stop or manual actual risk)
  let actualStopDistance: string | null = null;
  let actualRiskAmount: string | null = null;
  let actualRiskSource: TradeCalculatedMetrics['actualRiskSource'] = 'not_adjusted';

  if (trade.actualRiskAmount !== null) {
    actualRiskAmount = new Decimal(trade.actualRiskAmount).toFixed(2);
    actualRiskSource = 'manual_actual';
  } else if (entryPriceDec !== null && actualStopDec !== null) {
    const actMove =
      trade.direction === 'long'
        ? entryPriceDec.minus(actualStopDec)
        : actualStopDec.minus(entryPriceDec);
    const clampedAct = Decimal.max(0, actMove);
    actualStopDistance = clampedAct.toFixed(6).replace(/\.?0+$/, '');
    if (entryQtyDec !== null && instrument) {
      const nativeAct = calculateQuoteAmount(clampedAct, entryQtyDec, instrument);
      if (fxConversion?.rate !== null && fxConversion?.rate !== undefined) {
        actualRiskAmount = nativeAct.times(fxConversion.rate).toFixed(2);
        actualRiskSource = 'calculated_from_actual_stop';
      } else {
        actualRiskSource = 'missing_fx_rate';
      }
    }
  }

  const actualRiskPct =
    actualRiskAmount !== null && balanceDenom !== null
      ? new Decimal(actualRiskAmount).div(balanceDenom).times(100).toFixed(2)
      : null;

  // 3. Planned Target & Planned R
  let plannedRewardAmount: string | null = null;
  let plannedRMultiple: string | null = null;

  if (entryPriceDec !== null && targetDec !== null) {
    const targetMove = signedPriceDifference(trade.direction, entryPriceDec, targetDec);
    if (targetMove.lt(0)) {
      warnings.push('Planned target price is on the loss side of entry.');
    }
    if (rawInitialStopDistDec !== null && rawInitialStopDistDec.gt(0)) {
      plannedRMultiple = targetMove.div(rawInitialStopDistDec).toFixed(2);
    }
    if (entryQtyDec !== null && instrument && fxConversion?.rate) {
      const nativeReward = calculateQuoteAmount(targetMove, entryQtyDec, instrument);
      plannedRewardAmount = nativeReward.times(fxConversion.rate).toFixed(2);
      if (plannedRMultiple === null && initialRiskAmount !== null && new Decimal(initialRiskAmount).gt(0)) {
        plannedRMultiple = new Decimal(plannedRewardAmount).div(initialRiskAmount).toFixed(2);
      }
    }
  }

  // 4. Price Move & Gross P&L
  let priceMove: string | null = null;
  let realisedPips: string | null = null;
  let realisedTicks: string | null = null;
  let grossPnlNative: string | null = null;
  let grossPnl: string | null = null;
  let grossPnlSource: TradeCalculationSource = 'insufficient_data';
  let unavailableReason: string | null = null;

  if (entryPriceDec !== null && exitPriceDec !== null) {
    const moveDec = signedPriceDifference(trade.direction, entryPriceDec, exitPriceDec);
    priceMove = moveDec.toFixed(6).replace(/\.?0+$/, '') || '0';
    if (instrument) {
      realisedPips = moveDec.div(instrument.pipSize).toFixed(2);
      realisedTicks = moveDec.div(instrument.tickSize).toFixed(2);
    }
  }

  if (trade.manualGrossPnl !== null) {
    grossPnl = new Decimal(trade.manualGrossPnl).toFixed(2);
    grossPnlSource = 'manual_override';
  } else if (entryPriceDec !== null && exitPriceDec !== null && effectiveExitQtyDec !== null) {
    if (!instrument) {
      grossPnlSource = 'insufficient_data';
      unavailableReason = 'Link or configure an Instrument Specification to calculate monetary P&L from prices.';
    } else {
      const moveDec = signedPriceDifference(trade.direction, entryPriceDec, exitPriceDec);
      const nativeDec = calculateQuoteAmount(moveDec, effectiveExitQtyDec, instrument);
      grossPnlNative = nativeDec.toFixed(2);
      if (fxConversion?.rate) {
        grossPnl = nativeDec.times(fxConversion.rate).toFixed(2);
        grossPnlSource = 'calculated_from_prices';
      } else {
        grossPnlSource = 'missing_fx_rate';
        unavailableReason = `Missing FX rate for ${profitCurrency}/${accountCurrency} conversion.`;
      }
    }
  } else if (trade.status === 'closed') {
    unavailableReason = 'Missing entry price, exit price, or quantity for price-based P&L.';
  }

  // 5. Execution Costs & Net P&L
  const hasCostInputs =
    trade.commission !== null ||
    trade.swap !== null ||
    trade.fees !== null ||
    trade.slippage !== null;

  let totalCostsDec = new Decimal(0);
  if (hasCostInputs) {
    if (trade.commission !== null) totalCostsDec = totalCostsDec.plus(trade.commission);
    if (trade.swap !== null) totalCostsDec = totalCostsDec.plus(trade.swap);
    if (trade.fees !== null) totalCostsDec = totalCostsDec.plus(trade.fees);
    if (trade.slippage !== null) totalCostsDec = totalCostsDec.plus(trade.slippage);
  }
  const totalCosts = hasCostInputs ? totalCostsDec.toFixed(2) : null;

  let netPnl: string | null = null;
  let netPnlSource: TradeCalculatedMetrics['netPnlSource'] = 'unavailable';

  if (grossPnl !== null) {
    const grossDec = new Decimal(grossPnl);
    netPnl = grossDec.minus(totalCostsDec).toFixed(2);
    netPnlSource = hasCostInputs ? 'gross_minus_costs' : 'gross_no_costs_recorded';
  }

  const netPnlPct =
    netPnl !== null && balanceDenom !== null
      ? new Decimal(netPnl).div(balanceDenom).times(100).toFixed(2)
      : null;

  // 6. R Multiples (using Initial Risk, or fallback to Actual Risk only if Initial Risk wasn't provided)
  const rDenomStr =
    initialRiskAmount !== null && new Decimal(initialRiskAmount).gt(0)
      ? initialRiskAmount
      : actualRiskAmount !== null && new Decimal(actualRiskAmount).gt(0)
        ? actualRiskAmount
        : null;

  const grossRMultiple =
    grossPnl !== null && rDenomStr !== null
      ? new Decimal(grossPnl).div(rDenomStr).toFixed(2)
      : null;

  const netRMultiple =
    netPnl !== null && rDenomStr !== null
      ? new Decimal(netPnl).div(rDenomStr).toFixed(2)
      : null;

  // 7. Outcome Classification
  let outcome: TradeOutcome = 'unknown';
  if (trade.status === 'draft') {
    outcome = 'draft';
  } else if (trade.status === 'open') {
    outcome = 'open';
  } else if (netPnl !== null) {
    const netDec = new Decimal(netPnl);
    if (netDec.abs().lte(BREAKEVEN_TOLERANCE)) {
      outcome = 'breakeven';
    } else if (netDec.gt(0)) {
      outcome = 'win';
    } else {
      outcome = 'loss';
    }
  }

  // 8. Account Ledger Balance Impact (strictly non-archived closed trades with calculable Net P&L)
  const balanceImpactApplies = !trade.isArchived && trade.status === 'closed' && netPnl !== null;
  const balanceImpact = balanceImpactApplies ? netPnl : null;

  // 9. Holding Duration
  const duration = formatHoldingDuration(trade.entryAt, trade.exitAt);

  return {
    tradeId: trade.id,
    accountCurrency,
    instrumentSymbol: trade.symbol,
    instrumentMatched: instrument !== null,
    profitCurrency,
    fxConversion,
    priceMove,
    realisedPips,
    realisedTicks,
    initialStopDistance,
    initialStopPips,
    initialStopTicks,
    initialRiskNative,
    initialRiskAmount,
    initialRiskPct,
    initialRiskSource,
    actualStopDistance,
    actualRiskAmount,
    actualRiskPct,
    actualRiskSource,
    plannedRewardAmount,
    plannedRMultiple,
    grossPnlNative,
    grossPnl,
    grossPnlSource,
    totalCosts,
    hasCostInputs,
    netPnl,
    netPnlPct,
    netPnlSource,
    grossRMultiple,
    netRMultiple,
    outcome,
    balanceImpact,
    balanceImpactApplies,
    holdingDurationMinutes: duration.minutes,
    holdingDurationLabel: duration.label,
    warnings,
    unavailableReason,
  };
}

export function calculateAllTradeMetrics(
  trades: ReadonlyArray<Trade>,
  instruments: ReadonlyArray<InstrumentSpecification>,
  fxRates: ReadonlyArray<FXRateSnapshot> = [],
  accounts: ReadonlyArray<Account> = []
): Map<string, TradeCalculatedMetrics> {
  const accMap = new Map<string, Account>();
  for (const acc of accounts) accMap.set(acc.id, acc);

  const map = new Map<string, TradeCalculatedMetrics>();
  for (const trade of trades) {
    const spec = resolveInstrumentForTrade(trade, instruments);
    const acc = accMap.get(trade.accountId);
    map.set(
      trade.id,
      calculateTradeMetrics(trade, spec, fxRates, {
        accountBalanceFallback: acc?.startingBalance ?? null,
      })
    );
  }
  return map;
}

export function calculateAccountTradeImpact(
  account: Account,
  trades: ReadonlyArray<Trade>,
  instruments: ReadonlyArray<InstrumentSpecification>,
  fxRates: ReadonlyArray<FXRateSnapshot> = []
): AccountTradeImpactSummary {
  const accountTrades = trades.filter((t) => t.accountId === account.id);
  const archivedCount = accountTrades.filter((t) => t.isArchived).length;
  const activeTrades = accountTrades.filter((t) => !t.isArchived);

  const draftCount = activeTrades.filter((t) => t.status === 'draft').length;
  const openCount = activeTrades.filter((t) => t.status === 'open').length;
  const closedTrades = activeTrades.filter((t) => t.status === 'closed');

  let grossSum = new Decimal(0);
  let costsSum = new Decimal(0);
  let netSum = new Decimal(0);
  let closedWithPnlCount = 0;
  let unreconciledClosedCount = 0;
  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let grossWinningSum = new Decimal(0);
  let grossLosingAbsSum = new Decimal(0);
  let rSum = new Decimal(0);
  let rCount = 0;

  for (const trade of closedTrades) {
    const spec = resolveInstrumentForTrade(trade, instruments);
    const metrics = calculateTradeMetrics(trade, spec, fxRates, {
      accountBalanceFallback: account.startingBalance,
    });
    if (metrics.netPnl === null || metrics.grossPnl === null) {
      unreconciledClosedCount += 1;
      continue;
    }

    closedWithPnlCount += 1;
    const netDec = new Decimal(metrics.netPnl);
    grossSum = grossSum.plus(metrics.grossPnl);
    if (metrics.totalCosts !== null) {
      costsSum = costsSum.plus(metrics.totalCosts);
    }
    netSum = netSum.plus(netDec);

    if (metrics.outcome === 'win') {
      winCount += 1;
      grossWinningSum = grossWinningSum.plus(netDec);
    } else if (metrics.outcome === 'loss') {
      lossCount += 1;
      grossLosingAbsSum = grossLosingAbsSum.plus(netDec.abs());
    } else if (metrics.outcome === 'breakeven') {
      breakevenCount += 1;
    }

    if (metrics.netRMultiple !== null) {
      rSum = rSum.plus(metrics.netRMultiple);
      rCount += 1;
    }
  }

  const winRatePct =
    closedWithPnlCount > 0
      ? new Decimal(winCount).div(closedWithPnlCount).times(100).toFixed(1)
      : null;

  const profitFactor =
    closedWithPnlCount > 0 && grossLosingAbsSum.gt(0)
      ? grossWinningSum.div(grossLosingAbsSum).toFixed(2)
      : null;

  const expectancy =
    closedWithPnlCount > 0 ? netSum.div(closedWithPnlCount).toFixed(2) : null;

  const averageNetR = rCount > 0 ? rSum.div(rCount).toFixed(2) : null;

  return {
    accountId: account.id,
    currency: account.baseCurrency,
    totalActiveTrades: activeTrades.length,
    draftCount,
    openCount,
    closedCount: closedTrades.length,
    archivedCount,
    closedWithPnlCount,
    unreconciledClosedCount,
    realisedGrossPnl: closedWithPnlCount > 0 ? grossSum.toFixed(2) : null,
    realisedCostsTotal: closedWithPnlCount > 0 ? costsSum.toFixed(2) : null,
    realisedNetPnl: closedWithPnlCount > 0 ? netSum.toFixed(2) : null,
    winCount,
    lossCount,
    breakevenCount,
    winRatePct,
    profitFactor,
    expectancy,
    averageNetR,
  };
}

export function calculateTradeAggregateSummary(
  trades: ReadonlyArray<Trade>,
  metricsById: ReadonlyMap<string, TradeCalculatedMetrics>,
  targetCurrency?: string,
  fxRates: ReadonlyArray<FXRateSnapshot> = []
): TradeAggregateSummary {
  const archivedCount = trades.filter((t) => t.isArchived).length;
  const draftCount = trades.filter((t) => !t.isArchived && t.status === 'draft').length;
  const openCount = trades.filter((t) => !t.isArchived && t.status === 'open').length;
  const closedTrades = trades.filter((t) => !t.isArchived && t.status === 'closed');

  const bucketMap = new Map<
    string,
    { tradeCount: number; closedWithPnlCount: number; gross: Decimal; costs: Decimal; net: Decimal }
  >();

  let closedWithPnlCount = 0;
  let unreconciledClosedCount = 0;
  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let rSum = new Decimal(0);
  let rCount = 0;
  let grossWinning = new Decimal(0);
  let grossLosing = new Decimal(0);
  let singleCurrencyConvertedNetSum = new Decimal(0);

  for (const t of closedTrades) {
    const m = metricsById.get(t.id);
    if (!m || m.netPnl === null || m.grossPnl === null) {
      unreconciledClosedCount += 1;
      continue;
    }

    closedWithPnlCount += 1;
    const netDec = new Decimal(m.netPnl);
    const grossDec = new Decimal(m.grossPnl);
    const costDec = m.totalCosts !== null ? new Decimal(m.totalCosts) : new Decimal(0);

    const b = bucketMap.get(m.accountCurrency) ?? {
      tradeCount: 0,
      closedWithPnlCount: 0,
      gross: new Decimal(0),
      costs: new Decimal(0),
      net: new Decimal(0),
    };
    b.tradeCount += 1;
    b.closedWithPnlCount += 1;
    b.gross = b.gross.plus(grossDec);
    b.costs = b.costs.plus(costDec);
    b.net = b.net.plus(netDec);
    bucketMap.set(m.accountCurrency, b);

    if (m.outcome === 'win') {
      winCount += 1;
      grossWinning = grossWinning.plus(netDec);
    } else if (m.outcome === 'loss') {
      lossCount += 1;
      grossLosing = grossLosing.plus(netDec.abs());
    } else if (m.outcome === 'breakeven') {
      breakevenCount += 1;
    }

    if (m.netRMultiple !== null) {
      rSum = rSum.plus(m.netRMultiple);
      rCount += 1;
    }
  }

  const currencyBuckets: TradeCurrencyBucket[] = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, agg]) => ({
      currency,
      tradeCount: agg.tradeCount,
      closedWithPnlCount: agg.closedWithPnlCount,
      grossPnl: agg.gross.toFixed(2),
      totalCosts: agg.costs.toFixed(2),
      netPnl: agg.net.toFixed(2),
    }));

  const winRatePct =
    closedWithPnlCount > 0
      ? new Decimal(winCount).div(closedWithPnlCount).times(100).toFixed(1)
      : null;

  let consolidatedCurrency: string | null = null;
  let consolidatedGrossPnl: string | null = null;
  let consolidatedCostsTotal: string | null = null;
  let consolidatedNetPnl: string | null = null;
  let consolidationUnavailableReason: string | null = null;
  let expectancy: string | null = null;
  let profitFactor: string | null = null;

  if (currencyBuckets.length === 1 && (!targetCurrency || currencyBuckets[0].currency === targetCurrency)) {
    const only = currencyBuckets[0];
    consolidatedCurrency = only.currency;
    consolidatedGrossPnl = only.grossPnl;
    consolidatedCostsTotal = only.totalCosts;
    consolidatedNetPnl = only.netPnl;
    singleCurrencyConvertedNetSum = new Decimal(only.netPnl);
    expectancy = singleCurrencyConvertedNetSum.div(closedWithPnlCount).toFixed(2);
    profitFactor = grossLosing.gt(0) ? grossWinning.div(grossLosing).toFixed(2) : null;
  } else if (currencyBuckets.length > 0) {
    const dest = targetCurrency ?? currencyBuckets[0].currency;
    let totalGross = new Decimal(0);
    let totalCosts = new Decimal(0);
    let totalNet = new Decimal(0);
    const missingPairs: string[] = [];

    for (const bucket of currencyBuckets) {
      const fx = resolveQuoteToAccountFxRate(bucket.currency, dest, null, fxRates);
      if (fx.rate) {
        totalGross = totalGross.plus(new Decimal(bucket.grossPnl).times(fx.rate));
        totalCosts = totalCosts.plus(new Decimal(bucket.totalCosts).times(fx.rate));
        totalNet = totalNet.plus(new Decimal(bucket.netPnl).times(fx.rate));
      } else {
        missingPairs.push(`${bucket.currency}/${dest}`);
      }
    }

    if (missingPairs.length === 0) {
      consolidatedCurrency = dest;
      consolidatedGrossPnl = totalGross.toFixed(2);
      consolidatedCostsTotal = totalCosts.toFixed(2);
      consolidatedNetPnl = totalNet.toFixed(2);
      expectancy = totalNet.div(closedWithPnlCount).toFixed(2);
    } else {
      consolidationUnavailableReason = `Missing FX rate for ${missingPairs.join(', ')} to consolidate trade P&L in ${dest}.`;
    }
  }

  return {
    totalTrades: trades.filter((t) => !t.isArchived).length,
    draftCount,
    openCount,
    closedCount: closedTrades.length,
    archivedCount,
    closedWithPnlCount,
    unreconciledClosedCount,
    winCount,
    lossCount,
    breakevenCount,
    winRatePct,
    profitFactor,
    expectancy,
    averageNetR: rCount > 0 ? rSum.div(rCount).toFixed(2) : null,
    consolidatedCurrency,
    consolidatedGrossPnl,
    consolidatedCostsTotal,
    consolidatedNetPnl,
    consolidationUnavailableReason,
    currencyBuckets,
  };
}

// ---------------------------------------------------------------------------
// Trade Explorer Pure Filter, Sort & Pagination Engine
// ---------------------------------------------------------------------------

export interface TradeFilterCriteria {
  searchQuery?: string;
  accountId?: string | 'all';
  archiveScope?: 'active_only' | 'archived_only' | 'all';
  status?: 'all' | TradeStatus;
  direction?: 'all' | TradeDirection;
  symbol?: string | 'all';
  session?: 'all' | TradeSession;
  outcome?: 'all' | 'win' | 'loss' | 'breakeven' | 'open_or_draft';
  dateFrom?: string;
  dateTo?: string;
}

export type TradeSortField = 'date' | 'symbol' | 'net_pnl' | 'net_r' | 'initial_risk' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface TradeSortCriteria {
  field: TradeSortField;
  direction: SortDirection;
}

export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

function getTradeSortDateKey(trade: Trade): string {
  return trade.entryAt ?? trade.exitAt ?? trade.createdAt;
}

export function filterAndSortTrades(
  trades: ReadonlyArray<Trade>,
  metricsById: ReadonlyMap<string, TradeCalculatedMetrics>,
  filters: TradeFilterCriteria,
  sort: TradeSortCriteria,
  accountNameById: ReadonlyMap<string, string> = new Map()
): Trade[] {
  const q = (filters.searchQuery ?? '').trim().toLowerCase();
  const archiveScope = filters.archiveScope ?? 'active_only';

  const filtered = trades.filter((t) => {
    if (archiveScope === 'active_only' && t.isArchived) return false;
    if (archiveScope === 'archived_only' && !t.isArchived) return false;

    if (filters.accountId && filters.accountId !== 'all' && t.accountId !== filters.accountId) {
      return false;
    }
    if (filters.status && filters.status !== 'all' && t.status !== filters.status) {
      return false;
    }
    if (filters.direction && filters.direction !== 'all' && t.direction !== filters.direction) {
      return false;
    }
    if (filters.symbol && filters.symbol !== 'all' && t.symbol !== filters.symbol) {
      return false;
    }
    if (filters.session && filters.session !== 'all' && t.session !== filters.session) {
      return false;
    }

    const metrics = metricsById.get(t.id);
    if (filters.outcome && filters.outcome !== 'all') {
      const outcome = metrics?.outcome ?? 'unknown';
      if (filters.outcome === 'open_or_draft') {
        if (t.status !== 'open' && t.status !== 'draft') return false;
      } else if (outcome !== filters.outcome) {
        return false;
      }
    }

    const tradeDate = getTradeSortDateKey(t).slice(0, 10);
    if (filters.dateFrom && tradeDate < filters.dateFrom) return false;
    if (filters.dateTo && tradeDate > filters.dateTo) return false;

    if (q) {
      const accName = accountNameById.get(t.accountId)?.toLowerCase() ?? '';
      const hit =
        t.symbol.toLowerCase().includes(q) ||
        (t.externalTicketId ?? '').toLowerCase().includes(q) ||
        (t.setupTag ?? '').toLowerCase().includes(q) ||
        (t.entryNotes ?? '').toLowerCase().includes(q) ||
        (t.reviewNotes ?? '').toLowerCase().includes(q) ||
        accName.includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.marketConditions.some((mc) => mc.toLowerCase().includes(q));
      if (!hit) return false;
    }

    return true;
  });

  const dirMultiplier = sort.direction === 'asc' ? 1 : -1;

  return filtered.sort((a, b) => {
    const ma = metricsById.get(a.id);
    const mb = metricsById.get(b.id);

    switch (sort.field) {
      case 'date': {
        return getTradeSortDateKey(a).localeCompare(getTradeSortDateKey(b)) * dirMultiplier;
      }
      case 'symbol': {
        return a.symbol.localeCompare(b.symbol) * dirMultiplier;
      }
      case 'status': {
        return a.status.localeCompare(b.status) * dirMultiplier;
      }
      case 'net_pnl': {
        if (ma?.netPnl == null && mb?.netPnl == null) return 0;
        if (ma?.netPnl == null) return 1;
        if (mb?.netPnl == null) return -1;
        return new Decimal(ma.netPnl).comparedTo(mb.netPnl) * dirMultiplier;
      }
      case 'net_r': {
        if (ma?.netRMultiple == null && mb?.netRMultiple == null) return 0;
        if (ma?.netRMultiple == null) return 1;
        if (mb?.netRMultiple == null) return -1;
        return new Decimal(ma.netRMultiple).comparedTo(mb.netRMultiple) * dirMultiplier;
      }
      case 'initial_risk': {
        if (ma?.initialRiskAmount == null && mb?.initialRiskAmount == null) return 0;
        if (ma?.initialRiskAmount == null) return 1;
        if (mb?.initialRiskAmount == null) return -1;
        return new Decimal(ma.initialRiskAmount).comparedTo(mb.initialRiskAmount) * dirMultiplier;
      }
    }
  });
}

export function paginateItems<T>(
  items: ReadonlyArray<T>,
  requestedPage: number,
  pageSize: number
): PaginatedResult<T> {
  const safeSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const startIndex = (page - 1) * safeSize;
  const endIndex = Math.min(startIndex + safeSize, totalItems);
  return {
    items: items.slice(startIndex, endIndex),
    totalItems,
    page,
    pageSize: safeSize,
    totalPages,
    startIndex,
    endIndex,
  };
}
