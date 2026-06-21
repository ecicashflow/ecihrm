import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const departments = await db.department.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });

    // Since Department model doesn't have direct relations to User/Designation,
    // compute counts by department name
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const [userCount, designationCount] = await Promise.all([
          db.user.count({ where: { department: dept.name, isActive: true } }),
          db.designation.count({ where: { department: dept.name, isActive: true } }),
        ]);
        return {
          ...dept,
          employeeCount: userCount,
          designationCount,
        };
      })
    );

    return NextResponse.json({ departments: departmentsWithCounts });
  } catch (error) {
    console.error('List departments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {  const auth = await requireRole(request, ["admin"]);
    if (auth.error) return auth.error;

    try {
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const existing = await db.department.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Department already exists' }, { status: 409 });
    }

    const department = await db.department.create({
      data: { name: name.trim() },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error('Create department error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
