import { describe, expect, it } from 'vitest';

import { APP_TITLE, pageTitle } from './app-page-titles';

describe('app-page-titles', () => {
  it('should expose the product title', () => {
    expect(APP_TITLE).toBe('Personal Finance Platform');
  });

  it('should build screen-specific document titles', () => {
    expect(pageTitle('Dashboard')).toBe('Dashboard — Personal Finance Platform');
    expect(pageTitle('Analysis')).toBe('Analysis — Personal Finance Platform');
  });
});
