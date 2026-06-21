import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-guard';

/**
 * GET /api/audit-logs
 *
 * Admin-only endpoint. Returns audit logs.
 *  - If `assignmentId` is provided → returns logs for that assignment.
 *  - Otherwise → returns all logs (most recent first, paginated).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['admin']);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const where = assignmentId ? { assignmentId } : {};

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: { name: true, role: true },
          },
          assignment: {
            select: {
              id: true,
              status: true,
              employee: { select: { name: true, employeeId: true } },
              cycle: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
