'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { EmployeeDetail } from '@/lib/types';

export default function EmployeeForm() {
  const { viewParams, setCurrentView } = useAppStore();
  const editId = viewParams?.id;
  const isEdit = !!editId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: string; title: string; requiredExp: string; requiredEdu: string; department: string }[]>([]);
  const [supervisors, setSupervisors] = useState<{ id: string; name: string; designation: string }[]>([]);

  const [form, setForm] = useState({
    employeeId: '',
    name: '',
    email: '',
    designation: '',
    department: '',
    phone: '',
    overallExp: '',
    yearsWithECI: '',
    currentEdu: '',
    role: 'employee' as const,
    lineManagerId: '',
    isActive: true,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [deptRes, desigRes, supRes] = await Promise.all([
          fetch('/api/departments'),
          fetch('/api/designations'),
          fetch('/api/users?role=supervisor'),
        ]);
        if (deptRes.ok) setDepartments((await deptRes.json()).departments || []);
        if (desigRes.ok) setDesignations((await desigRes.json()).designations || []);
        if (supRes.ok) setSupervisors((await supRes.json()).users || []);

        if (isEdit) {
          const empRes = await fetch(`/api/users/${editId}`);
          if (empRes.ok) {
            const emp: EmployeeDetail = await empRes.json();
            setForm({
              employeeId: emp.employeeId,
              name: emp.name,
              email: emp.email,
              designation: emp.designation,
              department: emp.department,
              phone: emp.phone,
              overallExp: emp.overallExp,
              yearsWithECI: emp.yearsWithECI,
              currentEdu: emp.currentEdu,
              role: emp.role,
              lineManagerId: emp.lineManagerId || '',
              isActive: emp.isActive,
            });
          }
        }
      } catch {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [editId, isEdit]);

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
    if (!form.name.trim()) return 'Name is required';
    if (!form.email.trim()) return 'Email is required';
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast.success(isEdit ? 'Employee updated successfully' : 'Employee created successfully');
        setCurrentView('employees');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save employee');
      }
    } catch {
      toast.error('Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
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
        <h2 className="text-2xl font-bold">{isEdit ? 'Edit Employee' : 'Create New Employee'}</h2>
      </div>

      {/* Form */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg">Employee Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee ID *</Label>
              <Input
                id="employeeId"
                value={form.employeeId}
                onChange={(e) => updateForm('employeeId', e.target.value)}
                placeholder="e.g., ECI-001"
                disabled={isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                placeholder="email@eci.com.pk"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation *</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
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
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
                placeholder="+92-XXX-XXXXXXX"
              />
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
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={form.role} onValueChange={(v) => updateForm('role', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lineManager">Line Manager</Label>
              <Select value={form.lineManagerId} onValueChange={(v) => updateForm('lineManagerId', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select line manager" />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} - {s.designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setCurrentView('employees')}>
          Cancel
        </Button>
        <Button className="eci-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {isEdit ? 'Update Employee' : 'Create Employee'}
        </Button>
      </div>
    </div>
  );
}