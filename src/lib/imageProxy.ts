// Instagram serves its media from rotating CDN hostnames such as
// `instagram.fsdu40-1.fna.fbcdn.net` and `scontent-xxx.cdninstagram.com`.
// None of these reply with CORS headers, so loading them directly into a
// <canvas> / fabric image (which requires `crossOrigin='anonymous'`) throws a
// CORS error. We route every such URL through our same-origin `/api/proxy`,
// which re-serves the bytes with `Access-Control-Allow-Origin: *`.
//
// NOTE: matching on `instagram.com` alone is NOT enough — the actual image
// host is `*.fbcdn.net`, which contains neither `instagram.com` nor
// `cdninstagram.com`. Match the CDN hostnames explicitly.
const PROXY_HOST_PATTERN = /(?:instagram\.com|cdninstagram\.com|fbcdn\.net)/i;

/** True when `url` is a remote Instagram/Facebook CDN URL that must be proxied. */
export function needsImageProxy(url: string): boolean {
  if (!url) return false;
  // Already local, inlined, or proxied — leave it untouched.
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
    return false;
  }
  // Match on the *host* only. Testing the whole URL would proxy any unrelated
  // address that merely mentions a CDN domain in its path or query string
  // (e.g. `https://example.com/redirect?to=cdninstagram.com`), which is both
  // wrong and a needless SSRF surface for `/api/proxy`.
  let host: string;
  try {
    host = new URL(url, 'https://placeholder.invalid').hostname;
  } catch {
    return false;
  }
  return PROXY_HOST_PATTERN.test(host);
}

/** Returns a same-origin proxy URL for CDN images, or the original URL otherwise. */
export function proxiedImageUrl(url: string): string {
  return needsImageProxy(url) ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
}
