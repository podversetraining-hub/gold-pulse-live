import { useEffect, useState } from "react";
import { clsx, fmtPrice } from "@/lib/gold/format";
import type { MarketSnapshot } from "@/lib/gold/types";

interface Props {
  snapshot: MarketSnapshot;
  history: { t: number; price: number }[];
}

export function PriceHeader({ snapshot, history }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // session change vs first sample
  const sessionChange = (() => {
    if (history.length < 2) return { abs: 0, pct: 0 };
    const first = history[0];
    const last = history[history.length - 1];
    const abs = last.price - first.price;
    const pct = (abs / first.price) * 100;
    return { abs, pct };
  })();

  const isUp = sessionChange.abs >= 0;
  const utc = new Date(now).toUTCString().slice(17, 25);

  return (
    <div className="bg-gradient-panel shadow-panel border-b border-gold/30 px-6 py-3 flex items-center gap-6">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-gradient-gold shadow-gold flex items-center justify-center text-background font-black text-2xl">
            Au
          </div>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-bull live-dot border-2 border-background" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground leading-none">Live Stream</div>
          <div className="text-xl font-black text-gold-shine leading-tight tracking-tight">GOLD · XAUUSD</div>
        </div>
      </div>

      {/* Big price */}
      <div className="flex items-baseline gap-3 ml-2">
        <div className={clsx("text-6xl font-black tabular-nums tracking-tight drop-shadow", isUp ? "text-bull" : "text-bear")}>
          ${fmtPrice(snapshot.price)}
        </div>
        <div className={clsx("flex flex-col text-right", isUp ? "text-bull" : "text-bear")}>
          <div className="text-xl font-bold tabular-nums leading-none">
            {isUp ? "▲" : "▼"} {fmtPrice(Math.abs(sessionChange.abs))}
          </div>
          <div className="text-sm tabular-nums opacity-80">{isUp ? "+" : "-"}{Math.abs(sessionChange.pct).toFixed(3)}%</div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Right info */}
      <div className="text-right">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">UTC</div>
        <div className="text-3xl font-black tabular-nums text-gold leading-none">{utc}</div>
      </div>
      <div className="text-right border-l border-border/60 pl-5">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Volatility</div>
        <div className="text-3xl font-black tabular-nums text-foreground leading-none">{snapshot.volatility.toFixed(2)}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ATR M15</div>
      </div>
      <div className="text-right border-l border-border/60 pl-5">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Trend</div>
        <div className="text-3xl font-black tabular-nums text-gold-shine leading-none">{snapshot.trendStrength.toFixed(0)}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">strength</div>
      </div>
    </div>
  );
}
