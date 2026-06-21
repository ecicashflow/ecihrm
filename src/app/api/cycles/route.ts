import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const cycles = await db.appraisalCycle.findMany({
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = cycles.map((c) => ({
      id: c.id,
      name: c.name,
      cycleType: c.cycleType,
      year: c.year,
      periodFrom: c.periodFrom,
      periodTo: c.periodTo,
      startDate: c.startDate,
      endDate: c.endDate,
      submissionDeadline: c.submissionDeadline,
      status: c.status,
      applicableDepts: JSON.parse(c.applicableDepts),
      createdById: c.createdById,
      createdBy: c.createdBy,
      _count: c._count,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return NextResponse.json({ cycles: result });
  } catch (error) {
    console.error('List cycles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin"]);
    if (auth.error) return auth.error;
    const body = await request.json();
    const {
      name,
      cycleType,
      year,
      periodFrom,
      periodTo,
      startDate,
      endDate,
      submissionDeadline,
      applicableDepts,
      createdById,
    } = body;

    if (!name || !cycleType || !year || !periodFrom || !periodTo || !startDate || !endDate || !submissionDeadline || !createdById) {
      return NextResponse.json(
        { error: 'name, cycleType, year, periodFrom, periodTo, startDate, endDate, submissionDeadline, createdById are required' },
        { status: 400 }
      );
    }

    const cycle = await db.appraisalCycle.create({
      data: {
        name,
        cycleType,
        year,
        periodFrom,
        periodTo,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        submissionDeadline: new Date(submissionDeadline),
        applicableDepts: JSON.stringify(applicableDepts || []),
        createdById,
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
    }, { status: 201 });
  } catch (error) {
    console.error('Create cycle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}