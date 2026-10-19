import { describe, expect, it } from 'vitest';

import {
  API_BASE_URL_PLACEHOLDER,
  normalizeApiBaseUrl,
  resolveProductionApiBaseUrl,
} from './api-base-url';

describe('api-base-url', () => {
  it('should normalize trailing slashes', () => {
    expect(normalizeApiBaseUrl('https://api.example.com/')).toBe(
      'https://api.example.com',
    );
  });

  it('should reject the documentation placeholder', () => {
    expect(() =>
      resolveProductionApiBaseUrl(API_BASE_URL_PLACEHOLDER),
    ).toThrow(/placeholder/i);
  });

  it('should reject a missing production URL', () => {
    expect(() => resolveProductionApiBaseUrl(undefined)).toThrow(
      /missing/i,
    );
  });

  it('should accept a valid https API origin', () => {
    expect(
      resolveProductionApiBaseUrl('https://api.example.com'),
    ).toBe('https://api.example.com');
  });
});
