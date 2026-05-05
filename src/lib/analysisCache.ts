// In-memory analysis cache keyed by Instagram URL
// Survives requests, cleared on server restart (fine for dev/single-process)

const cache = new Map<string, string>();

export function getCachedAnalysis(key: string): string | undefined {
  return cache.get(normalise(key));
}

export function setCachedAnalysis(key: string, analysis: string): void {
  cache.set(normalise(key), analysis);
}

function normalise(url: string): string {
  // Strip trailing slash / query params so variants of the same URL hit the same entry
  return url.trim().replace(/\/+$/, '').split('?')[0].toLowerCase();
}
