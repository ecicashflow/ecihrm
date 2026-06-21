/**
 * src/lib/auth.ts
 *
 * JWT-based session management for ECI HRM.
 *
 * - Uses `jose` for JWT sign/verify (Edge-compatible, works on Vercel).
 * - Sessions are stored in an httpOnly cookie named `eci_session`.
 * - Session lifetime: 7 days (sliding — re-issued on each successful auth check).
 * - The JWT payload contains: { userId, email, role }.
 *
 * The server ALWAYS re-validates the user against the database on each
 * protected request (see src/lib/auth-guard.ts). The JWT only proves the
 * client was authenticated at some point in the last 7 days.
 */

import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE_NAME = 'eci_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

const JWT_ALG = 'HS256';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET environment variable is required in production. ' +
          'Generate one with: openssl rand -base64 32'
      );
    }
    // Dev-only fallback — never use in production.
    return new TextEncoder().encode('dev-secret-change-me-in-production');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Sign a new session JWT.
 */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .setIssuer('eci-hrm')
    .setAudience('eci-hrm-users')
    .sign(getSecret());
}

/**
 * Verify a session JWT. Returns null if invalid/expired.
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: 'eci-hrm',
      audience: 'eci-hrm-users',
    });
    if (
      typeof payload.userId === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.role === 'string'
    ) {
      return { userId: payload.userId, email: payload.email, role: payload.role };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Cookie options for the session cookie. Use these when setting/clearing.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
