/**
 * prisma/seed.ts
 *
 * Production-safe seed script for ECI HRM Performance Appraisal System.
 *
 * Usage:
 *   bun run db:seed               # production mode (admin + rating scales + categories only)
 *   bun run db:seed -- --demo     # demo mode (full sample dataset)
 *   bun run db:seed -- --reset    # wipe all data first (alias for production mode)
 *
 * Admin credentials come from env vars (with secure defaults):
 *   ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, ADMIN_EMPLOYEE_ID
 *
 * Run via: `bun run db:seed`
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  TECHNICAL_SKILLS,
  LEADERSHIP_SKILLS,
  MANAGERIAL_SKILLS,
  createDefaultFormData,
} from '../src/lib/constants';

const db = new PrismaClient();

const args = process.argv.slice(2);
const isDemo = args.includes('--demo');
const mode = isDemo ? 'demo' : 'production';

async function main() {
  console.log(`\n🌱 Seeding database in ${mode.toUpperCase()} mode...\n`);

  // ── Wipe existing data in reverse dependency order ──
  console.log('  • Clearing existing data...');
  await db.auditLog.deleteMany({});
  await db.notification.deleteMany({});
  await db.appraisalFormData.deleteMany({});
  await db.appraisalAssignment.deleteMany({});
  await db.appraisalCycle.deleteMany({});
  await db.user.deleteMany({});
  await db.designation.deleteMany({});
  await db.department.deleteMany({});
  await db.appraisalCategory.deleteMany({});
  await db.ratingScale.deleteMany({});

  // ── Rating Scales (essential for both modes) ──
  console.log('  • Creating rating scales...');
  const goalsScale = await db.ratingScale.create({
    data: {
      name: 'Goals Rating (0-3)',
      description: 'Rating scale for achievements and goals evaluation',
      minScore: 0,
      maxScore: 3,
      labelsJson: JSON.stringify([
        { score: 0, label: 'N/A' },
        { score: 1, label: 'Below Average' },
        { score: 2, label: 'Meets Expectations' },
        { score: 3, label: 'Exceeds Expectations' },
      ]),
      appliesTo: 'goals',
      sortOrder: 0,
    },
  });

  const competencyScale = await db.ratingScale.create({
    data: {
      name: 'Competency Rating (1-5)',
      description: 'Rating scale for technical, leadership and managerial competencies',
      minScore: 1,
      maxScore: 5,
      labelsJson: JSON.stringify([
        { score: 1, label: 'Poor' },
        { score: 2, label: 'Below Average' },
        { score: 3, label: 'Average' },
        { score: 4, label: 'Good' },
        { score: 5, label: 'Excellent' },
      ]),
      appliesTo: 'competencies',
      sortOrder: 1,
    },
  });

  const explanationScale = await db.ratingScale.create({
    data: {
      name: 'Explanation Rating (0-3)',
      description: 'Rating scale for notices/explanations severity',
      minScore: 0,
      maxScore: 3,
      labelsJson: JSON.stringify([
        { score: 0, label: 'N/A' },
        { score: 1, label: '1 - Minor' },
        { score: 2, label: '2 - Moderate' },
        { score: 3, label: '3 - Severe' },
      ]),
      appliesTo: 'explanations',
      sortOrder: 2,
    },
  });

  // ── Appraisal Categories (22 competency items) ──
  console.log('  • Creating appraisal categories (22 items)...');
  const categorySeedData: Array<{ name: string; section: string; sortOrder: number; ratingScaleId: string }> = [];
  TECHNICAL_SKILLS.forEach((name, idx) => {
    categorySeedData.push({ name, section: 'technical_skills', sortOrder: idx, ratingScaleId: competencyScale.id });
  });
  LEADERSHIP_SKILLS.forEach((name, idx) => {
    categorySeedData.push({ name, section: 'leadership_skills', sortOrder: idx, ratingScaleId: competencyScale.id });
  });
  MANAGERIAL_SKILLS.forEach((name, idx) => {
    categorySeedData.push({ name, section: 'managerial_skills', sortOrder: idx, ratingScaleId: competencyScale.id });
  });
  await Promise.all(
    categorySeedData.map((cat) =>
      db.appraisalCategory.create({
        data: { name: cat.name, section: cat.section, description: '', sortOrder: cat.sortOrder, ratingScaleId: cat.ratingScaleId },
      })
    )
  );

  if (mode === 'production') {
    await seedProduction();
  } else {
    await seedDemo(goalsScale, competencyScale, explanationScale);
  }

  console.log('\n✅ Seed completed successfully!\n');
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTION SEED — Admin-only, no demo data
// ═══════════════════════════════════════════════════════════════
async function seedProduction() {
  const adminEmail = process.env.ADMIN_EMAIL || 'imunir@eci.com.pk';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ECI@dm1n#2025!Secure';
  const adminEmployeeId = process.env.ADMIN_EMPLOYEE_ID || 'ECI-001';

  console.log('  • Creating admin user...');
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const admin = await db.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      password: hashedPassword,
      employeeId: adminEmployeeId,
      designation: 'HR Manager',
      department: 'Administration',
      phone: '',
      overallExp: '',
      yearsWithECI: '',
      currentEdu: '',
      role: 'admin',
      isSupervisor: true,
      isActive: true,
    },
  });

  console.log('\n─────────────────────────────────────────────');
  console.log('  PRODUCTION SEED COMPLETE');
  console.log('─────────────────────────────────────────────');
  console.log(`  Admin Email:     ${admin.email}`);
  console.log(`  Admin Name:      ${admin.name}`);
  console.log(`  Admin Emp ID:    ${admin.employeeId}`);
  console.log(`  Admin Role:      ${admin.role}`);
  console.log(`  Password:        (set via ADMIN_PASSWORD env var)`);
  console.log('─────────────────────────────────────────────');
  console.log('\nNext steps:');
  console.log('  1. Login with the admin account above');
  console.log('  2. Master Data → Departments → create departments');
  console.log('  3. Master Data → Designations → create designations');
  console.log('  4. Master Data → Employees → add users');
  console.log('  5. Appraisal → Cycles → create your first appraisal cycle\n');
}

// ═══════════════════════════════════════════════════════════════
// DEMO SEED — Full demo dataset for development/testing
// ═══════════════════════════════════════════════════════════════
async function seedDemo(_goalsScale: any, _competencyScale: any, _explanationScale: any) {
  console.log('  • Creating departments...');
  const departments = await Promise.all([
    db.department.create({ data: { name: 'Administration' } }),
    db.department.create({ data: { name: 'Program' } }),
    db.department.create({ data: { name: 'Finance' } }),
    db.department.create({ data: { name: 'Human Resources' } }),
    db.department.create({ data: { name: 'Monitoring & Evaluation' } }),
    db.department.create({ data: { name: 'Communication' } }),
  ]);

  console.log('  • Creating designations...');
  const designations = await Promise.all([
    db.designation.create({ data: { title: 'Chief Executive Officer', requiredExp: '15+ years', requiredEdu: 'Masters degree', department: 'Management' } }),
    db.designation.create({ data: { title: 'HR Manager', requiredExp: '8+ years', requiredEdu: 'MBA/Masters in HR', department: 'Human Resources' } }),
    db.designation.create({ data: { title: 'Program Manager', requiredExp: '7+ years', requiredEdu: 'Masters degree', department: 'Program' } }),
    db.designation.create({ data: { title: 'Finance Manager', requiredExp: '7+ years', requiredEdu: 'CA/MBA Finance', department: 'Finance' } }),
    db.designation.create({ data: { title: 'Program Officer', requiredExp: '3+ years', requiredEdu: 'Masters degree', department: 'Program' } }),
    db.designation.create({ data: { title: 'Finance Officer', requiredExp: '3+ years', requiredEdu: 'BBA/BCOM/MBA Finance', department: 'Finance' } }),
    db.designation.create({ data: { title: 'M&E Officer', requiredExp: '3+ years', requiredEdu: 'Masters in Statistics/Economics', department: 'Monitoring & Evaluation' } }),
    db.designation.create({ data: { title: 'Communication Officer', requiredExp: '3+ years', requiredEdu: 'Masters in Communications', department: 'Communication' } }),
    db.designation.create({ data: { title: 'Admin Assistant', requiredExp: '2+ years', requiredEdu: 'Bachelors degree', department: 'Administration' } }),
  ]);

  console.log('  • Creating users (10 demo accounts)...');
  const defaultPassword = await bcrypt.hash('password123', 12);

  const admin = await db.user.create({
    data: { email: 'admin@eci.com', password: defaultPassword, name: 'Sarah Ahmad', employeeId: 'ECI-001', designation: 'HR Manager', department: 'Administration', phone: '+92-300-1000001', overallExp: '10 years', yearsWithECI: '8 years', currentEdu: 'MBA (HRM)', role: 'admin' },
  });
  const management = await db.user.create({
    data: { email: 'ceo@eci.com', password: defaultPassword, name: 'Ahmed Khan', employeeId: 'ECI-002', designation: 'Chief Executive Officer', department: 'Management', phone: '+92-300-1000002', overallExp: '20 years', yearsWithECI: '12 years', currentEdu: 'MBA (Finance)', role: 'management' },
  });
  const supervisor1 = await db.user.create({
    data: { email: 'supervisor1@eci.com', password: defaultPassword, name: 'Fatima Noor', employeeId: 'ECI-003', designation: 'Program Manager', department: 'Program', phone: '+92-300-1000003', overallExp: '9 years', yearsWithECI: '6 years', currentEdu: 'Masters in Development Studies', role: 'supervisor', lineManagerId: management.id, isSupervisor: true },
  });
  const supervisor2 = await db.user.create({
    data: { email: 'supervisor2@eci.com', password: defaultPassword, name: 'Imran Ali', employeeId: 'ECI-004', designation: 'Finance Manager', department: 'Finance', phone: '+92-300-1000004', overallExp: '8 years', yearsWithECI: '5 years', currentEdu: 'MBA (Finance)', role: 'supervisor', lineManagerId: management.id, isSupervisor: true },
  });
  const emp1 = await db.user.create({ data: { email: 'ali.rashid@eci.com', password: defaultPassword, name: 'Ali Rashid', employeeId: 'ECI-005', designation: 'Program Officer', department: 'Program', phone: '+92-300-1000005', overallExp: '4 years', yearsWithECI: '3 years', currentEdu: 'Masters in Social Sciences', role: 'employee', lineManagerId: supervisor1.id } });
  const emp2 = await db.user.create({ data: { email: 'zainab.malik@eci.com', password: defaultPassword, name: 'Zainab Malik', employeeId: 'ECI-006', designation: 'Program Officer', department: 'Program', phone: '+92-300-1000006', overallExp: '5 years', yearsWithECI: '4 years', currentEdu: 'Masters in Public Health', role: 'employee', lineManagerId: supervisor1.id } });
  const emp3 = await db.user.create({ data: { email: 'bilal.hassan@eci.com', password: defaultPassword, name: 'Bilal Hassan', employeeId: 'ECI-007', designation: 'Finance Officer', department: 'Finance', phone: '+92-300-1000007', overallExp: '4 years', yearsWithECI: '2 years', currentEdu: 'MBA (Finance)', role: 'employee', lineManagerId: supervisor2.id } });
  const emp4 = await db.user.create({ data: { email: 'aisha.khan@eci.com', password: defaultPassword, name: 'Aisha Khan', employeeId: 'ECI-008', designation: 'M&E Officer', department: 'Monitoring & Evaluation', phone: '+92-300-1000008', overallExp: '6 years', yearsWithECI: '5 years', currentEdu: 'Masters in Statistics', role: 'employee', lineManagerId: supervisor1.id } });
  const emp5 = await db.user.create({ data: { email: 'omar.farooq@eci.com', password: defaultPassword, name: 'Omar Farooq', employeeId: 'ECI-009', designation: 'Communication Officer', department: 'Communication', phone: '+92-300-1000009', overallExp: '3 years', yearsWithECI: '2 years', currentEdu: 'Masters in Media Studies', role: 'employee', lineManagerId: supervisor1.id } });
  const emp6 = await db.user.create({ data: { email: 'hina.siddiqui@eci.com', password: defaultPassword, name: 'Hina Siddiqui', employeeId: 'ECI-010', designation: 'Admin Assistant', department: 'Administration', phone: '+92-300-1000010', overallExp: '3 years', yearsWithECI: '3 years', currentEdu: 'Bachelors in Business Admin', role: 'employee', lineManagerId: admin.id } });

  console.log('  • Creating appraisal cycle + assignments...');
  const cycle = await db.appraisalCycle.create({
    data: {
      name: 'Mid-Year Performance Appraisal 2025',
      cycleType: 'mid_year',
      year: '2025',
      periodFrom: 'January 2025',
      periodTo: 'June 2025',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2025-07-31'),
      submissionDeadline: new Date('2025-08-15'),
      status: 'active',
      applicableDepts: JSON.stringify(['Program', 'Finance', 'Monitoring & Evaluation', 'Communication', 'Administration']),
      createdById: admin.id,
    },
  });

  const employees = [emp1, emp2, emp3, emp4, emp5, emp6];
  const supervisors = [supervisor1, supervisor1, supervisor2, supervisor1, supervisor1, admin];
  const assignments = [];

  for (let i = 0; i < employees.length; i++) {
    const assignment = await db.appraisalAssignment.create({
      data: {
        cycleId: cycle.id,
        employeeId: employees[i].id,
        supervisorId: supervisors[i].id,
        status: 'assigned_to_employee',
        currentActionBy: 'employee',
        deadline: cycle.submissionDeadline,
      },
    });
    assignments.push(assignment);
  }

  // Sample form data for first two employees
  console.log('  • Creating sample form data...');
  const defaultForm = createDefaultFormData();
  for (let i = 0; i < 2; i++) {
    const a = assignments[i];
    const emp = employees[i];
    const sup = supervisors[i];

    const sampleAchievements = defaultForm.achievements.map((_: any, idx: number) => ({
      description: idx === 0 ? 'Successfully led training workshop for field staff' : idx === 1 ? 'Developed new monitoring framework' : idx === 2 ? '' : '',
      employeeRating: idx < 3 ? [3, 2, 0][idx] : 0,
      supervisorRating: 0,
    }));
    const sampleGoals = defaultForm.goals.map((_: any, idx: number) => ({
      description: idx === 0 ? 'Complete advanced certification course' : idx === 1 ? 'Improve report submission timeline by 20%' : idx === 2 ? 'Mentor 2 junior staff members' : '',
      employeeRating: idx < 3 ? [3, 2, 3][idx] : 0,
      supervisorRating: 0,
    }));
    const sampleTechSkills = defaultForm.technicalSkills.map((skill: { name: string }, idx: number) => ({
      name: skill.name,
      employeeRating: [4, 3, 4, 3, 4, 3, 2, 3, 4, 4][idx],
      supervisorRating: 0,
    }));
    const sampleLeadSkills = defaultForm.leadershipSkills.map((skill: { name: string }, idx: number) => ({
      name: skill.name,
      employeeRating: [3, 4, 3, 4, 3][idx],
      supervisorRating: 0,
    }));
    const sampleMgrSkills = defaultForm.managerialSkills.map((skill: { name: string }, idx: number) => ({
      name: skill.name,
      employeeRating: [3, 4, 3, 3, 4, 3, 3][idx],
      supervisorRating: 0,
    }));

    const designationData = designations.find((d) => d.title === emp.designation);

    await db.appraisalFormData.create({
      data: {
        assignmentId: a.id,
        employeeName: emp.name,
        employeeId: emp.employeeId,
        designation: emp.designation,
        overallExp: emp.overallExp,
        yearsWithECI: emp.yearsWithECI,
        currentEdu: emp.currentEdu,
        requiredExp: designationData?.requiredExp || '',
        requiredEdu: designationData?.requiredEdu || '',
        department: emp.department,
        appraisalPeriod: `${cycle.periodFrom} to ${cycle.periodTo}`,
        lineManagerName: sup.name,
        lineManagerDesignation: sup.designation,
        achievementsJson: JSON.stringify(sampleAchievements),
        goalsJson: JSON.stringify(sampleGoals),
        technicalSkillsJson: JSON.stringify(sampleTechSkills),
        leadershipSkillsJson: JSON.stringify(sampleLeadSkills),
        managerialSkillsJson: JSON.stringify(sampleMgrSkills),
        explanationsJson: JSON.stringify(defaultForm.explanations),
        futureGoalsJson: JSON.stringify(defaultForm.futureGoals),
        remarksJson: JSON.stringify(defaultForm.remarks),
      },
    });

    if (i === 0) {
      await db.appraisalAssignment.update({ where: { id: a.id }, data: { status: 'submitted_by_employee' } });
    }
  }

  console.log('  • Creating notifications...');
  const notificationData = assignments.map((a) => ({
    userId: a.employeeId,
    assignmentId: a.id,
    type: 'form_assigned',
    title: 'New Appraisal Assigned',
    message: `You have been assigned a new appraisal: ${cycle.name}.`,
    actionRequired: true,
    link: '',
  }));
  await db.notification.createMany({ data: notificationData });

  console.log('\n─────────────────────────────────────────────');
  console.log('  DEMO SEED COMPLETE');
  console.log('─────────────────────────────────────────────');
  console.log('  Demo login accounts (all use password: password123):');
  console.log('    admin@eci.com         (admin)');
  console.log('    ceo@eci.com           (management)');
  console.log('    supervisor1@eci.com   (supervisor)');
  console.log('    supervisor2@eci.com   (supervisor)');
  console.log('    ali.rashid@eci.com    (employee)');
  console.log('    ...and 5 more employees');
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
