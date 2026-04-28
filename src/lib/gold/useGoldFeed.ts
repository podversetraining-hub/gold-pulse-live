import { useEffect, useRef, useState } from "react";
import { getSharedFrame } from "./feed.functions";
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
  frameId: number;
}

const FETCH_WATCHDOG_MS = 6000;
const STALE_AFTER_MS = 8000;

// ────────────────────────────────────────────────────────────────────────
// Mirror hook: every browser polls the SAME centralized server endpoint
// and renders the SAME frame. No client-side signal computation happens.
// ────────────────────────────────────────────────────────────────────────
export function useGoldFeed(pollMs = 1000): LiveData {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [history, setHistory] = useState<PriceTick[]>([]);
  const [status, setStatus] = useState<LiveData["status"]>("loading");
  const [error, setError] = useState<string>();
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [frameId, setFrameId] = useState<number>(0);
  const inflightRef = useRef(false);
  const inflightStartedRef = useRef(0);
  const lastSuccessRef = useRef(0);
  const lastFrameIdRef = useRef(0);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
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
        const frame = await getSharedFrame();
        if (!alive) return;

        if (frame.snapshot) {
          // Only update React state when the server frame actually advanced —
          // this guarantees every browser renders the SAME frameId at the
          // SAME moment (true mirror behaviour).
          if (frame.frameId !== lastFrameIdRef.current) {
            lastFrameIdRef.current = frame.frameId;
            setSnapshot(frame.snapshot);
            setHistory(frame.history);
            setFrameId(frame.frameId);
            const now = Date.now();
            setLastUpdate(now);
            lastSuccessRef.current = now;
          }
          setStatus(frame.snapshot.feedAgeSec > 90 ? "stale" : "live");
          setError(frame.error);
        } else {
          if (Date.now() - lastSuccessRef.current > STALE_AFTER_MS) setStatus("stale");
          setError(frame.error ?? "Awaiting first frame");
        }
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

  return { snapshot, history, lastUpdate, status, error, frameId };
}
