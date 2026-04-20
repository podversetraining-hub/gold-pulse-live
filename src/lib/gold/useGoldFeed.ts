import { useEffect, useRef, useState } from "react";
import { fetchGoldFeed } from "./feed.functions";
import { parseFeed } from "./parser";
import { buildSnapshot } from "./signal";
import type { MarketSnapshot } from "./types";

interface PriceTick {
  t: number;
  price: number;
}

export interface LiveData {
  snapshot: MarketSnapshot | null;
  history: PriceTick[];
  lastUpdate: number;
  status: "loading" | "live" | "error";
  error?: string;
}

const HISTORY_MAX = 600; // ~10 min at 1s

export function useGoldFeed(pollMs = 1000): LiveData {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [history, setHistory] = useState<PriceTick[]>([]);
  const [status, setStatus] = useState<LiveData["status"]>("loading");
  const [error, setError] = useState<string>();
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const inflightRef = useRef(false);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        const res = await fetchGoldFeed();
        if (!alive) return;
        if (!res.ok) {
          setStatus("error");
          setError(res.error);
          return;
        }
        const parsed = parseFeed(res.raw);
        if (!parsed.price) {
          setStatus("error");
          setError("No price in feed");
          return;
        }
        const snap = buildSnapshot(parsed);
        setSnapshot(snap);
        setStatus("live");
        setError(undefined);
        setLastUpdate(Date.now());
        setHistory((h) => {
          const next = [...h, { t: Date.now(), price: snap.price }];
          if (next.length > HISTORY_MAX) next.splice(0, next.length - HISTORY_MAX);
          return next;
        });
      } catch (e) {
        if (!alive) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "unknown");
      } finally {
        inflightRef.current = false;
      }
    };

    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return { snapshot, history, lastUpdate, status, error };
}
