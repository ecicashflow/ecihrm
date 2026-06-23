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
 * Primary path: httpOnly session cookie (JWT) — this is the secure production path.
 *
 * IMPORTANT: We do NOT read the request body here. Reading the body stream
 * (even via clone()) can consume it in some Next.js runtime contexts, causing
 * the actual route handler's request.json() to fail with "Body is not usable".
 * This was the root cause of the "authentication required" error for admin
 * actions that send a JSON body (create cycle, edit employee, etc.).
 */
async function resolveUserId(request: NextRequest): Promise<string | null> {
  // 1. Session cookie (secure path — primary)
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

  // 2. X-User-Id header (legacy/dev fallback — does not consume body)
  const headerUserId = request.headers.get('x-user-id');
  if (headerUserId) return headerUserId;

  // 3. userId query param (legacy/dev fallback — does not consume body)
  const { searchParams } = new URL(request.url);
  const paramUserId = searchParams.get('userId');
  if (paramUserId) return paramUserId;

  // NOTE: We intentionally do NOT read the JSON body for userId/createdById.
  // Reading the body here breaks the route handler's ability to read it later.

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

  // Admin has access to everything — always allowed
  if (user.role === 'admin') {
    return { userId: user.id, role: user.role, user };
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
    select: { employeeId: true, supervisorId: true, escalatedSupervisorId: true, hrReviewerId: true, managementReviewerId: true, ceoApproverId: true },
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

  // Admin has access to everything
  if (role === 'admin') {
    return { ...auth, canAccess: true };
  }

  // Check if user is involved in this assignment
  const isEmployee = assignment.employeeId === userId;
  const isSupervisor = assignment.supervisorId === userId || assignment.escalatedSupervisorId === userId;
  const isHR = assignment.hrReviewerId === userId || role === 'hr';
  const isManagement = assignment.managementReviewerId === userId || role === 'management';
  const isCEO = assignment.ceoApproverId === userId || role === 'management'; // CEO is often management role

  const canAccess = isEmployee || isSupervisor || isHR || isManagement || isCEO;
  return { ...auth, canAccess };
}
