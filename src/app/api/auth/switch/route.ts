import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, targetRole } = body;

    if (!userId || !targetRole) {
      return NextResponse.json(
        { error: 'userId and targetRole are required' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'supervisor', 'management', 'employee', 'hr'];
    if (!validRoles.includes(targetRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        lineManager: {
          select: { id: true, name: true, designation: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      employeeId: user.employeeId,
      designation: user.designation,
      department: user.department,
      phone: user.phone,
      overallExp: user.overallExp,
      yearsWithECI: user.yearsWithECI,
      currentEdu: user.currentEdu,
      role: targetRole,
      isActive: user.isActive,
      isSupervisor: user.isSupervisor,
      lineManagerId: user.lineManagerId,
      lineManager: user.lineManager,
      originalRole: user.role,
    });
  } catch (error) {
    console.error('Switch role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}