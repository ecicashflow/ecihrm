import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from './db';
import { verifySession, SESSION_COOKIE_NAME } from './auth';

export interface AuthResult {
  error?: NextResponse;
  userId?: string;
  role?: string;
  user?: { id: string; name: string; role: string; isActive: boolean };
}

/**
 * Resolve the authenticated user's ID from the request.
 *
 * Primary path: httpOnly session cookie (JWT).
 * Fallback (dev/legacy): X-User-Id header or userId/createdById in JSON body.
 *   The fallback only exists to keep older clients working; the cookie path
 *   is the secure production path.
 */
async function resolveUserId(request: NextRequest): Promise<string | null> {
  // 1. Session cookie (secure path)
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const session = await verifySession(token);
      if (session?.userId) return session.userId;
    }
  } catch {
    // cookies() may throw in some edge contexts — fall through to header.
  }

  // 2. X-User-Id header (legacy/dev fallback)
  const headerUserId = request.headers.get('x-user-id');
  if (headerUserId) return headerUserId;

  // 3. userId query param (legacy/dev fallback)
  const { searchParams } = new URL(request.url);
  const paramUserId = searchParams.get('userId');
  if (paramUserId) return paramUserId;

  // 4. userId inside JSON body (legacy/dev fallback)
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const bodyClone = await request.clone().json();
      if (bodyClone.userId) return bodyClone.userId;
      if (bodyClone.createdById) return bodyClone.createdById;
    }
  } catch {
    // Body parse failed — ignore.
  }

  return null;
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<AuthResult> {
  const userId = await resolveUserId(request);

  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      ),
    };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isActive: true },
  });

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'User not found. Please log in again.' },
        { status: 401 }
      ),
    };
  }

  if (!user.isActive) {
    return {
      error: NextResponse.json(
        { error: 'Your account has been deactivated. Contact your administrator.' },
        { status: 403 }
      ),
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      error: NextResponse.json(
        { error: 'Access denied. You do not have permission to perform this action.' },
        { status: 403 }
      ),
    };
  }

  return { userId: user.id, role: user.role, user };
}

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const userId = await resolveUserId(request);

  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      ),
    };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return {
      error: NextResponse.json(
        { error: 'User not found or inactive.' },
        { status: 401 }
      ),
    };
  }

  return { userId: user.id, role: user.role, user };
}

export async function canAccessAssignment(
  request: NextRequest,
  assignmentId: string
): Promise<AuthResult & { canAccess: boolean }> {
  const auth = await requireAuth(request);
  if (auth.error) return { ...auth, canAccess: false };

  const assignment = await db.appraisalAssignment.findUnique({
    where: { id: assignmentId },
    select: { employeeId: true, supervisorId: true, escalatedSupervisorId: true },
  });

  if (!assignment) {
    return {
      ...auth,
      canAccess: false,
      error: NextResponse.json({ error: 'Assignment not found' }, { status: 404 }),
    };
  }

  const role = auth.role!;
  const userId = auth.userId!;

  if (role === 'admin' || role === 'management' || role === 'hr') {
    return { ...auth, canAccess: true };
  }

  if (role === 'supervisor') {
    const canAccess =
      assignment.supervisorId === userId ||
      assignment.escalatedSupervisorId === userId ||
      assignment.employeeId === userId;
    return { ...auth, canAccess };
  }

  const canAccess = assignment.employeeId === userId;
  return { ...auth, canAccess };
}
