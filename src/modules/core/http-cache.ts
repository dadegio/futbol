export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export function publicApiCacheHeaders(seconds = 30, staleSeconds = seconds * 2) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const safeStale = Math.max(0, Math.floor(staleSeconds));

  return {
    "Cache-Control": `public, max-age=0, s-maxage=${safeSeconds}, stale-while-revalidate=${safeStale}`,
  } as const;
}
