import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const subordinates = await db.user.findMany({
      where: {
        lineManagerId: id,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        employeeId: true,
        designation: true,
        department: true,
        phone: true,
        overallExp: true,
        yearsWithECI: true,
        currentEdu: true,
        role: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(subordinates);
  } catch (error) {
    console.error('Get subordinates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}