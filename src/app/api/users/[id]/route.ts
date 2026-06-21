import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      include: {
        lineManager: {
          select: { id: true, name: true, designation: true },
        },
        supervisedEmployees: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            designation: true,
            department: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            appraisals: true,
            supervisorAppraisals: true,
          },
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
      lineManagerId: user.lineManagerId,
      role: user.role,
      isSupervisor: user.isSupervisor,
      isActive: user.isActive,
      lineManager: user.lineManager,
      supervisedEmployees: user.supervisedEmployees,
      appraisalCount: user._count.appraisals,
      supervisedAppraisalCount: user._count.supervisorAppraisals,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error('Get user error:', error);
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

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { email, employeeId } = body;
    if (email && email !== existing.email) {
      const emailExists = await db.user.findFirst({
        where: { email, id: { not: id } },
      });
      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
    }
    if (employeeId && employeeId !== existing.employeeId) {
      const eidExists = await db.user.findFirst({
        where: { employeeId, id: { not: id } },
      });
      if (eidExists) {
        return NextResponse.json({ error: 'Employee ID already in use' }, { status: 409 });
      }
    }

    // Note: Changes to department/designation/lineManagerId only affect future appraisals.
    // Existing appraisal records store snapshots in AppraisalFormData, so they remain unchanged.

    // Hash password if provided (password reset)
    let hashedPassword: string | undefined;
    if (body.password && String(body.password).trim()) {
      hashedPassword = await bcrypt.hash(String(body.password), 12);
    }

    const user = await db.user.update({
      where: { id },
      data: {
        ...(body.email !== undefined && { email: body.email }),
        ...(hashedPassword !== undefined && { password: hashedPassword }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.employeeId !== undefined && { employeeId: body.employeeId }),
        ...(body.designation !== undefined && { designation: body.designation }),
        ...(body.department !== undefined && { department: body.department }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.overallExp !== undefined && { overallExp: body.overallExp }),
        ...(body.yearsWithECI !== undefined && { yearsWithECI: body.yearsWithECI }),
        ...(body.currentEdu !== undefined && { currentEdu: body.currentEdu }),
        ...(body.lineManagerId !== undefined && { lineManagerId: body.lineManagerId || null }),
        ...(body.role !== undefined && { role: body.role }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.isSupervisor !== undefined && { isSupervisor: body.isSupervisor }),
      },
      include: {
        lineManager: {
          select: { id: true, name: true, designation: true },
        },
      },
    });

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
      lineManagerId: user.lineManagerId,
      role: user.role,
      isSupervisor: user.isSupervisor,
      isActive: user.isActive,
      lineManager: user.lineManager,
    });
  } catch (error) {
    console.error('Update user error:', error);
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

    const existing = await db.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            appraisals: true,
            supervisorAppraisals: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hasAppraisals =
      existing._count.appraisals > 0 || existing._count.supervisorAppraisals > 0;

    // Always deactivate (safe default) — whether or not they have appraisals
    await db.user.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: hasAppraisals
        ? 'User deactivated (has appraisal records)'
        : 'User deactivated',
      hasAppraisals,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

