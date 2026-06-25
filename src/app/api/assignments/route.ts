import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const authenticatedUserId = auth.userId!;
    const authenticatedRole = auth.role!;

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get('cycleId') || undefined;
    const employeeId = searchParams.get('employeeId') || undefined;
    const supervisorId = searchParams.get('supervisorId') || undefined;
    const status = searchParams.get('status') || undefined;
    const department = searchParams.get('department') || undefined;
    const view = searchParams.get('view') || undefined;
    const managementView = searchParams.get('managementView') === 'true';
    // Use authenticated userId (cookie) for dual-role view modes
    const userId = authenticatedUserId;

    const where: Record<string, unknown> = {};

    if (cycleId) where.cycleId = cycleId;
    if (status) where.status = status;

    if (department) {
      where.employee = { department };
    }

    // View modes for dual-role users
    if (view === 'both' && userId) {
      // Return assignments where user is either employee OR supervisor (for dual-role users)
      where.OR = [
        { employeeId: userId },
        { supervisorId: userId },
        { escalatedSupervisorId: userId },
      ];
    } else if (view === 'team' && userId) {
      // Return only supervisor assignments, excluding self
      where.supervisorId = userId;
      where.employeeId = { not: userId };
    } else if (managementView && (authenticatedRole === 'management' || authenticatedRole === 'admin' || authenticatedRole === 'hr')) {
      // Management/admin/HR view: return all assignments
      // No additional user-specific filter
    } else {
      // Default behavior: apply filters individually
      if (employeeId) where.employeeId = employeeId;
      if (supervisorId) where.supervisorId = supervisorId;
    }

    const assignments = await db.appraisalAssignment.findMany({
      where,
      include: {
        employee: {
          select: { id: true, name: true, employeeId: true, designation: true, department: true },
        },
        supervisor: {
          select: { id: true, name: true, designation: true },
        },
        escalatedSupervisor: {
          select: { id: true, name: true, designation: true },
        },
        cycle: {
          select: { id: true, name: true, cycleType: true, year: true, periodFrom: true, periodTo: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('List assignments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}