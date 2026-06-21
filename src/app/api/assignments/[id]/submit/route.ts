import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Workflow state machine: defines valid transitions
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
    newStatus: 'submitted_to_management',
    nextActionBy: 'management',
    timestampField: 'submittedByHRAt',
  },
  management_approve: {
    newStatus: 'approved',
    nextActionBy: 'hr',
    timestampField: 'approvedByManagementAt',
  },
  management_return: {
    newStatus: 'returned_for_correction',
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
  employee_submit: ['assigned_to_employee', 'returned_for_correction'],
  supervisor_submit: ['submitted_by_employee', 'under_supervisor_review'],
  hr_submit: ['submitted_by_supervisor', 'under_hr_review'],
  management_approve: ['submitted_to_management', 'under_management_review'],
  management_return: ['submitted_to_management', 'under_management_review'],
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
      management_approve: 'Management',
      management_return: 'Management',
      employee_acknowledge: assignment.employee.name,
      hr_share: 'HR Team',
    };

    await db.auditLog.create({
      data: {
        assignmentId: id,
        userId: assignment.employeeId,
        action,
        previousStatus,
        newStatus,
        details: returnReason
          ? `Returned by ${actorNames[action]}. Reason: ${returnReason}`
          : `Action performed by ${actorNames[action]}`,
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
        // Notify HR (admin users)
        const hrUsers = await db.user.findMany({
          where: { role: 'admin', isActive: true },
          select: { id: true },
        });
        for (const hrUser of hrUsers) {
          notificationsToCreate.push({
            userId: hrUser.id,
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
        // Notify management
        const mgmtUsers = await db.user.findMany({
          where: { role: 'management', isActive: true },
          select: { id: true },
        });
        for (const mgmtUser of mgmtUsers) {
          notificationsToCreate.push({
            userId: mgmtUser.id,
            assignmentId: id,
            type: 'hr_submitted',
            title: 'Appraisal Submitted to Management',
            message: `HR has reviewed and submitted ${assignment.employee.name}'s appraisal for "${assignment.cycle.name}" for management approval.`,
            actionRequired: true,
            link: `/appraisal/${id}`,
          });
        }
        break;

      case 'management_approve':
        // Notify HR to share with employee
        const adminUsers = await db.user.findMany({
          where: { role: 'admin', isActive: true },
          select: { id: true },
        });
        for (const adminUser of adminUsers) {
          notificationsToCreate.push({
            userId: adminUser.id,
            assignmentId: id,
            type: 'management_approved',
            title: 'Appraisal Approved by Management',
            message: `${assignment.employee.name}'s appraisal for "${assignment.cycle.name}" has been approved by management. Please share with the employee.`,
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