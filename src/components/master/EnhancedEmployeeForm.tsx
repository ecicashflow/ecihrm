'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Loader2, Info, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { EmployeeDetail } from '@/lib/types';

const ROLE_OPTIONS = [
  { value: 'employee', label: 'Employee', desc: 'Standard employee with self-appraisal access' },
  { value: 'supervisor', label: 'Supervisor', desc: 'Can evaluate team members and manage appraisals' },
  { value: 'hr', label: 'HR', desc: 'HR team with review and reporting access' },
  { value: 'admin', label: 'Admin', desc: 'Full system access including master data management' },
  { value: 'management', label: 'Management', desc: 'CEO/Directors with final approval authority' },
];

export default function EnhancedEmployeeForm() {
  const { viewParams, setCurrentView } = useAppStore();
  const editId = viewParams?.id;
  const isEdit = !!editId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{
    id: string;
    title: string;
    requiredExp: string;
    requiredEdu: string;
    department: string;
  }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string; designation: string }[]>([]);
  const [supervisedCount, setSupervisedCount] = useState(0);

  const [form, setForm] = useState({
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    role: 'employee' as string,
    isSupervisor: false,
    overallExp: '',
    yearsWithECI: '',
    currentEdu: '',
    lineManagerId: '',
    isActive: true,
    password: '',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [deptRes, desigRes, mgrRes] = await Promise.all([
          fetch('/api/departments'),
          fetch('/api/designations'),
          // Fetch supervisors, management, and admin users as potential managers
          fetch('/api/users?role=supervisor&role=management&role=admin'),
        ]);
        if (deptRes.ok) {
          const data = await deptRes.json();
          setDepartments((data.departments || data || []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
        }
        if (desigRes.ok) {
          const data = await desigRes.json();
          setDesignations((data.designations || data || []).map((d: { id: string; title: string; requiredExp: string; requiredEdu: string; department: string }) => ({
            id: d.id,
            title: d.title,
            requiredExp: d.requiredExp || '',
            requiredEdu: d.requiredEdu || '',
            department: d.department || '',
          })));
        }
        if (mgrRes.ok) {
          const data = await mgrRes.json();
          const list = Array.isArray(data) ? data : (data.users || []);
          setManagers(
            list
              .filter((u: { id: string; isActive: boolean }) => u.isActive && u.id !== editId)
              .map((u: { id: string; name: string; designation: string }) => ({
                id: u.id,
                name: u.name,
                designation: u.designation,
              }))
          );
        }

        if (isEdit && editId) {
          const empRes = await fetch(`/api/users/${editId}`);
          if (empRes.ok) {
            const emp: EmployeeDetail & { supervisedEmployees?: { isActive: boolean }[] } = await empRes.json();
            const activeSupervised = (emp.supervisedEmployees || []).filter(
              (s) => s.isActive
            ).length;
            setSupervisedCount(activeSupervised);
            setForm({
              employeeId: emp.employeeId,
              name: emp.name,
              email: emp.email,
              phone: emp.phone || '',
              designation: emp.designation,
              department: emp.department,
              role: emp.role,
              isSupervisor: emp.isSupervisor ?? false,
              overallExp: emp.overallExp || '',
              yearsWithECI: emp.yearsWithECI || '',
              currentEdu: emp.currentEdu || '',
              lineManagerId: emp.lineManagerId || '',
              isActive: emp.isActive,
            });
          } else {
            toast.error('Failed to load employee data');
            setCurrentView('employees');
          }
        }
      } catch {
        toast.error('Failed to load form data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [editId, isEdit, setCurrentView]);

  const updateForm = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleDesignationChange = (title: string) => {
    const desig = designations.find((d) => d.title === title);
    setForm((prev) => ({
      ...prev,
      designation: title,
      department: desig?.department || prev.department,
    }));
  };

  const validate = () => {
    if (!form.employeeId.trim()) return 'Employee ID is required';
    if (!form.name.trim()) return 'Full Name is required';
    if (!form.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Invalid email format';
    if (!form.designation) return 'Designation is required';
    if (!form.department) return 'Department is required';
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const url = isEdit ? `/api/users/${editId}` : '/api/users';
      const method = isEdit ? 'PUT' : 'POST';

      const body: Record<string, unknown> = { ...form };
      if (!isEdit) {
        delete body.isActive;
      }
      // Don't send password if blank (on edit, leave unchanged; on create, server defaults to password123)
      if (!body.password) {
        delete body.password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(isEdit ? 'Employee updated successfully' : 'Employee created successfully');
        setCurrentView('employees');
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${isEdit ? 'update' : 'create'} employee`);
      }
    } catch {
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} employee`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setCurrentView('employees')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">
          {isEdit ? 'Edit Employee' : 'Create New Employee'}
        </h2>
      </div>

      {/* Supervisor Info Box */}
      {isEdit && (form.role === 'supervisor' || form.role === 'management') && supervisedCount > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            This employee supervises <strong>{supervisedCount} active employee{supervisedCount > 1 ? 's' : ''}</strong>.
            Changing their role or status may affect their team&apos;s appraisal assignments.
          </AlertDescription>
        </Alert>
      )}

      {/* Personal Information */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-blue-500" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">
                Employee ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="employeeId"
                value={form.employeeId}
                onChange={(e) => updateForm('employeeId', e.target.value)}
                placeholder="e.g., ECI-001"
                disabled={isEdit}
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">Employee ID cannot be changed</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                placeholder="email@eci.com.pk"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
                placeholder="+92-XXX-XXXXXXX"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employment Details */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-emerald-500" />
            Employment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="designation">
                Designation <span className="text-red-500">*</span>
              </Label>
              <Select value={form.designation} onValueChange={handleDesignationChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {designations.map((d) => (
                    <SelectItem key={d.id} value={d.title}>
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecting a designation auto-fills the department
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">
                Department <span className="text-red-500">*</span>
              </Label>
              <Select value={form.department} onValueChange={(v) => updateForm('department', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-red-500">*</span>
              </Label>
              <Select value={form.role} onValueChange={(v) => updateForm('role', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-xs text-muted-foreground">{r.desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="isSupervisor">Can Supervise Others (Line Manager)</Label>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="isSupervisor"
                  checked={form.isSupervisor}
                  onCheckedChange={(v) => updateForm('isSupervisor', v)}
                />
                <span className="text-sm text-muted-foreground">
                  {form.isSupervisor ? 'Yes — can evaluate team members' : 'No — employee only'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="overallExp">Overall Experience</Label>
              <Input
                id="overallExp"
                value={form.overallExp}
                onChange={(e) => updateForm('overallExp', e.target.value)}
                placeholder="e.g., 5 Years"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearsWithECI">Years with ECI</Label>
              <Input
                id="yearsWithECI"
                value={form.yearsWithECI}
                onChange={(e) => updateForm('yearsWithECI', e.target.value)}
                placeholder="e.g., 3 Years"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentEdu">Current Education</Label>
              <Input
                id="currentEdu"
                value={form.currentEdu}
                onChange={(e) => updateForm('currentEdu', e.target.value)}
                placeholder="e.g., MBA"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reporting Structure */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-purple-500" />
            Reporting Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label htmlFor="lineManager">Line Manager</Label>
            <Select value={form.lineManagerId} onValueChange={(v) => updateForm('lineManagerId', v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select line manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} — {m.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Available managers include users with Supervisor, Management, and Admin roles
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Account Status (Edit only) */}
      {isEdit && (
        <Card className="eci-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-amber-500" />
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between max-w-md">
              <div>
                <Label htmlFor="isActive" className="text-sm font-medium">
                  Active Status
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deactivating will disable login and hide from active lists
                </p>
              </div>
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(v) => updateForm('isActive', v)}
              />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Login Access:{' '}
                <Badge
                  className={
                    form.isActive
                      ? 'bg-green-100 text-green-800 hover:bg-green-100'
                      : 'bg-red-100 text-red-800 hover:bg-red-100'
                  }
                >
                  {form.isActive ? 'Enabled' : 'Disabled'}
                </Badge>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security — password set / reset */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-red-500" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label htmlFor="password">
              {isEdit ? 'Reset Password (optional)' : 'Initial Password'}
            </Label>
            <Input
              id="password"
              type="text"
              value={form.password}
              onChange={(e) => updateForm('password', e.target.value)}
              placeholder={isEdit ? 'Leave blank to keep current password' : 'Defaults to "password123" if left blank'}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? 'Enter a new password here to reset it. Leave blank to keep the existing password.'
                : 'The employee will use this password to log in for the first time. They can change it later.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pb-6">
        <Button variant="outline" onClick={() => setCurrentView('employees')}>
          Cancel
        </Button>
        <Button className="eci-btn-primary" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          {isEdit ? 'Update Employee' : 'Create Employee'}
        </Button>
      </div>
    </div>
  );
}