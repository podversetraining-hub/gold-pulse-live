import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
  CrosshairMode,
} from "lightweight-charts";
import type { MarketSnapshot } from "@/lib/gold/types";

interface Props {
  history: { t: number; price: number }[];
  snapshot: MarketSnapshot | null;
}

export function PriceChart({ history, snapshot }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineRef = useRef<ISeriesApi<"Area"> | null>(null);
  const priceLinesRef = useRef<ReturnType<ISeriesApi<"Area">["createPriceLine"]>[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "rgba(0,0,0,0)" },
        textColor: "#d6c79a",
        fontSize: 14,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(232,191,99,0.4)", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "rgba(232,191,99,0.4)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#b88a2c" },
      },
      handleScroll: false,
      handleScale: false,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const line = chart.addAreaSeries({
      lineColor: "#f0c87a",
      topColor: "rgba(240,200,122,0.45)",
      bottomColor: "rgba(240,200,122,0.02)",
      lineWidth: 3,
      priceLineColor: "#f6d68a",
      priceLineWidth: 2,
      priceLineStyle: LineStyle.Solid,
      lastValueVisible: true,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    chartRef.current = chart;
    lineRef.current = line;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      lineRef.current = null;
    };
  }, []);

  // Push history into series
  useEffect(() => {
    if (!lineRef.current || history.length === 0) return;
    const data: LineData[] = history.map((h) => ({
      time: Math.floor(h.t / 1000) as UTCTimestamp,
      value: h.price,
    }));
    // Deduplicate timestamps
    const seen = new Set<number>();
    const dedup = data.filter((d) => {
      const t = d.time as number;
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
    lineRef.current.setData(dedup);
    chartRef.current?.timeScale().scrollToRealTime();
  }, [history]);

  // Overlay key levels
  useEffect(() => {
    const series = lineRef.current;
    if (!series || !snapshot) return;
    for (const pl of priceLinesRef.current) {
      try { series.removePriceLine(pl); } catch { /* ignore */ }
    }
    priceLinesRef.current = [];

    const add = (price: number, color: string, title: string, style: LineStyle = LineStyle.Solid, width: 1 | 2 | 3 | 4 = 2) => {
      const pl = series.createPriceLine({ price, color, lineWidth: width, lineStyle: style, axisLabelVisible: true, title });
      priceLinesRef.current.push(pl);
    };
    // Only show pivot/structural levels — no entry / SL / TP
    const m15 = snapshot.byTf.M15;
    if (m15?.r1) add(m15.r1, "rgba(239,68,68,0.55)", "R1", LineStyle.Dotted, 1);
    if (m15?.s1) add(m15.s1, "rgba(34,197,94,0.55)", "S1", LineStyle.Dotted, 1);
    if (m15?.pivot) add(m15.pivot, "rgba(232,191,99,0.5)", "Pivot", LineStyle.Dotted, 1);
  }, [snapshot]);

  return <div ref={containerRef} className="w-full h-full" />;
}
