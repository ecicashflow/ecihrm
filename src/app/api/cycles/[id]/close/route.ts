import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['admin']);
    if (auth.error) return auth.error;

    const { id } = await params;

    const cycle = await db.appraisalCycle.findUnique({ where: { id } });
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    if (cycle.status !== 'active') {
      return NextResponse.json({ error: 'Only active cycles can be closed' }, { status: 400 });
    }

    // Close all non-closed assignments in this cycle
    await db.appraisalAssignment.updateMany({
      where: {
        cycleId: id,
        status: { notIn: ['closed', 'acknowledged_by_employee'] },
      },
      data: { status: 'closed' },
    });

    await db.appraisalCycle.update({
      where: { id },
      data: { status: 'closed' },
    });

    return NextResponse.json({ message: 'Cycle closed successfully' });
  } catch (error) {
    console.error('Close cycle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

