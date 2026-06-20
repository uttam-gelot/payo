import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for golang-jwt — keyed by the `authApproach` answer value. */
export const golangJwt: TechModule = {
  id: 'golang-jwt',
  title: 'golang-jwt',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'golang-jwt',
  questions: () => [
    {
      id: 'golang-jwt.signing',
      type: 'select',
      summary: 'Signing method',
      message: 'JWT signing method?',
      options: [
        { value: 'hmac', label: 'HMAC (HS256) — shared secret', hint: 'recommended' },
        { value: 'rsa-ec', label: 'RSA/ECDSA — key pair' },
      ],
    },
  ],
  guidance: (a) => {
    const hmac = a['golang-jwt.signing'] !== 'rsa-ec';
    const lines = [
      '- Parse tokens with an explicit keyfunc that pins the expected signing method (assert `*jwt.SigningMethodHMAC`/`RSA`); reject anything else to prevent algorithm-confusion attacks.',
      hmac
        ? '- Sign with HS256 using a long, high-entropy secret loaded from env; never commit it or share it client-side.'
        : '- Sign with RS256/ES256; keep the private key server-only and distribute only the public key for verification.',
      '- Use `RegisteredClaims` with `ExpiresAt`/`IssuedAt`; validate expiry, issuer, and audience on every request via middleware.',
      '- Hash passwords with `golang.org/x/crypto/bcrypt` (or argon2) and compare with the library’s constant-time function; keep no sensitive data in the JWT payload.',
    ];
    return guidanceSection('Authentication — golang-jwt', lines);
  },
};
