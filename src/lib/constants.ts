// Rating labels for Section 2 (Achievements/Goals)
export const GOAL_RATING_OPTIONS = [
  { value: 0, label: 'No Achievement' },
  { value: 1, label: 'Partial Achievement' },
  { value: 2, label: 'Substantial Achievement' },
  { value: 3, label: 'Full Achievement' },
] as const;

// Rating labels for Section 3 (Competencies)  
export const COMPETENCY_RATING_OPTIONS = [
  { value: 1, label: 'Needs Improvement (0-40%)' },
  { value: 2, label: 'Partially Meets Expectations (41-55%)' },
  { value: 3, label: 'Meets Expectations (56-70%)' },
  { value: 4, label: 'Exceeds Expectations (71-86%)' },
  { value: 5, label: 'Greatly Exceeds Expectations (86-100%)' },
  { value: 'NA' as const, label: 'Not Applicable' },
] as const;

// Overall Rating Scale
export const OVERALL_RATING_SCALE = [
  { min: 86, max: 100, label: 'Greatly Exceeds Job Requirements', color: '#16a34a' },
  { min: 71, max: 85, label: 'Exceeds Job Requirements', color: '#2563eb' },
  { min: 56, max: 70, label: 'Meets Job Requirements', color: '#ca8a04' },
  { min: 41, max: 55, label: 'Occasionally Meets Job Requirements', color: '#ea580c' },
  { min: 0, max: 40, label: 'Fails to Meet Job Requirements', color: '#dc2626' },
] as const;

// Technical Skills list
export const TECHNICAL_SKILLS = [
  'Diploma / ToT / Courses',
  'Use of IT Tools',
  'Content/Material Development',
  'Data Search, Collection and Management',
  'Communication and Presentation',
  'Effective Communication on WhatsApp, Emails etc.',
  'Business Mobilization and Development',
  'Linkages and Relationship Management',
  'Reporting and Submission of Bills, Task Sheet, Supporting Documents etc.',
  'Personal Appearance',
] as const;

// Leadership Skills list
export const LEADERSHIP_SKILLS = [
  'Visionary and Long-Term Thinking',
  'Team Building, Coaching and Mentoring',
  'Fostering and Upholding Organizational Reputation',
  'Initiative & Creativity',
  'Adaptability & Flexibility',
] as const;

// Managerial Skills list
export const MANAGERIAL_SKILLS = [
  'Planning and Organizing',
  'Project Implementation',
  'Productivity In Terms of Quality and Quantity',
  'Utilization of Resources',
  'Monitoring and Controlling',
  'Decision Making and Problem Solving',
  'Time Management and Instant Response',
] as const;

// Section descriptions from Excel
export const SECTION_DESCRIPTIONS = {
  accomplishments: "The accomplishments include the extra and ordinary things done by you. Kindly don't list activities or training you done this year because these are part of your ToRs. These should be quantified, i.e., how many times won EOTM award, how many projects managed at same time, any degree / certification completed related to office job.",
  competencies: "Under this section, evaluates the employee's proficiency in technical/soft, leadership and managerial skills. It provides a snapshot of the individual's capabilities, focusing on key job-related competencies.",
  explanations: "This section contains the details of Notices / Explanation calls issued to staff and their status either these are resolved or still pending. If not resolved then maximum 3 numbers will be minus against each explanation.",
  futureGoals: "Setting goals for the next year in your performance appraisal is a crucial step for your personal and professional growth and aligning your efforts with the organization's strategic objectives. Minimum 3 goals are mandatory, maximum 5 goals can be added.",
  remarks: "The HR and supervisor remarks sections are critical components that provide valuable insights into your professional career. HR and supervisor remarks about staff job-related accomplishments and areas for improvement, skillset level, behavior, performances and recommendation for mentoring support, promotions, increments and award/rewards.",
} as const;

// Appraisal status labels
export const APPRAISAL_STATUS_LABELS: Record<string, string> = {
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
  closed: 'Closed/Archived',
};

export const APPRAISAL_STATUS_COLORS: Record<string, string> = {
  assigned_to_employee: 'bg-blue-100 text-blue-800',
  submitted_by_employee: 'bg-cyan-100 text-cyan-800',
  under_supervisor_review: 'bg-amber-100 text-amber-800',
  submitted_by_supervisor: 'bg-yellow-100 text-yellow-800',
  under_hr_review: 'bg-purple-100 text-purple-800',
  submitted_to_management: 'bg-indigo-100 text-indigo-800',
  under_management_review: 'bg-violet-100 text-violet-800',
  returned_for_correction: 'bg-red-100 text-red-800',
  approved: 'bg-green-100 text-green-800',
  shared_with_employee: 'bg-emerald-100 text-emerald-800',
  acknowledged_by_employee: 'bg-teal-100 text-teal-800',
  closed: 'bg-gray-100 text-gray-800',
};

export const CYCLE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  archived: 'Archived',
};

export const CYCLE_TYPE_LABELS: Record<string, string> = {
  mid_year: 'Mid-Year Appraisal',
  annual: 'Annual Appraisal',
};

// Default form data factory
export function createDefaultFormData(): any {
  return {
    achievements: Array.from({ length: 4 }, () => ({ description: '', employeeRating: 0, supervisorRating: 0 })),
    goals: Array.from({ length: 4 }, () => ({ description: '', employeeRating: 0, supervisorRating: 0 })),
    technicalSkills: TECHNICAL_SKILLS.map(name => ({ name, employeeRating: 0, supervisorRating: 0 })),
    leadershipSkills: LEADERSHIP_SKILLS.map(name => ({ name, employeeRating: 0, supervisorRating: 0 })),
    managerialSkills: MANAGERIAL_SKILLS.map(name => ({ name, employeeRating: 0, supervisorRating: 0 })),
    explanations: Array.from({ length: 3 }, () => ({ description: '', isResolved: false, hrRemarks: '', category: '', rating: 0 })),
    futureGoals: Array.from({ length: 4 }, () => ({ description: '', quarters: [false, false, false, false] as [boolean, boolean, boolean, boolean] })),
    remarks: {
      hrSatisfactionSkills: null,
      hrSatisfactionBehavior: null,
      hrSatisfactionPerformance: null,
      hrRecommendationMonitoring: null,
      hrRecommendationPromotion: null,
      hrRecommendationReward: null,
      hrGeneralRemarks: '',
      supervisorSatisfaction: null,
      supervisorConsiderationPromotion: null,
      supervisorConsiderationIncrement: null,
      supervisorConsiderationReward: null,
      supervisorGeneralRemarks: '',
    },
    employeeSignature: '',
    employeeSignatureDate: '',
    supervisorSignature: '',
    supervisorSignatureDate: '',
    ceoSignature: '',
    ceoSignatureDate: '',
  };
}

// Calculation Functions - exactly matching Excel logic
export function calculateAppraisalScores(data: any, role: 'employee' | 'supervisor') {
  const ratingKey = role === 'employee' ? 'employeeRating' : 'supervisorRating';

  // Section 2: Goals & Achievements
  const allItems = [...(data.achievements || []), ...(data.goals || [])];
  const naCountGoals = allItems.filter((item: any) => item[ratingKey] === 'NA').length;
  const totalItemsGoals = allItems.length;
  const maxMarksGoals = (totalItemsGoals - naCountGoals) * 3;
  const marksGoals = allItems.reduce((sum: number, item: any) => sum + (item[ratingKey] === 'NA' ? 0 : Number(item[ratingKey])), 0);

  // Section 3: Competencies
  const techItems = data.technicalSkills || [];
  const leadItems = data.leadershipSkills || [];
  const mgrItems = data.managerialSkills || [];

  const naTech = techItems.filter((item: any) => item[ratingKey] === 'NA').length;
  const naLead = leadItems.filter((item: any) => item[ratingKey] === 'NA').length;
  const naMgr = mgrItems.filter((item: any) => item[ratingKey] === 'NA').length;
  const totalNACompetencies = naTech + naLead + naMgr;

  const maxMarksCompetencies = 110 - (totalNACompetencies * 3);

  const techSubtotal = techItems.reduce((sum: number, item: any) => sum + (item[ratingKey] === 'NA' ? 0 : Number(item[ratingKey])), 0);
  const leadSubtotal = leadItems.reduce((sum: number, item: any) => sum + (item[ratingKey] === 'NA' ? 0 : Number(item[ratingKey])), 0);
  const mgrSubtotal = mgrItems.reduce((sum: number, item: any) => sum + (item[ratingKey] === 'NA' ? 0 : Number(item[ratingKey])), 0);
  const totalCompetencies = techSubtotal + leadSubtotal + mgrSubtotal;

  // Section 4: Explanations
  const explanations = data.explanations || [];
  const naExplanations = explanations.filter((e: any) => !e.description || e.description.trim() === '').length;
  const maxMarksExplanations = 9 + (naExplanations * -3);
  const marksDeducted = explanations.reduce((sum: number, e: any) => sum + (e.rating || 0), 0);

  // Section 5: Overall
  const denominator = maxMarksExplanations + maxMarksCompetencies + maxMarksGoals;
  const grandTotal = marksGoals + totalCompetencies - marksDeducted;
  const overallPercentage = denominator > 0 ? (grandTotal / denominator) * 100 : 0;

  // Rating
  let rating = '';
  if (overallPercentage === 0) rating = '';
  else if (overallPercentage < 40) rating = 'Fails to Meet Job Requirements';
  else if (overallPercentage < 55) rating = 'Occasionally Meets Job Requirements';
  else if (overallPercentage < 70) rating = 'Meets Job Requirements';
  else if (overallPercentage < 86) rating = 'Exceeds Job Requirements';
  else rating = 'Greatly Exceeds Job Requirements';

  return {
    naCountGoals,
    maxMarksGoals,
    marksGoals,
    naTech, naLead, naMgr,
    totalNACompetencies,
    maxMarksCompetencies,
    techSubtotal, leadSubtotal, mgrSubtotal,
    totalCompetencies,
    naExplanations,
    maxMarksExplanations,
    marksDeducted,
    grandTotal,
    overallPercentage: Math.round(overallPercentage * 100) / 100,
    rating,
  };
}