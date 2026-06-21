import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-guard';

/**
 * GET /api/reports
 *
 * Admin/Management-only endpoint. Returns aggregated report data:
 *  - summary: totalEmployees, totalAppraised, averageScore, highestScore, lowestScore
 *  - ratingDistribution: count of employees per rating band
 *  - departmentComparison: avg score + completion per department
 *
 * Query params:
 *  - cycleId: filter by a specific cycle (default: all active+closed cycles)
 *  - department: filter by department name
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['admin', 'management']);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get('cycleId') || undefined;
    const department = searchParams.get('department') || undefined;

    // Build the where clause for assignments
    const where: Record<string, unknown> = {};
    if (cycleId) {
      where.cycleId = cycleId;
    } else {
      // Default: include assignments from active or closed cycles only
      where.cycle = { status: { in: ['active', 'closed'] } };
    }
    if (department) {
      where.employee = { department };
    }

    // Fetch assignments with form data for scoring
    const assignments = await db.appraisalAssignment.findMany({
      where,
      include: {
        employee: {
          select: { id: true, name: true, department: true, designation: true },
        },
        cycle: {
          select: { id: true, name: true, status: true },
        },
        formData: {
          select: {
            overallPercentageEmployee: true,
            overallPercentageSupervisor: true,
            ratingEmployee: true,
            ratingSupervisor: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Total employees (distinct) — fall back to all active users if no assignments
    const totalEmployees = await db.user.count({
      where: { isActive: true, role: { in: ['employee', 'supervisor', 'management', 'hr'] } },
    });

    // Only count assignments that have form data with scores
    const scored = assignments.filter(
      (a) => a.formData && a.formData.overallPercentageEmployee > 0
    );

    const scores = scored.map((a) => a.formData!.overallPercentageEmployee);
    const totalAppraised = scored.length;
    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
      : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    // Rating distribution (based on supervisor rating, or employee if supervisor not yet rated)
    const ratingBands = [
      { name: 'Greatly Exceeds', min: 86, max: 100, color: '#16a34a' },
      { name: 'Exceeds', min: 71, max: 85, color: '#2563eb' },
      { name: 'Meets', min: 56, max: 70, color: '#ca8a04' },
      { name: 'Occasionally Meets', min: 41, max: 55, color: '#ea580c' },
      { name: 'Fails to Meet', min: 0, max: 40, color: '#dc2626' },
    ];

    const ratingDistribution = ratingBands.map((band) => ({
      name: band.name,
      value: scored.filter((a) => {
        const pct = a.formData!.overallPercentageSupervisor || a.formData!.overallPercentageEmployee;
        return pct >= band.min && pct <= band.max;
      }).length,
      color: band.color,
    }));

    // Department comparison
    const deptMap = new Map<string, { total: number; completed: number; scoreSum: number }>();
    for (const a of assignments) {
      const dept = a.employee.department || 'Unknown';
      if (!deptMap.has(dept)) deptMap.set(dept, { total: 0, completed: 0, scoreSum: 0 });
      const entry = deptMap.get(dept)!;
      entry.total++;
      // "Completed" = approved / shared / acknowledged / closed
      if (['approved', 'shared_with_employee', 'acknowledged_by_employee', 'closed'].includes(a.status)) {
        entry.completed++;
      }
      if (a.formData && a.formData.overallPercentageEmployee > 0) {
        entry.scoreSum += a.formData.overallPercentageEmployee;
      }
    }

    const departmentComparison = Array.from(deptMap.entries()).map(([name, data]) => ({
      name,
      avgScore: data.scoreSum > 0 ? Math.round(data.scoreSum / data.total) : 0,
      total: data.total,
      completed: data.completed,
    }));

    return NextResponse.json({
      summary: {
        totalEmployees,
        totalAppraised,
        averageScore,
        highestScore,
        lowestScore,
      },
      ratingDistribution,
      departmentComparison,
    });
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
