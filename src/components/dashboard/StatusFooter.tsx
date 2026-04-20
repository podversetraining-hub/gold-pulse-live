import { useEffect, useMemo, useState } from "react";
import { clsx, fmtPrice } from "@/lib/gold/format";
import type { MarketSnapshot } from "@/lib/gold/types";

interface Props {
  snapshot: MarketSnapshot;
  history: { t: number; price: number }[];
}

export function StatusFooter({ snapshot, history }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // 1-min change
  const oneMinChange = useMemo(() => {
    if (history.length < 2) return { abs: 0, pct: 0 };
    const last = history[history.length - 1];
    const cutoff = last.t - 60_000;
    let ref = history[0];
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].t <= cutoff) { ref = history[i]; break; }
    }
    const abs = last.price - ref.price;
    const pct = (abs / ref.price) * 100;
    return { abs, pct };
  }, [history]);

  const ageSec = Math.max(0, Math.floor((now - snapshot.fetchedAt) / 1000));
  const fresh = ageSec < 5;

  // Build ticker items
  const tickerItems: { label: string; value: string; tone: "bull" | "bear" | "neutral" }[] = [];
  const push = (label: string, value: string, tone: "bull" | "bear" | "neutral") => tickerItems.push({ label, value, tone });

  for (const tf of ["D1", "H4", "H1", "M30", "M15", "M5"] as const) {
    const d = snapshot.byTf[tf];
    if (!d) continue;
    if (d.rsi !== undefined) push(`${tf} RSI`, d.rsi.toFixed(1), d.rsi > 55 ? "bull" : d.rsi < 45 ? "bear" : "neutral");
    if (d.adx !== undefined) push(`${tf} ADX`, d.adx.toFixed(1), d.adx > 25 ? "bull" : "neutral");
  }
  const m15 = snapshot.byTf.M15;
  if (m15?.bbWidth !== undefined) push("BB Width M15", m15.bbWidth.toFixed(2), m15.bbWidth > 5 ? "bear" : "neutral");
  if (m15?.relVolume !== undefined) push("Rel Vol M15", `${m15.relVolume.toFixed(2)}x`, m15.relVolume > 1.2 ? "bull" : "neutral");

  return (
    <div className="bg-gradient-panel border-t border-gold/30 shadow-panel">
      {/* Top status row */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border/60">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className={clsx("inline-block w-2.5 h-2.5 rounded-full", fresh ? "bg-bull live-dot" : "bg-bear")} />
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{fresh ? "LIVE" : `+${ageSec}s`}</span>
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Server: {snapshot.time}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Regime: <span className="text-gold font-bold">{snapshot.marketRegime.replace("_", " ")}</span></div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-xs">
            <span className="text-muted-foreground">1m Δ </span>
            <span className={clsx("font-mono font-bold tabular-nums", oneMinChange.abs >= 0 ? "text-bull" : "text-bear")}>
              {oneMinChange.abs >= 0 ? "+" : ""}{fmtPrice(oneMinChange.abs)} ({oneMinChange.pct >= 0 ? "+" : ""}{oneMinChange.pct.toFixed(3)}%)
            </span>
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Powered by 80+ indicators · 7 timeframes</div>
        </div>
      </div>

      {/* Scrolling ticker */}
      <div className="overflow-hidden h-10 flex items-center relative">
        <div className="ticker-track flex gap-8 whitespace-nowrap pl-6 will-change-transform">
          {[...tickerItems, ...tickerItems].map((it, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground uppercase tracking-wider text-[11px]">{it.label}</span>
              <span className={clsx(
                "font-mono font-bold tabular-nums",
                it.tone === "bull" && "text-bull",
                it.tone === "bear" && "text-bear",
                it.tone === "neutral" && "text-gold",
              )}>{it.value}</span>
              <span className="text-border">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
