export type TF = "D1" | "H4" | "H1" | "M30" | "M15" | "M5" | "M1";

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: string;
}

export interface TFData {
  tf: TF;
  price: number;
  time: string;
  // Trend
  ema8?: number;
  ema21?: number;
  ema50?: number;
  ema100?: number;
  ema200?: number;
  // Momentum
  rsi?: number;
  rsi9?: number;
  rsi21?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  stochK?: number;
  stochD?: number;
  williamsR?: number;
  cci?: number;
  momentum?: number;
  // Trend strength
  adx?: number;
  adxPlus?: number;
  adxMinus?: number;
  // Volatility
  atr?: number;
  bbUpper?: number;
  bbMid?: number;
  bbLower?: number;
  bbWidth?: number;
  // Volume
  volume?: number;
  mfi?: number;
  relVolume?: number;
  // Pivots
  pivot?: number;
  r1?: number; r2?: number; r3?: number;
  s1?: number; s2?: number; s3?: number;
  // SuperTrend
  superTrendValue?: number;
  superTrendDir?: "UP" | "DOWN";
  // Ichimoku
  tenkan?: number;
  kijun?: number;
  senkouA?: number;
  senkouB?: number;
  cloudPos?: "ABOVE_CLOUD" | "BELOW_CLOUD" | "INSIDE_CLOUD";
  // PSAR
  psar?: number;
  // SMC
  swingHigh?: number;
  swingLow?: number;
  swingHighBars?: number;
  swingLowBars?: number;
  zigzagTrend?: "UP" | "DOWN";
  fractalUp?: number;
  fractalDown?: number;
  alligatorState?: string;
  // Fibonacci
  fib236?: number;
  fib382?: number;
  fib50?: number;
  fib618?: number;
  fib764?: number;
  trendDirection?: "UPTREND" | "DOWNTREND";
  closestFib?: string;
  pricePosInRange?: number;
  // Aroon
  aroonUp?: number;
  aroonDown?: number;
  // Channels
  channelHigh?: number;
  channelLow?: number;
  channelPos?: number;
  // Candles
  current?: Candle;
  last?: Candle;
}

export type SignalTier = "STRONG" | "MODERATE" | "WATCH" | "NEUTRAL";
export type SignalSide = "BUY" | "SELL" | "NEUTRAL";

export interface IndicatorVote {
  name: string;
  side: SignalSide;
  weight: number;
  detail: string;
}

export interface TFBias {
  tf: TF;
  side: SignalSide;
  score: number; // -100..+100
  votes: IndicatorVote[];
}

export interface TradeSignal {
  side: SignalSide;
  tier: SignalTier;
  confidence: number; // 0..100
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
  reasoning: string[];
  confluence: number; // count of TFs aligned
  timeframe: TF; // primary trade TF
  timestamp: number;
}

export interface MarketSnapshot {
  price: number;
  time: string;
  pair: string;
  byTf: Record<TF, TFData>;
  biases: TFBias[];
  signal: TradeSignal;
  trendStrength: number; // 0..100
  volatility: number; // ATR M15
  marketRegime: "TRENDING_UP" | "TRENDING_DOWN" | "RANGING" | "VOLATILE";
  fetchedAt: number;
  rawScore: number; // raw aggregate score before smoothing
  smoothedScore: number; // EMA-smoothed score
  pendingSide: SignalSide; // raw side this tick (may differ from confirmed signal.side)
  pendingTicks: number; // how many ticks the pending side has persisted
  ticksRequired: number; // how many ticks needed to confirm a flip
  feedAgeSec: number; // seconds since feed timestamp
}
