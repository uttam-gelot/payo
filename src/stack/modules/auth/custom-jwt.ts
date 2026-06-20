import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for custom JWT / session auth — keyed by the `authApproach` answer value. */
export const customJwt: TechModule = {
  id: 'custom-jwt',
  title: 'Custom JWT / Sessions',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'custom-jwt',
  questions: () => [
    {
      id: 'custom-jwt.refresh',
      type: 'confirm',
      summary: 'Refresh tokens',
      message: 'Use refresh tokens (short access token + rotating refresh)?',
      recommended: true,
    },
  ],
  guidance: (a) => {
    const lines = [
      '- Hash passwords with argon2id/bcrypt and a per-user salt; verify with a constant-time compare and never log credentials.',
      '- Sign JWTs with a strong server-only secret/keypair and an explicit algorithm; verify signature, issuer, audience, and expiry on every request — never accept `alg: none`.',
      '- Keep access-token lifetimes short and store no sensitive data in the payload; deliver tokens in httpOnly + SameSite + Secure cookies rather than localStorage where possible.',
      '- Enforce authorization server-side from verified claims; treat the client as untrusted.',
    ];
    if (a['custom-jwt.refresh'] === true)
      lines.push(
        '- Issue a short-lived access token plus a rotating refresh token stored server-side (hashed); revoke the family on reuse detection and on logout.',
      );
    else
      lines.push(
        '- Without refresh tokens, keep a server-side revocation list (or short expiry + re-login) so logout and compromise are enforceable.',
      );
    return guidanceSection('Authentication — Custom JWT / Sessions', lines);
  },
};
