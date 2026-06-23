import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateAppraisalScores } from '@/lib/constants';
import { aiEnabled, getLLMResponse } from '@/lib/ai';
import { requireRole } from '@/lib/auth-guard';

export async function POST(request: NextRequest) {
  try {
    // AI features are admin-only — all reporting and analysis is monitored by the administrator
    // AI analysis: admin, HR, and management can access
    const auth = await requireRole(request, ['admin', 'hr', 'management']);
    if (auth.error) return auth.error;

    if (!aiEnabled()) {
      return NextResponse.json(
        { error: 'AI features are not configured. Set AI_API_KEY in the server environment.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { assignmentId } = body;

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
    }

    const assignment = await db.appraisalAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        employee: {
          select: { name: true, employeeId: true, designation: true, department: true },
        },
        supervisor: {
          select: { name: true, designation: true },
        },
        cycle: {
          select: { name: true, cycleType: true, year: true, periodFrom: true, periodTo: true },
        },
        formData: true,
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const formData = assignment.formData;
    if (!formData) {
      return NextResponse.json({ error: 'No form data found for this assignment' }, { status: 400 });
    }

    // Parse JSON fields
    const achievements = JSON.parse(formData.achievementsJson);
    const goals = JSON.parse(formData.goalsJson);
    const technicalSkills = JSON.parse(formData.technicalSkillsJson);
    const leadershipSkills = JSON.parse(formData.leadershipSkillsJson);
    const managerialSkills = JSON.parse(formData.managerialSkillsJson);
    const explanations = JSON.parse(formData.explanationsJson);
    const futureGoals = JSON.parse(formData.futureGoalsJson);
    const remarks = JSON.parse(formData.remarksJson);

    // Calculate scores
    const empScores = calculateAppraisalScores({
      achievements, goals, technicalSkills, leadershipSkills, managerialSkills, explanations,
    }, 'employee');
    const supScores = calculateAppraisalScores({
      achievements, goals, technicalSkills, leadershipSkills, managerialSkills, explanations,
    }, 'supervisor');

    const prompt = `You are an HR analytics expert. Analyze the following employee performance appraisal data and provide a comprehensive analysis.

## Employee Information
- Name: ${assignment.employee.name}
- Employee ID: ${assignment.employee.employeeId}
- Designation: ${assignment.employee.designation}
- Department: ${assignment.employee.department}
- Appraisal Cycle: ${assignment.cycle.name} (${assignment.cycle.periodFrom} to ${assignment.cycle.periodTo})

## Employee Self-Evaluation Scores
- Overall Percentage: ${empScores.overallPercentage}%
- Rating: ${empScores.rating}
- Goals & Achievements Marks: ${empScores.marksGoals}/${empScores.maxMarksGoals}
- Competencies Marks: ${empScores.totalCompetencies}/${empScores.maxMarksCompetencies}
- Marks Deducted (Explanations): ${empScores.marksDeducted}

## Supervisor Evaluation Scores
- Overall Percentage: ${supScores.overallPercentage}%
- Rating: ${supScores.rating}
- Goals & Achievements Marks: ${supScores.marksGoals}/${supScores.maxMarksGoals}
- Competencies Marks: ${supScores.totalCompetencies}/${supScores.maxMarksCompetencies}

## Key Achievements
${achievements.filter((a: { description: string }) => a.description).map((a: { description: string; employeeRating: number }, i: number) => `${i + 1}. ${a.description} (Rating: ${a.employeeRating})`).join('\n') || 'None listed'}

## Goals
${goals.filter((g: { description: string }) => g.description).map((g: { description: string; employeeRating: number }, i: number) => `${i + 1}. ${g.description} (Rating: ${g.employeeRating})`).join('\n') || 'None listed'}

## Technical Skills
${technicalSkills.filter((s: { name: string }) => s.name).map((s: { name: string; employeeRating: number; supervisorRating: number }) => `- ${s.name}: Employee ${s.employeeRating}, Supervisor ${s.supervisorRating}`).join('\n')}

## Leadership Skills
${leadershipSkills.filter((s: { name: string }) => s.name).map((s: { name: string; employeeRating: number; supervisorRating: number }) => `- ${s.name}: Employee ${s.employeeRating}, Supervisor ${s.supervisorRating}`).join('\n')}

## Managerial Skills
${managerialSkills.filter((s: { name: string }) => s.name).map((s: { name: string; employeeRating: number; supervisorRating: number }) => `- ${s.name}: Employee ${s.employeeRating}, Supervisor ${s.supervisorRating}`).join('\n')}

## Future Goals
${futureGoals.filter((g: { description: string }) => g.description).map((g: { description: string }, i: number) => `${i + 1}. ${g.description}`).join('\n') || 'None listed'}

## Supervisor Remarks
${remarks.supervisorGeneralRemarks || 'No remarks provided'}

## HR Remarks
${remarks.hrGeneralRemarks || 'No remarks provided'}

## HR Recommendations
- Satisfied with Skills: ${remarks.hrSatisfactionSkills ? 'Yes' : 'No'}
- Satisfied with Behavior: ${remarks.hrSatisfactionBehavior ? 'Yes' : 'No'}
- Satisfied with Performance: ${remarks.hrSatisfactionPerformance ? 'Yes' : 'No'}
- Recommend for Monitoring: ${remarks.hrRecommendationMonitoring ? 'Yes' : 'No'}
- Recommend for Promotion: ${remarks.hrRecommendationPromotion ? 'Yes' : 'No'}
- Recommend for Reward: ${remarks.hrRecommendationReward ? 'Yes' : 'No'}

Please provide a structured analysis in JSON format with the following fields:
{
  "summary": "Brief overall summary of the employee's performance (2-3 sentences)",
  "strengths": ["List of 3-5 key strengths"],
  "improvementAreas": ["List of 3-5 areas needing improvement"],
  "trainingNeeds": ["List of 2-4 recommended training programs"],
  "supervisorRemarksSummary": "Summary of supervisor's assessment",
  "hrRecommendationSummary": "Summary of HR's assessment and recommendations",
  "scoreGap": "Analysis of any gap between employee self-rating and supervisor rating",
  "actionItems": ["List of 3-5 specific action items for the employee"]
}

Return ONLY the JSON, no other text.`;

    const aiResponse = await getLLMResponse([
      { role: 'user', content: prompt },
    ]);

    // Parse the AI response - try to extract JSON
    let analysisJson = '{}';
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        analysisJson = JSON.stringify(parsed);
      }
    } catch {
      analysisJson = JSON.stringify({ rawAnalysis: aiResponse });
    }

    // Save to form data
    await db.appraisalFormData.update({
      where: { assignmentId },
      data: { aiAnalysisJson: analysisJson },
    });

    return NextResponse.json({
      message: 'AI analysis generated successfully',
      analysis: JSON.parse(analysisJson),
    });
  } catch (error) {
    console.error('AI analyze error:', error);
    return NextResponse.json({ error: 'Failed to generate AI analysis' }, { status: 500 });
  }
}