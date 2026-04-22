import { useEffect, useRef, useState } from "react";
import { fetchGoldFeed } from "./feed.functions";
import { parseFeed } from "./parser";
import { buildSnapshot, createEngineState } from "./signal";
import type { MarketSnapshot } from "./types";

interface PriceTick {
  t: number;
  price: number;
}

export interface LiveData {
  snapshot: MarketSnapshot | null;
  history: PriceTick[];
  lastUpdate: number;
  status: "loading" | "live" | "error" | "stale";
  error?: string;
}

const HISTORY_MAX = 600; // ~10 min at 1s
const FETCH_WATCHDOG_MS = 6000; // if a fetch hasn't returned in 6s, abandon and re-tick
const STALE_AFTER_MS = 8000; // mark feed stale if no successful update for 8s

export function useGoldFeed(pollMs = 1000): LiveData {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [history, setHistory] = useState<PriceTick[]>([]);
  const [status, setStatus] = useState<LiveData["status"]>("loading");
  const [error, setError] = useState<string>();
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const inflightRef = useRef(false);
  const inflightStartedRef = useRef(0);
  const engineRef = useRef(createEngineState());
  const lastSuccessRef = useRef(0);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      // Watchdog: if a request has been in-flight too long, force release.
      if (inflightRef.current) {
        if (Date.now() - inflightStartedRef.current > FETCH_WATCHDOG_MS) {
          inflightRef.current = false;
        } else {
          return;
        }
      }
      inflightRef.current = true;
      inflightStartedRef.current = Date.now();
      try {
        const res = await fetchGoldFeed();
        if (!alive) return;
        if (!res.ok) {
          // Don't immediately drop to error — keep last snapshot, just flag stale.
          if (Date.now() - lastSuccessRef.current > STALE_AFTER_MS) setStatus("stale");
          setError(res.error);
          return;
        }
        const parsed = parseFeed(res.raw);
        if (!parsed.price) {
          if (Date.now() - lastSuccessRef.current > STALE_AFTER_MS) setStatus("stale");
          setError("No price in feed");
          return;
        }
        const snap = buildSnapshot(parsed, engineRef.current);
        setSnapshot(snap);
        setStatus(snap.feedAgeSec > 90 ? "stale" : "live");
        setError(undefined);
        const now = Date.now();
        setLastUpdate(now);
        lastSuccessRef.current = now;
        setHistory((h) => {
          // Avoid pushing duplicate price for same feed timestamp.
          if (h.length && h[h.length - 1].price === snap.price && now - h[h.length - 1].t < 800) return h;
          const next = [...h, { t: now, price: snap.price }];
          if (next.length > HISTORY_MAX) next.splice(0, next.length - HISTORY_MAX);
          return next;
        });
      } catch (e) {
        if (!alive) return;
        if (Date.now() - lastSuccessRef.current > STALE_AFTER_MS) setStatus("stale");
        setError(e instanceof Error ? e.message : "unknown");
      } finally {
        inflightRef.current = false;
      }
    };

    tick();
    const id = setInterval(tick, pollMs);
    // Independent staleness checker — flips status to "stale" even when no tick fires.
    const staleCheck = setInterval(() => {
      if (!alive) return;
      if (lastSuccessRef.current && Date.now() - lastSuccessRef.current > STALE_AFTER_MS) {
        setStatus((s) => (s === "live" ? "stale" : s));
      }
    }, 1000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(staleCheck);
    };
  }, [pollMs]);

  return { snapshot, history, lastUpdate, status, error };
}
