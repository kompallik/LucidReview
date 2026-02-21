import { describe, it, expect } from 'vitest';
import { sha256, sha256Buffer } from './hash.js';

describe('sha256', () => {
  it('produces correct hex for empty string', () => {
    expect(sha256('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('produces correct hex for "hello"', () => {
    expect(sha256('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });

  it('produces a 64-character hex string', () => {
    const result = sha256('test input');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(sha256('same input')).toBe(sha256('same input'));
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

describe('sha256Buffer', () => {
  it('produces correct hex for a buffer', () => {
    const buf = Buffer.from('hello', 'utf8');
    // Same content should produce same hash as string version
    expect(sha256Buffer(buf)).toBe(sha256('hello'));
  });

  it('handles empty buffer', () => {
    const buf = Buffer.alloc(0);
    expect(sha256Buffer(buf)).toBe(sha256(''));
  });

  it('handles binary data', () => {
    const buf = Buffer.from([0x00, 0xff, 0x80, 0x01]);
    const result = sha256Buffer(buf);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});
