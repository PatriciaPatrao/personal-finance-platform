import { resolveProductionApiBaseUrl } from './api-base-url';

declare const NG_APP_API_BASE_URL: string;

export const environment = {
  production: true,
  apiBaseUrl: resolveProductionApiBaseUrl(NG_APP_API_BASE_URL),
};
