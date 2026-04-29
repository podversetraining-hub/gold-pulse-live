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

const EXTRA_PROXIES = [
  (u: string) => `https://proxy.cors.sh/${u}`,
  (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`,
  (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
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
  const timer = setTimeout(() => ctrl.abort(), 4500);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    let txt = await res.text();
    // allorigins /get wraps in JSON { contents: "..." }
    if (txt.startsWith("{") && txt.includes('"contents"')) {
      try {
        const j = JSON.parse(txt);
        if (typeof j.contents === "string") txt = j.contents;
      } catch {}
    }
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

// Race-first: returns the FASTEST successful proxy, others are aborted via
// AbortController inside tryFetch (their timeouts fire). This boosts
// resilience because we no longer wait for the slowest proxy.
const sourceStats: Record<string, { ok: number; fail: number; lastMs: number }> = {};

function trackSource(url: string, ok: boolean, ms: number) {
  const key = new URL(url, "http://x").host || url.slice(0, 40);
  const s = sourceStats[key] ?? { ok: 0, fail: 0, lastMs: 0 };
  if (ok) s.ok += 1; else s.fail += 1;
  s.lastMs = ms;
  sourceStats[key] = s;
}

async function fetchRawFeed(): Promise<{ ok: true; raw: string; source: string } | { ok: false; error: string }> {
  const liveUrl = withLiveQuery(FEED_URL);
  const builders = [...PROXIES, ...EXTRA_PROXIES];
  const urls = builders.map((build) => build(liveUrl));

  return await new Promise((resolve) => {
    let remaining = urls.length;
    let resolved = false;
    urls.forEach((url) => {
      const start = Date.now();
      tryFetch(url).then((raw) => {
        const ms = Date.now() - start;
        trackSource(url, !!raw, ms);
        if (resolved) return;
        if (raw) {
          resolved = true;
          resolve({ ok: true, raw, source: new URL(url, "http://x").host || url.slice(0, 40) });
        } else {
          remaining -= 1;
          if (remaining === 0 && !resolved) {
            resolved = true;
            resolve({ ok: false, error: `All ${urls.length} sources failed` });
          }
        }
      }).catch(() => {
        remaining -= 1;
        if (remaining === 0 && !resolved) {
          resolved = true;
          resolve({ ok: false, error: `All ${urls.length} sources failed` });
        }
      });
    });
  });
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
  heartbeat: number;
  source?: string;
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
    heartbeat: 0,
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
      heartbeat: sharedState.frame.heartbeat + 1,
    };
    return;
  }
  const parsed = parseFeed(res.raw);
  if (!parsed.price) {
    sharedState.frame = {
      ...sharedState.frame,
      lastError: "No price in feed",
      serverTime: now,
      heartbeat: sharedState.frame.heartbeat + 1,
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
    heartbeat: sharedState.frame.heartbeat + 1,
    source: res.source,
  };
}

async function ensureFresh(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - sharedState.lastComputeAt < REFRESH_MS && sharedState.frame.snapshot) {
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
  .inputValidator((input: unknown) => {
    const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const reqId = typeof obj.requestId === "string" ? obj.requestId : "";
    const force = obj.force === true;
    return { requestId: reqId, force };
  })
  .handler(async ({ data }) => {
    setResponseHeaders({
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    });
    try {
      await ensureFresh(data.force === true);
    } catch (e) {
      sharedState.frame = {
        ...sharedState.frame,
        lastError: e instanceof Error ? e.message : "unknown",
        serverTime: Date.now(),
      };
    }
    const sources = Object.entries(sourceStats)
      .map(([host, s]) => ({ host, ok: s.ok, fail: s.fail, lastMs: s.lastMs }))
      .sort((a, b) => b.ok - a.ok)
      .slice(0, 8);
    return {
      snapshot: sharedState.frame.snapshot,
      history: sharedState.frame.history,
      lastSuccessAt: sharedState.frame.lastSuccessAt,
      serverTime: sharedState.frame.serverTime || Date.now(),
      frameId: sharedState.frame.frameId,
      heartbeat: sharedState.frame.heartbeat,
      source: sharedState.frame.source,
      sources,
      error: sharedState.frame.lastError,
    };
  });
