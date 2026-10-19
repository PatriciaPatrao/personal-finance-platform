/** Production API base URL validation and normalization. */

export const API_BASE_URL_PLACEHOLDER = 'REPLACE_WITH_API_BASE_URL';

export function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function resolveProductionApiBaseUrl(
  url: string | undefined,
): string {
  if (url === undefined || url.trim() === '') {
    throw new Error(
      'Production API base URL is missing. Set NG_APP_API_BASE_URL when running npm run build.',
    );
  }

  const normalized = normalizeApiBaseUrl(url);
  if (
    normalized === API_BASE_URL_PLACEHOLDER
    || normalized.includes('REPLACE_WITH_API_BASE_URL')
  ) {
    throw new Error(
      'Production API base URL is still the placeholder. Set NG_APP_API_BASE_URL to your deployed API origin.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(
      `Production API base URL is invalid: ${normalized}`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      'Production API base URL must use http or https.',
    );
  }

  return normalized;
}
