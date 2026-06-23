import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

// Workflow state machine: defines valid transitions
// Extended workflow: Employee → Supervisor → HR → Management → HR (final) → CEO → Approved
const WORKFLOW_TRANSITIONS: Record<string, { newStatus: string; nextActionBy: string; timestampField: string }> = {
  employee_submit: {
    newStatus: 'submitted_by_employee',
    nextActionBy: 'supervisor',
    timestampField: 'submittedByEmployeeAt',
  },
  supervisor_submit: {
    newStatus: 'submitted_by_supervisor',
    nextActionBy: 'hr',
    timestampField: 'submittedBySupervisorAt',
  },
  hr_submit: {
    // HR submits to Management for review
    newStatus: 'submitted_to_management',
    nextActionBy: 'management',
    timestampField: 'submittedByHRAt',
  },
  management_submit: {
    // Management reviews and submits back to HR for final processing
    newStatus: 'management_returned_to_hr',
    nextActionBy: 'hr',
    timestampField: 'approvedByManagementAt',
  },
  hr_final_submit: {
    // HR final review complete, submits to CEO for approval
    newStatus: 'submitted_to_ceo',
    nextActionBy: 'ceo',
    timestampField: 'submittedByHRAt',
  },
  ceo_approve: {
    // CEO approves — appraisal becomes final
    newStatus: 'approved',
    nextActionBy: 'hr',
    timestampField: 'approvedByManagementAt',
  },
  ceo_return: {
    // CEO returns with remarks
    newStatus: 'returned_for_hr_revision',
    nextActionBy: 'hr',
    timestampField: '',
  },
  management_return: {
    // Management returns to employee for correction
    newStatus: 'returned_for_employee_revision',
    nextActionBy: 'employee',
    timestampField: '',
  },
  admin_reopen: {
    // Admin reopens an approved/closed appraisal
    newStatus: 'reopened_by_admin',
    nextActionBy: 'employee',
    timestampField: '',
  },
  employee_acknowledge: {
    newStatus: 'acknowledged_by_employee',
    nextActionBy: 'employee',
    timestampField: 'acknowledgedByEmployeeAt',
  },
  hr_share: {
    newStatus: 'shared_with_employee',
    nextActionBy: 'employee',
    timestampField: '',
  },
};

// Valid current statuses for each action
const VALID_TRANSITIONS: Record<string, string[]> = {
  employee_submit: ['assigned_to_employee', 'returned_for_correction', 'returned_for_employee_revision', 'reopened_by_admin'],
  supervisor_submit: ['submitted_by_employee'],
  hr_submit: ['submitted_by_supervisor', 'returned_for_hr_revision'],
  management_submit: ['submitted_to_management'],
  hr_final_submit: ['management_returned_to_hr'],
  ceo_approve: ['submitted_to_ceo'],
  ceo_return: ['submitted_to_ceo'],
  management_return: ['submitted_to_management'],
  admin_reopen: ['approved', 'acknowledged_by_employee', 'shared_with_employee', 'closed'],
  employee_acknowledge: ['approved', 'shared_with_employee'],
  hr_share: ['approved'],
};

const STATUS_LABELS: Record<string, string> = {
  assigned_to_employee: 'Assigned to Employee',
  submitted_by_employee: 'Submitted by Employee',
  under_supervisor_review: 'Under Supervisor Review',
  submitted_by_supervisor: 'Submitted by Supervisor',
  under_hr_review: 'Under HR Review',
  submitted_to_management: 'Submitted to Management',
  under_management_review: 'Under Management Review',
  returned_for_correction: 'Returned for Correction',
  approved: 'Approved',
  shared_with_employee: 'Shared with Employee',
  acknowledged_by_employee: 'Acknowledged by Employee',
  closed: 'Closed',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, returnReason } = body;

    if (!action || !WORKFLOW_TRANSITIONS[action]) {
      return NextResponse.json(
        { error: `Invalid action. Valid actions: ${Object.keys(WORKFLOW_TRANSITIONS).join(', ')}` },
        { status: 400 }
      );
    }

    const assignment = await db.appraisalAssignment.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
        escalatedSupervisor: { select: { id: true, name: true } },
        cycle: { select: { id: true, name: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // ── STRICT AUTHORIZATION: verify the caller is authorized for this action ──
    // No bypassing the hierarchy — each stage can only be advanced by the
    // designated role.
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const callerId = auth.userId!;
    const callerRole = auth.role!;

    // Map each action to who is allowed to perform it
    // Admin can perform ANY action (override capability)
    const isAdmin = callerRole === 'admin';
    const ACTION_AUTH: Record<string, boolean> = {
      employee_submit: isAdmin || assignment.employeeId === callerId,
      supervisor_submit: isAdmin || ((assignment.supervisorId === callerId || assignment.escalatedSupervisorId === callerId) && assignment.employeeId !== callerId),
      hr_submit: isAdmin || callerRole === 'hr',
      management_submit: isAdmin || callerRole === 'management',
      hr_final_submit: isAdmin || callerRole === 'hr',
      ceo_approve: isAdmin || callerRole === 'management' || callerRole === 'ceo',
      ceo_return: isAdmin || callerRole === 'management' || callerRole === 'ceo',
      management_return: isAdmin || callerRole === 'management',
      admin_reopen: isAdmin,
      hr_share: isAdmin || callerRole === 'hr',
      employee_acknowledge: isAdmin || assignment.employeeId === callerId,
    };

    if (!ACTION_AUTH[action]) {
      return NextResponse.json(
        {
          error: `You are not authorized to perform '${action}'. This action can only be performed by the designated role for this appraisal stage.`,
        },
        { status: 403 }
      );
    }

    // Self-review guard: prevent supervisor from submitting their own review
    if (action === 'supervisor_submit' && assignment.supervisorId === assignment.employeeId) {
      return NextResponse.json(
        { error: 'Self-review is not allowed' },
        { status: 403 }
      );
    }

    // Validate current status
    const validFrom = VALID_TRANSITIONS[action];
    if (!validFrom.includes(assignment.status)) {
      return NextResponse.json(
        { error: `Cannot perform '${action}' from status '${assignment.status}'. Valid statuses: ${validFrom.join(', ')}` },
        { status: 400 }
      );
    }

    const transition = WORKFLOW_TRANSITIONS[action];
    const previousStatus = assignment.status;
    const newStatus = transition.newStatus;
    const nextActionBy = transition.nextActionBy;

    // Update assignment status
    await db.appraisalAssignment.update({
      where: { id },
      data: {
        status: newStatus,
        currentActionBy: nextActionBy,
        ...(returnReason ? { returnReason } : (action !== 'management_return' ? { returnReason: '' } : {})),
      },
    });

    // Update form data timestamp
    if (transition.timestampField) {
      await db.appraisalFormData.upsert({
        where: { assignmentId: id },
        create: {
          assignmentId: id,
          [transition.timestampField]: new Date(),
        },
        update: {
          [transition.timestampField]: new Date(),
        },
      });
    }

    // Create audit log
    const actorNames: Record<string, string> = {
      employee_submit: assignment.employee.name,
      supervisor_submit: assignment.supervisor.name,
      hr_submit: 'HR Team',
      management_submit: 'Management',
      hr_final_submit: 'HR Team',
      ceo_approve: 'CEO/Managing Director',
      ceo_return: 'CEO/Managing Director',
      management_return: 'Management',
      admin_reopen: 'Admin',
      employee_acknowledge: assignment.employee.name,
      hr_share: 'HR Team',
    };

    await db.auditLog.create({
      data: {
        assignmentId: id,
        userId: callerId, // Use actual caller ID, not always employee
        action,
        previousStatus,
        newStatus,
        details: returnReason
          ? `${actorNames[action] || 'User'} — ${returnReason}`
          : `Action performed by ${actorNames[action] || callerRole}`,
        remarks: returnReason || '',
      },
    });

    // Create notifications for the next person in workflow
    const notificationsToCreate: { userId: string; type: string; title: string; message: string; actionRequired: boolean; link: string; assignmentId: string }[] = [];

    // Determine the correct reviewer to notify for supervisor-level actions
    const reviewerId = assignment.escalatedSupervisorId || assignment.supervisorId;
    const reviewerName = assignment.escalatedSupervisor?.name || assignment.supervisor.name;

    switch (action) {
      case 'employee_submit':
        // Notify the escalated supervisor if set, otherwise the regular supervisor
        notificationsToCreate.push({
          userId: reviewerId,
          assignmentId: id,
          type: 'employee_submitted',
          title: 'Appraisal Submitted by Employee',
          message: `${assignment.employee.name} has submitted their self-evaluation for "${assignment.cycle.name}". Please review and add your assessment.`,
          actionRequired: true,
          link: `/appraisal/${id}`,
        });
        break;

      case 'supervisor_submit':
        // Notify HR — use assigned HR reviewer if set, otherwise all HR users
        const hrNotifyIds = assignment.hrReviewerId
          ? [assignment.hrReviewerId]
          : (await db.user.findMany({ where: { role: 'hr', isActive: true }, select: { id: true } })).map(u => u.id);
        // Also notify admin
        const adminUsers1 = await db.user.findMany({ where: { role: 'admin', isActive: true }, select: { id: true } });
        for (const uid of [...hrNotifyIds, ...adminUsers1.map(u => u.id)]) {
          notificationsToCreate.push({
            userId: uid,
            assignmentId: id,
            type: 'supervisor_submitted',
            title: 'Appraisal Ready for HR Review',
            message: `${reviewerName} has completed the supervisor review for ${assignment.employee.name}'s appraisal in "${assignment.cycle.name}".`,
            actionRequired: true,
            link: `/appraisal/${id}`,
          });
        }
        break;

      case 'hr_submit':
        // Notify assigned management reviewer, or all management users
        const mgmtNotifyIds = assignment.managementReviewerId
          ? [assignment.managementReviewerId]
          : (await db.user.findMany({ where: { role: 'management', isActive: true }, select: { id: true } })).map(u => u.id);
        for (const uid of mgmtNotifyIds) {
          notificationsToCreate.push({
            userId: uid,
            assignmentId: id,
            type: 'hr_submitted',
            title: 'Appraisal Submitted to Management',
            message: `HR has reviewed and submitted ${assignment.employee.name}'s appraisal for "${assignment.cycle.name}" for management review.`,
            actionRequired: true,
            link: `/appraisal/${id}`,
          });
        }
        break;

      case 'management_submit':
        // Management submits back to HR for final processing
        const hrFinalIds = assignment.hrReviewerId
          ? [assignment.hrReviewerId]
          : (await db.user.findMany({ where: { role: 'hr', isActive: true }, select: { id: true } })).map(u => u.id);
        for (const uid of hrFinalIds) {
          notificationsToCreate.push({
            userId: uid,
            assignmentId: id,
            type: 'management_reviewed',
            title: 'Appraisal Reviewed by Management',
            message: `Management has reviewed ${assignment.employee.name}'s appraisal for "${assignment.cycle.name}". Please complete final HR processing and submit to CEO/Managing Director.`,
            actionRequired: true,
            link: `/appraisal/${id}`,
          });
        }
        break;

      case 'hr_final_submit':
        // HR submits to CEO/Managing Director for final approval
        const ceoNotifyIds = assignment.ceoApproverId
          ? [assignment.ceoApproverId]
          : (await db.user.findMany({ where: { role: 'management', isActive: true }, select: { id: true } })).map(u => u.id);
        for (const uid of ceoNotifyIds) {
          notificationsToCreate.push({
            userId: uid,
            assignmentId: id,
            type: 'hr_final_submitted',
            title: 'Appraisal Ready for CEO Approval',
            message: `HR has completed final processing for ${assignment.employee.name}'s appraisal in "${assignment.cycle.name}". Please review and approve.`,
            actionRequired: true,
            link: `/appraisal/${id}`,
          });
        }
        break;

      case 'ceo_approve':
        // CEO approves — notify HR to share with employee
        const hrShareIds = assignment.hrReviewerId
          ? [assignment.hrReviewerId]
          : (await db.user.findMany({ where: { role: 'hr', isActive: true }, select: { id: true } })).map(u => u.id);
        const adminApproveIds = (await db.user.findMany({ where: { role: 'admin', isActive: true }, select: { id: true } })).map(u => u.id);
        for (const uid of [...hrShareIds, ...adminApproveIds]) {
          notificationsToCreate.push({
            userId: uid,
            assignmentId: id,
            type: 'management_approved',
            title: 'Appraisal Approved by CEO/Managing Director',
            message: `${assignment.employee.name}'s appraisal for "${assignment.cycle.name}" has been approved. Please share with the employee.`,
            actionRequired: true,
            link: `/appraisal/${id}`,
          });
        }
        break;

      case 'ceo_return':
        // CEO returns — notify HR
        const hrReturnIds = assignment.hrReviewerId
          ? [assignment.hrReviewerId]
          : (await db.user.findMany({ where: { role: 'hr', isActive: true }, select: { id: true } })).map(u => u.id);
        for (const uid of hrReturnIds) {
          notificationsToCreate.push({
            userId: uid,
            assignmentId: id,
            type: 'returned_for_correction',
            title: 'Appraisal Returned by CEO/Managing Director',
            message: `${assignment.employee.name}'s appraisal for "${assignment.cycle.name}" has been returned by the CEO/Managing Director. ${returnReason ? `Reason: ${returnReason}` : 'Please review and make corrections.'}`,
            actionRequired: true,
            link: `/appraisal/${id}`,
          });
        }
        break;

      case 'management_return':
        notificationsToCreate.push({
          userId: assignment.employeeId,
          assignmentId: id,
          type: 'returned_for_correction',
          title: 'Appraisal Returned for Correction',
          message: `Your appraisal for "${assignment.cycle.name}" has been returned by management. ${returnReason ? `Reason: ${returnReason}` : 'Please review and make corrections.'}`,
          actionRequired: true,
          link: `/appraisal/${id}`,
        });
        break;

      case 'employee_acknowledge':
        // Notify admin
        const adminNotify = await db.user.findMany({
          where: { role: 'admin', isActive: true },
          select: { id: true },
        });
        for (const au of adminNotify) {
          notificationsToCreate.push({
            userId: au.id,
            assignmentId: id,
            type: 'reminder',
            title: 'Appraisal Acknowledged',
            message: `${assignment.employee.name} has acknowledged their appraisal for "${assignment.cycle.name}".`,
            actionRequired: false,
            link: `/appraisal/${id}`,
          });
        }
        break;

      case 'hr_share':
        notificationsToCreate.push({
          userId: assignment.employeeId,
          assignmentId: id,
          type: 'management_approved',
          title: 'Appraisal Shared - Please Acknowledge',
          message: `Your appraisal for "${assignment.cycle.name}" has been approved and shared with you. Please review and acknowledge.`,
          actionRequired: true,
          link: `/appraisal/${id}`,
        });
        // Also notify supervisor (or escalated supervisor if set)
        notificationsToCreate.push({
          userId: reviewerId,
          assignmentId: id,
          type: 'reminder',
          title: 'Appraisal Shared with Employee',
          message: `${assignment.employee.name}'s appraisal for "${assignment.cycle.name}" has been shared with the employee.`,
          actionRequired: false,
          link: `/appraisal/${id}`,
        });
        break;
    }

    if (notificationsToCreate.length > 0) {
      await db.notification.createMany({ data: notificationsToCreate });
    }

    return NextResponse.json({
      message: `Action '${action}' completed successfully`,
      previousStatus: STATUS_LABELS[previousStatus] || previousStatus,
      newStatus: STATUS_LABELS[newStatus] || newStatus,
      nextActionBy,
    });
  } catch (error) {
    console.error('Submit appraisal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}