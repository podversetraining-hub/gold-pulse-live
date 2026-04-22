import type { TFData, TFBias, TradeSignal, IndicatorVote, SignalSide, TF, MarketSnapshot } from "./types";

const TF_WEIGHTS: Record<TF, number> = {
  D1: 4.0,
  H4: 3.0,
  H1: 2.2,
  M30: 1.6,
  M15: 1.3,
  M5: 0.9,
  M1: 0.5,
};

// Hysteresis & confirmation thresholds — calibrated for stable, confirmed signals.
// ENTRY: must cross strong band to flip into a side.
// EXIT: must fall back below weak band to drop to NEUTRAL — prevents oscillation.
const ENTER_SCORE = 22; // raw smoothed |score| needed to ENTER BUY/SELL
const EXIT_SCORE = 8;   // raw smoothed |score| under which active side reverts to NEUTRAL
const MIN_CONFLUENCE_ENTER = 3; // at least 3 of 7 TFs aligned to enter
const SMOOTHING_ALPHA = 0.35; // EMA factor for score smoothing (higher = faster react)
const TICKS_TO_CONFIRM_FLIP = 4; // consecutive matching ticks before changing confirmed side
const TICKS_TO_CONFIRM_NEUTRAL = 6; // harder to drop a confirmed side back to NEUTRAL

// Signal engine state — survives across ticks to enforce confirmation logic.
export interface SignalEngineState {
  confirmedSide: SignalSide;
  confirmedTier: TradeSignal["tier"];
  confirmedSince: number; // timestamp when confirmed side was set
  pendingSide: SignalSide;
  pendingTicks: number;
  smoothedScore: number;
  lastFeedTime: string; // last raw feed timestamp string seen
  lastChangeAt: number; // timestamp of last confirmed flip
}

export function createEngineState(): SignalEngineState {
  return {
    confirmedSide: "NEUTRAL",
    confirmedTier: "NEUTRAL",
    confirmedSince: 0,
    pendingSide: "NEUTRAL",
    pendingTicks: 0,
    smoothedScore: 0,
    lastFeedTime: "",
    lastChangeAt: 0,
  };
}

function vote(name: string, side: SignalSide, weight: number, detail: string): IndicatorVote {
  return { name, side, weight, detail };
}

export function biasForTimeframe(d: TFData): TFBias {
  const votes: IndicatorVote[] = [];
  const p = d.price;

  // EMA stack alignment
  if (d.ema8 && d.ema21 && d.ema50) {
    if (d.ema8 > d.ema21 && d.ema21 > d.ema50 && p > d.ema8) {
      votes.push(vote("EMA Stack", "BUY", 3, "8>21>50, price above"));
    } else if (d.ema8 < d.ema21 && d.ema21 < d.ema50 && p < d.ema8) {
      votes.push(vote("EMA Stack", "SELL", 3, "8<21<50, price below"));
    } else {
      votes.push(vote("EMA Stack", "NEUTRAL", 1, "Mixed"));
    }
  }

  // Price vs EMA200 (long-term bias)
  if (d.ema200) {
    if (p > d.ema200) votes.push(vote("EMA200", "BUY", 2, `Price ${(((p - d.ema200) / d.ema200) * 100).toFixed(2)}% above`));
    else votes.push(vote("EMA200", "SELL", 2, `Price ${(((d.ema200 - p) / d.ema200) * 100).toFixed(2)}% below`));
  }

  // RSI
  if (d.rsi !== undefined) {
    if (d.rsi > 60) votes.push(vote("RSI", "BUY", 1.5, `${d.rsi.toFixed(1)} bullish`));
    else if (d.rsi < 40) votes.push(vote("RSI", "SELL", 1.5, `${d.rsi.toFixed(1)} bearish`));
    else if (d.rsi > 50) votes.push(vote("RSI", "BUY", 0.6, `${d.rsi.toFixed(1)} mild bull`));
    else votes.push(vote("RSI", "SELL", 0.6, `${d.rsi.toFixed(1)} mild bear`));
  }

  // MACD
  if (d.macd !== undefined && d.macdSignal !== undefined) {
    const diff = d.macd - d.macdSignal;
    if (diff > 0 && d.macd > 0) votes.push(vote("MACD", "BUY", 2, "Above signal & zero"));
    else if (diff < 0 && d.macd < 0) votes.push(vote("MACD", "SELL", 2, "Below signal & zero"));
    else if (diff > 0) votes.push(vote("MACD", "BUY", 1, "Bullish cross"));
    else votes.push(vote("MACD", "SELL", 1, "Bearish cross"));
  }

  // Stochastic
  if (d.stochK !== undefined && d.stochD !== undefined) {
    if (d.stochK > d.stochD && d.stochK < 80) votes.push(vote("Stoch", "BUY", 1, `K>D ${d.stochK.toFixed(0)}`));
    else if (d.stochK < d.stochD && d.stochK > 20) votes.push(vote("Stoch", "SELL", 1, `K<D ${d.stochK.toFixed(0)}`));
  }

  // ADX trend strength + direction
  if (d.adx !== undefined && d.adxPlus !== undefined && d.adxMinus !== undefined) {
    if (d.adx > 25) {
      if (d.adxPlus > d.adxMinus) votes.push(vote("ADX", "BUY", 2, `Strong trend ${d.adx.toFixed(0)}`));
      else votes.push(vote("ADX", "SELL", 2, `Strong trend ${d.adx.toFixed(0)}`));
    }
  }

  // SuperTrend
  if (d.superTrendDir) {
    if (d.superTrendDir === "UP") votes.push(vote("SuperTrend", "BUY", 2.5, "Uptrend"));
    else votes.push(vote("SuperTrend", "SELL", 2.5, "Downtrend"));
  }

  // Ichimoku cloud
  if (d.cloudPos) {
    if (d.cloudPos === "ABOVE_CLOUD") votes.push(vote("Ichimoku", "BUY", 2, "Above cloud"));
    else if (d.cloudPos === "BELOW_CLOUD") votes.push(vote("Ichimoku", "SELL", 2, "Below cloud"));
  }

  // PSAR
  if (d.psar !== undefined) {
    if (p > d.psar) votes.push(vote("PSAR", "BUY", 1, "Below price"));
    else votes.push(vote("PSAR", "SELL", 1, "Above price"));
  }

  // Bollinger Bands position
  if (d.bbUpper && d.bbLower && d.bbMid) {
    if (p > d.bbUpper) votes.push(vote("BB", "SELL", 1, "Overbought break"));
    else if (p < d.bbLower) votes.push(vote("BB", "BUY", 1, "Oversold break"));
    else if (p > d.bbMid) votes.push(vote("BB", "BUY", 0.5, "Upper half"));
    else votes.push(vote("BB", "SELL", 0.5, "Lower half"));
  }

  // CCI
  if (d.cci !== undefined) {
    if (d.cci > 100) votes.push(vote("CCI", "BUY", 1, `${d.cci.toFixed(0)} strong`));
    else if (d.cci < -100) votes.push(vote("CCI", "SELL", 1, `${d.cci.toFixed(0)} strong`));
  }

  // Williams %R
  if (d.williamsR !== undefined) {
    if (d.williamsR > -20) votes.push(vote("Williams%R", "SELL", 0.5, "Overbought"));
    else if (d.williamsR < -80) votes.push(vote("Williams%R", "BUY", 0.5, "Oversold"));
  }

  // Aroon
  if (d.aroonUp !== undefined && d.aroonDown !== undefined) {
    if (d.aroonUp > 70 && d.aroonDown < 30) votes.push(vote("Aroon", "BUY", 1, "Strong up"));
    else if (d.aroonDown > 70 && d.aroonUp < 30) votes.push(vote("Aroon", "SELL", 1, "Strong down"));
  }

  // ZigZag SMC trend
  if (d.zigzagTrend) {
    if (d.zigzagTrend === "UP") votes.push(vote("ZigZag", "BUY", 1.5, "Higher highs"));
    else votes.push(vote("ZigZag", "SELL", 1.5, "Lower lows"));
  }

  // MFI volume-weighted
  if (d.mfi !== undefined) {
    if (d.mfi > 60) votes.push(vote("MFI", "BUY", 0.8, `${d.mfi.toFixed(0)}`));
    else if (d.mfi < 40) votes.push(vote("MFI", "SELL", 0.8, `${d.mfi.toFixed(0)}`));
  }

  // Tally
  let bull = 0, bear = 0;
  for (const v of votes) {
    if (v.side === "BUY") bull += v.weight;
    else if (v.side === "SELL") bear += v.weight;
  }
  const total = bull + bear || 1;
  const score = ((bull - bear) / total) * 100;
  let side: SignalSide = "NEUTRAL";
  if (score > 15) side = "BUY";
  else if (score < -15) side = "SELL";

  return { tf: d.tf, side, score, votes };
}

export function buildSnapshot(
  parsed: { pair: string; price: number; time: string; byTf: Partial<Record<TF, TFData>> },
  state: SignalEngineState,
): MarketSnapshot {
  const tfs: TF[] = ["D1", "H4", "H1", "M30", "M15", "M5", "M1"];
  const byTf = parsed.byTf as Record<TF, TFData>;

  const biases: TFBias[] = tfs
    .filter((t) => byTf[t])
    .map((t) => biasForTimeframe(byTf[t]));

  // Weighted aggregate score across timeframes
  let aggBull = 0, aggBear = 0, totalW = 0;
  for (const b of biases) {
    const w = TF_WEIGHTS[b.tf];
    totalW += w * 100;
    if (b.score > 0) aggBull += b.score * w;
    else aggBear += -b.score * w;
  }
  const rawScore = ((aggBull - aggBear) / Math.max(1, totalW)) * 100;

  // EMA smoothing of aggregate score to dampen tick-to-tick noise.
  state.smoothedScore = state.smoothedScore === 0
    ? rawScore
    : state.smoothedScore + SMOOTHING_ALPHA * (rawScore - state.smoothedScore);
  const smoothed = state.smoothedScore;

  // ── Pending side calculation with hysteresis ──
  // If we're already in a side, only exit when smoothed score collapses below EXIT_SCORE.
  // If we're NEUTRAL (or in opposite side), require crossing ENTER_SCORE.
  const currentSide = state.confirmedSide;
  const confluenceBuy = biases.filter((b) => b.side === "BUY").length;
  const confluenceSell = biases.filter((b) => b.side === "SELL").length;

  let pending: SignalSide;
  if (currentSide === "BUY") {
    if (smoothed > EXIT_SCORE && confluenceBuy >= 2) pending = "BUY";
    else if (smoothed < -ENTER_SCORE && confluenceSell >= MIN_CONFLUENCE_ENTER) pending = "SELL";
    else pending = "NEUTRAL";
  } else if (currentSide === "SELL") {
    if (smoothed < -EXIT_SCORE && confluenceSell >= 2) pending = "SELL";
    else if (smoothed > ENTER_SCORE && confluenceBuy >= MIN_CONFLUENCE_ENTER) pending = "BUY";
    else pending = "NEUTRAL";
  } else {
    if (smoothed > ENTER_SCORE && confluenceBuy >= MIN_CONFLUENCE_ENTER) pending = "BUY";
    else if (smoothed < -ENTER_SCORE && confluenceSell >= MIN_CONFLUENCE_ENTER) pending = "SELL";
    else pending = "NEUTRAL";
  }

  // ── N-tick confirmation ──
  if (pending === state.pendingSide) {
    state.pendingTicks += 1;
  } else {
    state.pendingSide = pending;
    state.pendingTicks = 1;
  }

  const ticksRequired = pending === "NEUTRAL" ? TICKS_TO_CONFIRM_NEUTRAL : TICKS_TO_CONFIRM_FLIP;
  if (pending !== state.confirmedSide && state.pendingTicks >= ticksRequired) {
    state.confirmedSide = pending;
    state.confirmedSince = Date.now();
    state.lastChangeAt = Date.now();
  }

  const side: SignalSide = state.confirmedSide;
  const confluence = side === "BUY" ? confluenceBuy : side === "SELL" ? confluenceSell : 0;

  // Confidence: blend of |smoothed score|, confluence, and how long the side has been confirmed.
  const scoreConf = Math.min(100, Math.abs(smoothed) * 1.5);
  const confluenceConf = (confluence / 7) * 100;
  const stabilityBonus = Math.min(15, (Date.now() - state.confirmedSince) / 4000); // up to +15 over time
  const conf = Math.min(100, Math.round(scoreConf * 0.55 + confluenceConf * 0.45 + stabilityBonus));

  let tier: TradeSignal["tier"];
  if (side === "NEUTRAL") tier = "NEUTRAL";
  else if (confluence >= 5 && conf >= 70) tier = "STRONG";
  else if (confluence >= 3 && conf >= 45) tier = "MODERATE";
  else tier = "WATCH";
  state.confirmedTier = tier;

  // Entry/SL/TP from M15 ATR & pivots
  const m15 = byTf.M15 ?? byTf.H1 ?? byTf.M30;
  const atr = m15?.atr ?? 5;
  const price = parsed.price;
  const slDist = Math.max(atr * 1.2, price * 0.0015);
  const tp1Dist = slDist * 1.5;
  const tp2Dist = slDist * 2.5;
  const tp3Dist = slDist * 4.0;

  let entry = price;
  let sl = price;
  let tp1 = price, tp2 = price, tp3 = price;
  if (side === "BUY") {
    entry = price;
    sl = price - slDist;
    tp1 = price + tp1Dist;
    tp2 = price + tp2Dist;
    tp3 = price + tp3Dist;
  } else if (side === "SELL") {
    entry = price;
    sl = price + slDist;
    tp1 = price - tp1Dist;
    tp2 = price - tp2Dist;
    tp3 = price - tp3Dist;
  }

  // Reasoning
  const reasoning: string[] = [];
  if (side !== "NEUTRAL") {
    const aligned = biases.filter((b) => b.side === side);
    reasoning.push(`${confluence}/${biases.length} timeframes confirmed ${side}`);
    const top = aligned.slice(0, 3).map((b) => `${b.tf} ${b.score.toFixed(0)}%`).join(" · ");
    if (top) reasoning.push(`Strongest: ${top}`);
    const heldSec = Math.round((Date.now() - state.confirmedSince) / 1000);
    if (heldSec > 0) reasoning.push(`Signal locked for ${heldSec}s · smoothed score ${smoothed.toFixed(0)}`);
    const d1 = byTf.D1;
    if (d1?.superTrendDir === (side === "BUY" ? "UP" : "DOWN")) reasoning.push("D1 SuperTrend confirms");
    if (d1?.cloudPos === (side === "BUY" ? "ABOVE_CLOUD" : "BELOW_CLOUD")) reasoning.push("D1 Ichimoku cloud confirms");
    const m15b = biases.find((b) => b.tf === "M15");
    if (m15b && m15b.side === side) reasoning.push(`M15 momentum aligned (${m15b.score.toFixed(0)}%)`);
  } else {
    if (state.pendingSide !== "NEUTRAL") {
      reasoning.push(`Pending ${state.pendingSide} — needs ${ticksRequired - state.pendingTicks} more confirms`);
    } else {
      reasoning.push("Mixed signals across timeframes — wait for confluence");
    }
    reasoning.push(`Smoothed score ${smoothed.toFixed(1)} (enter ±${ENTER_SCORE})`);
  }

  // Trend strength: avg ADX higher TFs
  const adxVals = [byTf.D1?.adx, byTf.H4?.adx, byTf.H1?.adx].filter((v): v is number => typeof v === "number");
  const trendStrength = adxVals.length ? Math.min(100, (adxVals.reduce((a, b) => a + b, 0) / adxVals.length) * 1.6) : 0;

  // Regime
  let marketRegime: MarketSnapshot["marketRegime"] = "RANGING";
  if (trendStrength > 50 && side === "BUY") marketRegime = "TRENDING_UP";
  else if (trendStrength > 50 && side === "SELL") marketRegime = "TRENDING_DOWN";
  else if ((m15?.bbWidth ?? 0) > 5) marketRegime = "VOLATILE";

  const signal: TradeSignal = {
    side,
    tier,
    confidence: Math.round(conf),
    entry,
    stopLoss: sl,
    takeProfit1: tp1,
    takeProfit2: tp2,
    takeProfit3: tp3,
    riskReward: +(tp2Dist / slDist).toFixed(2),
    reasoning,
    confluence,
    timeframe: "M15",
    timestamp: state.confirmedSince || Date.now(),
  };

  // Feed staleness — parse "YYYY.MM.DD HH:MM" UTC.
  let feedAgeSec = 0;
  if (parsed.time) {
    const m = parsed.time.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
    if (m) {
      const fed = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
      feedAgeSec = Math.max(0, Math.round((Date.now() - fed) / 1000));
    }
  }
  state.lastFeedTime = parsed.time;

  return {
    price,
    time: parsed.time,
    pair: parsed.pair,
    byTf,
    biases,
    signal,
    trendStrength,
    volatility: atr,
    marketRegime,
    fetchedAt: Date.now(),
    rawScore,
    smoothedScore: smoothed,
    pendingSide: state.pendingSide,
    pendingTicks: state.pendingTicks,
    ticksRequired,
    feedAgeSec,
  };
}
