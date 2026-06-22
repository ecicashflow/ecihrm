import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

export async function GET(request: NextRequest) {
  try {
    // Authenticate via session cookie (primary path).
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const userId = auth.userId!;

    // Role: allow client-side override for dual-role switching (e.g. supervisor
    // viewing as employee), but always validate against the DB role for admins.
    const { searchParams } = new URL(request.url);
    const requestedRole = searchParams.get('role');
    const dbRole = auth.role!;
    let role = requestedRole || dbRole;

    // Non-admin/management users cannot escalate to admin/management view
    if (
      (role === 'admin' || role === 'management') &&
      dbRole !== 'admin' &&
      dbRole !== 'management'
    ) {
      role = dbRole;
    }

    // Active cycles count (used by all roles)
    const activeCyclesCount = await db.appraisalCycle.count({
      where: { status: 'active' },
    });

    if (role === 'admin' || role === 'management') {
      return await getAdminManagementStats(userId, role, activeCyclesCount);
    } else if (role === 'supervisor') {
      return await getSupervisorStats(userId, activeCyclesCount);
    } else {
      return await getEmployeeStats(userId, activeCyclesCount);
    }
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getAdminManagementStats(userId: string, role: string, activeCyclesCount: number) {
  const allAssignments = await db.appraisalAssignment.findMany({
    include: {
      employee: { select: { id: true, name: true, department: true, designation: true } },
      supervisor: { select: { id: true, name: true } },
      cycle: { select: { status: true, name: true } },
      formData: { select: { overallPercentageEmployee: true, ratingEmployee: true } },
    },
  });

  const activeAssignments = allAssignments.filter((a) => a.cycle.status === 'active');
  const totalEmployees = await db.user.count({ where: { isActive: true } });

  const submittedAppraisals = activeAssignments.filter(
    (a) => a.status === 'approved' || a.status === 'shared_with_employee' || a.status === 'acknowledged_by_employee'
  ).length;
  const pendingAppraisals = activeAssignments.filter(
    (a) => a.status !== 'approved' && a.status !== 'shared_with_employee' && a.status !== 'acknowledged_by_employee' && a.status !== 'closed'
  ).length;
  const returnedCases = activeAssignments.filter(
    (a) => a.status === 'returned_for_correction'
  ).length;
  const approvedAppraisals = activeAssignments.filter(
    (a) => a.status === 'approved'
  ).length;

  const now = new Date();
  const overdueAppraisals = activeAssignments.filter(
    (a) => a.deadline && a.deadline < now && a.status !== 'approved' && a.status !== 'acknowledged_by_employee' && a.status !== 'closed'
  ).length;

  // Department progress
  const deptMap = new Map<string, { total: number; completed: number }>();
  for (const a of activeAssignments) {
    const dept = a.employee.department;
    if (!deptMap.has(dept)) deptMap.set(dept, { total: 0, completed: 0 });
    const d = deptMap.get(dept)!;
    d.total++;
    if (a.status === 'approved' || a.status === 'shared_with_employee' || a.status === 'acknowledged_by_employee') d.completed++;
  }
  const departmentProgress = Array.from(deptMap.entries()).map(([name, data]) => ({ name, total: data.total, completed: data.completed }));

  // Supervisor progress
  const supMap = new Map<string, { name: string; total: number; completed: number }>();
  for (const a of activeAssignments) {
    if (!supMap.has(a.supervisorId)) supMap.set(a.supervisorId, { name: a.supervisor.name, total: 0, completed: 0 });
    const s = supMap.get(a.supervisorId)!;
    s.total++;
    if (a.status === 'approved' || a.status === 'shared_with_employee' || a.status === 'acknowledged_by_employee') s.completed++;
  }
  const supervisorProgress = Array.from(supMap.values());

  // Rating distribution for management
  const ratingDistribution = [
    { name: 'Greatly Exceeds', value: 0, color: '#16a34a' },
    { name: 'Exceeds', value: 0, color: '#2563eb' },
    { name: 'Meets', value: 0, color: '#ca8a04' },
    { name: 'Occasionally Meets', value: 0, color: '#ea580c' },
    { name: 'Fails to Meet', value: 0, color: '#dc2626' },
  ];
  const ratedAssignments = activeAssignments.filter(
    (a) => a.formData && a.formData.overallPercentageEmployee > 0
  );
  for (const a of ratedAssignments) {
    const pct = a.formData!.overallPercentageEmployee;
    if (pct >= 86) ratingDistribution[0].value++;
    else if (pct >= 71) ratingDistribution[1].value++;
    else if (pct >= 56) ratingDistribution[2].value++;
    else if (pct >= 41) ratingDistribution[3].value++;
    else ratingDistribution[4].value++;
  }

  // Top performers & needs improvement
  const scoredAssignments = ratedAssignments
    .map((a) => ({
      name: a.employee.name,
      department: a.employee.department,
      score: a.formData!.overallPercentageEmployee,
    }))
    .sort((a, b) => b.score - a.score);

  const topPerformers = scoredAssignments.filter((s) => s.score >= 71).slice(0, 5);
  const needsImprovement = scoredAssignments.filter((s) => s.score < 56).slice(0, 5);

  // Approval queue (submitted to management)
  const approvalQueue = activeAssignments
    .filter((a) => a.status === 'submitted_to_management' || a.status === 'under_management_review')
    .map((a) => ({
      id: a.id,
      employeeName: a.employee.name,
      department: a.employee.department,
      cycleName: a.cycle.name,
      score: a.formData?.overallPercentageEmployee ?? 0,
    }));

  const pendingApproval = approvalQueue.length;

  const stats: Record<string, unknown> = {
    activeCycles: activeCyclesCount,
    totalAssigned: activeAssignments.length,
    totalEmployees,
    totalAppraisals: activeAssignments.length,
    submittedAppraisals,
    pendingAppraisals,
    overdueAppraisals,
    returnedCases,
    approvedAppraisals,
    pendingApproval,
    departmentProgress,
    supervisorProgress,
    ratingDistribution,
    topPerformers,
    needsImprovement,
    approvalQueue,
  };

  return NextResponse.json(stats);
}

async function getSupervisorStats(userId: string, activeCyclesCount: number) {
  const myAssignments = await db.appraisalAssignment.findMany({
    where: { supervisorId: userId, employeeId: { not: userId } },
    include: {
      cycle: { select: { status: true } },
      employee: { select: { id: true, name: true, department: true, designation: true } },
      formData: { select: { overallPercentageEmployee: true } },
    },
  });

  const activeAssignments = myAssignments.filter((a) => a.cycle.status === 'active');

  const totalAssigned = activeAssignments.length;
  const submittedAppraisals = activeAssignments.filter(
    (a) => a.status === 'submitted_by_supervisor' || a.status === 'approved' || a.status === 'shared_with_employee' || a.status === 'acknowledged_by_employee'
  ).length;
  const pendingAppraisals = activeAssignments.filter(
    (a) => a.status === 'submitted_by_employee' || a.status === 'under_supervisor_review'
  ).length;
  const returnedCases = activeAssignments.filter(
    (a) => a.status === 'returned_for_correction'
  ).length;
  const approvedEvaluations = activeAssignments.filter(
    (a) => a.status === 'approved' || a.status === 'shared_with_employee' || a.status === 'acknowledged_by_employee'
  ).length;

  const now = new Date();
  const overdueAppraisals = activeAssignments.filter(
    (a) => a.deadline && a.deadline < now && a.status !== 'approved' && a.status !== 'acknowledged_by_employee' && a.status !== 'closed'
  ).length;

  // Team members list with their assignment status
  const teamMembersList = activeAssignments.map((a) => ({
    id: a.employee.id,
    name: a.employee.name,
    designation: a.employee.designation,
    department: a.employee.department,
    assignmentStatus: a.status,
    assignmentId: a.id,
  }));

  // Team performance (average scores per member)
  const scoreMap = new Map<string, { name: string; total: number; count: number }>();
  for (const a of activeAssignments) {
    if (a.formData && a.formData.overallPercentageEmployee > 0) {
      if (!scoreMap.has(a.employee.id)) {
        scoreMap.set(a.employee.id, { name: a.employee.name, total: 0, count: 0 });
      }
      const entry = scoreMap.get(a.employee.id)!;
      entry.total += a.formData.overallPercentageEmployee;
      entry.count++;
    }
  }
  const teamPerformance = Array.from(scoreMap.values()).map((s) => ({
    name: s.name,
    score: Math.round(s.total / s.count),
  }));

  // My own appraisal as an employee (dual-role support)
  const myOwnAssignments = await db.appraisalAssignment.findMany({
    where: { employeeId: userId },
    include: {
      cycle: { select: { status: true, name: true, cycleType: true, periodFrom: true, periodTo: true, year: true } },
      formData: { select: { overallPercentageEmployee: true, ratingEmployee: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const myActiveAssignments = myOwnAssignments.filter((a) => a.cycle.status === 'active');
  const myPendingCount = myActiveAssignments.filter(
    (a) => a.status === 'assigned_to_employee' || a.status === 'returned_for_correction'
  ).length;
  const mySubmittedCount = myActiveAssignments.filter(
    (a) => a.status === 'submitted_by_employee' || a.status === 'submitted_by_supervisor' || a.status === 'approved' || a.status === 'shared_with_employee' || a.status === 'acknowledged_by_employee'
  ).length;

  const myCurrent = myActiveAssignments.find(
    (a) => a.status !== 'approved' && a.status !== 'acknowledged_by_employee' && a.status !== 'closed'
  );
  let myCurrentAssignment: Record<string, unknown> | null = null;
  if (myCurrent) {
    myCurrentAssignment = {
      id: myCurrent.id,
      status: myCurrent.status,
      deadline: myCurrent.deadline?.toISOString() || null,
      cycleName: myCurrent.cycle.name,
      cycleType: myCurrent.cycle.cycleType,
      periodFrom: myCurrent.cycle.periodFrom,
      periodTo: myCurrent.cycle.periodTo,
    };
  }

  const myHistory = myOwnAssignments.filter(
    (a) => a.status === 'approved' || a.status === 'shared_with_employee' || a.status === 'acknowledged_by_employee' || a.status === 'closed' || a.cycle.status === 'closed'
  );
  const myAppraisalHistory = myHistory.map((h) => ({
    id: h.id,
    cycleName: h.cycle.name,
    year: h.cycle.year,
    cycleType: h.cycle.cycleType,
    status: h.status,
    periodFrom: h.cycle.periodFrom,
    periodTo: h.cycle.periodTo,
    overallScore: h.formData?.overallPercentageEmployee ?? 0,
    rating: h.formData?.ratingEmployee ?? '',
  }));

  const stats: Record<string, unknown> = {
    activeCycles: activeCyclesCount,
    teamMembers: totalAssigned,
    pendingEvaluations: pendingAppraisals,
    submittedEvaluations: submittedAppraisals,
    approvedEvaluations,
    totalAssigned,
    submittedAppraisals,
    pendingAppraisals,
    overdueAppraisals,
    returnedCases,
    teamMembersList,
    teamPerformance,
    myAppraisal: {
      currentAssignment: myCurrentAssignment,
      pendingCount: myPendingCount,
      submittedCount: mySubmittedCount,
      history: myAppraisalHistory,
    },
  };

  return NextResponse.json(stats);
}

async function getEmployeeStats(userId: string, activeCyclesCount: number) {
  const myAssignments = await db.appraisalAssignment.findMany({
    where: { employeeId: userId },
    include: {
      cycle: { select: { status: true, name: true, cycleType: true, periodFrom: true, periodTo: true, year: true } },
      formData: { select: { overallPercentageEmployee: true, ratingEmployee: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeAssignments = myAssignments.filter((a) => a.cycle.status === 'active');

  const totalAssigned = activeAssignments.length;
  const submittedAppraisals = activeAssignments.filter(
    (a) => a.status === 'submitted_by_employee' || a.status === 'submitted_by_supervisor' || a.status === 'approved' || a.status === 'shared_with_employee' || a.status === 'acknowledged_by_employee'
  ).length;
  const pendingAppraisals = activeAssignments.filter(
    (a) => a.status === 'assigned_to_employee' || a.status === 'returned_for_correction'
  ).length;
  const returnedCases = activeAssignments.filter(
    (a) => a.status === 'returned_for_correction'
  ).length;

  // Current active assignment
  const current = activeAssignments.find(
    (a) => a.status !== 'approved' && a.status !== 'acknowledged_by_employee' && a.status !== 'closed'
  );
  let currentAssignment: Record<string, unknown> | null = null;
  if (current) {
    currentAssignment = {
      id: current.id,
      status: current.status,
      deadline: current.deadline?.toISOString() || null,
      cycleName: current.cycle.name,
      cycleType: current.cycle.cycleType,
      periodFrom: current.cycle.periodFrom,
      periodTo: current.cycle.periodTo,
    };
  }

  // Appraisal history (completed ones) with scores
  const history = myAssignments.filter(
    (a) => a.status === 'approved' || a.status === 'shared_with_employee' || a.status === 'acknowledged_by_employee' || a.status === 'closed' || a.cycle.status === 'closed'
  );
  const appraisalHistory = history.map((h) => ({
    id: h.id,
    cycleName: h.cycle.name,
    year: h.cycle.year,
    cycleType: h.cycle.cycleType,
    status: h.status,
    periodFrom: h.cycle.periodFrom,
    periodTo: h.cycle.periodTo,
    overallScore: h.formData?.overallPercentageEmployee ?? 0,
    rating: h.formData?.ratingEmployee ?? '',
  }));

  const stats: Record<string, unknown> = {
    activeCycles: activeCyclesCount,
    totalAssigned,
    submittedAppraisals,
    pendingAppraisals,
    returnedCases,
    currentAssignment,
    appraisalHistory,
  };

  return NextResponse.json(stats);
}