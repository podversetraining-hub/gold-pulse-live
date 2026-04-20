import { fmtPrice, clsx } from "@/lib/gold/format";
import type { MarketSnapshot } from "@/lib/gold/types";

interface Props {
  snapshot: MarketSnapshot;
}

export function KeyLevels({ snapshot }: Props) {
  const m15 = snapshot.byTf.M15 ?? snapshot.byTf.H1;
  const h4 = snapshot.byTf.H4;
  if (!m15) return null;
  const price = snapshot.price;

  const rows: { label: string; value?: number; tone: "bull" | "bear" | "neutral" }[] = [
    { label: "R3", value: m15.r3, tone: "bear" },
    { label: "R2", value: m15.r2, tone: "bear" },
    { label: "R1", value: m15.r1, tone: "bear" },
    { label: "Pivot", value: m15.pivot, tone: "neutral" },
    { label: "S1", value: m15.s1, tone: "bull" },
    { label: "S2", value: m15.s2, tone: "bull" },
    { label: "S3", value: m15.s3, tone: "bull" },
  ];

  return (
    <div className="bg-gradient-panel shadow-panel rounded-2xl border border-border/60 p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="text-xs uppercase tracking-[0.25em] text-gold-shine font-bold">Key Levels · M15</div>
        {h4?.atr !== undefined && (
          <div className="text-[10px] text-muted-foreground uppercase">ATR H4 {h4.atr.toFixed(2)}</div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-1">
        {rows.map((r) => {
          if (!r.value) return null;
          const dist = ((r.value - price) / price) * 100;
          const isPivot = r.label === "Pivot";
          return (
            <div
              key={r.label}
              className={clsx(
                "flex items-center justify-between text-sm rounded-md px-2 py-1",
                isPivot ? "bg-gold/10 border border-gold/40" : "hover:bg-panel-2",
              )}
            >
              <span
                className={clsx(
                  "font-bold w-9 text-xs",
                  r.tone === "bull" && "text-bull",
                  r.tone === "bear" && "text-bear",
                  r.tone === "neutral" && "text-gold",
                )}
              >
                {r.label}
              </span>
              <span className="font-mono tabular-nums text-foreground text-sm">{fmtPrice(r.value)}</span>
              <span
                className={clsx(
                  "text-[11px] font-mono tabular-nums w-14 text-right",
                  dist >= 0 ? "text-bull" : "text-bear",
                )}
              >
                {dist >= 0 ? "+" : ""}
                {dist.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
