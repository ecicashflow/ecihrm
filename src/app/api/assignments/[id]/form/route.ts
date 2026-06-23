import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createDefaultFormData, calculateAppraisalScores } from '@/lib/constants';
import { requireAuth } from '@/lib/auth-guard';

/**
 * GET /api/assignments/[id]/form
 * Returns the appraisal form data. If no form data exists yet, creates a
 * default record populated from the employee + designation + cycle records.
 */
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

/**
 * Merge helper: for arrays of rating items, preserve the existing
 * employeeRating and only update supervisorRating (and vice versa).
 */
function mergeRatingArrays(
  existing: any[],
  incoming: any[],
  preserveKey: 'employeeRating' | 'supervisorRating'
): any[] {
  if (!Array.isArray(existing) || !Array.isArray(incoming)) {
    return incoming || existing || [];
  }
  const maxLen = Math.max(existing.length, incoming.length);
  const result: any[] = [];
  for (let i = 0; i < maxLen; i++) {
    const ex = existing[i] || {};
    const inc = incoming[i] || {};
    result.push({
      ...ex,       // start with existing (preserves all data)
      ...inc,      // overlay incoming
      // But force-preserve the key that belongs to the OTHER role:
      [preserveKey]: ex[preserveKey] !== undefined ? ex[preserveKey] : (inc[preserveKey] ?? 0),
    });
  }
  return result;
}

/**
 * Merge remarks: preserve the other role's fields.
 */
function mergeRemarks(
  existing: Record<string, any>,
  incoming: Record<string, any>,
  currentStage: string
): Record<string, any> {
  const merged = { ...existing, ...incoming };
  // If supervisor is saving, preserve HR fields
  if (currentStage === 'supervisor') {
    const hrFields = ['hrSatisfactionSkills', 'hrSatisfactionBehavior', 'hrSatisfactionPerformance',
                      'hrRecommendationMonitoring', 'hrRecommendationPromotion', 'hrRecommendationReward',
                      'hrGeneralRemarks'];
    for (const f of hrFields) {
      if (existing[f] !== undefined) merged[f] = existing[f];
    }
  }
  // If HR is saving, preserve supervisor fields
  if (currentStage === 'hr') {
    const supFields = ['supervisorSatisfaction', 'supervisorConsiderationPromotion',
                       'supervisorConsiderationIncrement', 'supervisorConsiderationReward',
                       'supervisorGeneralRemarks'];
    for (const f of supFields) {
      if (existing[f] !== undefined) merged[f] = existing[f];
    }
  }
  return merged;
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
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // ── AUTHORIZATION: only the current stage's role can save ──
    // Admin can ALWAYS edit (override capability) — with audit logging.
    // Management can override supervisor scores during their review stage.
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const callerId = auth.userId!;
    const callerRole = auth.role!;

    const isEmployee = assignment.employeeId === callerId;
    const isSupervisor =
      (assignment.supervisorId === callerId || assignment.escalatedSupervisorId === callerId) &&
      !isEmployee;
    const isHR = callerRole === 'hr';
    const isManagement = callerRole === 'management';
    const isCEO = callerRole === 'ceo';
    const isAdmin = callerRole === 'admin';

    // Admin can always edit (override)
    if (isAdmin) {
      // Admin override — proceed with full edit access
    } else {
      const STAGE_AUTH: Record<string, boolean> = {
        employee: isEmployee,
        supervisor: isSupervisor,
        hr: isHR,
        management: isManagement || isCEO,
        ceo: isCEO || isManagement,
      };

      const canEdit = STAGE_AUTH[assignment.currentActionBy] ?? false;
      if (!canEdit) {
        const stageLabels: Record<string, string> = {
          employee: 'employee self-evaluation',
          supervisor: 'supervisor review',
          hr: 'HR review',
          management: 'management review',
          ceo: 'CEO approval',
        };
        return NextResponse.json(
          {
            error: `This appraisal is currently in the ${stageLabels[assignment.currentActionBy] || assignment.currentActionBy} stage. Only the designated person for that stage can edit the form.`,
          },
          { status: 403 }
        );
      }
    }

    // Determine the effective stage for merging:
    // - If admin is editing, use the current stage
    // - If management is editing supervisor scores during management stage,
    //   we log overrides
    const currentStage = assignment.currentActionBy;
    const isManagementOverride = isManagement && currentStage === 'management';
    let formData = await db.appraisalFormData.findUnique({
      where: { assignmentId: id },
    });

    // Parse existing data for merging
    const existing = formData ? {
      achievements: JSON.parse(formData.achievementsJson),
      goals: JSON.parse(formData.goalsJson),
      technicalSkills: JSON.parse(formData.technicalSkillsJson),
      leadershipSkills: JSON.parse(formData.leadershipSkillsJson),
      managerialSkills: JSON.parse(formData.managerialSkillsJson),
      explanations: JSON.parse(formData.explanationsJson),
      futureGoals: JSON.parse(formData.futureGoalsJson),
      remarks: JSON.parse(formData.remarksJson),
    } : null;

    // ── STAGE-AWARE MERGING ──
    // Each stage only updates its own fields, preserving data from other stages.
    const updateData: Record<string, unknown> = {};

    if (currentStage === 'employee') {
      // Employee can edit: descriptions, employeeRating, futureGoals, explanations, employeeSignature
      if (body.achievements !== undefined) {
        updateData.achievementsJson = JSON.stringify(body.achievements);
      }
      if (body.goals !== undefined) {
        updateData.goalsJson = JSON.stringify(body.goals);
      }
      if (body.technicalSkills !== undefined) {
        // Merge: preserve supervisorRating from existing, use new employeeRating
        const merged = existing ? mergeRatingArrays(existing.technicalSkills, body.technicalSkills, 'supervisorRating') : body.technicalSkills;
        updateData.technicalSkillsJson = JSON.stringify(merged);
      }
      if (body.leadershipSkills !== undefined) {
        const merged = existing ? mergeRatingArrays(existing.leadershipSkills, body.leadershipSkills, 'supervisorRating') : body.leadershipSkills;
        updateData.leadershipSkillsJson = JSON.stringify(merged);
      }
      if (body.managerialSkills !== undefined) {
        const merged = existing ? mergeRatingArrays(existing.managerialSkills, body.managerialSkills, 'supervisorRating') : body.managerialSkills;
        updateData.managerialSkillsJson = JSON.stringify(merged);
      }
      if (body.explanations !== undefined) {
        updateData.explanationsJson = JSON.stringify(body.explanations);
      }
      if (body.futureGoals !== undefined) {
        updateData.futureGoalsJson = JSON.stringify(body.futureGoals);
      }
      if (body.employeeSignature !== undefined) {
        updateData.employeeSignature = body.employeeSignature;
      }
      if (body.employeeSignatureDate !== undefined) {
        updateData.employeeSignatureDate = body.employeeSignatureDate || null;
      }
    } else if (currentStage === 'supervisor') {
      // Supervisor can edit: supervisorRating in all arrays, supervisorSignature, supervisor remarks
      if (body.achievements !== undefined && existing) {
        const merged = mergeRatingArrays(existing.achievements, body.achievements, 'employeeRating');
        updateData.achievementsJson = JSON.stringify(merged);
      }
      if (body.goals !== undefined && existing) {
        const merged = mergeRatingArrays(existing.goals, body.goals, 'employeeRating');
        updateData.goalsJson = JSON.stringify(merged);
      }
      if (body.technicalSkills !== undefined && existing) {
        const merged = mergeRatingArrays(existing.technicalSkills, body.technicalSkills, 'employeeRating');
        updateData.technicalSkillsJson = JSON.stringify(merged);
      }
      if (body.leadershipSkills !== undefined && existing) {
        const merged = mergeRatingArrays(existing.leadershipSkills, body.leadershipSkills, 'employeeRating');
        updateData.leadershipSkillsJson = JSON.stringify(merged);
      }
      if (body.managerialSkills !== undefined && existing) {
        const merged = mergeRatingArrays(existing.managerialSkills, body.managerialSkills, 'employeeRating');
        updateData.managerialSkillsJson = JSON.stringify(merged);
      }
      if (body.explanations !== undefined && existing) {
        // Preserve employee data, update supervisor fields
        updateData.explanationsJson = JSON.stringify(body.explanations);
      }
      if (body.supervisorSignature !== undefined) {
        updateData.supervisorSignature = body.supervisorSignature;
      }
      if (body.supervisorSignatureDate !== undefined) {
        updateData.supervisorSignatureDate = body.supervisorSignatureDate || null;
      }
      if (body.remarks !== undefined && existing) {
        const merged = mergeRemarks(existing.remarks, body.remarks, 'supervisor');
        updateData.remarksJson = JSON.stringify(merged);
      }
    } else if (currentStage === 'hr') {
      // HR can edit: HR remarks, explanations (HR remarks on explanations)
      if (body.remarks !== undefined && existing) {
        const merged = mergeRemarks(existing.remarks, body.remarks, 'hr');
        updateData.remarksJson = JSON.stringify(merged);
      }
      if (body.explanations !== undefined && existing) {
        // HR can update explanation ratings/remarks, but preserve descriptions
        updateData.explanationsJson = JSON.stringify(body.explanations);
      }
    } else if (currentStage === 'management' || isManagementOverride || isAdmin) {
      // Management can:
      // 1. Override supervisor scores (with audit trail)
      // 2. Add CEO signature
      // 3. Add management remarks
      // Admin can also do all of the above at any stage.

      // Override logging for management edits to supervisor scores
      const overrideLogs: { fieldName: string; fieldLabel: string; originalValue: string; newValue: string }[] = [];

      if (body.achievements !== undefined && existing) {
        const merged = mergeRatingArrays(existing.achievements, body.achievements, 'employeeRating');
        // Log overrides to supervisorRating
        if (isManagementOverride) {
          for (let i = 0; i < merged.length; i++) {
            const oldVal = existing.achievements[i]?.supervisorRating;
            const newVal = merged[i]?.supervisorRating;
            if (oldVal !== newVal && newVal !== undefined) {
              overrideLogs.push({
                fieldName: `achievements[${i}].supervisorRating`,
                fieldLabel: `Achievement ${i + 1}: ${merged[i]?.description || ''}`.trim(),
                originalValue: String(oldVal ?? ''),
                newValue: String(newVal),
              });
            }
          }
        }
        updateData.achievementsJson = JSON.stringify(merged);
      }
      if (body.goals !== undefined && existing) {
        const merged = mergeRatingArrays(existing.goals, body.goals, 'employeeRating');
        if (isManagementOverride) {
          for (let i = 0; i < merged.length; i++) {
            const oldVal = existing.goals[i]?.supervisorRating;
            const newVal = merged[i]?.supervisorRating;
            if (oldVal !== newVal && newVal !== undefined) {
              overrideLogs.push({
                fieldName: `goals[${i}].supervisorRating`,
                fieldLabel: `Goal ${i + 1}: ${merged[i]?.description || ''}`.trim(),
                originalValue: String(oldVal ?? ''),
                newValue: String(newVal),
              });
            }
          }
        }
        updateData.goalsJson = JSON.stringify(merged);
      }
      if (body.technicalSkills !== undefined && existing) {
        const merged = mergeRatingArrays(existing.technicalSkills, body.technicalSkills, 'employeeRating');
        if (isManagementOverride) {
          for (let i = 0; i < merged.length; i++) {
            const oldVal = existing.technicalSkills[i]?.supervisorRating;
            const newVal = merged[i]?.supervisorRating;
            if (oldVal !== newVal && newVal !== undefined) {
              overrideLogs.push({
                fieldName: `technicalSkills[${i}].supervisorRating`,
                fieldLabel: `Technical: ${merged[i]?.name || ''}`.trim(),
                originalValue: String(oldVal ?? ''),
                newValue: String(newVal),
              });
            }
          }
        }
        updateData.technicalSkillsJson = JSON.stringify(merged);
      }
      if (body.leadershipSkills !== undefined && existing) {
        const merged = mergeRatingArrays(existing.leadershipSkills, body.leadershipSkills, 'employeeRating');
        if (isManagementOverride) {
          for (let i = 0; i < merged.length; i++) {
            const oldVal = existing.leadershipSkills[i]?.supervisorRating;
            const newVal = merged[i]?.supervisorRating;
            if (oldVal !== newVal && newVal !== undefined) {
              overrideLogs.push({
                fieldName: `leadershipSkills[${i}].supervisorRating`,
                fieldLabel: `Leadership: ${merged[i]?.name || ''}`.trim(),
                originalValue: String(oldVal ?? ''),
                newValue: String(newVal),
              });
            }
          }
        }
        updateData.leadershipSkillsJson = JSON.stringify(merged);
      }
      if (body.managerialSkills !== undefined && existing) {
        const merged = mergeRatingArrays(existing.managerialSkills, body.managerialSkills, 'employeeRating');
        if (isManagementOverride) {
          for (let i = 0; i < merged.length; i++) {
            const oldVal = existing.managerialSkills[i]?.supervisorRating;
            const newVal = merged[i]?.supervisorRating;
            if (oldVal !== newVal && newVal !== undefined) {
              overrideLogs.push({
                fieldName: `managerialSkills[${i}].supervisorRating`,
                fieldLabel: `Managerial: ${merged[i]?.name || ''}`.trim(),
                originalValue: String(oldVal ?? ''),
                newValue: String(newVal),
              });
            }
          }
        }
        updateData.managerialSkillsJson = JSON.stringify(merged);
      }
      if (body.ceoSignature !== undefined) {
        updateData.ceoSignature = body.ceoSignature;
      }
      if (body.ceoSignatureDate !== undefined) {
        updateData.ceoSignatureDate = body.ceoSignatureDate || null;
      }
      if (body.supervisorSignature !== undefined) {
        updateData.supervisorSignature = body.supervisorSignature;
      }
      if (body.supervisorSignatureDate !== undefined) {
        updateData.supervisorSignatureDate = body.supervisorSignatureDate || null;
      }
      if (body.remarks !== undefined && existing) {
        // Management remarks — merge preserving other stages
        const merged = mergeRemarks(existing.remarks, body.remarks, 'management');
        updateData.remarksJson = JSON.stringify(merged);
      }

      // Save override logs to database
      if (overrideLogs.length > 0) {
        const overrideReason = body.overrideReason || 'Management override';
        for (const log of overrideLogs) {
          await db.managementOverrideLog.create({
            data: {
              assignmentId: id,
              editorId: callerId,
              fieldName: log.fieldName,
              fieldLabel: log.fieldLabel,
              originalValue: log.originalValue,
              newValue: log.newValue,
              reason: overrideReason,
              stage: 'management',
            },
          });
        }
        // Also create an audit log entry
        await db.auditLog.create({
          data: {
            assignmentId: id,
            userId: callerId,
            action: 'management_override',
            previousStatus: assignment.status,
            newStatus: assignment.status,
            details: `Management overrode ${overrideLogs.length} supervisor score(s). Reason: ${overrideReason}`,
            remarks: overrideReason,
          },
        });
      }
    }

    // ── Recalculate scores using MERGED data ──
    // Use the final merged arrays (existing + updates) for calculation
    const formForCalc = {
      achievements: updateData.achievementsJson ? JSON.parse(updateData.achievementsJson as string) : (existing?.achievements || []),
      goals: updateData.goalsJson ? JSON.parse(updateData.goalsJson as string) : (existing?.goals || []),
      technicalSkills: updateData.technicalSkillsJson ? JSON.parse(updateData.technicalSkillsJson as string) : (existing?.technicalSkills || []),
      leadershipSkills: updateData.leadershipSkillsJson ? JSON.parse(updateData.leadershipSkillsJson as string) : (existing?.leadershipSkills || []),
      managerialSkills: updateData.managerialSkillsJson ? JSON.parse(updateData.managerialSkillsJson as string) : (existing?.managerialSkills || []),
      explanations: updateData.explanationsJson ? JSON.parse(updateData.explanationsJson as string) : (existing?.explanations || []),
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
      formData = await db.appraisalFormData.update({
        where: { assignmentId: id },
        data: updateData,
      });
    } else {
      // Create new with the merged data
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
