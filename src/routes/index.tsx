import { createFileRoute } from "@tanstack/react-router";
import { useGoldFeed } from "@/lib/gold/useGoldFeed";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { SignalBanner } from "@/components/dashboard/SignalBanner";
import { TimeframeRail } from "@/components/dashboard/TimeframeRail";
import { ConfluenceStack } from "@/components/dashboard/ConfluenceStack";
import { KeyLevels } from "@/components/dashboard/KeyLevels";
import { StatusFooter } from "@/components/dashboard/StatusFooter";
import { PriceHeader } from "@/components/dashboard/PriceHeader";
import { ReasoningPanel } from "@/components/dashboard/ReasoningPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GOLD XAUUSD · 24/7 Live AI Signal Stream" },
      { name: "description", content: "Live gold (XAUUSD) signals, multi-timeframe confluence, institutional levels, 24/7 stream-ready dashboard." },
      { property: "og:title", content: "GOLD XAUUSD · 24/7 Live AI Signal Stream" },
      { property: "og:description", content: "Real-time gold analysis with 80+ indicators across 7 timeframes. Pro signal engine with entry, SL, TP." },
    ],
  }),
  component: LiveDashboard,
});

function LiveDashboard() {
  const { snapshot, history, status, error } = useGoldFeed(1000);

  return (
    <div className="w-screen h-screen overflow-hidden text-foreground relative">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-60" />

      {/* 1920x1080 canvas — but fluid so it also works on mobile reflow */}
      <div className="relative w-full h-full flex flex-col">
        {snapshot ? (
          <>
            <PriceHeader snapshot={snapshot} history={history} />

            <div className="flex-1 grid gap-3 p-3 min-h-0" style={{ gridTemplateColumns: "320px 1fr 360px", gridTemplateRows: "auto 1fr auto" }}>
              {/* Top row: signal banner spans all 3 columns */}
              <div className="col-span-3">
                <SignalBanner signal={snapshot.signal} trendStrength={snapshot.trendStrength} />
              </div>

              {/* Middle row */}
              <div className="min-h-0 flex flex-col gap-3">
                <TimeframeRail biases={snapshot.biases} />
                <ReasoningPanel snapshot={snapshot} />
              </div>

              <div className="min-h-0 bg-gradient-panel shadow-panel rounded-2xl border border-border/60 overflow-hidden relative">
                <div className="absolute top-3 left-4 z-10 text-xs uppercase tracking-[0.3em] text-muted-foreground font-bold">
                  XAUUSD · Live · 1s candles
                </div>
                <div className="absolute top-3 right-4 z-10 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-gold-shine font-bold">
                  <span className="inline-block w-2 h-2 rounded-full bg-bull live-dot" />
                  Streaming
                </div>
                <PriceChart history={history} snapshot={snapshot} />
              </div>

              <div className="min-h-0 flex flex-col gap-3">
                <ConfluenceStack snapshot={snapshot} />
                <KeyLevels snapshot={snapshot} />
              </div>
            </div>

            <StatusFooter snapshot={snapshot} history={history} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-gold shadow-gold flex items-center justify-center text-background font-black text-4xl pulse-gold">
              Au
            </div>
            <div className="text-2xl font-black text-gold-shine uppercase tracking-[0.3em]">
              {status === "error" ? "Connecting to feed…" : "Loading XAUUSD live feed…"}
            </div>
            {error && <div className="text-sm text-bear">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
