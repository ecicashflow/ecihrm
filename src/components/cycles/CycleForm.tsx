'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  employeeId: string;
  designation: string;
  department: string;
  lineManagerId: string | null;
  lineManager?: { id: string; name: string } | null;
}

interface Supervisor {
  id: string;
  name: string;
  designation: string;
}

export default function CycleForm() {
  const { setCurrentView, currentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);

  const [name, setName] = useState('');
  const [cycleType, setCycleType] = useState<string>('annual');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  // Store department NAMES (not IDs) so they match employee.department
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [supervisorMap, setSupervisorMap] = useState<Record<string, string>>({});
  const [employeeSearch, setEmployeeSearch] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [deptRes, empRes, sup1Res, sup2Res, adminRes] = await Promise.all([
          fetch('/api/departments'),
          fetch('/api/users?includeInactive=false'),
          fetch('/api/users?role=supervisor'),
          fetch('/api/users?role=management'),
          fetch('/api/users?role=admin'),
        ]);
        if (deptRes.ok) {
          const data = await deptRes.json();
          setDepartments(data.departments || data || []);
        }
        // Users API returns an array directly
        if (empRes.ok) {
          const data = await empRes.json();
          const list = Array.isArray(data) ? data : (data.users || []);
          // Only show active employees (exclude admin/management who are just managers)
          setEmployees(
            list
              .filter((u: Employee & { isActive: boolean }) => u.isActive)
              .map((u: Employee) => ({
                id: u.id, name: u.name, employeeId: u.employeeId,
                designation: u.designation, department: u.department,
                lineManagerId: u.lineManagerId,
                lineManager: u.lineManager,
              }))
          );
        }
        // Merge supervisors + management + admin as potential supervisors
        const allSups: Supervisor[] = [];
        for (const res of [sup1Res, sup2Res, adminRes]) {
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.users || []);
            allSups.push(...list.map((u: Supervisor & { isActive: boolean }) => ({
              id: u.id, name: u.name, designation: u.designation,
            })));
          }
        }
        // Deduplicate
        const seen = new Set<string>();
        setSupervisors(allSups.filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        }));
      } catch {
        // Server unavailable - use empty data gracefully
        console.warn('Server unavailable, using empty data for cycle form');
        setDepartments([]);
        setEmployees([]);
        setSupervisors([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const toggleDept = (deptName: string) => {
    setSelectedDepts((prev) =>
      prev.includes(deptName) ? prev.filter((d) => d !== deptName) : [...prev, deptName]
    );
  };

  const filteredEmployees = employees.filter((e) => {
    const matchDept = selectedDepts.length === 0 || selectedDepts.includes(e.department);
    const matchSearch =
      !employeeSearch ||
      e.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(employeeSearch.toLowerCase());
    return matchDept && matchSearch;
  });

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees((prev) => {
      const next = prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : [...prev, empId];
      // Pre-fill supervisor from employee data
      if (!prev.includes(empId)) {
        const emp = employees.find((e) => e.id === empId);
        if (emp?.lineManagerId && !supervisorMap[empId]) {
          setSupervisorMap((prev) => ({ ...prev, [empId]: emp.lineManagerId! }));
        }
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    const visibleIds = filteredEmployees.map((e) => e.id);
    const allSelected = visibleIds.every((id) => selectedEmployees.includes(id));
    if (allSelected) {
      setSelectedEmployees((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedEmployees((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const validate = () => {
    if (!name.trim()) return 'Cycle name is required';
    if (!year) return 'Year is required';
    if (!periodFrom || !periodTo) return 'Period dates are required';
    if (!startDate || !endDate) return 'Start and end dates are required';
    if (!submissionDeadline) return 'Submission deadline is required';
    if (selectedEmployees.length === 0) return 'At least one employee must be selected';
    for (const empId of selectedEmployees) {
      if (!supervisorMap[empId]) {
        const emp = employees.find((e) => e.id === empId);
        return `Supervisor required for ${emp?.name || 'an employee'}`;
      }
    }
    return null;
  };

  const handleSave = async (activate = false) => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    if (!currentUser?.id) {
      toast.error('You must be logged in to create a cycle');
      return;
    }

    if (activate) setActivating(true);
    else setSaving(true);

    try {
      // Format period dates as readable strings (e.g., "January 2025")
      const formatDateStr = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      };

      const res = await fetch('/api/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          cycleType,
          year,
          periodFrom: formatDateStr(periodFrom),
          periodTo: formatDateStr(periodTo),
          startDate,
          endDate,
          submissionDeadline,
          applicableDepts: selectedDepts, // Send department NAMES
          createdById: currentUser.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // POST /api/cycles returns the cycle object directly (spread, not wrapped)
        const cycleId = data.id;
        if (!cycleId) {
          toast.error('Cycle created but failed to get cycle ID');
          setCurrentView('cycles');
          return;
        }
        if (activate) {
          const actRes = await fetch(`/api/cycles/${cycleId}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeIds: selectedEmployees,
              supervisorMap,
            }),
          });
          if (actRes.ok) {
            const actData = await actRes.json();
            toast.success(`Cycle created and activated! ${actData.assignmentsCreated || 0} appraisal assignments created.`);
            setCurrentView('cycles');
            return;
          } else {
            const actData = await actRes.json().catch(() => ({}));
            toast.error(`Cycle created but activation failed: ${actData.error || 'Unknown error'}`);
            setCurrentView('cycles');
            return;
          }
        } else {
          toast.success('Cycle saved as draft');
          setCurrentView('cycles');
          return;
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create cycle');
      }
    } catch {
      toast.error('Failed to create cycle');
    } finally {
      setSaving(false);
      setActivating(false);
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
        <Button variant="ghost" size="sm" onClick={() => setCurrentView('cycles')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">Create New Cycle</h2>
      </div>

      {/* Basic Info */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg">Cycle Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Cycle Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Annual Performance Review 2024" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Cycle Type *</Label>
              <Select value={cycleType} onValueChange={setCycleType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mid_year">Mid-Year Appraisal</SelectItem>
                  <SelectItem value="annual">Annual Appraisal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year *</Label>
              <Input id="year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Submission Deadline *</Label>
              <Input id="deadline" type="date" value={submissionDeadline} onChange={(e) => setSubmissionDeadline(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodFrom">Period From *</Label>
              <Input id="periodFrom" type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodTo">Period To *</Label>
              <Input id="periodTo" type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department Selection */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg">Departments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {departments.map((dept) => (
              <label
                key={dept.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedDepts.includes(dept.name)
                    ? 'border-eci-blue bg-eci-blue/5 text-eci-blue'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={selectedDepts.includes(dept.name)}
                  onCheckedChange={() => toggleDept(dept.name)}
                />
                <span className="text-sm font-medium">{dept.name}</span>
              </label>
            ))}
            {departments.length === 0 && (
              <p className="text-sm text-muted-foreground">No departments found. Create departments first.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employee Selection */}
      <Card className="eci-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Employees ({selectedEmployees.length} selected)</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search employees..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-60"
              />
              <Button variant="outline" size="sm" onClick={selectAllVisible}>
                {filteredEmployees.every((e) => selectedEmployees.includes(e.id)) ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto eci-scroll space-y-1">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selectedEmployees.includes(emp.id)
                    ? 'border-eci-blue bg-eci-blue/5'
                    : 'border-border'
                }`}
              >
                <Checkbox
                  checked={selectedEmployees.includes(emp.id)}
                  onCheckedChange={() => toggleEmployee(emp.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{emp.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {emp.employeeId} · {emp.designation} · {emp.department}
                  </p>
                </div>
                {selectedEmployees.includes(emp.id) && (
                  <Select
                    value={supervisorMap[emp.id] || ''}
                    onValueChange={(val) => setSupervisorMap((prev) => ({ ...prev, [emp.id]: val }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Assign Supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisors.map((sup) => (
                        <SelectItem key={sup.id} value={sup.id}>
                          {sup.name} - {sup.designation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
            {filteredEmployees.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No employees found</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setCurrentView('cycles')}>
          Cancel
        </Button>
        <Button variant="outline" onClick={() => handleSave(false)} disabled={saving || activating}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save as Draft
        </Button>
        <Button className="eci-btn-primary" onClick={() => handleSave(true)} disabled={saving || activating}>
          {activating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Create and Activate
        </Button>
      </div>
    </div>
  );
}