import { createServerFn } from "@tanstack/react-start";

const FEED_URL = "http://88.99.64.228/XAUUSDm_Complete_Data.txt";

// The origin host blocks some datacenter IPs (Cloudflare Workers) with 403.
// We try direct first, then fall back through public CORS/HTTP proxies.
const PROXIES = [
  (u: string) => u, // direct
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
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const txt = await res.text();
    // Sanity check: real feed mentions XAUUSDm + Timeframe
    if (txt.includes("XAUUSDm") && txt.includes("Timeframe")) return txt;
    return null;
  } catch {
    return null;
  }
}

export const fetchGoldFeed = createServerFn({ method: "GET" }).handler(async () => {
  const errors: string[] = [];
  for (const build of PROXIES) {
    const url = build(FEED_URL);
    const raw = await tryFetch(url);
    if (raw) {
      return { ok: true as const, raw, fetchedAt: Date.now(), via: url };
    }
    errors.push(url.slice(0, 60));
  }
  return {
    ok: false as const,
    error: `All sources failed: ${errors.join(" | ")}`,
    raw: "",
  };
});
