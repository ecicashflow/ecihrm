import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const assignment = await db.appraisalAssignment.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, name: true, employeeId: true, designation: true, department: true },
        },
        supervisor: {
          select: { id: true, name: true, designation: true, department: true },
        },
        cycle: {
          select: { id: true, name: true, cycleType: true, year: true, periodFrom: true, periodTo: true, status: true },
        },
        formData: true,
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Get assignment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}