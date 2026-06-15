import { describe, it, expect } from 'vitest';
import { needsImageProxy, proxiedImageUrl } from '@/lib/imageProxy';

describe('needsImageProxy', () => {
  it('proxies Instagram / Facebook CDN hosts', () => {
    expect(needsImageProxy('https://scontent-xxx.cdninstagram.com/v/a.jpg')).toBe(true);
    expect(needsImageProxy('https://instagram.fsdu40-1.fna.fbcdn.net/v/a.jpg')).toBe(true);
    expect(needsImageProxy('https://www.instagram.com/p/abc/media')).toBe(true);
  });

  it('is case-insensitive on the host', () => {
    expect(needsImageProxy('https://SCONTENT.CDNINSTAGRAM.COM/a.jpg')).toBe(true);
  });

  it('leaves non-CDN remote URLs untouched', () => {
    expect(needsImageProxy('https://example.com/a.jpg')).toBe(false);
    expect(needsImageProxy('https://images.unsplash.com/a.jpg')).toBe(false);
  });

  it('never proxies already-local / inlined / proxied URLs', () => {
    expect(needsImageProxy('data:image/png;base64,AAAA')).toBe(false);
    expect(needsImageProxy('blob:https://app/123')).toBe(false);
    expect(needsImageProxy('/api/proxy?url=x')).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(needsImageProxy('')).toBe(false);
  });

  it('does not proxy a data URL that merely mentions a CDN host in its payload', () => {
    // Guards against accidentally re-proxying inlined bytes.
    expect(needsImageProxy('data:text/plain,fbcdn.net')).toBe(false);
  });
});

describe('proxiedImageUrl', () => {
  it('rewrites CDN URLs to the same-origin proxy with the original URL encoded', () => {
    const original = 'https://scontent.cdninstagram.com/v/a.jpg?ig_cache_key=1';
    const out = proxiedImageUrl(original);
    expect(out).toBe(`/api/proxy?url=${encodeURIComponent(original)}`);
    // round-trips back to the original
    const decoded = decodeURIComponent(out.split('url=')[1]);
    expect(decoded).toBe(original);
  });

  it('returns non-CDN URLs verbatim', () => {
    expect(proxiedImageUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(proxiedImageUrl('/local.png')).toBe('/local.png');
  });
});
