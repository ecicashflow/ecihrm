import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-guard';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: admin only
    const auth = await requireRole(request, ['admin']);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const { employeeIds, supervisorMap } = body as {
      employeeIds?: string[];
      supervisorMap?: Record<string, string>;
    };

    const cycle = await db.appraisalCycle.findUnique({ where: { id } });
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    if (cycle.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft cycles can be activated' }, { status: 400 });
    }

    const applicableDepts: string[] = JSON.parse(cycle.applicableDepts);

    // Resolve department IDs to names (User.department stores names, not IDs)
    let deptNames: string[] = [];
    if (applicableDepts.length > 0) {
      const deptRecords = await db.department.findMany({
        where: { id: { in: applicableDepts } },
        select: { name: true },
      });
      deptNames = deptRecords.map((d) => d.name);
      // Also include entries that are already names (not CUIDs)
      for (const d of applicableDepts) {
        if (!d.startsWith('c') || d.length < 20) {
          deptNames.push(d);
        }
      }
      deptNames = [...new Set(deptNames)];
    }

    // Build where clause
    const whereClause: Record<string, unknown> = { isActive: true };
    if (deptNames.length > 0 && !employeeIds?.length) {
      whereClause.department = { in: deptNames };
    }
    if (employeeIds && employeeIds.length > 0) {
      whereClause.id = { in: employeeIds };
    }

    const allActiveUsers = await db.user.findMany({
      where: whereClause,
      include: {
        lineManager: {
          select: { id: true, name: true },
        },
      },
    });

    // Filter: only include users who were explicitly in employeeIds OR have a lineManagerId
    const employees = allActiveUsers.filter((emp) => {
      if (employeeIds && employeeIds.length > 0 && employeeIds.includes(emp.id)) {
        return true;
      }
      return !!emp.lineManagerId;
    });

    if (employees.length === 0) {
      return NextResponse.json({ error: 'No eligible employees found for this cycle' }, { status: 400 });
    }

    // Get potential supervisors
    const supervisors = await db.user.findMany({
      where: {
        OR: [
          { role: { in: ['supervisor', 'management', 'admin'] } },
          { isSupervisor: true },
        ],
        isActive: true,
      },
      select: { id: true, name: true, department: true },
    });

    // Get admin/HR users for escalation fallback
    const adminUsers = await db.user.findMany({
      where: { role: { in: ['admin', 'management'] }, isActive: true },
      select: { id: true },
    });

    // Resolve supervisor for an employee
    function resolveSupervisor(emp: typeof employees[0]): string | undefined {
      // 1. Use supervisorMap if provided (explicit assignment from form)
      if (supervisorMap && supervisorMap[emp.id]) {
        const mappedId = supervisorMap[emp.id];
        if (mappedId !== emp.id) return mappedId;
      }
      // 2. Use lineManagerId
      if (emp.lineManagerId && emp.lineManagerId !== emp.id) {
        return emp.lineManagerId;
      }
      // 3. Same department supervisor
      const sameDeptSup = supervisors.find(
        (s) => s.department === emp.department && s.id !== emp.id
      );
      if (sameDeptSup) return sameDeptSup.id;
      // 4. Any supervisor
      const anySup = supervisors.find((s) => s.id !== emp.id);
      if (anySup) return anySup.id;
      return undefined;
    }

    // Find escalation supervisor (for self-review prevention)
    function findEscalationSupervisor(emp: typeof employees[0]): string | undefined {
      if (emp.lineManagerId && emp.lineManagerId !== emp.id) return emp.lineManagerId;
      const fallback = adminUsers.find((a) => a.id !== emp.id);
      if (fallback) return fallback.id;
      const anySup = supervisors.find((s) => s.id !== emp.id);
      if (anySup) return anySup.id;
      return undefined;
    }

    // Create assignments
    const assignmentData: { cycleId: string; employeeId: string; supervisorId: string; escalatedSupervisorId?: string; status: string; currentActionBy: string; deadline: Date }[] = [];

    for (const emp of employees) {
      let supervisorId = resolveSupervisor(emp);
      if (!supervisorId) continue;

      if (supervisorId === emp.id) {
        const escalationId = findEscalationSupervisor(emp);
        if (!escalationId) continue;
        supervisorId = escalationId;
        assignmentData.push({
          cycleId: id, employeeId: emp.id, supervisorId,
          escalatedSupervisorId: escalationId,
          status: 'assigned_to_employee', currentActionBy: 'employee',
          deadline: cycle.submissionDeadline,
        });
      } else {
        assignmentData.push({
          cycleId: id, employeeId: emp.id, supervisorId,
          status: 'assigned_to_employee', currentActionBy: 'employee',
          deadline: cycle.submissionDeadline,
        });
      }
    }

    if (assignmentData.length === 0) {
      return NextResponse.json({ error: 'No valid assignments could be created. Ensure employees have line managers or supervisors are assigned.' }, { status: 400 });
    }

    await db.appraisalAssignment.createMany({ data: assignmentData });

    // Create notifications
    const createdAssignments = await db.appraisalAssignment.findMany({
      where: { cycleId: id },
      include: { employee: true, supervisor: true },
    });

    const notificationData: { userId: string; assignmentId: string; type: string; title: string; message: string; actionRequired: boolean; link: string }[] = [];
    for (const a of createdAssignments) {
      notificationData.push({
        userId: a.employeeId, assignmentId: a.id, type: 'form_assigned',
        title: 'New Appraisal Assigned',
        message: `You have been assigned a new appraisal: ${cycle.name}. Please complete your self-evaluation by ${cycle.submissionDeadline.toLocaleDateString()}.`,
        actionRequired: true, link: `/appraisal/${a.id}`,
      });
      notificationData.push({
        userId: a.supervisorId, assignmentId: a.id, type: 'cycle_activated',
        title: 'New Team Appraisal to Review',
        message: `${a.employee.name} has been assigned an appraisal for cycle "${cycle.name}".`,
        actionRequired: false, link: `/appraisal/${a.id}`,
      });
    }
    await db.notification.createMany({ data: notificationData });

    await db.appraisalCycle.update({ where: { id }, data: { status: 'active' } });

    return NextResponse.json({
      message: 'Cycle activated successfully',
      assignmentsCreated: assignmentData.length,
    });
  } catch (error) {
    console.error('Activate cycle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}