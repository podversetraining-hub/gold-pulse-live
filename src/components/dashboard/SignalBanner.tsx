import { clsx } from "@/lib/gold/format";
import type { TradeSignal } from "@/lib/gold/types";

interface Props {
  signal: TradeSignal;
  trendStrength: number;
}

const tierStyles: Record<TradeSignal["tier"], string> = {
  STRONG: "bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400 text-background",
  MODERATE: "bg-gradient-to-r from-amber-500/90 to-amber-300/90 text-background",
  WATCH: "bg-panel-2 text-gold border border-gold/40",
  NEUTRAL: "bg-panel-2 text-muted-foreground border border-border",
};

export function SignalBanner({ signal, trendStrength }: Props) {
  const isBuy = signal.side === "BUY";
  const isSell = signal.side === "SELL";
  const isNeutral = signal.side === "NEUTRAL";

  const sideColor = isBuy ? "text-bull" : isSell ? "text-bear" : "text-muted-foreground";
  const sideBg = isBuy
    ? "bg-gradient-bull pulse-bull"
    : isSell
      ? "bg-gradient-bear pulse-bear"
      : "bg-panel-2 border border-border/60";

  const label = isNeutral ? "NEUTRAL" : signal.side;
  const arrow = isBuy ? "▲" : isSell ? "▼" : "■";

  return (
    <div className="bg-gradient-panel shadow-panel rounded-2xl border border-border/60 p-6 flex items-center gap-8">
      {/* Side badge — now the hero */}
      <div
        className={clsx(
          "flex items-center justify-center gap-5 rounded-xl px-10 py-6 min-w-[420px] shadow-gold",
          sideBg,
        )}
      >
        <div className="text-6xl font-black text-white drop-shadow leading-none">{arrow}</div>
        <div className="flex flex-col">
          <div className="text-xs uppercase tracking-[0.35em] text-white/80">Direction</div>
          <div className="text-7xl font-black tracking-tight text-white drop-shadow leading-none">
            {label}
          </div>
          <div
            className={clsx(
              "mt-2 inline-block self-start px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest",
              tierStyles[signal.tier],
            )}
          >
            {signal.tier}
          </div>
        </div>
      </div>

      {/* Confidence + confluence */}
      <div className="flex-1 grid grid-cols-3 gap-6">
        <Stat
          label="Confidence"
          value={`${signal.confidence}%`}
          accent={sideColor}
          bar={signal.confidence}
          barColor={isBuy ? "bg-bull" : isSell ? "bg-bear" : "bg-muted-foreground"}
        />
        <Stat
          label="Confluence"
          value={`${signal.confluence}/7`}
          accent="text-gold-shine"
          sub="Timeframes aligned"
        />
        <Stat
          label="Trend Strength"
          value={trendStrength.toFixed(0)}
          accent="text-gold-shine"
          bar={trendStrength}
          barColor="bg-gradient-to-r from-amber-500 to-yellow-300"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  sub,
  bar,
  barColor,
}: {
  label: string;
  value: string;
  accent: string;
  sub?: string;
  bar?: number;
  barColor?: string;
}) {
  return (
    <div className="flex flex-col justify-center">
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={clsx("text-4xl font-black tabular-nums leading-tight", accent)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">{sub}</div>}
      {bar !== undefined && (
        <div className="w-full h-1.5 bg-panel-2 rounded-full mt-2 overflow-hidden">
          <div className={clsx("h-full rounded-full", barColor)} style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </div>
      )}
    </div>
  );
}
