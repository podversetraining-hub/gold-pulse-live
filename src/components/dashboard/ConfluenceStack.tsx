import { clsx, fmtPrice } from "@/lib/gold/format";
import type { MarketSnapshot } from "@/lib/gold/types";

interface Props {
  snapshot: MarketSnapshot;
}

export function ConfluenceStack({ snapshot }: Props) {
  const m15 = snapshot.byTf.M15;
  const h1 = snapshot.byTf.H1;
  const h4 = snapshot.byTf.H4;
  const d1 = snapshot.byTf.D1;

  const items: { label: string; value: string; tone: "bull" | "bear" | "neutral" }[] = [];

  const push = (label: string, value: string, tone: "bull" | "bear" | "neutral") => items.push({ label, value, tone });

  if (d1?.superTrendDir) push("D1 SuperTrend", d1.superTrendDir, d1.superTrendDir === "UP" ? "bull" : "bear");
  if (h4?.superTrendDir) push("H4 SuperTrend", h4.superTrendDir, h4.superTrendDir === "UP" ? "bull" : "bear");
  if (d1?.cloudPos) push("D1 Ichimoku", d1.cloudPos.replace("_", " "), d1.cloudPos === "ABOVE_CLOUD" ? "bull" : d1.cloudPos === "BELOW_CLOUD" ? "bear" : "neutral");
  if (h1?.cloudPos) push("H1 Ichimoku", h1.cloudPos.replace("_", " "), h1.cloudPos === "ABOVE_CLOUD" ? "bull" : h1.cloudPos === "BELOW_CLOUD" ? "bear" : "neutral");
  if (h4?.rsi !== undefined) push("H4 RSI", h4.rsi.toFixed(1), h4.rsi > 55 ? "bull" : h4.rsi < 45 ? "bear" : "neutral");
  if (m15?.rsi !== undefined) push("M15 RSI", m15.rsi.toFixed(1), m15.rsi > 55 ? "bull" : m15.rsi < 45 ? "bear" : "neutral");
  if (h1?.adx !== undefined) push("H1 ADX", h1.adx.toFixed(1), h1.adx > 25 ? (h1.adxPlus! > h1.adxMinus! ? "bull" : "bear") : "neutral");
  if (m15?.macdHist !== undefined) push("M15 MACD H", m15.macdHist.toFixed(2), m15.macdHist > 0 ? "bull" : "bear");
  if (d1?.zigzagTrend) push("D1 SMC Trend", d1.zigzagTrend, d1.zigzagTrend === "UP" ? "bull" : "bear");
  if (h4?.alligatorState) push("H4 Alligator", h4.alligatorState.replace("_", " "), h4.alligatorState.includes("UP") ? "bull" : h4.alligatorState.includes("DOWN") ? "bear" : "neutral");

  return (
    <div className="bg-gradient-panel shadow-panel rounded-2xl border border-border/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-[0.25em] text-gold-shine font-bold">Institutional Confluence</div>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {items.map((it) => (
          <div
            key={it.label}
            className={clsx(
              "flex items-center justify-between rounded px-2 py-1 text-[11px] border",
              it.tone === "bull" && "bg-bull/10 border-bull/40 text-bull",
              it.tone === "bear" && "bg-bear/10 border-bear/40 text-bear",
              it.tone === "neutral" && "bg-panel-2 border-border text-muted-foreground",
            )}
          >
            <span className="font-semibold truncate">{it.label}</span>
            <span className="font-mono tabular-nums">{it.value}</span>
          </div>
        ))}
      </div>

      {/* Key SMC swings */}
      {(d1?.swingHigh || d1?.swingLow) && (
        <div className="mt-2 pt-2 border-t border-border/60 grid grid-cols-2 gap-2 text-[11px]">
          {d1?.swingHigh && (
            <div className="flex justify-between text-bear">
              <span className="text-muted-foreground">Swing H D1</span>
              <span className="font-mono">{fmtPrice(d1.swingHigh)}</span>
            </div>
          )}
          {d1?.swingLow && (
            <div className="flex justify-between text-bull">
              <span className="text-muted-foreground">Swing L D1</span>
              <span className="font-mono">{fmtPrice(d1.swingLow)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
