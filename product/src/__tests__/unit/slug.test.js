import { generateSlug } from '../../utils/slug.js';

describe('Slug Generator Utility', () => {
  it('converts title to lowercase hyphenated slug', () => {
    expect(generateSlug('Wireless Bluetooth Headphones')).toBe('wireless-bluetooth-headphones');
  });

  it('removes special characters and punctuation', () => {
    expect(generateSlug('Apple MacBook Pro 16"! #1 Best-Seller?')).toBe('apple-macbook-pro-16-1-best-seller');
  });

  it('trims leading and trailing hyphens and spaces', () => {
    expect(generateSlug('   ---Sony WH-1000XM5---   ')).toBe('sony-wh-1000xm5');
  });

  it('handles multiple consecutive whitespace and underscores', () => {
    expect(generateSlug('Gaming    Laptop___RGB__Pro')).toBe('gaming-laptop-rgb-pro');
  });

  it('returns empty string for null, undefined, or non-string input', () => {
    expect(generateSlug(null)).toBe('');
    expect(generateSlug(undefined)).toBe('');
    expect(generateSlug(12345)).toBe('');
  });
});
