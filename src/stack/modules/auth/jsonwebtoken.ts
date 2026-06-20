import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for the Rust `jsonwebtoken` crate — keyed by the `authApproach` answer value. */
export const jsonwebtoken: TechModule = {
  id: 'jsonwebtoken',
  title: 'jsonwebtoken (Rust)',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'jsonwebtoken',
  questions: () => [
    {
      id: 'jsonwebtoken.algo',
      type: 'select',
      summary: 'Algorithm',
      message: 'Signing algorithm?',
      options: [
        { value: 'hs256', label: 'HS256 — shared secret', hint: 'recommended' },
        { value: 'rs-es', label: 'RS256/ES256 — key pair' },
      ],
    },
  ],
  guidance: (a) => {
    const hmac = a['jsonwebtoken.algo'] !== 'rs-es';
    const lines = [
      '- Pin the algorithm in `Validation::new(Algorithm::…)` and validate `exp`, `iss`, and `aud`; never decode with `insecure_disable_signature_validation` outside tests.',
      hmac
        ? '- Sign with HS256 using a long secret from env loaded into `EncodingKey::from_secret`; keep it server-only.'
        : '- Sign with RS256/ES256; keep the private key server-only and verify with the public key (`DecodingKey::from_rsa_pem`/`ec_pem`).',
      '- Derive an extractor (e.g. an Axum `FromRequestParts`) that verifies the token once and yields typed claims to handlers; reject on any validation error.',
      '- Hash passwords with argon2/bcrypt crates; keep no sensitive data in claims and use short access-token lifetimes.',
    ];
    return guidanceSection('Authentication — jsonwebtoken', lines);
  },
};
