import { clsx, fmtPrice } from "@/lib/gold/format";
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
  const sideColor = isBuy ? "text-bull" : isSell ? "text-bear" : "text-muted-foreground";
  const sideBg = isBuy ? "bg-gradient-bull pulse-bull" : isSell ? "bg-gradient-bear pulse-bear" : "bg-panel-2";

  return (
    <div className="bg-gradient-panel shadow-panel rounded-2xl border border-border/60 p-5 flex items-center gap-6">
      {/* Side badge */}
      <div className={clsx("flex flex-col items-center justify-center rounded-xl px-7 py-4 min-w-[180px] shadow-gold", sideBg)}>
        <div className="text-xs uppercase tracking-[0.3em] text-white/80">Signal</div>
        <div className="text-5xl font-black tracking-tight text-white drop-shadow">{signal.side}</div>
        <div className={clsx("mt-1 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest", tierStyles[signal.tier])}>
          {signal.tier}
        </div>
      </div>

      {/* Levels */}
      <div className="grid grid-cols-5 gap-4 flex-1">
        <Metric label="Entry" value={fmtPrice(signal.entry)} accent="text-gold" />
        <Metric label="Stop Loss" value={fmtPrice(signal.stopLoss)} accent="text-bear" />
        <Metric label="TP1" value={fmtPrice(signal.takeProfit1)} accent="text-bull" />
        <Metric label="TP2" value={fmtPrice(signal.takeProfit2)} accent="text-bull" />
        <Metric label="TP3" value={fmtPrice(signal.takeProfit3)} accent="text-bull" />
      </div>

      {/* Confidence */}
      <div className="flex flex-col items-center justify-center min-w-[160px] border-l border-border/60 pl-5">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Confidence</div>
        <div className={clsx("text-4xl font-black", sideColor)}>{signal.confidence}%</div>
        <div className="text-xs text-muted-foreground mt-1">R:R {signal.riskReward} · {signal.confluence}/7 TFs</div>
        <div className="w-full h-1.5 bg-panel-2 rounded-full mt-2 overflow-hidden">
          <div
            className={clsx("h-full rounded-full", isBuy ? "bg-bull" : isSell ? "bg-bear" : "bg-muted-foreground")}
            style={{ width: `${signal.confidence}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Trend {trendStrength.toFixed(0)}</div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-col">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={clsx("text-2xl font-bold tabular-nums leading-tight", accent)}>{value}</div>
    </div>
  );
}
