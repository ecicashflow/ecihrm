import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'json';
    const cycleId = searchParams.get('cycleId');
    const departmentId = searchParams.get('departmentId');

    if (!cycleId) {
      return NextResponse.json({ error: 'cycleId is required' }, { status: 400 });
    }

    const cycle = await db.appraisalCycle.findUnique({
      where: { id: cycleId },
    });

    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    const whereClause: Record<string, unknown> = { cycleId };
    if (departmentId) {
      whereClause.employee = { department: departmentId };
    }

    const assignments = await db.appraisalAssignment.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { name: true, employeeId: true, designation: true, department: true },
        },
        supervisor: {
          select: { name: true, designation: true },
        },
        formData: true,
      },
      orderBy: { employee: { name: 'asc' } },
    });

    // Build export data
    const exportData = {
      cycle: {
        name: cycle.name,
        cycleType: cycle.cycleType,
        year: cycle.year,
        periodFrom: cycle.periodFrom,
        periodTo: cycle.periodTo,
        status: cycle.status,
      },
      generatedAt: new Date().toISOString(),
      type,
      totalRecords: assignments.length,
      records: assignments.map((a) => {
        const fd = a.formData;
        return {
          employeeName: a.employee.name,
          employeeId: a.employee.employeeId,
          designation: a.employee.designation,
          department: a.employee.department,
          supervisorName: a.supervisor.name,
          supervisorDesignation: a.supervisor.designation,
          status: a.status,
          ...(fd ? {
            employeeScore: fd.overallPercentageEmployee,
            employeeRating: fd.ratingEmployee,
            supervisorScore: fd.overallPercentageSupervisor,
            supervisorRating: fd.ratingSupervisor,
            submittedByEmployeeAt: fd.submittedByEmployeeAt,
            submittedBySupervisorAt: fd.submittedBySupervisorAt,
            approvedByManagementAt: fd.approvedByManagementAt,
          } : {}),
        };
      }),
    };

    if (type === 'excel' || type === 'pdf') {
      // Return JSON data that frontend can use for export
      return NextResponse.json(exportData);
    }

    return NextResponse.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}