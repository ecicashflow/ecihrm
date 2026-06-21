import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const department = await db.department.findUnique({ where: { id } });
    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Count linked records
    const [employeeCount, designationCount, appraisalCount] = await Promise.all([
      db.user.count({ where: { department: department.name, isActive: true } }),
      db.designation.count({ where: { department: department.name, isActive: true } }),
      db.appraisalFormData.count({
        where: { department: department.name },
      }),
    ]);

    return NextResponse.json({
      ...department,
      employeeCount,
      designationCount,
      appraisalCount,
    });
  } catch (error) {
    console.error('Get department error:', error);
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
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const existing = await db.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (name.trim() !== existing.name) {
      const duplicate = await db.department.findUnique({ where: { name: name.trim() } });
      if (duplicate) {
        return NextResponse.json({ error: 'Department name already exists' }, { status: 409 });
      }
    }

    const updated = await db.department.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update department error:', error);
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

    const existing = await db.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Count active users linked to this department
    const linkedCount = await db.user.count({
      where: { department: existing.name, isActive: true },
    });

    if (linkedCount > 0) {
      // Safe deactivate
      await db.department.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        message: 'Department deactivated',
        deactivated: true,
        linkedCount,
      });
    }

    // No linked users — permanent delete
    await db.department.delete({ where: { id } });
    return NextResponse.json({
      message: 'Department deleted',
      deactivated: false,
    });
  } catch (error) {
    console.error('Delete department error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

