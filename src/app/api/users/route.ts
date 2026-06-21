import { requireRole } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department') || undefined;
    const role = searchParams.get('role') || undefined;
    const active = searchParams.get('active');
    const search = searchParams.get('search') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};

    // By default, only show active users unless includeInactive=true
    if (!includeInactive) {
      where.isActive = true;
    } else if (active !== null && active !== '' && active !== undefined) {
      where.isActive = active === 'true';
    }

    if (department) {
      where.department = department;
    }
    if (role) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { employeeId: { contains: search } },
      ];
    }

    const users = await db.user.findMany({
      where,
      include: {
        lineManager: {
          select: { id: true, name: true, designation: true },
        },
        _count: {
          select: {
            appraisals: true,
            supervisorAppraisals: true,
            supervisedEmployees: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const safeUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      employeeId: u.employeeId,
      designation: u.designation,
      department: u.department,
      phone: u.phone,
      overallExp: u.overallExp,
      yearsWithECI: u.yearsWithECI,
      currentEdu: u.currentEdu,
      lineManagerId: u.lineManagerId,
      role: u.role,
      isSupervisor: u.isSupervisor,
      isActive: u.isActive,
      lineManager: u.lineManager,
      appraisalCount: u._count.appraisals,
      supervisedAppraisalCount: u._count.supervisorAppraisals,
      supervisedEmployeeCount: u._count.supervisedEmployees,
      createdAt: u.createdAt,
    }));

    return NextResponse.json(safeUsers);
  } catch (error) {
    console.error('List users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {  const auth = await requireRole(request, ["admin"]);
    if (auth.error) return auth.error;

    try {
    const body = await request.json();
    const {
      email,
      name,
      employeeId,
      designation,
      department,
      phone,
      overallExp,
      yearsWithECI,
      currentEdu,
      lineManagerId,
      role,
      isSupervisor,
      password,
    } = body;

    if (!email || !name || !employeeId || !designation || !department) {
      return NextResponse.json(
        { error: 'email, name, employeeId, designation, department are required' },
        { status: 400 }
      );
    }

    const existing = await db.user.findFirst({
      where: {
        OR: [{ email }, { employeeId }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User with this email or employee ID already exists' },
        { status: 409 }
      );
    }

    // Hash password (default to "password123" if not provided)
    const plaintextPassword = password && String(password).trim() ? String(password) : 'password123';
    const hashedPassword = await bcrypt.hash(plaintextPassword, 12);

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        employeeId,
        designation,
        department,
        phone: phone || '',
        overallExp: overallExp || '',
        yearsWithECI: yearsWithECI || '',
        currentEdu: currentEdu || '',
        lineManagerId: lineManagerId || null,
        role: role || 'employee',
        isSupervisor: isSupervisor || false,
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
    }, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
