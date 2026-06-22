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

Please provide a structured analysis in plain text with these sections:
1. Cycle Overview (2-3 sentences)
2. Overall Statistics (average scores, completion rate)
3. Department Analysis
4. Key Findings (3-5 points)
5. Recommendations (3-5 points)
6. Top Performers (employees with score > 80%)
7. Needs Attention (employees with score < 50%)

Keep it concise and actionable.`;

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
    // AI features are admin-only
    const auth = await requireRole(request, ['admin']);
    if (auth.error) return auth.error;

    if (!aiEnabled()) {
      return NextResponse.json(
        { error: 'AI features are not configured. Set OPENAI_API_KEY in the server environment.' },
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
    const auth = await requireRole(request, ['admin']);
    if (auth.error) return auth.error;

    if (!aiEnabled()) {
      return NextResponse.json(
        { error: 'AI features are not configured. Set OPENAI_API_KEY in the server environment.' },
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