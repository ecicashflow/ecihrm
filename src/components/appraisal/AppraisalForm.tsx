'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Save, Send, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type {
  AppraisalFormDataFull,
  AssignmentDetail,
  AchievementGoalItem,
  CompetencyItem,
  ExplanationItem,
  FutureGoalItem,
  RemarksData,
  AppraisalStatus,
} from '@/lib/types';
import {
  GOAL_RATING_OPTIONS,
  COMPETENCY_RATING_OPTIONS,
  TECHNICAL_SKILLS,
  LEADERSHIP_SKILLS,
  MANAGERIAL_SKILLS,
  SECTION_DESCRIPTIONS,
  createDefaultFormData,
  calculateAppraisalScores,
} from '@/lib/constants';
import { APPRAISAL_STATUS_LABELS, APPRAISAL_STATUS_COLORS } from '@/lib/constants';

export default function AppraisalForm() {
  const { viewParams, currentUser, setCurrentView } = useAppStore();
  const assignmentId = viewParams?.id;

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [formData, setFormData] = useState<AppraisalFormDataFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [returnDialog, setReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRole = currentUser?.role || 'employee';
  const currentActionBy = assignment?.currentActionBy;

  // Can the user edit?
  const canEditEmployee = userRole === 'employee' && currentActionBy === 'employee';
  const canEditSupervisor = (userRole === 'supervisor' || userRole === 'admin' || userRole === 'hr') && currentActionBy === 'supervisor' && currentUser?.id !== assignment?.employeeId;
  const canEditHR = (userRole === 'admin' || userRole === 'hr') && currentActionBy === 'hr';
  const canEditManagement = userRole === 'management' && (currentActionBy === 'management');
  const canSubmit = currentActionBy === userRole;

  // Fetch assignment and form data
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
          const data = await formRes.json();
          setFormData(data.formData || createDefaultFormData());
        } else {
          setFormData(createDefaultFormData());
        }
      } catch {
        console.warn('Server unavailable, could not load appraisal form');
        setError('Unable to load appraisal form. The server may be temporarily unavailable.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [assignmentId]);

  // Update form helpers
  const updateAchievement = useCallback(
    (section: 'achievements' | 'goals', index: number, field: keyof AchievementGoalItem, value: string | number) => {
      setFormData((prev) => {
        if (!prev) return prev;
        const updated = [...prev[section]];
        updated[index] = { ...updated[index], [field]: value };
        return { ...prev, [section]: updated };
      });
    },
    []
  );

  const updateSkill = useCallback(
    (section: 'technicalSkills' | 'leadershipSkills' | 'managerialSkills', index: number, field: 'employeeRating' | 'supervisorRating', value: number | 'NA') => {
      setFormData((prev) => {
        if (!prev) return prev;
        const updated = [...prev[section]];
        updated[index] = { ...updated[index], [field]: value };
        return { ...prev, [section]: updated };
      });
    },
    []
  );

  const updateExplanation = useCallback(
    (index: number, field: keyof ExplanationItem, value: string | boolean | number) => {
      setFormData((prev) => {
        if (!prev) return prev;
        const updated = [...prev.explanations];
        updated[index] = { ...updated[index], [field]: value };
        return { ...prev, explanations: updated };
      });
    },
    []
  );

  const updateGoal = useCallback(
    (index: number, field: keyof FutureGoalItem, value: string | boolean | [boolean, boolean, boolean, boolean], quarterIdx?: number) => {
      setFormData((prev) => {
        if (!prev) return prev;
        const updated = [...prev.futureGoals];
        if (field === 'quarters' && quarterIdx !== undefined) {
          const newQuarters = [...updated[index].quarters] as [boolean, boolean, boolean, boolean];
          newQuarters[quarterIdx] = value as boolean;
          updated[index] = { ...updated[index], quarters: newQuarters };
        } else {
          updated[index] = { ...updated[index], [field]: value };
        }
        return { ...prev, futureGoals: updated };
      });
    },
    []
  );

  const updateRemarks = useCallback(
    (section: 'hr' | 'supervisor', field: string, value: boolean | string | null) => {
      setFormData((prev) => {
        if (!prev) return prev;
        const updated = { ...prev.remarks };
        if (section === 'hr') {
          (updated as any)[`hr${field}`] = value;
        } else {
          (updated as any)[`supervisor${field}`] = value;
        }
        return { ...prev, remarks: updated as RemarksData };
      });
    },
    []
  );

  // Calculate scores
  const employeeScores = useMemo(
    () => (formData ? calculateAppraisalScores(formData, 'employee') : null),
    [formData]
  );
  const supervisorScores = useMemo(
    () => (formData ? calculateAppraisalScores(formData, 'supervisor') : null),
    [formData]
  );

  // Save draft
  const handleSave = async () => {
    if (!assignmentId || !formData) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/form`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, callerId: currentUser?.id }),
      });
      if (res.ok) {
        toast.success('Draft saved successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Determine the workflow action based on current user role
  const getSubmitAction = (): string => {
    if (userRole === 'employee') return 'employee_submit';
    if (userRole === 'supervisor') return 'supervisor_submit';
    if (userRole === 'admin') return 'hr_submit';
    if (userRole === 'hr') return 'hr_submit';
    if (userRole === 'management') return 'management_approve';
    return 'employee_submit';
  };

  // Submit
  const handleSubmit = async () => {
    if (!assignmentId || !formData) return;

    // Validation
    if (canEditEmployee) {
      const filledGoals = formData.futureGoals.filter((g) => g.description.trim() !== '');
      if (filledGoals.length < 3) {
        toast.error('Minimum 3 goals are required in Section 6');
        return;
      }
    }

    setSubmitting(true);
    try {
      // Save form data first
      await fetch(`/api/assignments/${assignmentId}/form`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, callerId: currentUser?.id }),
      });

      const action = getSubmitAction();
      const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success('Appraisal submitted successfully');
        setCurrentView('appraisal-list');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to submit');
      }
    } catch {
      toast.error('Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  // Return for correction
  const handleReturn = async () => {
    if (!assignmentId || !returnReason.trim()) {
      toast.error('Please provide a reason for returning');
      return;
    }
    setReturning(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'management_return', returnReason }),
      });
      if (res.ok) {
        toast.success('Appraisal returned for correction');
        setCurrentView('appraisal-list');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to return');
      }
    } catch {
      toast.error('Failed to return');
    } finally {
      setReturning(false);
      setReturnDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
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
    return <div className="text-center py-12 text-muted-foreground">Assignment not found</div>;
  }

  const isReadOnly = !canEditEmployee && !canEditSupervisor && !canEditHR && !canEditManagement;

  // Section header component
  function SectionHeader({ number, title }: { number: number; title: string }) {
    return (
      <div className="eci-gradient-header text-white px-4 py-3 rounded-t-xl">
        <h3 className="font-semibold text-sm">
          Section {number}: {title}
        </h3>
      </div>
    );
  }

  // Rating select for Section 2
  function GoalRatingSelect({
    value,
    onChange,
    disabled,
  }: {
    value: number | 'NA';
    onChange: (val: number | 'NA') => void;
    disabled: boolean;
  }) {
    return (
      <Select value={String(value)} onValueChange={(v) => onChange(v === 'NA' ? 'NA' : Number(v))} disabled={disabled}>
        <SelectTrigger className="w-28 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GOAL_RATING_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              {opt.value} - {opt.label}
            </SelectItem>
          ))}
          <SelectItem value="NA">NA</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Rating select for Section 3
  function CompetencyRatingSelect({
    value,
    onChange,
    disabled,
  }: {
    value: number | 'NA';
    onChange: (val: number | 'NA') => void;
    disabled: boolean;
  }) {
    return (
      <Select value={String(value)} onValueChange={(v) => onChange(v === 'NA' ? 'NA' : Number(v))} disabled={disabled}>
        <SelectTrigger className="w-28 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMPETENCY_RATING_OPTIONS.map((opt) => (
            <SelectItem key={String(opt.value)} value={String(opt.value)}>
              {opt.value} - {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('appraisal-list')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-bold">Performance Appraisal Form</h2>
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
        <div className="flex items-center gap-2 no-print">
          {canSubmit && (
            <Button className="eci-btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit
            </Button>
          )}
          {canEditManagement && (
            <Button variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => setReturnDialog(true)}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Return for Correction
            </Button>
          )}
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Draft
          </Button>
        </div>
      </div>

      {/* Escalation Notice */}
      {assignment.escalatedSupervisorId && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Appraisal Escalated</p>
            <p className="text-sm">
              This appraisal was escalated to {assignment.escalatedSupervisor?.name || 'a higher manager'} to prevent self-review.
            </p>
          </div>
        </div>
      )}

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
        <SectionHeader number={2} title="Key Accomplishments and Goals of " />
        <CardContent className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground bg-amber-50 p-3 rounded-lg border border-amber-200">
            {SECTION_DESCRIPTIONS.accomplishments}
          </p>
          <p className="text-xs text-muted-foreground">
            Rating: 0 = No Achievement, 1 = Partial, 2 = Substantial, 3 = Full Achievement
          </p>

          {/* Achievements */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Achievements</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 min-w-48">#</th>
                    <th className="text-left p-2 min-w-48">Description</th>
                    <th className="text-center p-2 w-32">Employee Rating</th>
                    <th className="text-center p-2 w-32">Supervisor Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.achievements.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2">
                        <Textarea
                          value={item.description}
                          onChange={(e) => updateAchievement('achievements', idx, 'description', e.target.value)}
                          disabled={!canEditEmployee}
                          placeholder="Describe achievement..."
                          className="min-h-16 text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <GoalRatingSelect
                          value={item.employeeRating}
                          onChange={(v) => updateAchievement('achievements', idx, 'employeeRating', v)}
                          disabled={!canEditEmployee}
                        />
                      </td>
                      <td className="p-2">
                        <GoalRatingSelect
                          value={item.supervisorRating}
                          onChange={(v) => updateAchievement('achievements', idx, 'supervisorRating', v)}
                          disabled={!canEditSupervisor}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/20 font-semibold">
                    <td colSpan={2} className="p-2 text-right">Sub-Total (Achievements):</td>
                    <td className="p-2 text-center">
                      {formData.achievements.reduce((s, i) => s + (i.employeeRating === 'NA' ? 0 : Number(i.employeeRating)), 0)} /{' '}
                      {(formData.achievements.length - formData.achievements.filter((i) => i.employeeRating === 'NA').length) * 3}
                    </td>
                    <td className="p-2 text-center">
                      {formData.achievements.reduce((s, i) => s + (i.supervisorRating === 'NA' ? 0 : Number(i.supervisorRating)), 0)} /{' '}
                      {(formData.achievements.length - formData.achievements.filter((i) => i.supervisorRating === 'NA').length) * 3}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          {/* Goals */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Goals</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 min-w-48">#</th>
                    <th className="text-left p-2 min-w-48">Description</th>
                    <th className="text-center p-2 w-32">Employee Rating</th>
                    <th className="text-center p-2 w-32">Supervisor Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.goals.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2">
                        <Textarea
                          value={item.description}
                          onChange={(e) => updateAchievement('goals', idx, 'description', e.target.value)}
                          disabled={!canEditEmployee}
                          placeholder="Describe goal..."
                          className="min-h-16 text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <GoalRatingSelect
                          value={item.employeeRating}
                          onChange={(v) => updateAchievement('goals', idx, 'employeeRating', v)}
                          disabled={!canEditEmployee}
                        />
                      </td>
                      <td className="p-2">
                        <GoalRatingSelect
                          value={item.supervisorRating}
                          onChange={(v) => updateAchievement('goals', idx, 'supervisorRating', v)}
                          disabled={!canEditSupervisor}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/20 font-semibold">
                    <td colSpan={2} className="p-2 text-right">Sub-Total (Goals):</td>
                    <td className="p-2 text-center">
                      {formData.goals.reduce((s, i) => s + (i.employeeRating === 'NA' ? 0 : Number(i.employeeRating)), 0)} /{' '}
                      {(formData.goals.length - formData.goals.filter((i) => i.employeeRating === 'NA').length) * 3}
                    </td>
                    <td className="p-2 text-center">
                      {formData.goals.reduce((s, i) => s + (i.supervisorRating === 'NA' ? 0 : Number(i.supervisorRating)), 0)} /{' '}
                      {(formData.goals.length - formData.goals.filter((i) => i.supervisorRating === 'NA').length) * 3}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Note: Both achievements and goals are rated on a scale of 0-3. NA items are excluded from the calculation.
          </p>
        </CardContent>
      </Card>

      {/* Section 3: Assessment of Skillset and Competencies */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={3} title="Assessment of Skillset and Competencies" />
        <CardContent className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
            {SECTION_DESCRIPTIONS.competencies}
          </p>
          <p className="text-xs text-muted-foreground">
            Rating: 1 = Needs Improvement, 2 = Partially Meets, 3 = Meets, 4 = Exceeds, 5 = Greatly Exceeds, NA
          </p>

          {([
            { key: 'technicalSkills' as const, label: 'Technical and Soft Skills', items: TECHNICAL_SKILLS },
            { key: 'leadershipSkills' as const, label: 'Leadership Skills', items: LEADERSHIP_SKILLS },
            { key: 'managerialSkills' as const, label: 'Managerial Skills', items: MANAGERIAL_SKILLS },
          ]).map((group) => (
            <div key={group.key}>
              <h4 className="font-semibold text-sm mb-2">{group.label}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Skill</th>
                      <th className="text-center p-2 w-32">Employee Rating</th>
                      <th className="text-center p-2 w-32">Supervisor Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData[group.key].map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="p-2 text-muted-foreground">{idx + 1}</td>
                        <td className="p-2">{item.name}</td>
                        <td className="p-2">
                          <CompetencyRatingSelect
                            value={item.employeeRating}
                            onChange={(v) => updateSkill(group.key, idx, 'employeeRating', v)}
                            disabled={!canEditEmployee}
                          />
                        </td>
                        <td className="p-2">
                          <CompetencyRatingSelect
                            value={item.supervisorRating}
                            onChange={(v) => updateSkill(group.key, idx, 'supervisorRating', v)}
                            disabled={!canEditSupervisor}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/20 font-semibold">
                      <td colSpan={2} className="p-2 text-right">Sub-Total:</td>
                      <td className="p-2 text-center">
                        {formData[group.key].reduce((s, i) => s + (i.employeeRating === 'NA' ? 0 : Number(i.employeeRating)), 0)} /{' '}
                        {(formData[group.key].length - formData[group.key].filter((i) => i.employeeRating === 'NA').length) * 5}
                      </td>
                      <td className="p-2 text-center">
                        {formData[group.key].reduce((s, i) => s + (i.supervisorRating === 'NA' ? 0 : Number(i.supervisorRating)), 0)} /{' '}
                        {(formData[group.key].length - formData[group.key].filter((i) => i.supervisorRating === 'NA').length) * 5}
                      </td>
                    </tr>
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
                  <th className="text-left p-2 min-w-48">Description</th>
                  <th className="text-center p-2 w-24">Resolved</th>
                  <th className="text-left p-2 min-w-48">HR Remarks</th>
                  <th className="text-center p-2 w-32">Category</th>
                  <th className="text-center p-2 w-24">Rating (0-3)</th>
                </tr>
              </thead>
              <tbody>
                {formData.explanations.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="p-2 text-muted-foreground">{idx + 1}</td>
                    <td className="p-2">
                      <Textarea
                        value={item.description}
                        onChange={(e) => updateExplanation(idx, 'description', e.target.value)}
                        disabled={!canEditHR}
                        placeholder="Description..."
                        className="min-h-16 text-sm"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Checkbox
                        checked={item.isResolved}
                        onCheckedChange={(checked) => updateExplanation(idx, 'isResolved', !!checked)}
                        disabled={!canEditHR}
                      />
                    </td>
                    <td className="p-2">
                      <Textarea
                        value={item.hrRemarks}
                        onChange={(e) => updateExplanation(idx, 'hrRemarks', e.target.value)}
                        disabled={!canEditHR}
                        placeholder="HR remarks..."
                        className="min-h-16 text-sm"
                      />
                    </td>
                    <td className="p-2">
                      <Select
                        value={item.category}
                        onValueChange={(v) => updateExplanation(idx, 'category', v)}
                        disabled={!canEditHR}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="attendance">Attendance</SelectItem>
                          <SelectItem value="behavior">Behavior</SelectItem>
                          <SelectItem value="performance">Performance</SelectItem>
                          <SelectItem value="compliance">Compliance</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Select
                        value={String(item.rating)}
                        onValueChange={(v) => updateExplanation(idx, 'rating', Number(v))}
                        disabled={!canEditHR}
                      >
                        <SelectTrigger className="w-20 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0</SelectItem>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/20 font-semibold">
                  <td colSpan={5} className="p-2 text-right">Total Marks Deducted:</td>
                  <td className="p-2 text-center text-red-600">
                    {formData.explanations.reduce((s, e) => s + (e.rating || 0), 0)}
                  </td>
                </tr>
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
                  <th className="text-left p-3" rowSpan={2}>Description</th>
                  <th className="text-center p-3 w-28" colSpan={2}>Employee</th>
                  <th className="text-center p-3 w-28" colSpan={2}>Supervisor</th>
                </tr>
              </thead>
              <tbody>
                {/* Goals & Achievements */}
                <tr className="border-b">
                  <td className="p-3 font-medium">Total NA in Goals & Achievements</td>
                  <td className="p-3 text-center">{employeeScores?.naCountGoals ?? 0}</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center">{supervisorScores?.naCountGoals ?? 0}</td>
                  <td className="p-3"></td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium">Total Marks of Goals & Achievements</td>
                  <td className="p-3 text-center font-semibold">{employeeScores?.marksGoals ?? 0}</td>
                  <td className="p-3 text-muted-foreground">/ {employeeScores?.maxMarksGoals ?? 0}</td>
                  <td className="p-3 text-center font-semibold">{supervisorScores?.marksGoals ?? 0}</td>
                  <td className="p-3 text-muted-foreground">/ {supervisorScores?.maxMarksGoals ?? 0}</td>
                </tr>
                <tr className="border-b bg-muted/10">
                  <td className="p-3 font-medium">Total NA in Technical Skills</td>
                  <td className="p-3 text-center">{employeeScores?.naTech ?? 0}</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center">{supervisorScores?.naTech ?? 0}</td>
                  <td className="p-3"></td>
                </tr>
                <tr className="border-b bg-muted/10">
                  <td className="p-3 font-medium">Total NA in Leadership Skills</td>
                  <td className="p-3 text-center">{employeeScores?.naLead ?? 0}</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center">{supervisorScores?.naLead ?? 0}</td>
                  <td className="p-3"></td>
                </tr>
                <tr className="border-b bg-muted/10">
                  <td className="p-3 font-medium">Total NA in Managerial Skills</td>
                  <td className="p-3 text-center">{employeeScores?.naMgr ?? 0}</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center">{supervisorScores?.naMgr ?? 0}</td>
                  <td className="p-3"></td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium">Total of Skillset and Competencies</td>
                  <td className="p-3 text-center font-semibold">{employeeScores?.totalCompetencies ?? 0}</td>
                  <td className="p-3 text-muted-foreground">/ {employeeScores?.maxMarksCompetencies ?? 0}</td>
                  <td className="p-3 text-center font-semibold">{supervisorScores?.totalCompetencies ?? 0}</td>
                  <td className="p-3 text-muted-foreground">/ {supervisorScores?.maxMarksCompetencies ?? 0}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium">Total NA in Explanations</td>
                  <td className="p-3 text-center">{employeeScores?.naExplanations ?? 0}</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center">{supervisorScores?.naExplanations ?? 0}</td>
                  <td className="p-3"></td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium text-red-600">Marks Deducted Because of Explanations</td>
                  <td className="p-3 text-center text-red-600 font-semibold">-{employeeScores?.marksDeducted ?? 0}</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center text-red-600 font-semibold">-{supervisorScores?.marksDeducted ?? 0}</td>
                  <td className="p-3"></td>
                </tr>
                <tr className="border-b bg-eci-blue/5 font-bold text-lg">
                  <td className="p-3">Grand Total</td>
                  <td className="p-3 text-center">{employeeScores?.grandTotal ?? 0}</td>
                  <td className="p-3 text-muted-foreground text-sm">/ {((employeeScores?.maxMarksGoals ?? 0) + (employeeScores?.maxMarksCompetencies ?? 0) + (employeeScores?.maxMarksExplanations ?? 0))}</td>
                  <td className="p-3 text-center">{supervisorScores?.grandTotal ?? 0}</td>
                  <td className="p-3 text-muted-foreground text-sm">/ {((supervisorScores?.maxMarksGoals ?? 0) + (supervisorScores?.maxMarksCompetencies ?? 0) + (supervisorScores?.maxMarksExplanations ?? 0))}</td>
                </tr>
                <tr className="border-b bg-green-50">
                  <td className="p-3 font-bold">Overall Performance %</td>
                  <td className="p-3 text-center font-bold text-lg">{employeeScores?.overallPercentage ?? 0}%</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center font-bold text-lg">{supervisorScores?.overallPercentage ?? 0}%</td>
                  <td className="p-3"></td>
                </tr>
                <tr className="bg-eci-blue/10">
                  <td className="p-3 font-bold">Rating</td>
                  <td className="p-3 text-center font-semibold" style={{ color: employeeScores?.rating ? (employeeScores.overallPercentage >= 86 ? '#16a34a' : employeeScores.overallPercentage >= 71 ? '#2563eb' : employeeScores.overallPercentage >= 56 ? '#ca8a04' : employeeScores.overallPercentage >= 41 ? '#ea580c' : '#dc2626') : undefined }}>
                    {employeeScores?.rating || '-'}
                  </td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center font-semibold" style={{ color: supervisorScores?.rating ? (supervisorScores.overallPercentage >= 86 ? '#16a34a' : supervisorScores.overallPercentage >= 71 ? '#2563eb' : supervisorScores.overallPercentage >= 56 ? '#ca8a04' : supervisorScores.overallPercentage >= 41 ? '#ea580c' : '#dc2626') : undefined }}>
                    {supervisorScores?.rating || '-'}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Goals for Next Year */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={6} title={`Goals for Next Year`} />
        <CardContent className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground bg-green-50 p-3 rounded-lg border border-green-200">
            {SECTION_DESCRIPTIONS.futureGoals}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2 min-w-48">Goal Description</th>
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
                    <td className="p-2">
                      <Textarea
                        value={item.description}
                        onChange={(e) => updateGoal(idx, 'description', e.target.value)}
                        disabled={!canEditEmployee}
                        placeholder="Describe goal..."
                        className="min-h-12 text-sm"
                      />
                    </td>
                    {[0, 1, 2, 3].map((qi) => (
                      <td key={qi} className="p-2 text-center">
                        <Checkbox
                          checked={item.quarters[qi]}
                          onCheckedChange={(checked) => updateGoal(idx, 'quarters', checked, qi)}
                          disabled={!canEditEmployee}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Filled goals: {formData.futureGoals.filter((g) => g.description.trim() !== '').length} / 4 (minimum 3 required)
          </p>
        </CardContent>
      </Card>

      {/* Section 7: Remarks on Employee's Performance */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={7} title="Remarks on Employee's Performance (Mandatory)" />
        <CardContent className="p-4 space-y-6">
          <p className="text-sm text-muted-foreground bg-purple-50 p-3 rounded-lg border border-purple-200">
            {SECTION_DESCRIPTIONS.remarks}
          </p>

          {/* HR Section */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-eci-blue">HR Section</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'SatisfactionSkills', label: 'Satisfaction About Skills' },
                { key: 'SatisfactionBehavior', label: 'Satisfaction About Behavior' },
                { key: 'SatisfactionPerformance', label: 'Satisfaction About Performance' },
                { key: 'RecommendationMonitoring', label: 'Recommendation for Close Monitoring' },
                { key: 'RecommendationPromotion', label: 'Recommendation for Promotion' },
                { key: 'RecommendationReward', label: 'Recommendation for Reward/Award' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-sm cursor-pointer">
                      <RadioGroup
                        value={formData.remarks[`hr${item.key}` as keyof RemarksData] === true ? 'yes' : formData.remarks[`hr${item.key}` as keyof RemarksData] === false ? 'no' : ''}
                        onValueChange={(v) => updateRemarks('hr', item.key, v === 'yes' ? true : v === 'no' ? false : null)}
                        disabled={!canEditHR}
                        className="flex"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="yes" id={`hr-${item.key}-yes`} />
                          <Label htmlFor={`hr-${item.key}-yes`} className="text-sm">Yes</Label>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <RadioGroupItem value="no" id={`hr-${item.key}-no`} />
                          <Label htmlFor={`hr-${item.key}-no`} className="text-sm">No</Label>
                        </div>
                      </RadioGroup>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Label className="text-sm font-medium">HR General Remarks</Label>
              <Textarea
                value={formData.remarks.hrGeneralRemarks}
                onChange={(e) => updateRemarks('hr', 'GeneralRemarks', e.target.value)}
                disabled={!canEditHR}
                placeholder="Enter HR general remarks..."
                className="mt-2 min-h-20"
              />
            </div>
          </div>

          <Separator />

          {/* Supervisor Section */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-eci-blue">Supervisor Section</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'Satisfaction', label: 'Satisfaction' },
                { key: 'ConsiderationPromotion', label: 'Consideration for Promotion' },
                { key: 'ConsiderationIncrement', label: 'Consideration for Increment' },
                { key: 'ConsiderationReward', label: 'Consideration for Reward/Award' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <span className="text-sm">{item.label}</span>
                  <RadioGroup
                    value={formData.remarks[`supervisor${item.key}` as keyof RemarksData] === true ? 'yes' : formData.remarks[`supervisor${item.key}` as keyof RemarksData] === false ? 'no' : ''}
                    onValueChange={(v) => updateRemarks('supervisor', item.key, v === 'yes' ? true : v === 'no' ? false : null)}
                    disabled={!canEditSupervisor}
                    className="flex"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="yes" id={`sup-${item.key}-yes`} />
                      <Label htmlFor={`sup-${item.key}-yes`} className="text-sm">Yes</Label>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <RadioGroupItem value="no" id={`sup-${item.key}-no`} />
                      <Label htmlFor={`sup-${item.key}-no`} className="text-sm">No</Label>
                    </div>
                  </RadioGroup>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Label className="text-sm font-medium">Supervisor General Remarks</Label>
              <Textarea
                value={formData.remarks.supervisorGeneralRemarks}
                onChange={(e) => updateRemarks('supervisor', 'GeneralRemarks', e.target.value)}
                disabled={!canEditSupervisor}
                placeholder="Enter supervisor general remarks..."
                className="mt-2 min-h-20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 8: Certification */}
      <Card className="eci-card overflow-hidden">
        <SectionHeader number={8} title="Certification" />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Employee's Signature</Label>
              <Input
                value={formData.employeeSignature}
                onChange={(e) => setFormData((prev) => prev ? { ...prev, employeeSignature: e.target.value } : prev)}
                disabled={!canEditEmployee}
                placeholder="Full name as signature"
              />
              <Input
                type="date"
                value={formData.employeeSignatureDate}
                onChange={(e) => setFormData((prev) => prev ? { ...prev, employeeSignatureDate: e.target.value } : prev)}
                disabled={!canEditEmployee}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Supervisor's Signature</Label>
              <Input
                value={formData.supervisorSignature}
                onChange={(e) => setFormData((prev) => prev ? { ...prev, supervisorSignature: e.target.value } : prev)}
                disabled={!canEditSupervisor}
                placeholder="Full name as signature"
              />
              <Input
                type="date"
                value={formData.supervisorSignatureDate}
                onChange={(e) => setFormData((prev) => prev ? { ...prev, supervisorSignatureDate: e.target.value } : prev)}
                disabled={!canEditSupervisor}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">CEO's Signature</Label>
              <Input
                value={formData.ceoSignature}
                onChange={(e) => setFormData((prev) => prev ? { ...prev, ceoSignature: e.target.value } : prev)}
                disabled={userRole !== 'management'}
                placeholder="Full name as signature"
              />
              <Input
                type="date"
                value={formData.ceoSignatureDate}
                onChange={(e) => setFormData((prev) => prev ? { ...prev, ceoSignatureDate: e.target.value } : prev)}
                disabled={userRole !== 'management'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between no-print">
        <Button variant="outline" onClick={() => setCurrentView('appraisal-list')}>
          Back to List
        </Button>
        <div className="flex items-center gap-2">
          {canSubmit && (
            <Button className="eci-btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit
            </Button>
          )}
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Draft
          </Button>
        </div>
      </div>

      {/* Return Dialog */}
      <Dialog open={returnDialog} onOpenChange={setReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return for Correction</DialogTitle>
            <DialogDescription>
              Please provide a reason for returning this appraisal for correction.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Enter reason for return..."
            className="min-h-24"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialog(false)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleReturn} disabled={returning}>
              {returning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}