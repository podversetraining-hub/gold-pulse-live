import { clsx } from "@/lib/gold/format";
import type { TFBias } from "@/lib/gold/types";

interface Props {
  biases: TFBias[];
}

export function TimeframeRail({ biases }: Props) {
  return (
    <div className="bg-gradient-panel shadow-panel rounded-2xl border border-border/60 p-3 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-[0.25em] text-gold-shine font-bold">Multi-Timeframe Bias</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">7 TFs · weighted</div>
      </div>
      <div className="space-y-1">
        {biases.map((b) => {
          const isBuy = b.side === "BUY";
          const isSell = b.side === "SELL";
          const pct = Math.min(100, Math.abs(b.score));
          return (
            <div key={b.tf} className="flex items-center gap-2">
              <div className="w-9 text-sm font-bold tabular-nums text-foreground/90">{b.tf}</div>
              <div className="flex-1 relative h-6 rounded-md bg-panel-2 overflow-hidden border border-border/40">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/80" />
                <div
                  className={clsx(
                    "absolute top-0 bottom-0",
                    isBuy && "bg-gradient-bull left-1/2",
                    isSell && "bg-gradient-bear right-1/2",
                    !isBuy && !isSell && "bg-muted left-1/2 w-1",
                  )}
                  style={isBuy || isSell ? { width: `${pct / 2}%` } : undefined}
                />
                <div className="relative z-10 h-full flex items-center justify-center text-[11px] font-bold tracking-widest">
                  <span className={clsx(isBuy && "text-white", isSell && "text-white", !isBuy && !isSell && "text-muted-foreground")}>
                    {b.side === "NEUTRAL" ? "—" : b.side} · {b.score.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="w-7 text-right text-[10px] text-muted-foreground tabular-nums">{b.votes.length}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
