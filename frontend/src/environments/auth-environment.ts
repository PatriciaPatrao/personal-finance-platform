/** Public Auth0 SPA settings (no secrets). */

export interface Auth0PublicConfig {
  domain: string;
  clientId: string;
  audience: string;
}

const devDefaults: Auth0PublicConfig = {
  domain: 'YOUR_TENANT.auth0.com',
  clientId: 'YOUR_SPA_CLIENT_ID',
  audience: 'https://api.personal-finance',
};

export function resolveAuth0Config(
  production: boolean,
): Auth0PublicConfig {
  if (production) {
    const domain = NG_APP_AUTH0_DOMAIN?.trim();
    const clientId = NG_APP_AUTH0_CLIENT_ID?.trim();
    const audience = NG_APP_AUTH0_AUDIENCE?.trim();
    if (!domain || !clientId || !audience) {
      throw new Error(
        'Production builds require NG_APP_AUTH0_DOMAIN, ' +
          'NG_APP_AUTH0_CLIENT_ID, and NG_APP_AUTH0_AUDIENCE.',
      );
    }
    return { domain, clientId, audience };
  }
  return devDefaults;
}
