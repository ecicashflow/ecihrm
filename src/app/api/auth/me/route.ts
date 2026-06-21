import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth';

/**
 * GET /api/auth/me
 * Returns the currently authenticated user (or 401 if not logged in).
 * Used by the frontend to restore the session on page refresh.
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(null, { status: 401 });
    }

    const session = await verifySession(token);
    if (!session) {
      return NextResponse.json(null, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: {
        lineManager: {
          select: { id: true, name: true, designation: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(null, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      employeeId: user.employeeId,
      designation: user.designation,
      department: user.department,
      phone: user.phone,
      overallExp: user.overallExp,
      yearsWithECI: user.yearsWithECI,
      currentEdu: user.currentEdu,
      role: user.role,
      isActive: user.isActive,
      isSupervisor: user.isSupervisor,
      lineManagerId: user.lineManagerId,
      lineManager: user.lineManager,
    });
  } catch (error) {
    console.error('Auth/me error:', error);
    return NextResponse.json(null, { status: 401 });
  }
}
