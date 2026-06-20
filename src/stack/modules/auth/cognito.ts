import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for AWS Cognito — hosted provider, keyed by the `authApproach` answer value. */
export const cognito: TechModule = {
  id: 'cognito',
  title: 'AWS Cognito',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'cognito',
  questions: () => [
    {
      id: 'cognito.client',
      type: 'select',
      summary: 'Integration',
      message: 'How does the app talk to Cognito?',
      options: [
        { value: 'hosted-ui', label: 'Hosted UI / OAuth (Amplify or OIDC)', hint: 'recommended' },
        { value: 'sdk-srp', label: 'Direct SDK (SRP auth flow)' },
      ],
    },
  ],
  guidance: (a) => {
    const hosted = a['cognito.client'] !== 'sdk-srp';
    const lines = [
      hosted
        ? '- Use the Cognito Hosted UI / OIDC flow (via Amplify or a standard OIDC client); let Cognito own the login screens rather than collecting passwords yourself.'
        : '- Use the Cognito SDK with the SRP flow so raw passwords never traverse your servers; never log or persist them.',
      '- Validate the JWT (ID/access token) against the User Pool JWKS — check issuer, audience/client id, `token_use`, and expiry — on every protected request.',
      '- Keep the User Pool id, client id, region, and any client secret in env/SSM; secrets stay server-side.',
      '- Authorize from Cognito groups/scopes read out of the verified token, not from client-supplied values.',
    ];
    return guidanceSection('Authentication — AWS Cognito', lines);
  },
};
