// App View Types
export type AppView =
  | 'dashboard'
  | 'master-data'
  | 'cycles'
  | 'cycle-create'
  | 'cycle-detail'
  | 'employees'
  | 'employee-create'
  | 'employee-detail'
  | 'departments'
  | 'designations'
  | 'rating-scales'
  | 'appraisal-categories'
  | 'appraisal-list'
  | 'appraisal-form'
  | 'appraisal-view'
  | 'notifications'
  | 'reports'
  | 'settings'
  | 'login'
  | 'audit-logs';

export type UserRole = 'admin' | 'supervisor' | 'management' | 'employee' | 'hr';

export type CycleStatus = 'draft' | 'active' | 'closed' | 'archived';
export type CycleType = 'mid_year' | 'annual';

export type AppraisalStatus =
  | 'assigned_to_employee'
  | 'submitted_by_employee'
  | 'under_supervisor_review'
  | 'submitted_by_supervisor'
  | 'under_hr_review'
  | 'submitted_to_management'
  | 'under_management_review'
  | 'returned_for_correction'
  | 'approved'
  | 'shared_with_employee'
  | 'acknowledged_by_employee'
  | 'closed';

export type ActionBy = 'employee' | 'supervisor' | 'hr' | 'management';

// Achievement / Goal Item (Section 2)
export interface AchievementGoalItem {
  description: string;
  employeeRating: number | 'NA';
  supervisorRating: number | 'NA';
}

// Competency Item (Section 3)
export interface CompetencyItem {
  name: string;
  employeeRating: number | 'NA';
  supervisorRating: number | 'NA';
}

// Explanation Item (Section 4)
export interface ExplanationItem {
  description: string;
  isResolved: boolean;
  hrRemarks: string;
  category: string;
  rating: number;
}

// Future Goal Item (Section 6)
export interface FutureGoalItem {
  description: string;
  quarters: [boolean, boolean, boolean, boolean];
}

// Remarks (Section 7)
export interface RemarksData {
  hrSatisfactionSkills: boolean | null;
  hrSatisfactionBehavior: boolean | null;
  hrSatisfactionPerformance: boolean | null;
  hrRecommendationMonitoring: boolean | null;
  hrRecommendationPromotion: boolean | null;
  hrRecommendationReward: boolean | null;
  hrGeneralRemarks: string;
  supervisorSatisfaction: boolean | null;
  supervisorConsiderationPromotion: boolean | null;
  supervisorConsiderationIncrement: boolean | null;
  supervisorConsiderationReward: boolean | null;
  supervisorGeneralRemarks: string;
}

export interface AppraisalFormDataFull {
  id?: string;
  assignmentId?: string;
  // Basic Info
  employeeName: string;
  employeeId: string;
  designation: string;
  overallExp: string;
  yearsWithECI: string;
  currentEdu: string;
  requiredExp: string;
  requiredEdu: string;
  department: string;
  appraisalPeriod: string;
  lineManagerName: string;
  lineManagerDesignation: string;
  // Section 2
  achievements: AchievementGoalItem[];
  goals: AchievementGoalItem[];
  // Section 3
  technicalSkills: CompetencyItem[];
  leadershipSkills: CompetencyItem[];
  managerialSkills: CompetencyItem[];
  // Section 4
  explanations: ExplanationItem[];
  // Section 5 (computed)
  // Section 6
  futureGoals: FutureGoalItem[];
  // Section 7
  remarks: RemarksData;
  // Section 8
  employeeSignature: string;
  employeeSignatureDate: string;
  supervisorSignature: string;
  supervisorSignatureDate: string;
  ceoSignature: string;
  ceoSignatureDate: string;
  // AI analysis (optional, may be empty object)
  aiAnalysis?: Record<string, unknown>;
}

// Notification
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  actionRequired: boolean;
  isRead: boolean;
  link: string;
  createdAt: string;
  assignmentId?: string;
}

// Audit Log
export interface AuditLogItem {
  id: string;
  action: string;
  userName: string;
  previousStatus: string;
  newStatus: string;
  details: string;
  createdAt: string;
}

// Dashboard Stats
export interface DashboardStats {
  activeCycles: number;
  totalAssigned: number;
  submittedAppraisals: number;
  pendingAppraisals: number;
  overdueAppraisals: number;
  returnedCases: number;
  approvedAppraisals: number;
  departmentProgress: { name: string; total: number; completed: number }[];
  supervisorProgress: { name: string; total: number; completed: number }[];
}

export interface CycleDetail {
  id: string;
  name: string;
  cycleType: CycleType;
  year: string;
  periodFrom: string;
  periodTo: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  status: CycleStatus;
  applicableDepts: string[];
  createdById: string;
  _count?: { assignments: number };
}

export interface EmployeeDetail {
  id: string;
  email: string;
  name: string;
  employeeId: string;
  designation: string;
  department: string;
  phone: string;
  overallExp: string;
  yearsWithECI: string;
  currentEdu: string;
  lineManagerId: string | null;
  role: UserRole;
  isSupervisor: boolean;
  isActive: boolean;
  lineManager?: { id: string; name: string; designation: string } | null;
  supervisedEmployees?: { id: string; name: string; employeeId: string; designation: string; department: string; isActive: boolean }[];
  _count?: { appraisals: number; supervisedAppraisals: number };
  createdAt?: string;
  updatedAt?: string;
}

// Department with linked record counts
export interface DepartmentDetail {
  id: string;
  name: string;
  isActive: boolean;
  employeeCount: number;
  designationCount: number;
  appraisalCount: number;
  createdAt: string;
  updatedAt: string;
}

// Designation with linked record counts
export interface DesignationDetail {
  id: string;
  title: string;
  requiredExp: string;
  requiredEdu: string;
  department: string;
  isActive: boolean;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

// Rating Scale
export interface RatingScaleItem {
  id: string;
  name: string;
  description: string;
  minScore: number;
  maxScore: number;
  labels: { score: number; label: string }[];
  appliesTo: string;
  sortOrder: number;
  isActive: boolean;
  categoryCount: number;
  createdAt: string;
  updatedAt: string;
}

// Appraisal Category
export interface AppraisalCategoryItem {
  id: string;
  name: string;
  section: string;
  description: string;
  sortOrder: number;
  ratingScaleId: string | null;
  ratingScaleName: string | null;
  ratingScale?: { id: string; name: string; minScore: number; maxScore: number } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Master Data Overview Stats
export interface MasterDataStats {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  employeesByRole: { role: string; count: number }[];
  totalDepartments: number;
  activeDepartments: number;
  totalDesignations: number;
  activeDesignations: number;
  totalRatingScales: number;
  totalCategories: number;
  employeesWithoutSupervisor: number;
  departmentsWithoutEmployees: string[];
}

export interface AssignmentDetail {
  id: string;
  cycleId: string;
  employeeId: string;
  supervisorId: string;
  escalatedSupervisorId?: string | null;
  status: AppraisalStatus;
  currentActionBy: ActionBy;
  returnReason: string;
  deadline: string | null;
  employee?: { id: string; name: string; employeeId: string; designation: string; department: string };
  supervisor?: { id: string; name: string; designation: string };
  escalatedSupervisor?: { id: string; name: string; designation: string } | null;
  cycle?: { id: string; name: string; cycleType: string; year: string; periodFrom: string; periodTo: string; status: string };
  formData?: any;
  createdAt: string;
}