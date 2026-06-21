import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const designation = await db.designation.findUnique({ where: { id } });
    if (!designation) {
      return NextResponse.json({ error: 'Designation not found' }, { status: 404 });
    }

    const employeeCount = await db.user.count({
      where: { designation: designation.title, isActive: true },
    });

    return NextResponse.json({
      ...designation,
      employeeCount,
    });
  } catch (error) {
    console.error('Get designation error:', error);
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
    const { title, requiredExp, requiredEdu, department } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Designation title is required' }, { status: 400 });
    }

    const existing = await db.designation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Designation not found' }, { status: 404 });
    }

    if (title.trim() !== existing.title) {
      const duplicate = await db.designation.findUnique({ where: { title: title.trim() } });
      if (duplicate) {
        return NextResponse.json({ error: 'Designation title already exists' }, { status: 409 });
      }
    }

    const updated = await db.designation.update({
      where: { id },
      data: {
        title: title.trim(),
        ...(requiredExp !== undefined && { requiredExp }),
        ...(requiredEdu !== undefined && { requiredEdu }),
        ...(department !== undefined && { department }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update designation error:', error);
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

    const existing = await db.designation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Designation not found' }, { status: 404 });
    }

    // Count active users with this designation
    const linkedCount = await db.user.count({
      where: { designation: existing.title, isActive: true },
    });

    if (linkedCount > 0) {
      // Safe deactivate
      await db.designation.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        message: 'Designation deactivated',
        deactivated: true,
        linkedCount,
      });
    }

    // No linked users — permanent delete
    await db.designation.delete({ where: { id } });
    return NextResponse.json({
      message: 'Designation deleted',
      deactivated: false,
    });
  } catch (error) {
    console.error('Delete designation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

