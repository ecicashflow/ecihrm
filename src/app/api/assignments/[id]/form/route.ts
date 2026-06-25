import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createDefaultFormData, calculateAppraisalScores } from '@/lib/constants';
import { requireAuth } from '@/lib/auth-guard';

// Map workflow stage to review stage
const STAGE_MAP: Record<string, string> = {
  employee: 'EMPLOYEE_SELF',
  supervisor: 'SUPERVISOR_REVIEW',
  hr: 'HR_INITIAL_REVIEW',
  management: 'MANAGEMENT_REVIEW',
  ceo: 'CEO_APPROVAL',
};

// Sections that have ratings (achievements, goals, technicalSkills, leadershipSkills, managerialSkills)
const RATED_SECTIONS = ['achievements', 'goals', 'technicalSkills', 'leadershipSkills', 'managerialSkills'];

/**
 * GET /api/assignments/[id]/form
 * Returns the COMPLETE appraisal detail with ALL reviewer stages separately.
 * Does NOT filter by current reviewer role — all prior-stage data is always returned.
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
        employee: { select: { id: true, name: true, employeeId: true, designation: true, department: true, overallExp: true, yearsWithECI: true, currentEdu: true } },
        supervisor: { select: { id: true, name: true, designation: true } },
        escalatedSupervisor: { select: { id: true, name: true, designation: true } },
        hrReviewer: { select: { id: true, name: true, designation: true } },
        managementReviewer: { select: { id: true, name: true, designation: true } },
        ceoApprover: { select: { id: true, name: true, designation: true } },
        cycle: { select: { id: true, name: true, cycleType: true, year: true, periodFrom: true, periodTo: true } },
        formData: true,
        criterionResponses: { orderBy: [{ criterionSection: 'asc' }, { criterionIndex: 'asc' }] },
        stageReviews: true,
        overrideLogs: { include: { editor: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // If no formData yet, create it with defaults
    if (!assignment.formData) {
      const emp = assignment.employee;
      const sup = assignment.supervisor;
      const cyc = assignment.cycle;
      const designation = await db.designation.findUnique({ where: { title: emp.designation } });
      assignment.formData = await db.appraisalFormData.create({
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

    // Build the response: combine legacy JSON data with new criterion-response data
    // If criterion responses exist, use them; otherwise fall back to legacy JSON
    const fd = assignment.formData;
    const responses = assignment.criterionResponses || [];
    const stageReviews = assignment.stageReviews || [];

    // Group responses by section+index, then by reviewStage
    const responseMap = new Map<string, Record<string, any>>();
    for (const r of responses) {
      const key = `${r.criterionSection}__${r.criterionIndex}`;
      if (!responseMap.has(key)) responseMap.set(key, {});
      const stageData = responseMap.get(key)!;
      stageData[r.reviewStage] = {
        score: r.score,
        rating: r.rating,
        remarks: r.remarks,
        description: r.description,
        savedByUserId: r.savedByUserId,
        draftSavedAt: r.draftSavedAt,
        submittedAt: r.submittedAt,
      };
    }

    // Group stage reviews by reviewStage
    const stageReviewMap = new Map<string, any>();
    for (const sr of stageReviews) {
      stageReviewMap.set(sr.reviewStage, {
        status: sr.status,
        overallRemarks: sr.overallRemarks,
        returnReason: sr.returnReason,
        signature: sr.signature,
        signatureDate: sr.signatureDate,
        draftSavedAt: sr.draftSavedAt,
        submittedAt: sr.submittedAt,
        approvedAt: sr.approvedAt,
      });
    }

    // Parse legacy JSON for backward compatibility
    const legacyAchievements = JSON.parse(fd.achievementsJson);
    const legacyGoals = JSON.parse(fd.goalsJson);
    const legacyTechSkills = JSON.parse(fd.technicalSkillsJson);
    const legacyLeadSkills = JSON.parse(fd.leadershipSkillsJson);
    const legacyMgrSkills = JSON.parse(fd.managerialSkillsJson);
    const legacyExplanations = JSON.parse(fd.explanationsJson);
    const legacyFutureGoals = JSON.parse(fd.futureGoalsJson);
    const legacyRemarks = JSON.parse(fd.remarksJson);

    // Build merged arrays: prefer criterion responses (authoritative per-stage
    // data) over legacy JSON. The legacy JSON can have stale/missing values if
    // a previous PUT call failed partway through. Criterion responses are the
    // source of truth — each reviewer's score is stored in its own row keyed
    // by (assignmentId, criterionName, section, index, reviewStage).
    function buildMergedArray(section: string, legacy: any[], defaults: any[]) {
      const result: any[] = [];
      const maxLen = Math.max(legacy.length, defaults.length);
      for (let i = 0; i < maxLen; i++) {
        const leg = legacy[i] || {};
        const def = defaults[i] || {};
        const key = `${section}__${i}`;
        const respData = responseMap.get(key) || {};

        // Criterion response scores (authoritative). A score of 0 is valid
        // ("No Achievement"), so we only fall back to legacy if the criterion
        // response doesn't exist at all (undefined).
        const empResp = respData.EMPLOYEE_SELF;
        const supResp = respData.SUPERVISOR_REVIEW;

        // Helper: convert criterion-response rating (string) to number|'NA'
        function normalizeRating(rating: any): number | 'NA' {
          if (rating === undefined || rating === null || rating === '') return 0;
          if (rating === 'NA') return 'NA';
          const n = Number(rating);
          return isNaN(n) ? 0 : n;
        }

        const employeeRating =
          empResp !== undefined ? normalizeRating(empResp.rating) :
          (leg.employeeRating ?? def.employeeRating ?? 0);
        const supervisorRating =
          supResp !== undefined ? normalizeRating(supResp.rating) :
          (leg.supervisorRating ?? def.supervisorRating ?? 0);

        result.push({
          ...def,
          ...leg,
          name: leg.name || def.name || '',
          description: leg.description || def.description || '',
          employeeRating,
          supervisorRating,
          // Also include structured response data by stage
          responses: respData,
        });
      }
      return result;
    }

    const defaults = createDefaultFormData();
    const result = {
      ...fd,
      // Basic info
      employeeName: fd.employeeName,
      employeeId: fd.employeeId,
      designation: fd.designation,
      overallExp: fd.overallExp,
      yearsWithECI: fd.yearsWithECI,
      currentEdu: fd.currentEdu,
      requiredExp: fd.requiredExp,
      requiredEdu: fd.requiredEdu,
      department: fd.department,
      appraisalPeriod: fd.appraisalPeriod,
      lineManagerName: fd.lineManagerName,
      lineManagerDesignation: fd.lineManagerDesignation,
      // Arrays (merged legacy + new responses)
      achievements: buildMergedArray('achievements', legacyAchievements, defaults.achievements),
      goals: buildMergedArray('goals', legacyGoals, defaults.goals),
      technicalSkills: buildMergedArray('technicalSkills', legacyTechSkills, defaults.technicalSkills),
      leadershipSkills: buildMergedArray('leadershipSkills', legacyLeadSkills, defaults.leadershipSkills),
      managerialSkills: buildMergedArray('managerialSkills', legacyMgrSkills, defaults.managerialSkills),
      explanations: legacyExplanations.length > 0 ? legacyExplanations : defaults.explanations,
      futureGoals: legacyFutureGoals.length > 0 ? legacyFutureGoals : defaults.futureGoals,
      remarks: legacyRemarks,
      // Signatures (from legacy + stage reviews)
      employeeSignature: stageReviewMap.get('EMPLOYEE_SELF')?.signature ?? fd.employeeSignature ?? '',
      employeeSignatureDate: stageReviewMap.get('EMPLOYEE_SELF')?.signatureDate ?? fd.employeeSignatureDate ?? '',
      supervisorSignature: stageReviewMap.get('SUPERVISOR_REVIEW')?.signature ?? fd.supervisorSignature ?? '',
      supervisorSignatureDate: stageReviewMap.get('SUPERVISOR_REVIEW')?.signatureDate ?? fd.supervisorSignatureDate ?? '',
      ceoSignature: stageReviewMap.get('CEO_APPROVAL')?.signature ?? fd.ceoSignature ?? '',
      ceoSignatureDate: stageReviewMap.get('CEO_APPROVAL')?.signatureDate ?? fd.ceoSignatureDate ?? '',
      // Structured stage data (always available)
      stageReviews: Object.fromEntries(stageReviewMap),
      // Override logs
      overrideLogs: assignment.overrideLogs || [],
      // AI analysis
      aiAnalysis: JSON.parse(fd.aiAnalysisJson || '{}'),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get form data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/assignments/[id]/form
 * Saves ONLY the current reviewer's stage data.
 * Uses database transaction to save both legacy JSON (for backward compat) and
 * new criterion-response rows (for permanent separation).
 * NEVER overwrites another reviewer's data.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const assignment = await db.appraisalAssignment.findUnique({
      where: { id },
      include: { employee: { select: { id: true, name: true } } },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Authorize: only the current stage's reviewer can save
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const callerId = auth.userId!;
    const callerRole = auth.role!;
    const isAdmin = callerRole === 'admin';

    const currentStage = assignment.currentActionBy;
    const reviewStage = STAGE_MAP[currentStage] || 'EMPLOYEE_SELF';

    // Check edit permission
    const isEmployee = assignment.employeeId === callerId;
    const isSupervisor = (assignment.supervisorId === callerId || assignment.escalatedSupervisorId === callerId) && !isEmployee;
    const isHR = callerRole === 'hr';
    const isManagement = callerRole === 'management' || callerRole === 'ceo';

    const STAGE_AUTH: Record<string, boolean> = {
      employee: isEmployee || isAdmin,
      supervisor: isSupervisor || isAdmin,
      hr: isHR || isAdmin,
      management: isManagement || isAdmin,
      ceo: isManagement || isAdmin,
    };

    const canEdit = STAGE_AUTH[currentStage] ?? false;
    if (!canEdit) {
      return NextResponse.json(
        { error: `This appraisal is in the ${currentStage} stage. Only the designated reviewer can save.` },
        { status: 403 }
      );
    }

    // Determine if this is a draft save or submit
    const isDraft = body._isDraft === true;

    // Use transaction for atomic save.
    // NOTE: Neon + PgBouncer connections can be slow/short-lived. We extend the
    // transaction timeout to 30s (default is 5s) so the many sequential upserts
    // for criterion responses don't fail with "Transaction not found" (P2028).
    await db.$transaction(async (tx) => {
      // 1. Save to legacy JSON (for backward compatibility with the existing UI)
      let formData = await tx.appraisalFormData.findUnique({ where: { assignmentId: id } });
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

      const updateData: Record<string, unknown> = {};

      // MERGE: preserve other roles' data, update only current role's data
      // Use the mergeRatingArrays approach for legacy JSON
      function mergeRatingArrays(existingArr: any[], incomingArr: any[], preserveKey: string): any[] {
        if (!Array.isArray(existingArr) || !Array.isArray(incomingArr)) return incomingArr || existingArr || [];
        const maxLen = Math.max(existingArr.length, incomingArr.length);
        const result: any[] = [];
        const otherKey = preserveKey === 'employeeRating' ? 'supervisorRating' : 'employeeRating';
        for (let i = 0; i < maxLen; i++) {
          const ex = existingArr[i] || {};
          const inc = incomingArr[i] || {};
          const merged: any = { ...ex };
          if (inc.description !== undefined) merged.description = inc.description;
          if (inc.name !== undefined) merged.name = inc.name;
          // Save the incoming rating for the "other" role (the one being updated).
          // 0 is a valid rating ("No Achievement"), so we accept any defined value.
          // 'NA' is also valid. Only fall back to existing if incoming is undefined.
          const incRating = inc[otherKey];
          const exRating = ex[otherKey];
          if (incRating === 'NA') merged[otherKey] = 'NA';
          else if (incRating !== undefined && incRating !== null) merged[otherKey] = incRating;
          else if (exRating !== undefined) merged[otherKey] = exRating;
          else merged[otherKey] = 0;
          // Preserve the other role's rating from existing data
          merged[preserveKey] = ex[preserveKey] !== undefined ? ex[preserveKey] : (inc[preserveKey] ?? 0);
          result.push(merged);
        }
        return result;
      }

      if (currentStage === 'employee') {
        if (body.achievements !== undefined) updateData.achievementsJson = JSON.stringify(existing ? mergeRatingArrays(existing.achievements, body.achievements, 'supervisorRating') : body.achievements);
        if (body.goals !== undefined) updateData.goalsJson = JSON.stringify(existing ? mergeRatingArrays(existing.goals, body.goals, 'supervisorRating') : body.goals);
        if (body.technicalSkills !== undefined) updateData.technicalSkillsJson = JSON.stringify(existing ? mergeRatingArrays(existing.technicalSkills, body.technicalSkills, 'supervisorRating') : body.technicalSkills);
        if (body.leadershipSkills !== undefined) updateData.leadershipSkillsJson = JSON.stringify(existing ? mergeRatingArrays(existing.leadershipSkills, body.leadershipSkills, 'supervisorRating') : body.leadershipSkills);
        if (body.managerialSkills !== undefined) updateData.managerialSkillsJson = JSON.stringify(existing ? mergeRatingArrays(existing.managerialSkills, body.managerialSkills, 'supervisorRating') : body.managerialSkills);
        if (body.explanations !== undefined) updateData.explanationsJson = JSON.stringify(body.explanations);
        if (body.futureGoals !== undefined) updateData.futureGoalsJson = JSON.stringify(body.futureGoals);
        if (body.employeeSignature !== undefined) updateData.employeeSignature = body.employeeSignature || '';
        // Schema fields are `String @default("")` (non-nullable) — use '' not null.
        if (body.employeeSignatureDate !== undefined) updateData.employeeSignatureDate = body.employeeSignatureDate || '';
      } else if (currentStage === 'supervisor') {
        if (body.achievements !== undefined && existing) updateData.achievementsJson = JSON.stringify(mergeRatingArrays(existing.achievements, body.achievements, 'employeeRating'));
        if (body.goals !== undefined && existing) updateData.goalsJson = JSON.stringify(mergeRatingArrays(existing.goals, body.goals, 'employeeRating'));
        if (body.technicalSkills !== undefined && existing) updateData.technicalSkillsJson = JSON.stringify(mergeRatingArrays(existing.technicalSkills, body.technicalSkills, 'employeeRating'));
        if (body.leadershipSkills !== undefined && existing) updateData.leadershipSkillsJson = JSON.stringify(mergeRatingArrays(existing.leadershipSkills, body.leadershipSkills, 'employeeRating'));
        if (body.managerialSkills !== undefined && existing) updateData.managerialSkillsJson = JSON.stringify(mergeRatingArrays(existing.managerialSkills, body.managerialSkills, 'employeeRating'));
        if (body.supervisorSignature !== undefined) updateData.supervisorSignature = body.supervisorSignature || '';
        // Schema fields are `String @default("")` (non-nullable) — use '' not null.
        if (body.supervisorSignatureDate !== undefined) updateData.supervisorSignatureDate = body.supervisorSignatureDate || '';
        if (body.remarks !== undefined && existing) {
          const mergedRemarks = { ...existing.remarks, ...body.remarks };
          // Preserve HR fields
          const hrFields = ['hrSatisfactionSkills', 'hrSatisfactionBehavior', 'hrSatisfactionPerformance', 'hrRecommendationMonitoring', 'hrRecommendationPromotion', 'hrRecommendationReward', 'hrGeneralRemarks'];
          for (const f of hrFields) if (existing.remarks[f] !== undefined) mergedRemarks[f] = existing.remarks[f];
          updateData.remarksJson = JSON.stringify(mergedRemarks);
        }
      } else if (currentStage === 'hr') {
        if (body.remarks !== undefined && existing) {
          const mergedRemarks = { ...existing.remarks, ...body.remarks };
          const supFields = ['supervisorSatisfaction', 'supervisorConsiderationPromotion', 'supervisorConsiderationIncrement', 'supervisorConsiderationReward', 'supervisorGeneralRemarks'];
          for (const f of supFields) if (existing.remarks[f] !== undefined) mergedRemarks[f] = existing.remarks[f];
          updateData.remarksJson = JSON.stringify(mergedRemarks);
        }
      } else if (currentStage === 'management' || currentStage === 'ceo' || isAdmin) {
        // Management/CEO/Admin can override
        if (body.achievements !== undefined && existing) updateData.achievementsJson = JSON.stringify(mergeRatingArrays(existing.achievements, body.achievements, 'employeeRating'));
        if (body.goals !== undefined && existing) updateData.goalsJson = JSON.stringify(mergeRatingArrays(existing.goals, body.goals, 'employeeRating'));
        if (body.technicalSkills !== undefined && existing) updateData.technicalSkillsJson = JSON.stringify(mergeRatingArrays(existing.technicalSkills, body.technicalSkills, 'employeeRating'));
        if (body.leadershipSkills !== undefined && existing) updateData.leadershipSkillsJson = JSON.stringify(mergeRatingArrays(existing.leadershipSkills, body.leadershipSkills, 'employeeRating'));
        if (body.managerialSkills !== undefined && existing) updateData.managerialSkillsJson = JSON.stringify(mergeRatingArrays(existing.managerialSkills, body.managerialSkills, 'employeeRating'));
        if (body.remarks !== undefined && existing) updateData.remarksJson = JSON.stringify(body.remarks);
        if (body.ceoSignature !== undefined) updateData.ceoSignature = body.ceoSignature || '';
        // Schema fields are `String @default("")` (non-nullable) — use '' not null.
        if (body.ceoSignatureDate !== undefined) updateData.ceoSignatureDate = body.ceoSignatureDate || '';
        if (body.supervisorSignature !== undefined) updateData.supervisorSignature = body.supervisorSignature || '';
        if (body.supervisorSignatureDate !== undefined) updateData.supervisorSignatureDate = body.supervisorSignatureDate || '';
      }

      // Recalculate scores
      const formForCalc = {
        achievements: updateData.achievementsJson ? JSON.parse(updateData.achievementsJson as string) : (existing?.achievements || []),
        goals: updateData.goalsJson ? JSON.parse(updateData.goalsJson as string) : (existing?.goals || []),
        technicalSkills: updateData.technicalSkillsJson ? JSON.parse(updateData.technicalSkillsJson as string) : (existing?.technicalSkills || []),
        leadershipSkills: updateData.leadershipSkillsJson ? JSON.parse(updateData.leadershipSkillsJson as string) : (existing?.leadershipSkills || []),
        managerialSkills: updateData.managerialSkillsJson ? JSON.parse(updateData.managerialSkillsJson as string) : (existing?.managerialSkills || []),
        explanations: updateData.explanationsJson ? JSON.parse(updateData.explanationsJson as string) : (existing?.explanations || []),
      };
      const empScores = calculateAppraisalScores(formForCalc, 'employee');
      const supScores = calculateAppraisalScores(formForCalc, 'supervisor');
      Object.assign(updateData, {
        achievementsSubtotalEmployee: empScores.marksGoals,
        technicalSubtotalEmployee: empScores.techSubtotal,
        leadershipSubtotalEmployee: empScores.leadSubtotal,
        managerialSubtotalEmployee: empScores.mgrSubtotal,
        totalCompetenciesEmployee: empScores.totalCompetencies,
        totalMarksDeducted: empScores.marksDeducted,
        grandTotalEmployee: empScores.grandTotal,
        overallPercentageEmployee: empScores.overallPercentage,
        ratingEmployee: empScores.rating,
        achievementsSubtotalSupervisor: supScores.marksGoals,
        technicalSubtotalSupervisor: supScores.techSubtotal,
        leadershipSubtotalSupervisor: supScores.leadSubtotal,
        managerialSubtotalSupervisor: supScores.mgrSubtotal,
        totalCompetenciesSupervisor: supScores.totalCompetencies,
        grandTotalSupervisor: supScores.grandTotal,
        overallPercentageSupervisor: supScores.overallPercentage,
        ratingSupervisor: supScores.rating,
      });

      if (formData) {
        await tx.appraisalFormData.update({ where: { assignmentId: id }, data: updateData });
      }

      // 2. Save to new criterion-response table (permanent separation by stage)
      // For each rated section, upsert criterion responses
      const sections = [
        { key: 'achievements', section: 'achievements', data: body.achievements },
        { key: 'goals', section: 'goals', data: body.goals },
        { key: 'technicalSkills', section: 'technicalSkills', data: body.technicalSkills },
        { key: 'leadershipSkills', section: 'leadershipSkills', data: body.leadershipSkills },
        { key: 'managerialSkills', section: 'managerialSkills', data: body.managerialSkills },
      ];

      for (const sec of sections) {
        if (!sec.data || !Array.isArray(sec.data)) continue;
        for (let i = 0; i < sec.data.length; i++) {
          const item = sec.data[i];
          const criterionName = item.name || `Item ${i + 1}`;
          const rating = currentStage === 'employee' ? String(item.employeeRating ?? 0) : String(item.supervisorRating ?? 0);
          const description = item.description ?? '';
          
          await tx.appraisalCriterionResponse.upsert({
            where: {
              assignmentId_criterionName_criterionSection_criterionIndex_reviewStage: {
                assignmentId: id,
                criterionName,
                criterionSection: sec.section,
                criterionIndex: i,
                reviewStage,
              }
            },
            create: {
              assignmentId: id,
              criterionName,
              criterionSection: sec.section,
              criterionIndex: i,
              reviewStage,
              score: Number(rating) || 0,
              rating,
              remarks: description,
              description,
              savedByUserId: callerId,
              draftSavedAt: isDraft ? new Date() : null,
              submittedAt: !isDraft ? new Date() : null,
            },
            update: {
              score: Number(rating) || 0,
              rating,
              remarks: description,
              description,
              savedByUserId: callerId,
              ...(isDraft ? { draftSavedAt: new Date() } : { submittedAt: new Date() }),
            },
          });
        }
      }

      // 3. Save stage review record
      const stageReviewData: Record<string, unknown> = {
        assignmentId: id,
        reviewStage,
        assignedUserId: callerId,
        status: isDraft ? 'draft' : 'submitted',
      };

      if (currentStage === 'employee') {
        if (body.employeeSignature !== undefined) {
          stageReviewData.signature = body.employeeSignature;
          stageReviewData.signatureDate = body.employeeSignatureDate || '';
        }
      } else if (currentStage === 'supervisor') {
        if (body.supervisorSignature !== undefined) {
          stageReviewData.signature = body.supervisorSignature;
          stageReviewData.signatureDate = body.supervisorSignatureDate || '';
        }
        if (body.remarks?.supervisorGeneralRemarks !== undefined) {
          stageReviewData.overallRemarks = body.remarks.supervisorGeneralRemarks;
        }
      } else if (currentStage === 'hr') {
        if (body.remarks?.hrGeneralRemarks !== undefined) {
          stageReviewData.overallRemarks = body.remarks.hrGeneralRemarks;
        }
      } else if (currentStage === 'ceo') {
        if (body.ceoSignature !== undefined) {
          stageReviewData.signature = body.ceoSignature;
          stageReviewData.signatureDate = body.ceoSignatureDate || '';
        }
      }

      if (isDraft) {
        stageReviewData.draftSavedAt = new Date();
      } else {
        stageReviewData.submittedAt = new Date();
      }

      await tx.appraisalStageReview.upsert({
        where: { assignmentId_reviewStage: { assignmentId: id, reviewStage } },
        create: stageReviewData as any,
        update: stageReviewData as any,
      });
    }, {
      maxWait: 20000,  // max time to acquire a transaction connection
      timeout: 30000,  // max time the transaction can run (default 5s is too short for Neon)
    });

    // Return the updated form data
    const updatedAssignment = await db.appraisalAssignment.findUnique({
      where: { id },
      include: {
        formData: true,
        criterionResponses: { orderBy: [{ criterionSection: 'asc' }, { criterionIndex: 'asc' }] },
        stageReviews: true,
      },
    });

    const fd = updatedAssignment?.formData;
    if (!fd) return NextResponse.json({ error: 'Form data not found' }, { status: 404 });

    const result = {
      ...fd,
      achievements: JSON.parse(fd.achievementsJson),
      goals: JSON.parse(fd.goalsJson),
      technicalSkills: JSON.parse(fd.technicalSkillsJson),
      leadershipSkills: JSON.parse(fd.leadershipSkillsJson),
      managerialSkills: JSON.parse(fd.managerialSkillsJson),
      explanations: JSON.parse(fd.explanationsJson),
      futureGoals: JSON.parse(fd.futureGoalsJson),
      remarks: JSON.parse(fd.remarksJson),
      aiAnalysis: JSON.parse(fd.aiAnalysisJson || '{}'),
      criterionResponses: updatedAssignment?.criterionResponses || [],
      stageReviews: updatedAssignment?.stageReviews || [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Save form data error:', error);
    return NextResponse.json({ error: 'Internal server error', detail: String(error) }, { status: 500 });
  }
}
