import type { TF, TFData, Candle } from "./types";

const TF_MAP: Record<string, TF> = {
  PERIOD_D1: "D1",
  PERIOD_H4: "H4",
  PERIOD_H1: "H1",
  PERIOD_M30: "M30",
  PERIOD_M15: "M15",
  PERIOD_M5: "M5",
  PERIOD_M1: "M1",
};

function num(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const v = parseFloat(s.replace(/[^\d\.\-]/g, ""));
  return Number.isFinite(v) ? v : undefined;
}

function get(block: string, key: string): string | undefined {
  // Match "Key: value" up to end of line. Handle keys with spaces/symbols.
  const safe = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*${safe}\\s*:\\s*(.+)$`, "im");
  const m = block.match(re);
  return m ? m[1].trim() : undefined;
}

function getNum(block: string, key: string): number | undefined {
  return num(get(block, key));
}

function parseCandleBlock(block: string, marker: string): Candle | undefined {
  const idx = block.indexOf(marker);
  if (idx === -1) return undefined;
  const sub = block.slice(idx, idx + 400);
  const o = num(get(sub, "open"));
  const h = num(get(sub, "high"));
  const l = num(get(sub, "low"));
  const c = num(get(sub, "close"));
  const v = num(get(sub, "volume"));
  const t = get(sub, "time");
  if (o === undefined || c === undefined) return undefined;
  return {
    open: o, high: h ?? o, low: l ?? o, close: c, volume: v ?? 0, time: t ?? "",
  };
}

function parseSwingBars(block: string, key: string): { val?: number; bars?: number } {
  const re = new RegExp(`^\\s*${key}\\s*:\\s*([\\-\\d\\.]+)\\s*\\(Bars_Ago:\\s*(\\d+)\\)`, "im");
  const m = block.match(re);
  if (!m) return {};
  return { val: parseFloat(m[1]), bars: parseInt(m[2], 10) };
}

function parseFibLevel(block: string, label: string): number | undefined {
  // e.g. "Fib_38.2%: 4795.860 (Distance: ...)"
  const safe = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*${safe}\\s*:\\s*([\\-\\d\\.]+)`, "im");
  const m = block.match(re);
  return m ? parseFloat(m[1]) : undefined;
}

export function parseFeed(raw: string): { pair: string; price: number; time: string; byTf: Partial<Record<TF, TFData>> } {
  // Split by "--- Timeframe:" markers
  const parts = raw.split(/^---\s*Timeframe:\s*/m).slice(1);
  const byTf: Partial<Record<TF, TFData>> = {};
  let pair = "XAUUSDm";
  let price = 0;
  let time = "";

  for (const part of parts) {
    const headerEnd = part.indexOf("\n");
    const header = part.slice(0, headerEnd).replace(/-/g, "").trim();
    const tf = TF_MAP[header];
    if (!tf) continue;
    const block = part;

    const p = num(get(block, "Pair"));
    const pStr = get(block, "Pair");
    if (pStr) pair = pStr;
    const cp = getNum(block, "Current Price");
    const ct = get(block, "Time");
    if (cp) price = cp;
    if (ct) time = ct;

    const swingH = parseSwingBars(block, "Swing_High");
    const swingL = parseSwingBars(block, "Swing_Low");

    const data: TFData = {
      tf,
      price: cp ?? 0,
      time: ct ?? "",
      ema8: getNum(block, "EMA_8"),
      ema21: getNum(block, "EMA_21"),
      ema50: getNum(block, "EMA_50"),
      ema100: getNum(block, "EMA_100"),
      ema200: getNum(block, "EMA_200"),
      rsi: getNum(block, "RSI"),
      rsi9: getNum(block, "RSI_9"),
      rsi21: getNum(block, "RSI_21"),
      macd: getNum(block, "MACD"),
      macdSignal: getNum(block, "MACD_Signal"),
      macdHist: getNum(block, "MACD_Histogram"),
      stochK: getNum(block, "Stoch_K_14"),
      stochD: getNum(block, "Stoch_D_14"),
      williamsR: getNum(block, "Williams_R"),
      cci: getNum(block, "CCI_20"),
      momentum: getNum(block, "Momentum_14"),
      adx: getNum(block, "ADX_Main"),
      adxPlus: getNum(block, "ADX_Plus"),
      adxMinus: getNum(block, "ADX_Minus"),
      atr: getNum(block, "ATR"),
      bbUpper: getNum(block, "BB_UPPER"),
      bbMid: getNum(block, "BB_MID"),
      bbLower: getNum(block, "BB_LOWER"),
      bbWidth: getNum(block, "BB_Width_20"),
      volume: getNum(block, "Volume"),
      mfi: getNum(block, "MFI_14"),
      relVolume: getNum(block, "Relative_Volume"),
      pivot: getNum(block, "Pivot Point"),
      r1: getNum(block, "Resistance 1 (R1)"),
      r2: getNum(block, "Resistance 2 (R2)"),
      r3: getNum(block, "Resistance 3 (R3)"),
      s1: getNum(block, "Support 1 (S1)"),
      s2: getNum(block, "Support 2 (S2)"),
      s3: getNum(block, "Support 3 (S3)"),
      superTrendValue: getNum(block, "SuperTrend_Value"),
      superTrendDir: (get(block, "SuperTrend_Direction") as "UP" | "DOWN" | undefined),
      tenkan: getNum(block, "Tenkan_Sen"),
      kijun: getNum(block, "Kijun_Sen"),
      senkouA: getNum(block, "Senkou_A"),
      senkouB: getNum(block, "Senkou_B"),
      cloudPos: get(block, "Cloud_Position") as TFData["cloudPos"],
      psar: getNum(block, "PSAR"),
      swingHigh: swingH.val,
      swingLow: swingL.val,
      swingHighBars: swingH.bars,
      swingLowBars: swingL.bars,
      zigzagTrend: get(block, "ZigZag_Trend") as "UP" | "DOWN" | undefined,
      fractalUp: getNum(block, "Fractal_Up_Value"),
      fractalDown: getNum(block, "Fractal_Down_Value"),
      alligatorState: get(block, "Alligator_State"),
      fib236: parseFibLevel(block, "Fib_23.6%"),
      fib382: parseFibLevel(block, "Fib_38.2%"),
      fib50: parseFibLevel(block, "Fib_50%"),
      fib618: parseFibLevel(block, "Fib_61.8%"),
      fib764: parseFibLevel(block, "Fib_76.4%"),
      trendDirection: get(block, "Trend_Direction") as "UPTREND" | "DOWNTREND" | undefined,
      closestFib: get(block, "Closest_Fib_Level"),
      pricePosInRange: (() => {
        const s = get(block, "Price_Position_in_Range");
        if (!s) return undefined;
        return parseFloat(s.replace("%", ""));
      })(),
      aroonUp: getNum(block, "Aroon_Up"),
      aroonDown: getNum(block, "Aroon_Down"),
      channelHigh: getNum(block, "Channel_High_20"),
      channelLow: getNum(block, "Channel_Low_20"),
      channelPos: getNum(block, "Channel_Position"),
      current: parseCandleBlock(block, "current candle:"),
      last: parseCandleBlock(block, "last complete candle:"),
    };

    byTf[tf] = data;
  }

  return { pair, price, time, byTf };
}
