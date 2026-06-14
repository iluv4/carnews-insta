import { describe, it, expect } from 'vitest';
import { needsImageProxy, proxiedImageUrl } from '@/lib/imageProxy';

describe('needsImageProxy', () => {
  it('proxies Instagram / Facebook CDN image hosts', () => {
    expect(needsImageProxy('https://scontent-xyz.cdninstagram.com/v/t51/x.jpg')).toBe(true);
    expect(needsImageProxy('https://instagram.fsdu40-1.fna.fbcdn.net/v/x.jpg')).toBe(true);
    expect(needsImageProxy('https://www.instagram.com/p/abc/media/?size=l')).toBe(true);
  });

  it('leaves local / inlined / already-proxied URLs untouched', () => {
    expect(needsImageProxy('data:image/png;base64,AAAA')).toBe(false);
    expect(needsImageProxy('blob:https://example.com/uuid')).toBe(false);
    expect(needsImageProxy('/api/proxy?url=x')).toBe(false);
    expect(needsImageProxy('')).toBe(false);
  });

  it('leaves unrelated remote hosts untouched', () => {
    expect(needsImageProxy('https://example.com/img.jpg')).toBe(false);
    expect(needsImageProxy('https://images.unsplash.com/photo.jpg')).toBe(false);
  });

  it('matches on the host, not on arbitrary text in the path or query', () => {
    // A non-CDN host that merely *mentions* a CDN domain in its path/query
    // must NOT be proxied — only the actual host should be matched.
    expect(needsImageProxy('https://example.com/redirect?to=cdninstagram.com')).toBe(false);
    expect(needsImageProxy('https://tracker.evil.com/instagram.com/pixel.gif')).toBe(false);
  });
});

describe('proxiedImageUrl', () => {
  it('wraps CDN URLs through the same-origin proxy with encoding', () => {
    const url = 'https://scontent.cdninstagram.com/v/x.jpg?a=1&b=2';
    expect(proxiedImageUrl(url)).toBe(`/api/proxy?url=${encodeURIComponent(url)}`);
  });

  it('returns non-CDN URLs unchanged', () => {
    expect(proxiedImageUrl('https://example.com/img.jpg')).toBe('https://example.com/img.jpg');
    expect(proxiedImageUrl('/local.png')).toBe('/local.png');
  });
});
