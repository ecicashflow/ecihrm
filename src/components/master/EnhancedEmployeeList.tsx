'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EmployeeDetail } from '@/lib/types';

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 hover:bg-red-100',
  hr: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  supervisor: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  management: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  employee: 'bg-green-100 text-green-800 hover:bg-green-100',
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  hr: 'HR',
  supervisor: 'Supervisor',
  management: 'Management',
  employee: 'Employee',
};

interface FilterOption {
  id: string;
  name: string;
}

export default function EnhancedEmployeeList() {
  const { setCurrentView, navigate, currentUser } = useAppStore();
  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [departments, setDepartments] = useState<FilterOption[]>([]);
  const [designations, setDesignations] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [desigFilter, setDesigFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  const [isOffline, setIsOffline] = useState(false);

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set('includeInactive', 'true');
      const url = `/api/users${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // API may return array directly or wrapped
        setEmployees(Array.isArray(data) ? data : (data.users || []));
      }
    } catch {
      // Server unavailable - show empty state gracefully
      console.warn('Server unavailable, showing empty employee list');
      setEmployees([]);
      setIsOffline(true);
    }
  }, [showInactive]);

  const fetchFilters = useCallback(async () => {
    try {
      const [deptRes, desigRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/designations'),
      ]);
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments((data.departments || data || []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
      }
      if (desigRes.ok) {
        const data = await desigRes.json();
        setDesignations((data.designations || data || []).map((d: { id: string; title: string }) => ({ id: d.id, name: d.title })));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEmployees(), fetchFilters()]).finally(() => setLoading(false));
  }, [fetchEmployees, fetchFilters]);

  const filtered = employees.filter((e) => {
    const matchSearch =
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'all' || e.department === deptFilter;
    const matchDesig = desigFilter === 'all' || e.designation === desigFilter;
    const matchRole = roleFilter === 'all' || e.role === roleFilter;
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && e.isActive) ||
      (statusFilter === 'inactive' && !e.isActive);
    return matchSearch && matchDept && matchDesig && matchRole && matchStatus;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Employee deactivated successfully');
        fetchEmployees();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to deactivate employee');
      }
    } catch {
      toast.error('Failed to deactivate employee');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (emp: EmployeeDetail) => {
    setTogglingId(emp.id);
    try {
      const res = await fetch(`/api/users/${emp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !emp.isActive }),
      });
      if (res.ok) {
        toast.success(`Employee ${emp.isActive ? 'deactivated' : 'activated'} successfully`);
        fetchEmployees();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update employee');
      }
    } catch {
      toast.error('Failed to update employee');
    } finally {
      setTogglingId(null);
    }
  };

  const handleRowClick = (emp: EmployeeDetail) => {
    navigate('employee-create', { id: emp.id });
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'hr';

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-10" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
          Server unavailable — showing cached data. Some features may not work.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Employees &amp; Users</h2>
        {isAdmin && (
          <Button
            className="eci-btn-primary"
            onClick={() => {
              navigate('employee-create', {});
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Employee
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.name}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={desigFilter} onValueChange={setDesigFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Designation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Designations</SelectItem>
            {designations.map((d) => (
              <SelectItem key={d.id} value={d.name}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
            <SelectItem value="hr">HR</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="management">Management</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive-emps"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <Label htmlFor="show-inactive-emps" className="text-sm cursor-pointer whitespace-nowrap">
            {showInactive ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}
            Inactive
          </Label>
        </div>
      </div>

      {/* Table */}
      <Card className="eci-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emp ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Designation</TableHead>
                  <TableHead className="hidden lg:table-cell">Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Is Supervisor</TableHead>
                  <TableHead className="hidden xl:table-cell">Line Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell text-center">Appraisals</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 12 : 10}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {search || deptFilter !== 'all' || desigFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all'
                        ? 'No employees match your filters'
                        : 'No employees found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((emp) => (
                    <TableRow key={emp.id} className={!emp.isActive ? 'opacity-60' : ''}>
                      <TableCell className="font-mono text-sm">{emp.employeeId}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleRowClick(emp)}
                          className="font-medium text-blue-700 hover:underline text-left"
                        >
                          {emp.name}
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {emp.email}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {emp.designation}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {emp.department}
                      </TableCell>
                      <TableCell>
                        <Badge className={ROLE_BADGE[emp.role] || ROLE_BADGE.employee}>
                          {ROLE_LABEL[emp.role] || emp.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {emp.isSupervisor ? (
                          <span className="inline-flex items-center gap-1 text-sm text-green-700">
                            <ShieldCheck className="h-4 w-4" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {emp.lineManager?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            emp.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                          }
                        >
                          {emp.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-center">
                        {emp._count?.appraisals ?? 0}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRowClick(emp)}
                              title="View / Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <div
                              role="switch"
                              aria-checked={emp.isActive}
                              tabIndex={0}
                              className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                              onClick={() => handleToggleActive(emp)}
                              onKeyDown={(e) => e.key === 'Enter' && handleToggleActive(emp)}
                              title={emp.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {togglingId === emp.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <div className={`w-4 h-4 rounded-full border-2 transition-colors ${emp.isActive ? 'bg-green-500 border-green-500' : 'border-muted-foreground'}`} />
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setDeleteTarget(emp)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Employee</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {deleteTarget && (deleteTarget._count?.appraisals ?? 0) > 0 ? (
                  <>
                    <p className="font-medium text-orange-700 mb-2">
                      This employee has {deleteTarget._count?.appraisals} appraisal record{(deleteTarget._count?.appraisals ?? 0) > 1 ? 's' : ''}.
                    </p>
                    <p>
                      The account will be <strong>deactivated to preserve historical data</strong>.
                      The employee will no longer appear in active lists or receive new appraisal assignments.
                    </p>
                  </>
                ) : (
                  <p>
                    This employee has no appraisal records. The account will be <strong>deactivated</strong>.
                    This action can be reversed by reactivating the account later.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}