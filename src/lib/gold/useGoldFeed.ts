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
const FRAME_STALL_MS = 12000;
const MAX_BACKOFF_MS = 5000;

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
  const lastFrameAtRef = useRef(0);
  const lastFrameIdRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const attemptRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const clearTimer = () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };

    const schedule = (delay = pollMs) => {
      if (!alive) return;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        void tick();
      }, delay);
    };

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
        const frame = await getSharedFrame({ data: { requestId: `${Date.now()}-${attemptRef.current}` } });
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
            lastFrameAtRef.current = now;
          }
          attemptRef.current = 0;
          setStatus(frame.snapshot.feedAgeSec > 90 ? "stale" : "live");
          setError(frame.error);
        } else {
          attemptRef.current += 1;
          if (Date.now() - lastSuccessRef.current > STALE_AFTER_MS) setStatus("stale");
          setError(frame.error ?? "Awaiting first frame");
        }
      } catch (e) {
        if (!alive) return;
        attemptRef.current += 1;
        if (Date.now() - lastSuccessRef.current > STALE_AFTER_MS) setStatus("stale");
        setError(e instanceof Error ? e.message : "unknown");
      } finally {
        inflightRef.current = false;
        const backoff = Math.min(MAX_BACKOFF_MS, pollMs + attemptRef.current * 750);
        schedule(attemptRef.current ? backoff : pollMs);
      }
    };

    const recover = () => {
      if (!alive) return;
      inflightRef.current = false;
      clearTimer();
      void tick();
    };

    void tick();
    const staleCheck = setInterval(() => {
      if (!alive) return;
      if (lastSuccessRef.current && Date.now() - lastSuccessRef.current > STALE_AFTER_MS) {
        setStatus((s) => (s === "live" ? "stale" : s));
      }
      if (lastFrameAtRef.current && Date.now() - lastFrameAtRef.current > FRAME_STALL_MS) {
        recover();
      }
    }, 1000);
    window.addEventListener("focus", recover);
    window.addEventListener("online", recover);
    window.addEventListener("pageshow", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      alive = false;
      clearTimer();
      clearInterval(staleCheck);
      window.removeEventListener("focus", recover);
      window.removeEventListener("online", recover);
      window.removeEventListener("pageshow", recover);
      document.removeEventListener("visibilitychange", recover);
    };
  }, [pollMs]);

  return { snapshot, history, lastUpdate, status, error, frameId };
}
