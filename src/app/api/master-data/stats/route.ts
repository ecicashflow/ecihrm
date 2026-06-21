import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Employee stats
    const totalEmployees = await db.user.count();
    const activeEmployees = await db.user.count({ where: { isActive: true } });
    const inactiveEmployees = totalEmployees - activeEmployees;

    // Group by role
    const usersByRole = await db.user.groupBy({
      by: ['role'],
      _count: { role: true },
    });
    const employeesByRole = usersByRole.map((g) => ({
      role: g.role,
      count: g._count.role,
    }));

    // Department stats
    const totalDepartments = await db.department.count();
    const activeDepartments = await db.department.count({ where: { isActive: true } });

    // Designation stats
    const totalDesignations = await db.designation.count();
    const activeDesignations = await db.designation.count({ where: { isActive: true } });

    // Rating scale & category stats
    const totalRatingScales = await db.ratingScale.count();
    const totalCategories = await db.appraisalCategory.count();

    // Employees without supervisor (active, no lineManagerId)
    const employeesWithoutSupervisor = await db.user.count({
      where: {
        isActive: true,
        lineManagerId: null,
      },
    });

    // Departments without active employees
    const allDepartments = await db.department.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    const departmentsWithoutEmployees: string[] = [];
    for (const dept of allDepartments) {
      const count = await db.user.count({
        where: { department: dept.name, isActive: true },
      });
      if (count === 0) {
        departmentsWithoutEmployees.push(dept.name);
      }
    }

    return NextResponse.json({
      stats: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        employeesByRole,
        totalDepartments,
        activeDepartments,
        totalDesignations,
        activeDesignations,
        totalRatingScales,
        totalCategories,
        employeesWithoutSupervisor,
        departmentsWithoutEmployees,
      },
    });
  } catch (error) {
    console.error('Master data stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
