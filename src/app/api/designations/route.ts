import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const designations = await db.designation.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { title: 'asc' },
    });

    // Compute user count per designation (by title)
    const designationsWithCounts = await Promise.all(
      designations.map(async (desig) => {
        const userCount = await db.user.count({
          where: { designation: desig.title, isActive: true },
        });
        return {
          ...desig,
          employeeCount: userCount,
        };
      })
    );

    return NextResponse.json({ designations: designationsWithCounts });
  } catch (error) {
    console.error('List designations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {  const auth = await requireRole(request, ["admin"]);
    if (auth.error) return auth.error;

    try {
    const body = await request.json();
    const { title, requiredExp, requiredEdu, department } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Designation title is required' }, { status: 400 });
    }

    const existing = await db.designation.findUnique({ where: { title: title.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Designation already exists' }, { status: 409 });
    }

    const designation = await db.designation.create({
      data: {
        title: title.trim(),
        requiredExp: requiredExp || '',
        requiredEdu: requiredEdu || '',
        department: department || '',
      },
    });

    return NextResponse.json(designation, { status: 201 });
  } catch (error) {
    console.error('Create designation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
