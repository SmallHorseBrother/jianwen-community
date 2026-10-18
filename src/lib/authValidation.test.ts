import { describe, expect, it } from 'vitest';
import { isValidMainlandPhone, normalizePhone } from './authValidation';

describe('authValidation', () => {
  it('accepts 11-digit mainland mobile numbers', () => {
    expect(isValidMainlandPhone('13800138000')).toBe(true);
    expect(isValidMainlandPhone('19912345678')).toBe(true);
  });

  it('rejects malformed numbers', () => {
    expect(isValidMainlandPhone('12800138000')).toBe(false);
    expect(isValidMainlandPhone('1380013800')).toBe(false);
    expect(isValidMainlandPhone('138001380000')).toBe(false);
    expect(isValidMainlandPhone('abc')).toBe(false);
    expect(isValidMainlandPhone('')).toBe(false);
  });

  it('strips whitespace before validation', () => {
    expect(normalizePhone(' 138 0013 8000 ')).toBe('13800138000');
  });
});
