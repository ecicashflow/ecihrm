import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createDefaultFormData, calculateAppraisalScores } from '@/lib/constants';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const assignment = await db.appraisalAssignment.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true, name: true, employeeId: true, designation: true,
            department: true, overallExp: true, yearsWithECI: true, currentEdu: true,
          },
        },
        supervisor: {
          select: { id: true, name: true, designation: true },
        },
        escalatedSupervisor: {
          select: { id: true, name: true, designation: true },
        },
        cycle: {
          select: { id: true, name: true, cycleType: true, year: true, periodFrom: true, periodTo: true },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    let formData = await db.appraisalFormData.findUnique({
      where: { assignmentId: id },
    });

    // If no form data yet, create it with defaults
    if (!formData) {
      const emp = assignment.employee;
      const sup = assignment.supervisor;
      const cyc = assignment.cycle;

      const designation = await db.designation.findUnique({
        where: { title: emp.designation },
      });

      formData = await db.appraisalFormData.create({
        data: {
          assignmentId: id,
          employeeName: emp.name,
          employeeId: emp.employeeId,
          designation: emp.designation,
          overallExp: emp.overallExp,
          yearsWithECI: emp.yearsWithECI,
          currentEdu: emp.currentEdu,
          requiredExp: designation?.requiredExp || '',
          requiredEdu: designation?.requiredEdu || '',
          department: emp.department,
          appraisalPeriod: `${cyc.periodFrom} to ${cyc.periodTo}`,
          lineManagerName: sup.name,
          lineManagerDesignation: sup.designation,
          achievementsJson: JSON.stringify(createDefaultFormData().achievements),
          goalsJson: JSON.stringify(createDefaultFormData().goals),
          technicalSkillsJson: JSON.stringify(createDefaultFormData().technicalSkills),
          leadershipSkillsJson: JSON.stringify(createDefaultFormData().leadershipSkills),
          managerialSkillsJson: JSON.stringify(createDefaultFormData().managerialSkills),
          explanationsJson: JSON.stringify(createDefaultFormData().explanations),
          futureGoalsJson: JSON.stringify(createDefaultFormData().futureGoals),
          remarksJson: JSON.stringify(createDefaultFormData().remarks),
        },
      });
    }

    // Parse JSON fields for response
    const result = {
      ...formData,
      achievements: JSON.parse(formData.achievementsJson),
      goals: JSON.parse(formData.goalsJson),
      technicalSkills: JSON.parse(formData.technicalSkillsJson),
      leadershipSkills: JSON.parse(formData.leadershipSkillsJson),
      managerialSkills: JSON.parse(formData.managerialSkillsJson),
      explanations: JSON.parse(formData.explanationsJson),
      futureGoals: JSON.parse(formData.futureGoalsJson),
      remarks: JSON.parse(formData.remarksJson),
      aiAnalysis: JSON.parse(formData.aiAnalysisJson || '{}'),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get form data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const assignment = await db.appraisalAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Authorization: verify the caller has the right to save (optional callerId for backward compatibility)
    const callerId = body.callerId;
    if (callerId) {
      const isEmployee = assignment.employeeId === callerId;
      const isSupervisor = assignment.supervisorId === callerId || assignment.escalatedSupervisorId === callerId;
      const isHR = assignment.currentActionBy === 'hr';
      const isManagement = assignment.currentActionBy === 'management';

      if (assignment.currentActionBy === 'employee' && !isEmployee) {
        return NextResponse.json({ error: 'Only the employee can edit during their phase' }, { status: 403 });
      }
      if (assignment.currentActionBy === 'supervisor' && !isSupervisor && !isHR && !isManagement) {
        return NextResponse.json({ error: 'Only the assigned supervisor can edit during their phase' }, { status: 403 });
      }
    }

    let formData = await db.appraisalFormData.findUnique({
      where: { assignmentId: id },
    });

    // Build update data
    const updateData: Record<string, unknown> = {};

    // Handle JSON array fields
    if (body.achievements !== undefined) {
      updateData.achievementsJson = JSON.stringify(body.achievements);
    }
    if (body.goals !== undefined) {
      updateData.goalsJson = JSON.stringify(body.goals);
    }
    if (body.technicalSkills !== undefined) {
      updateData.technicalSkillsJson = JSON.stringify(body.technicalSkills);
    }
    if (body.leadershipSkills !== undefined) {
      updateData.leadershipSkillsJson = JSON.stringify(body.leadershipSkills);
    }
    if (body.managerialSkills !== undefined) {
      updateData.managerialSkillsJson = JSON.stringify(body.managerialSkills);
    }
    if (body.explanations !== undefined) {
      updateData.explanationsJson = JSON.stringify(body.explanations);
    }
    if (body.futureGoals !== undefined) {
      updateData.futureGoalsJson = JSON.stringify(body.futureGoals);
    }
    if (body.remarks !== undefined) {
      updateData.remarksJson = JSON.stringify(body.remarks);
    }
    if (body.employeeSignature !== undefined) {
      updateData.employeeSignature = body.employeeSignature;
    }
    if (body.employeeSignatureDate !== undefined) {
      updateData.employeeSignatureDate = body.employeeSignatureDate || null;
    }
    if (body.supervisorSignature !== undefined) {
      updateData.supervisorSignature = body.supervisorSignature;
    }
    if (body.supervisorSignatureDate !== undefined) {
      updateData.supervisorSignatureDate = body.supervisorSignatureDate || null;
    }
    if (body.ceoSignature !== undefined) {
      updateData.ceoSignature = body.ceoSignature;
    }
    if (body.ceoSignatureDate !== undefined) {
      updateData.ceoSignatureDate = body.ceoSignatureDate || null;
    }

    // Calculate scores for employee ratings
    const formForCalc = {
      achievements: body.achievements ? JSON.parse(JSON.stringify(body.achievements)) : formData ? JSON.parse(formData.achievementsJson) : [],
      goals: body.goals ? JSON.parse(JSON.stringify(body.goals)) : formData ? JSON.parse(formData.goalsJson) : [],
      technicalSkills: body.technicalSkills ? JSON.parse(JSON.stringify(body.technicalSkills)) : formData ? JSON.parse(formData.technicalSkillsJson) : [],
      leadershipSkills: body.leadershipSkills ? JSON.parse(JSON.stringify(body.leadershipSkills)) : formData ? JSON.parse(formData.leadershipSkillsJson) : [],
      managerialSkills: body.managerialSkills ? JSON.parse(JSON.stringify(body.managerialSkills)) : formData ? JSON.parse(formData.managerialSkillsJson) : [],
      explanations: body.explanations ? JSON.parse(JSON.stringify(body.explanations)) : formData ? JSON.parse(formData.explanationsJson) : [],
    };

    const empScores = calculateAppraisalScores(formForCalc, 'employee');
    updateData.achievementsSubtotalEmployee = empScores.marksGoals;
    updateData.technicalSubtotalEmployee = empScores.techSubtotal;
    updateData.leadershipSubtotalEmployee = empScores.leadSubtotal;
    updateData.managerialSubtotalEmployee = empScores.mgrSubtotal;
    updateData.totalCompetenciesEmployee = empScores.totalCompetencies;
    updateData.totalMarksDeducted = empScores.marksDeducted;
    updateData.totalNAInGoalsEmployee = empScores.naCountGoals;
    updateData.totalNAInTechnicalEmployee = empScores.naTech;
    updateData.totalNAInLeadershipEmployee = empScores.naLead;
    updateData.totalNAInManagerialEmployee = empScores.naMgr;
    updateData.totalNAInExplanations = empScores.naExplanations;
    updateData.maxMarksGoals = empScores.maxMarksGoals;
    updateData.maxMarksCompetencies = empScores.maxMarksCompetencies;
    updateData.maxMarksExplanations = empScores.maxMarksExplanations;
    updateData.grandTotalEmployee = empScores.grandTotal;
    updateData.overallPercentageEmployee = empScores.overallPercentage;
    updateData.ratingEmployee = empScores.rating;

    // Calculate supervisor scores
    const supScores = calculateAppraisalScores(formForCalc, 'supervisor');
    updateData.achievementsSubtotalSupervisor = supScores.marksGoals;
    updateData.technicalSubtotalSupervisor = supScores.techSubtotal;
    updateData.leadershipSubtotalSupervisor = supScores.leadSubtotal;
    updateData.managerialSubtotalSupervisor = supScores.mgrSubtotal;
    updateData.totalCompetenciesSupervisor = supScores.totalCompetencies;
    updateData.totalNAInGoalsSupervisor = supScores.naCountGoals;
    updateData.totalNAInTechnicalSupervisor = supScores.naTech;
    updateData.totalNAInLeadershipSupervisor = supScores.naLead;
    updateData.totalNAInManagerialSupervisor = supScores.naMgr;
    updateData.grandTotalSupervisor = supScores.grandTotal;
    updateData.overallPercentageSupervisor = supScores.overallPercentage;
    updateData.ratingSupervisor = supScores.rating;

    if (formData) {
      // Update existing
      formData = await db.appraisalFormData.update({
        where: { assignmentId: id },
        data: updateData,
      });
    } else {
      // Create new (shouldn't normally happen via PUT, but handle it)
      const assignmentData = await db.appraisalAssignment.findUnique({
        where: { id },
        include: {
          employee: {
            select: { id: true, name: true, employeeId: true, designation: true, department: true, overallExp: true, yearsWithECI: true, currentEdu: true },
          },
          supervisor: { select: { id: true, name: true, designation: true } },
          cycle: { select: { id: true, name: true, periodFrom: true, periodTo: true } },
        },
      });
      if (assignmentData) {
        const emp = assignmentData.employee;
        const sup = assignmentData.supervisor;
        const cyc = assignmentData.cycle;
        formData = await db.appraisalFormData.create({
          data: {
            assignmentId: id,
            employeeName: emp.name,
            employeeId: emp.employeeId,
            designation: emp.designation,
            overallExp: emp.overallExp,
            yearsWithECI: emp.yearsWithECI,
            currentEdu: emp.currentEdu,
            department: emp.department,
            appraisalPeriod: `${cyc.periodFrom} to ${cyc.periodTo}`,
            lineManagerName: sup.name,
            lineManagerDesignation: sup.designation,
            ...updateData,
          },
        });
      }
    }

    const result = {
      ...formData,
      achievements: JSON.parse((formData as { achievementsJson: string }).achievementsJson),
      goals: JSON.parse((formData as { goalsJson: string }).goalsJson),
      technicalSkills: JSON.parse((formData as { technicalSkillsJson: string }).technicalSkillsJson),
      leadershipSkills: JSON.parse((formData as { leadershipSkillsJson: string }).leadershipSkillsJson),
      managerialSkills: JSON.parse((formData as { managerialSkillsJson: string }).managerialSkillsJson),
      explanations: JSON.parse((formData as { explanationsJson: string }).explanationsJson),
      futureGoals: JSON.parse((formData as { futureGoalsJson: string }).futureGoalsJson),
      remarks: JSON.parse((formData as { remarksJson: string }).remarksJson),
      aiAnalysis: JSON.parse((formData as { aiAnalysisJson: string }).aiAnalysisJson || '{}'),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Save form data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}