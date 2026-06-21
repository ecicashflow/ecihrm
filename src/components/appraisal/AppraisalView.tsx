'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Printer, Share2, CheckCircle2, Loader2, Send, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type {
  AppraisalFormDataFull,
  AssignmentDetail,
} from '@/lib/types';
import {
  GOAL_RATING_OPTIONS,
  COMPETENCY_RATING_OPTIONS,
  TECHNICAL_SKILLS,
  LEADERSHIP_SKILLS,
  MANAGERIAL_SKILLS,
  SECTION_DESCRIPTIONS,
  calculateAppraisalScores,
  createDefaultFormData,
  OVERALL_RATING_SCALE,
} from '@/lib/constants';
import { APPRAISAL_STATUS_LABELS, APPRAISAL_STATUS_COLORS } from '@/lib/constants';

export default function AppraisalView() {
  const { viewParams, setCurrentView, currentUser } = useAppStore();
  const assignmentId = viewParams?.id;

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [formData, setFormData] = useState<AppraisalFormDataFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    async function fetchData() {
      try {
        setError(null);
        const [assignRes, formRes] = await Promise.all([
          fetch(`/api/assignments/${assignmentId}`),
          fetch(`/api/assignments/${assignmentId}/form`),
        ]);
        if (assignRes.ok) setAssignment(await assignRes.json());
        if (formRes.ok) {
          // API returns form data directly (not wrapped in `formData`).
          // Merge with defaults so all fields are populated correctly.
          const data = await formRes.json();
          const defaults = createDefaultFormData();
          setFormData({
            ...defaults,
            employeeName: data.employeeName || '',
            employeeId: data.employeeId || '',
            designation: data.designation || '',
            overallExp: data.overallExp || '',
            yearsWithECI: data.yearsWithECI || '',
            currentEdu: data.currentEdu || '',
            requiredExp: data.requiredExp || '',
            requiredEdu: data.requiredEdu || '',
            department: data.department || '',
            appraisalPeriod: data.appraisalPeriod || '',
            lineManagerName: data.lineManagerName || '',
            lineManagerDesignation: data.lineManagerDesignation || '',
            achievements: Array.isArray(data.achievements) ? data.achievements : defaults.achievements,
            goals: Array.isArray(data.goals) ? data.goals : defaults.goals,
            technicalSkills: Array.isArray(data.technicalSkills) ? data.technicalSkills : defaults.technicalSkills,
            leadershipSkills: Array.isArray(data.leadershipSkills) ? data.leadershipSkills : defaults.leadershipSkills,
            managerialSkills: Array.isArray(data.managerialSkills) ? data.managerialSkills : defaults.managerialSkills,
            explanations: Array.isArray(data.explanations) ? data.explanations : defaults.explanations,
            futureGoals: Array.isArray(data.futureGoals) ? data.futureGoals : defaults.futureGoals,
            remarks: data.remarks || defaults.remarks,
            employeeSignature: data.employeeSignature || '',
            employeeSignatureDate: data.employeeSignatureDate || '',
            supervisorSignature: data.supervisorSignature || '',
            supervisorSignatureDate: data.supervisorSignatureDate || '',
            ceoSignature: data.ceoSignature || '',
            ceoSignatureDate: data.ceoSignatureDate || '',
          });
        }
      } catch {
        console.warn('Server unavailable, could not load appraisal data');
        setError('Unable to load appraisal data. The server may be temporarily unavailable.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [assignmentId]);

  const employeeScores = useMemo(
    () => (formData ? calculateAppraisalScores(formData, 'employee') : null),
    [formData]
  );
  const supervisorScores = useMemo(
    () => (formData ? calculateAppraisalScores(formData, 'supervisor') : null),
    [formData]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Connection Issue</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={() => setCurrentView('appraisal-list')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  if (!assignment || !formData) {
    return <div className="text-center py-12 text-muted-foreground">Appraisal not found</div>;
  }

  const userRole = currentUser?.role || 'employee';
  const canShare = (userRole === 'admin') && assignment.status === 'approved';
  const canAcknowledge = userRole === 'employee' && (assignment.status === 'approved' || assignment.status === 'shared_with_employee');

  const handleShareWithEmployee = async () => {
    if (!assignmentId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hr_share' }),
      });
      if (res.ok) {
        toast.success('Appraisal shared with employee');
        setCurrentView('appraisal-list');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to share');
      }
    } catch {
      toast.error('Failed to share');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!assignmentId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'employee_acknowledge' }),
      });
      if (res.ok) {
        toast.success('Appraisal acknowledged successfully');
        setCurrentView('appraisal-list');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to acknowledge');
      }
    } catch {
      toast.error('Failed to acknowledge');
    } finally {
      setActionLoading(false);
    }
  };

  function SectionHeader({ number, title }: { number: number; title: string }) {
    return (
      <div className="eci-gradient-header text-white px-4 py-3 rounded-t-xl">
        <h3 className="font-semibold text-sm">
          Section {number}: {title}
        </h3>
      </div>
    );
  }

  function RatingLabel({ section, value }: { section: 'goal' | 'competency'; value: number | 'NA' }) {
    if (value === 'NA') return <span className="text-muted-foreground text-xs">NA</span>;
    const options = section === 'goal' ? GOAL_RATING_OPTIONS : COMPETENCY_RATING_OPTIONS;
    const opt = options.find((o) => o.value === value);
    return (
      <span className="text-sm font-medium">
        {value} - {opt?.label || ''}
      </span>
    );
  }

  const getRatingColor = (pct: number) => {
    if (pct >= 86) return '#16a34a';
    if (pct >= 71) return '#2563eb';
    if (pct >= 56) return '#ca8a04';
    if (pct >= 41) return '#ea580c';
    return '#dc2626';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('appraisal-list')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-bold">Performance Appraisal - Read Only</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-muted-foreground">
                {assignment.employee?.name} · {assignment.cycle?.name}
              </span>
              <Badge className={APPRAISAL_STATUS_COLORS[assignment.status] || ''}>
                {APPRAISAL_STATUS_LABELS[assignment.status] || assignment.status}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        {canShare && (
          <Button className="eci-btn-primary" onClick={handleShareWithEmployee} disabled={actionLoading}>
            {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
            Share with Employee
          </Button>
        )}
        {canAcknowledge && (
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleAcknowledge} disabled={actionLoading}>
            {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Acknowledge
          </Button>
        )}
      </div>

      {/* Section 1: Basic Information */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={1} title="Basic Information" />
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            {[
              ['Employee ID', formData.employeeId],
              ['Name', formData.employeeName],
              ['Designation', formData.designation],
              ['Overall Experience', formData.overallExp],
              ['Years with ECI', formData.yearsWithECI],
              ['Current Education', formData.currentEdu],
              ['Required Experience', formData.requiredExp],
              ['Required Education', formData.requiredEdu],
              ['Department', formData.department],
              ['Appraisal Period', formData.appraisalPeriod],
              ['Line Manager Name', formData.lineManagerName],
              ['Line Manager Designation', formData.lineManagerDesignation],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-muted/30 p-2 rounded">
                <p className="text-xs text-muted-foreground">{label as string}</p>
                <p className="font-medium">{value || '-'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Key Accomplishments and Goals */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={2} title="Key Accomplishments and Goals" />
        <CardContent className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground bg-amber-50 p-3 rounded-lg border border-amber-200">
            {SECTION_DESCRIPTIONS.accomplishments}
          </p>

          <div>
            <h4 className="font-semibold text-sm mb-2">Achievements</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-center p-2 w-40">Employee Rating</th>
                    <th className="text-center p-2 w-40">Supervisor Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.achievements.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2 whitespace-pre-wrap">{item.description || <span className="text-muted-foreground">-</span>}</td>
                      <td className="p-2 text-center"><RatingLabel section="goal" value={item.employeeRating} /></td>
                      <td className="p-2 text-center"><RatingLabel section="goal" value={item.supervisorRating} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold text-sm mb-2">Goals</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-center p-2 w-40">Employee Rating</th>
                    <th className="text-center p-2 w-40">Supervisor Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.goals.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2 whitespace-pre-wrap">{item.description || <span className="text-muted-foreground">-</span>}</td>
                      <td className="p-2 text-center"><RatingLabel section="goal" value={item.employeeRating} /></td>
                      <td className="p-2 text-center"><RatingLabel section="goal" value={item.supervisorRating} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Assessment of Skillset and Competencies */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={3} title="Assessment of Skillset and Competencies" />
        <CardContent className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
            {SECTION_DESCRIPTIONS.competencies}
          </p>

          {([
            { key: 'technicalSkills' as const, label: 'Technical and Soft Skills' },
            { key: 'leadershipSkills' as const, label: 'Leadership Skills' },
            { key: 'managerialSkills' as const, label: 'Managerial Skills' },
          ]).map((group) => (
            <div key={group.key}>
              <h4 className="font-semibold text-sm mb-2">{group.label}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Skill</th>
                      <th className="text-center p-2 w-40">Employee Rating</th>
                      <th className="text-center p-2 w-40">Supervisor Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData[group.key].map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="p-2 text-muted-foreground">{idx + 1}</td>
                        <td className="p-2">{item.name}</td>
                        <td className="p-2 text-center"><RatingLabel section="competency" value={item.employeeRating} /></td>
                        <td className="p-2 text-center"><RatingLabel section="competency" value={item.supervisorRating} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Separator className="my-3" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section 4: Notices/Explanations */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={4} title="Notices/Explanations" />
        <CardContent className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground bg-red-50 p-3 rounded-lg border border-red-200">
            {SECTION_DESCRIPTIONS.explanations}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Description</th>
                  <th className="text-center p-2">Resolved</th>
                  <th className="text-left p-2">HR Remarks</th>
                  <th className="text-center p-2">Category</th>
                  <th className="text-center p-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {formData.explanations.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="p-2 text-muted-foreground">{idx + 1}</td>
                    <td className="p-2 whitespace-pre-wrap">{item.description || <span className="text-muted-foreground">-</span>}</td>
                    <td className="p-2 text-center">{item.isResolved ? '✓' : '✗'}</td>
                    <td className="p-2 whitespace-pre-wrap">{item.hrRemarks || <span className="text-muted-foreground">-</span>}</td>
                    <td className="p-2 text-center">{item.category || '-'}</td>
                    <td className="p-2 text-center font-semibold">{item.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Overall Performance Evaluation */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={5} title="Overall Performance Evaluation" />
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3">Description</th>
                  <th className="text-center p-3 w-28">Employee</th>
                  <th className="text-center p-3 w-28">Supervisor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3">Total NA in Goals & Achievements</td>
                  <td className="p-3 text-center">{employeeScores?.naCountGoals ?? 0}</td>
                  <td className="p-3 text-center">{supervisorScores?.naCountGoals ?? 0}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium">Total Marks of Goals & Achievements</td>
                  <td className="p-3 text-center">{employeeScores?.marksGoals ?? 0} / {employeeScores?.maxMarksGoals ?? 0}</td>
                  <td className="p-3 text-center">{supervisorScores?.marksGoals ?? 0} / {supervisorScores?.maxMarksGoals ?? 0}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">Total of Skillset and Competencies</td>
                  <td className="p-3 text-center">{employeeScores?.totalCompetencies ?? 0} / {employeeScores?.maxMarksCompetencies ?? 0}</td>
                  <td className="p-3 text-center">{supervisorScores?.totalCompetencies ?? 0} / {supervisorScores?.maxMarksCompetencies ?? 0}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 text-red-600">Marks Deducted (Explanations)</td>
                  <td className="p-3 text-center text-red-600">-{employeeScores?.marksDeducted ?? 0}</td>
                  <td className="p-3 text-center text-red-600">-{supervisorScores?.marksDeducted ?? 0}</td>
                </tr>
                <tr className="border-b bg-eci-blue/5 font-bold">
                  <td className="p-3">Grand Total</td>
                  <td className="p-3 text-center">{employeeScores?.grandTotal ?? 0}</td>
                  <td className="p-3 text-center">{supervisorScores?.grandTotal ?? 0}</td>
                </tr>
                <tr className="border-b bg-green-50">
                  <td className="p-3 font-bold">Overall Performance %</td>
                  <td className="p-3 text-center font-bold text-lg" style={{ color: getRatingColor(employeeScores?.overallPercentage ?? 0) }}>
                    {employeeScores?.overallPercentage ?? 0}%
                  </td>
                  <td className="p-3 text-center font-bold text-lg" style={{ color: getRatingColor(supervisorScores?.overallPercentage ?? 0) }}>
                    {supervisorScores?.overallPercentage ?? 0}%
                  </td>
                </tr>
                <tr className="bg-eci-blue/10">
                  <td className="p-3 font-bold">Rating</td>
                  <td className="p-3 text-center font-semibold" style={{ color: getRatingColor(employeeScores?.overallPercentage ?? 0) }}>
                    {employeeScores?.rating || '-'}
                  </td>
                  <td className="p-3 text-center font-semibold" style={{ color: getRatingColor(supervisorScores?.overallPercentage ?? 0) }}>
                    {supervisorScores?.rating || '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Goals for Next Year */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={6} title="Goals for Next Year" />
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Goal Description</th>
                  <th className="text-center p-2">Q1</th>
                  <th className="text-center p-2">Q2</th>
                  <th className="text-center p-2">Q3</th>
                  <th className="text-center p-2">Q4</th>
                </tr>
              </thead>
              <tbody>
                {formData.futureGoals.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="p-2 text-muted-foreground">{idx + 1}</td>
                    <td className="p-2 whitespace-pre-wrap">{item.description || <span className="text-muted-foreground">-</span>}</td>
                    {[0, 1, 2, 3].map((qi) => (
                      <td key={qi} className="p-2 text-center">{item.quarters[qi] ? '✓' : '✗'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 7: Remarks */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={7} title="Remarks on Employee's Performance" />
        <CardContent className="p-4 space-y-6">
          <div>
            <h4 className="font-semibold text-sm mb-3 text-eci-blue">HR Section</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                { label: 'Satisfaction About Skills', value: formData.remarks.hrSatisfactionSkills },
                { label: 'Satisfaction About Behavior', value: formData.remarks.hrSatisfactionBehavior },
                { label: 'Satisfaction About Performance', value: formData.remarks.hrSatisfactionPerformance },
                { label: 'Recommendation for Close Monitoring', value: formData.remarks.hrRecommendationMonitoring },
                { label: 'Recommendation for Promotion', value: formData.remarks.hrRecommendationPromotion },
                { label: 'Recommendation for Reward/Award', value: formData.remarks.hrRecommendationReward },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={item.value ? 'text-green-600 font-medium' : 'text-red-600'}>
                    {item.value === true ? 'Yes' : item.value === false ? 'No' : '-'}
                  </span>
                </div>
              ))}
            </div>
            {formData.remarks.hrGeneralRemarks && (
              <div className="mt-3 p-3 bg-muted/20 rounded text-sm">
                <span className="font-medium">HR Remarks: </span>
                {formData.remarks.hrGeneralRemarks}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold text-sm mb-3 text-eci-blue">Supervisor Section</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                { label: 'Satisfaction', value: formData.remarks.supervisorSatisfaction },
                { label: 'Consideration for Promotion', value: formData.remarks.supervisorConsiderationPromotion },
                { label: 'Consideration for Increment', value: formData.remarks.supervisorConsiderationIncrement },
                { label: 'Consideration for Reward/Award', value: formData.remarks.supervisorConsiderationReward },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={item.value ? 'text-green-600 font-medium' : 'text-red-600'}>
                    {item.value === true ? 'Yes' : item.value === false ? 'No' : '-'}
                  </span>
                </div>
              ))}
            </div>
            {formData.remarks.supervisorGeneralRemarks && (
              <div className="mt-3 p-3 bg-muted/20 rounded text-sm">
                <span className="font-medium">Supervisor Remarks: </span>
                {formData.remarks.supervisorGeneralRemarks}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 8: Certification */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={8} title="Certification" />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-1 p-3 bg-muted/20 rounded">
              <p className="text-muted-foreground text-xs">Employee's Signature</p>
              <p className="font-medium">{formData.employeeSignature || 'Not signed'}</p>
              <p className="text-xs text-muted-foreground">{formData.employeeSignatureDate || ''}</p>
            </div>
            <div className="space-y-1 p-3 bg-muted/20 rounded">
              <p className="text-muted-foreground text-xs">Supervisor's Signature</p>
              <p className="font-medium">{formData.supervisorSignature || 'Not signed'}</p>
              <p className="text-xs text-muted-foreground">{formData.supervisorSignatureDate || ''}</p>
            </div>
            <div className="space-y-1 p-3 bg-muted/20 rounded">
              <p className="text-muted-foreground text-xs">CEO's Signature</p>
              <p className="font-medium">{formData.ceoSignature || 'Not signed'}</p>
              <p className="text-xs text-muted-foreground">{formData.ceoSignatureDate || ''}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back button */}
      <div className="no-print">
        <Button variant="outline" onClick={() => setCurrentView('appraisal-list')}>
          Back to List
        </Button>
      </div>
    </div>
  );
}