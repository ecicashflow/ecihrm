import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiEnabled, getLLMResponse } from '@/lib/ai';
import { requireRole } from '@/lib/auth-guard';

async function generateSummary(cycleId: string) {
  const cycle = await db.appraisalCycle.findUnique({
    where: { id: cycleId },
  });

  if (!cycle) {
    return { error: 'Cycle not found', status: 404 };
  }

  const assignments = await db.appraisalAssignment.findMany({
    where: { cycleId },
    include: {
      employee: {
        select: { name: true, employeeId: true, designation: true, department: true },
      },
      supervisor: {
        select: { name: true },
      },
      formData: true,
    },
  });

  if (assignments.length === 0) {
    return { error: 'No assignments found for this cycle', status: 400 };
  }

  // Build summary data
  const employeeSummaries = assignments.map((a) => {
    const fd = a.formData;
    if (!fd) {
      return { name: a.employee.name, department: a.employee.department, status: 'No form data' };
    }
    return {
      name: a.employee.name,
      employeeId: a.employee.employeeId,
      designation: a.employee.designation,
      department: a.employee.department,
      supervisor: a.supervisor.name,
      status: a.status,
      empPercentage: fd.overallPercentageEmployee,
      empRating: fd.ratingEmployee,
      supPercentage: fd.overallPercentageSupervisor,
      supRating: fd.ratingSupervisor,
    };
  });

  const prompt = `You are an HR analytics expert. Analyze the following appraisal cycle summary data and provide comprehensive insights.

## Cycle Information
- Name: ${cycle.name}
- Type: ${cycle.cycleType}
- Year: ${cycle.year}
- Period: ${cycle.periodFrom} to ${cycle.periodTo}
- Total Appraisals: ${assignments.length}

## Employee Appraisal Results
${employeeSummaries.map((e, i) =>
    `${i + 1}. ${e.name} (${'designation' in e ? e.designation : 'N/A'}, ${e.department}) - Employee: ${'empPercentage' in e ? e.empPercentage : 'N/A'}% (${'empRating' in e ? e.empRating : 'N/A'}), Supervisor: ${'supPercentage' in e ? e.supPercentage : 'N/A'}% (${'supRating' in e ? e.supRating : 'N/A'}), Status: ${e.status}`
  ).join('\n')}

Please provide a structured management report in plain text with these sections:
1. Executive Summary (2-3 sentences summarizing overall cycle performance)
2. Overall Statistics (average scores, completion rate, total appraisals, pending count)
3. Department Performance Analysis (compare departments by average scores and completion rates)
4. Employee Strengths (common strengths observed across high-performing employees)
5. Development Areas (common improvement areas for employees needing attention)
6. Reviewer Score Variance (analyze gaps between employee self-ratings and supervisor ratings — flag significant mismatches)
7. Workflow Bottlenecks (identify stages with delays, pending appraisals stuck at each stage)
8. Training Needs (recommend specific training programs based on competency gaps)
9. Management Action Recommendations (3-5 specific, actionable recommendations for leadership)
10. Top Performers (employees with score > 80%)
11. Needs Attention (employees with score < 50% or with large supervisor-employee score gaps)

Keep it concise, data-driven, and actionable. Use the actual scores and data provided above.`;

  const aiResponse = await getLLMResponse([
    { role: 'user', content: prompt },
  ]);

  return {
    success: true,
    cycleId,
    cycleName: cycle.name,
    totalAppraisals: assignments.length,
    summary: aiResponse,
  };
}

// GET - Auto-find active cycle and generate summary
export async function GET(request: NextRequest) {
  try {
    // AI reporting: admin, HR, and management can access
    const auth = await requireRole(request, ['admin', 'hr', 'management']);
    if (auth.error) return auth.error;

    if (!aiEnabled()) {
      return NextResponse.json(
        { error: 'AI features are not configured. Set AI_API_KEY in the server environment.' },
        { status: 503 }
      );
    }

    const activeCycle = await db.appraisalCycle.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeCycle) {
      return NextResponse.json({ error: 'No active cycle found' }, { status: 400 });
    }

    const result = await generateSummary(activeCycle.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: (result as { status: number }).status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('AI cycle summary error:', error);
    return NextResponse.json({ error: 'Failed to generate cycle summary' }, { status: 500 });
  }
}

// POST - Generate summary for a specific cycle
export async function POST(request: NextRequest) {
  try {
    // AI features are admin-only
    const auth = await requireRole(request, ['admin', 'hr', 'management']);
    if (auth.error) return auth.error;

    if (!aiEnabled()) {
      return NextResponse.json(
        { error: 'AI features are not configured. Set AI_API_KEY in the server environment.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { cycleId } = body;

    if (!cycleId) {
      return NextResponse.json({ error: 'cycleId is required' }, { status: 400 });
    }

    const result = await generateSummary(cycleId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: (result as { status: number }).status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('AI cycle summary error:', error);
    return NextResponse.json({ error: 'Failed to generate cycle summary' }, { status: 500 });
  }
}