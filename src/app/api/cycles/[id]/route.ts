import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cycle = await db.appraisalCycle.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        assignments: {
          include: {
            employee: {
              select: { id: true, name: true, employeeId: true, designation: true, department: true },
            },
            supervisor: {
              select: { id: true, name: true, designation: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...cycle,
      applicableDepts: JSON.parse(cycle.applicableDepts),
    });
  } catch (error) {
    console.error('Get cycle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ["admin"]);
    if (auth.error) return auth.error;
    const { id } = await params;
    const body = await request.json();

    const existing = await db.appraisalCycle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft cycles can be updated' }, { status: 400 });
    }

    const cycle = await db.appraisalCycle.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.cycleType !== undefined && { cycleType: body.cycleType }),
        ...(body.year !== undefined && { year: body.year }),
        ...(body.periodFrom !== undefined && { periodFrom: body.periodFrom }),
        ...(body.periodTo !== undefined && { periodTo: body.periodTo }),
        ...(body.startDate !== undefined && { startDate: new Date(body.startDate) }),
        ...(body.endDate !== undefined && { endDate: new Date(body.endDate) }),
        ...(body.submissionDeadline !== undefined && { submissionDeadline: new Date(body.submissionDeadline) }),
        ...(body.applicableDepts !== undefined && { applicableDepts: JSON.stringify(body.applicableDepts) }),
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      ...cycle,
      applicableDepts: JSON.parse(cycle.applicableDepts),
    });
  } catch (error) {
    console.error('Update cycle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ["admin"]);
    if (auth.error) return auth.error;
    const { id } = await params;

    const existing = await db.appraisalCycle.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft cycles can be deleted' }, { status: 400 });
    }

    await db.appraisalCycle.delete({ where: { id } });

    return NextResponse.json({ message: 'Cycle deleted successfully' });
  } catch (error) {
    console.error('Delete cycle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

