import { createServerFn } from "@tanstack/react-start";

const FEED_URL = "http://88.99.64.228/XAUUSDm_Complete_Data.txt";

export const fetchGoldFeed = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const res = await fetch(FEED_URL, {
      headers: { "Cache-Control": "no-cache" },
      // Edge runtime fetch
    });
    if (!res.ok) {
      return { ok: false as const, error: `Feed HTTP ${res.status}`, raw: "" };
    }
    const raw = await res.text();
    return { ok: true as const, raw, fetchedAt: Date.now() };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "fetch failed", raw: "" };
  }
});
