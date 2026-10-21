import { resolveAuth0Config } from './auth-environment';

export const environment = {
  production: false,
  apiBaseUrl: 'http://127.0.0.1:8000',
  auth0: resolveAuth0Config(false),
};
