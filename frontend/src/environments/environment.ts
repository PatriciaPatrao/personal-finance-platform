import { resolveProductionApiBaseUrl } from './api-base-url';
import { resolveAuth0Config } from './auth-environment';

declare const NG_APP_API_BASE_URL: string;

export const environment = {
  production: true,
  apiBaseUrl: resolveProductionApiBaseUrl(NG_APP_API_BASE_URL),
  auth0: resolveAuth0Config(true),
};
