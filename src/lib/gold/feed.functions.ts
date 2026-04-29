import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { parseFeed } from "./parser";
import { buildSnapshot, createEngineState, type SignalEngineState } from "./signal";
import type { MarketSnapshot } from "./types";

const FEED_URL = "http://88.99.64.228/XAUUSDm_Complete_Data.txt";

const PROXIES = [
  (u: string) => u,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u: string) => `https://r.jina.ai/${u}`,
];

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/plain,*/*;q=0.9",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

async function tryFetch(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const txt = await res.text();
    if (txt.includes("XAUUSDm") && txt.includes("Timeframe")) return txt;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function withLiveQuery(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}ts=${Date.now()}`;
}

async function fetchRawFeed(): Promise<{ ok: true; raw: string } | { ok: false; error: string }> {
  const liveUrl = withLiveQuery(FEED_URL);
  const urls = PROXIES.map((build) => build(liveUrl));
  const results = await Promise.all(urls.map(async (url) => ({ url, raw: await tryFetch(url) })));
  const hit = results.find((result) => result.raw);
  if (hit?.raw) return { ok: true, raw: hit.raw };
  const errors = urls.map((url) => url.slice(0, 60));
  return { ok: false, error: `All sources failed: ${errors.join(" | ")}` };
}

// ────────────────────────────────────────────────────────────────────────
// Centralized server-side state — every browser sees the SAME frame.
// All client polls hit this single source. The snapshot is recomputed at
// most once per REFRESH_MS; in-between calls return the cached frame.
// ────────────────────────────────────────────────────────────────────────

interface PriceTick {
  t: number;
  price: number;
}

interface SharedFrame {
  snapshot: MarketSnapshot | null;
  history: PriceTick[];
  lastSuccessAt: number;
  lastError?: string;
  serverTime: number;
  frameId: number;
}

const REFRESH_MS = 1000; // recompute at most once per second
const HISTORY_MAX = 600;

const sharedState: {
  engine: SignalEngineState;
  frame: SharedFrame;
  lastComputeAt: number;
  inflight: Promise<void> | null;
} = {
  engine: createEngineState(),
  frame: {
    snapshot: null,
    history: [],
    lastSuccessAt: 0,
    serverTime: 0,
    frameId: 0,
  },
  lastComputeAt: 0,
  inflight: null,
};

async function recompute(): Promise<void> {
  const res = await fetchRawFeed();
  const now = Date.now();
  if (!res.ok) {
    sharedState.frame = {
      ...sharedState.frame,
      lastError: res.error,
      serverTime: now,
    };
    return;
  }
  const parsed = parseFeed(res.raw);
  if (!parsed.price) {
    sharedState.frame = {
      ...sharedState.frame,
      lastError: "No price in feed",
      serverTime: now,
    };
    return;
  }
  const snap = buildSnapshot(parsed, sharedState.engine);

  const history = sharedState.frame.history.slice();
  const last = history[history.length - 1];
  if (!last || last.price !== snap.price || now - last.t >= 800) {
    history.push({ t: now, price: snap.price });
    if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX);
  }

  sharedState.frame = {
    snapshot: snap,
    history,
    lastSuccessAt: now,
    lastError: undefined,
    serverTime: now,
    frameId: sharedState.frame.frameId + 1,
  };
}

async function ensureFresh(): Promise<void> {
  const now = Date.now();
  if (now - sharedState.lastComputeAt < REFRESH_MS && sharedState.frame.snapshot) {
    return;
  }
  if (sharedState.inflight) {
    await sharedState.inflight;
    return;
  }
  sharedState.lastComputeAt = now;
  sharedState.inflight = recompute().finally(() => {
    sharedState.inflight = null;
  });
  await sharedState.inflight;
}

export const getSharedFrame = createServerFn({ method: "GET" })
  .inputValidator((input: { requestId?: string } | undefined) => ({ requestId: input?.requestId ?? "" }))
  .handler(async () => {
    setResponseHeaders({
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    });
    try {
      await ensureFresh();
    } catch (e) {
      sharedState.frame = {
        ...sharedState.frame,
        lastError: e instanceof Error ? e.message : "unknown",
        serverTime: Date.now(),
      };
    }
    return {
      snapshot: sharedState.frame.snapshot,
      history: sharedState.frame.history,
      lastSuccessAt: sharedState.frame.lastSuccessAt,
      serverTime: sharedState.frame.serverTime || Date.now(),
      frameId: sharedState.frame.frameId,
      error: sharedState.frame.lastError,
    };
  });
