import { useMemo } from "react";
import type { MarketSnapshot } from "@/lib/gold/types";
import { clsx } from "@/lib/gold/format";

interface Props {
  snapshot: MarketSnapshot;
}

export function ReasoningPanel({ snapshot }: Props) {
  const { signal } = snapshot;

  // Top contributing votes from M15 + H1 + H4 biases
  const topVotes = useMemo(() => {
    const wanted = ["M15", "H1", "H4", "D1"] as const;
    const all = snapshot.biases
      .filter((b) => wanted.includes(b.tf as (typeof wanted)[number]))
      .flatMap((b) => b.votes.map((v) => ({ ...v, tf: b.tf })))
      .filter((v) => v.side === signal.side && v.side !== "NEUTRAL")
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
    return all;
  }, [snapshot, signal.side]);

  return (
    <div className="bg-gradient-panel shadow-panel rounded-2xl border border-border/60 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm uppercase tracking-[0.25em] text-gold-shine font-bold">AI Reasoning</div>
        <div className="text-[10px] text-muted-foreground uppercase">Live confluence</div>
      </div>

      <ul className="space-y-1.5 mb-3">
        {signal.reasoning.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="text-gold mt-0.5">◆</span>
            <span className="text-foreground/90">{r}</span>
          </li>
        ))}
      </ul>

      {topVotes.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Top supporting signals</div>
          <div className="flex flex-wrap gap-1.5">
            {topVotes.map((v, i) => (
              <span
                key={i}
                className={clsx(
                  "text-[11px] px-2 py-1 rounded-md border font-semibold",
                  signal.side === "BUY" && "bg-bull/10 border-bull/40 text-bull",
                  signal.side === "SELL" && "bg-bear/10 border-bear/40 text-bear",
                )}
                title={v.detail}
              >
                {v.tf} · {v.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
