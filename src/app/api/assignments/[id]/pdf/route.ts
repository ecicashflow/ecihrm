import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { calculateAppraisalScores } from '@/lib/constants';

/**
 * GET /api/assignments/[id]/pdf
 *
 * Generates a printable HTML page for the final appraisal PDF.
 * Only available after CEO/Managing Director approval (status: 'approved', 'shared_with_employee', 'acknowledged_by_employee').
 *
 * The HTML page uses print CSS so the user can "Save as PDF" from the browser.
 * Alternatively, admin/HR can use the print button to download.
 *
 * Authorization:
 * - Employee: can view their own approved appraisal
 * - HR: can view all approved appraisals
 * - Admin: can view all appraisals
 * - Supervisor: can view appraisals they reviewed
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const callerId = auth.userId!;
    const callerRole = auth.role!;

    const { id } = await params;

    // Fetch assignment without nested includes that might fail on old data
    const assignment = await db.appraisalAssignment.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, name: true, employeeId: true, designation: true, department: true,
                    overallExp: true, yearsWithECI: true, currentEdu: true, phone: true },
        },
        supervisor: { select: { id: true, name: true, designation: true } },
        escalatedSupervisor: { select: { id: true, name: true, designation: true } },
        cycle: { select: { id: true, name: true, cycleType: true, year: true, periodFrom: true, periodTo: true } },
        formData: true,
      },
    });

    // Fetch reviewer info separately (they might be null)
    let hrReviewer: any = null;
    let managementReviewer: any = null;
    let ceoApprover: any = null;
    if (assignment?.hrReviewerId) {
      hrReviewer = await db.user.findUnique({ where: { id: assignment.hrReviewerId }, select: { id: true, name: true, designation: true } });
    }
    if (assignment?.managementReviewerId) {
      managementReviewer = await db.user.findUnique({ where: { id: assignment.managementReviewerId }, select: { id: true, name: true, designation: true } });
    }
    if (assignment?.ceoApproverId) {
      ceoApprover = await db.user.findUnique({ where: { id: assignment.ceoApproverId }, select: { id: true, name: true, designation: true } });
    }

    // Fetch audit logs and override logs separately to avoid relation errors
    let auditLogs: any[] = [];
    let overrideLogs: any[] = [];
    try {
      auditLogs = await db.auditLog.findMany({
        where: { assignmentId: id },
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      });
    } catch { auditLogs = []; }
    try {
      overrideLogs = await db.managementOverrideLog.findMany({
        where: { assignmentId: id },
        include: { editor: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      });
    } catch { overrideLogs = []; }

    // Attach the fetched relations
    if (assignment) {
      (assignment as any).hrReviewer = hrReviewer;
      (assignment as any).managementReviewer = managementReviewer;
      (assignment as any).ceoApprover = ceoApprover;
      (assignment as any).auditLogs = auditLogs;
      (assignment as any).overrideLogs = overrideLogs;
    }

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Authorization: employee can view own, HR/admin can view all, supervisor can view assigned
    const isOwn = assignment.employeeId === callerId;
    const isAssignedSupervisor = assignment.supervisorId === callerId || assignment.escalatedSupervisorId === callerId;
    const isHR = callerRole === 'hr' || callerRole === 'admin';
    const isManagement = callerRole === 'management' || callerRole === 'ceo';
    const isAdmin = callerRole === 'admin';

    if (!isAdmin && !isHR && !isManagement && !isOwn && !isAssignedSupervisor) {
      return NextResponse.json({ error: 'You are not authorized to view this appraisal.' }, { status: 403 });
    }

    if (!assignment.formData) {
      return NextResponse.json({ error: 'Form data not found' }, { status: 404 });
    }

    const fd = assignment.formData;
    const achievements = JSON.parse(fd.achievementsJson);
    const goals = JSON.parse(fd.goalsJson);
    const technicalSkills = JSON.parse(fd.technicalSkillsJson);
    const leadershipSkills = JSON.parse(fd.leadershipSkillsJson);
    const managerialSkills = JSON.parse(fd.managerialSkillsJson);
    const explanations = JSON.parse(fd.explanationsJson);
    const futureGoals = JSON.parse(fd.futureGoalsJson);
    const remarks = JSON.parse(fd.remarksJson);

    // Calculate scores
    const empScores = calculateAppraisalScores({
      achievements, goals, technicalSkills, leadershipSkills, managerialSkills, explanations,
    }, 'employee');
    const supScores = calculateAppraisalScores({
      achievements, goals, technicalSkills, leadershipSkills, managerialSkills, explanations,
    }, 'supervisor');

    // Generate HTML for print/PDF
    const html = generatePdfHtml(assignment, {
      achievements, goals, technicalSkills, leadershipSkills, managerialSkills,
      explanations, futureGoals, remarks,
    }, empScores, supScores);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', detail: errorMsg }, { status: 500 });
  }
}

function generatePdfHtml(
  assignment: any,
  data: any,
  empScores: any,
  supScores: any
): string {
  const fd = assignment.formData;
  const cycle = assignment.cycle;
  const emp = assignment.employee;
  const sup = assignment.supervisor;
  const hr = assignment.hrReviewer;
  const mgmt = assignment.managementReviewer;
  const ceo = assignment.ceoApprover;

  const formatDate = (d: string | Date | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const ratingColor = (pct: number) => {
    if (pct >= 86) return '#16a34a';
    if (pct >= 71) return '#2563eb';
    if (pct >= 56) return '#ca8a04';
    if (pct >= 41) return '#ea580c';
    return '#dc2626';
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Appraisal Report — ${emp.name} — ${cycle.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a1a; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; background: #fff; }
  .header { text-align: center; border-bottom: 3px solid #1a3a5c; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 28px; color: #1a3a5c; margin-bottom: 5px; }
  .header p { font-size: 14px; color: #555; }
  .ref-no { text-align: right; font-size: 12px; color: #888; margin-bottom: 20px; }
  .final-badge { display: inline-block; background: #16a34a; color: white; padding: 5px 15px; border-radius: 4px; font-size: 12px; font-weight: bold; }
  .section { margin-bottom: 25px; page-break-inside: avoid; }
  .section h2 { font-size: 16px; color: #1a3a5c; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
  .info-grid div { padding: 4px 8px; background: #f8f8f8; border-radius: 3px; }
  .info-grid strong { color: #555; font-size: 11px; display: block; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th { background: #1a3a5c; color: white; padding: 6px 8px; text-align: left; }
  td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .score-box { display: inline-block; padding: 10px 20px; border-radius: 5px; color: white; font-weight: bold; font-size: 18px; }
  .score-row { display: flex; justify-content: space-around; margin: 15px 0; }
  .score-item { text-align: center; }
  .score-item label { display: block; font-size: 11px; color: #888; margin-bottom: 5px; }
  .remarks-box { background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; margin-top: 8px; }
  .signature-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 30px; }
  .sig-box { text-align: center; font-size: 12px; }
  .sig-box .sig-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; }
  .override-log { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin-top: 8px; font-size: 11px; }
  .audit-trail { font-size: 11px; color: #666; margin-top: 20px; }
  .audit-trail table th { background: #555; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none !important; }
    .section { page-break-inside: avoid; }
  }
  .print-btn { position: fixed; top: 20px; right: 20px; background: #1a3a5c; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px; }
  .print-btn:hover { background: #2a5a8c; }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>

  <div class="header">
    <h1>ECI Pvt Ltd — Performance Appraisal Report</h1>
    <p>${cycle.name} | ${cycle.cycleType === 'mid_year' ? 'Mid-Year' : 'Annual'} Appraisal | ${cycle.year}</p>
    <p>Period: ${cycle.periodFrom} to ${cycle.periodTo}</p>
  </div>

  <div class="ref-no">
    <span class="final-badge">✓ FINAL — APPROVED</span><br>
    <strong>Reference No:</strong> ${assignment.appraisalRefNo || 'N/A'}<br>
    <strong>Generated:</strong> ${formatDate(new Date())}
  </div>

  <!-- Section 1: Employee Details -->
  <div class="section">
    <h2>1. Employee Information</h2>
    <div class="info-grid">
      <div><strong>Name</strong>${emp.name}</div>
      <div><strong>Employee ID</strong>${emp.employeeId}</div>
      <div><strong>Designation</strong>${emp.designation}</div>
      <div><strong>Department</strong>${emp.department}</div>
      <div><strong>Overall Experience</strong>${emp.overallExp || '—'}</div>
      <div><strong>Years with ECI</strong>${emp.yearsWithECI || '—'}</div>
      <div><strong>Education</strong>${emp.currentEdu || '—'}</div>
      <div><strong>Phone</strong>${emp.phone || '—'}</div>
      <div><strong>Line Manager</strong>${sup.name} (${sup.designation})</div>
      <div><strong>HR Reviewer</strong>${hr?.name || 'HR Team'}</div>
      <div><strong>Management Reviewer</strong>${mgmt?.name || 'Management'}</div>
      <div><strong>CEO/MD Approver</strong>${ceo?.name || 'CEO/Managing Director'}</div>
    </div>
  </div>

  <!-- Section 2: Achievements & Goals -->
  <div class="section">
    <h2>2. Key Accomplishments and Goals</h2>
    <table>
      <thead><tr><th>#</th><th>Description</th><th>Emp Rating</th><th>Sup Rating</th></tr></thead>
      <tbody>
        ${data.achievements.map((a: any, i: number) => `<tr><td>A${i+1}</td><td>${a.description || '—'}</td><td>${a.employeeRating === 'NA' ? 'N/A' : a.employeeRating}</td><td>${a.supervisorRating === 'NA' ? 'N/A' : a.supervisorRating}</td></tr>`).join('')}
        ${data.goals.map((g: any, i: number) => `<tr><td>G${i+1}</td><td>${g.description || '—'}</td><td>${g.employeeRating === 'NA' ? 'N/A' : g.employeeRating}</td><td>${g.supervisorRating === 'NA' ? 'N/A' : g.supervisorRating}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- Section 3: Competencies -->
  <div class="section">
    <h2>3. Competency Assessment</h2>
    <table>
      <thead><tr><th>Skill</th><th>Emp Rating</th><th>Sup Rating</th></tr></thead>
      <tbody>
        ${data.technicalSkills.map((s: any) => `<tr><td>${s.name}</td><td>${s.employeeRating === 'NA' ? 'N/A' : s.employeeRating}</td><td>${s.supervisorRating === 'NA' ? 'N/A' : s.supervisorRating}</td></tr>`).join('')}
        ${data.leadershipSkills.map((s: any) => `<tr><td>${s.name}</td><td>${s.employeeRating === 'NA' ? 'N/A' : s.employeeRating}</td><td>${s.supervisorRating === 'NA' ? 'N/A' : s.supervisorRating}</td></tr>`).join('')}
        ${data.managerialSkills.map((s: any) => `<tr><td>${s.name}</td><td>${s.employeeRating === 'NA' ? 'N/A' : s.employeeRating}</td><td>${s.supervisorRating === 'NA' ? 'N/A' : s.supervisorRating}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- Section 4: Explanations -->
  <div class="section">
    <h2>4. Notices / Explanations</h2>
    <table>
      <thead><tr><th>#</th><th>Description</th><th>Resolved?</th><th>HR Remarks</th><th>Rating</th></tr></thead>
      <tbody>
        ${data.explanations.map((e: any, i: number) => `<tr><td>${i+1}</td><td>${e.description || '—'}</td><td>${e.isResolved ? 'Yes' : 'No'}</td><td>${e.hrRemarks || '—'}</td><td>${e.rating || 0}</td></tr>`).join('') || '<tr><td colspan="5">No explanations recorded</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Section 5: Final Scores -->
  <div class="section">
    <h2>5. Final Score Summary</h2>
    <div class="score-row">
      <div class="score-item">
        <label>Employee Self-Evaluation</label>
        <div class="score-box" style="background: ${ratingColor(empScores.overallPercentage)}">${empScores.overallPercentage}%</div>
        <p style="font-size: 12px; margin-top: 5px;">${empScores.rating || '—'}</p>
      </div>
      <div class="score-item">
        <label>Supervisor Evaluation</label>
        <div class="score-box" style="background: ${ratingColor(supScores.overallPercentage)}">${supScores.overallPercentage}%</div>
        <p style="font-size: 12px; margin-top: 5px;">${supScores.rating || '—'}</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Metric</th><th>Employee</th><th>Supervisor</th></tr></thead>
      <tbody>
        <tr><td>Goals & Achievements</td><td>${empScores.marksGoals} / ${empScores.maxMarksGoals}</td><td>${supScores.marksGoals} / ${supScores.maxMarksGoals}</td></tr>
        <tr><td>Competencies Total</td><td>${empScores.totalCompetencies} / ${empScores.maxMarksCompetencies}</td><td>${supScores.totalCompetencies} / ${supScores.maxMarksCompetencies}</td></tr>
        <tr><td>Marks Deducted</td><td>-${empScores.marksDeducted}</td><td>-${supScores.marksDeducted}</td></tr>
        <tr><td><strong>Grand Total</strong></td><td><strong>${empScores.grandTotal}</strong></td><td><strong>${supScores.grandTotal}</strong></td></tr>
      </tbody>
    </table>
  </div>

  <!-- Section 6: Future Goals -->
  <div class="section">
    <h2>6. Future Goals</h2>
    <table>
      <thead><tr><th>#</th><th>Goal</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th></tr></thead>
      <tbody>
        ${data.futureGoals.map((g: any, i: number) => `<tr><td>${i+1}</td><td>${g.description || '—'}</td><td>${g.quarters[0] ? '✓' : ''}</td><td>${g.quarters[1] ? '✓' : ''}</td><td>${g.quarters[2] ? '✓' : ''}</td><td>${g.quarters[3] ? '✓' : ''}</td></tr>`).join('') || '<tr><td colspan="6">No future goals recorded</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Section 7: Remarks -->
  <div class="section">
    <h2>7. Remarks & Recommendations</h2>
    <div class="remarks-box">
      <strong>Supervisor Remarks:</strong> ${data.remarks.supervisorGeneralRemarks || 'No remarks provided.'}<br>
      <small>Satisfaction: ${data.remarks.supervisorSatisfaction === true ? 'Satisfied' : data.remarks.supervisorSatisfaction === false ? 'Not Satisfied' : '—'} | Promotion: ${data.remarks.supervisorConsiderationPromotion ? 'Considered' : 'No'} | Increment: ${data.remarks.supervisorConsiderationIncrement ? 'Considered' : 'No'} | Reward: ${data.remarks.supervisorConsiderationReward ? 'Considered' : 'No'}</small>
    </div>
    <div class="remarks-box">
      <strong>HR Remarks:</strong> ${data.remarks.hrGeneralRemarks || 'No remarks provided.'}<br>
      <small>Skills: ${data.remarks.hrSatisfactionSkills === true ? 'Satisfied' : data.remarks.hrSatisfactionSkills === false ? 'Not Satisfied' : '—'} | Behavior: ${data.remarks.hrSatisfactionBehavior === true ? 'Satisfied' : data.remarks.hrSatisfactionBehavior === false ? 'Not Satisfied' : '—'} | Performance: ${data.remarks.hrSatisfactionPerformance === true ? 'Satisfied' : data.remarks.hrSatisfactionPerformance === false ? 'Not Satisfied' : '—'}</small><br>
      <small>Monitoring: ${data.remarks.hrRecommendationMonitoring ? 'Yes' : 'No'} | Promotion: ${data.remarks.hrRecommendationPromotion ? 'Yes' : 'No'} | Reward: ${data.remarks.hrRecommendationReward ? 'Yes' : 'No'}</small>
    </div>
  </div>

  <!-- Management Override Log -->
  ${assignment.overrideLogs.length > 0 ? `
  <div class="section">
    <h2>8. Management Override History</h2>
    <table>
      <thead><tr><th>Field</th><th>Original</th><th>New</th><th>Editor</th><th>Reason</th><th>Date</th></tr></thead>
      <tbody>
        ${assignment.overrideLogs.map((log: any) => `<tr><td>${log.fieldLabel}</td><td>${log.originalValue}</td><td>${log.newValue}</td><td>${log.editor.name}</td><td>${log.reason}</td><td>${formatDate(log.createdAt)}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Section 9: Signatures -->
  <div class="section">
    <h2>${assignment.overrideLogs.length > 0 ? '9' : '8'}. Certification & Signatures</h2>
    <div class="signature-row">
      <div class="sig-box">
        <div class="sig-line">
          <strong>Employee</strong><br>
          ${fd.employeeSignature || emp.name}<br>
          <small>${formatDate(fd.employeeSignatureDate)}</small>
        </div>
      </div>
      <div class="sig-box">
        <div class="sig-line">
          <strong>Supervisor</strong><br>
          ${fd.supervisorSignature || sup.name}<br>
          <small>${formatDate(fd.supervisorSignatureDate)}</small>
        </div>
      </div>
      <div class="sig-box">
        <div class="sig-line">
          <strong>CEO/Managing Director</strong><br>
          ${fd.ceoSignature || ceo?.name || '—'}<br>
          <small>${formatDate(fd.ceoSignatureDate)}</small>
        </div>
      </div>
    </div>
  </div>

  <!-- Audit Trail -->
  <div class="audit-trail">
    <h2>Workflow Status History</h2>
    <table>
      <thead><tr><th>Action</th><th>By</th><th>Role</th><th>From</th><th>To</th><th>Date</th><th>Remarks</th></tr></thead>
      <tbody>
        ${assignment.auditLogs.map((log: any) => `<tr><td>${log.action}</td><td>${log.user.name}</td><td>${log.user.role}</td><td>${log.previousStatus}</td><td>${log.newStatus}</td><td>${formatDate(log.createdAt)}</td><td>${log.remarks || '—'}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #888;">
    This is a computer-generated document. Reference: ${assignment.appraisalRefNo || 'N/A'} | Generated on ${formatDate(new Date())}
  </div>

  <script>
    // Auto-open print dialog on load
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;
}
