import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' });
  // Clear the session cookie by setting maxAge to 0
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
