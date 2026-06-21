'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
} from 'lucide-react';
import { toast } from 'sonner';
import type { DepartmentDetail } from '@/lib/types';

export default function EnhancedDepartmentList() {
  const [departments, setDepartments] = useState<DepartmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentDetail | null>(null);
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<DepartmentDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      const url = showInactive
        ? '/api/departments?includeInactive=true'
        : '/api/departments';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list: DepartmentDetail[] = (data.departments || data || []).map((d: Record<string, unknown>) => ({
          id: d.id as string,
          name: d.name as string,
          isActive: d.isActive as boolean,
          employeeCount: (d.employeeCount as number) || 0,
          designationCount: (d.designationCount as number) || 0,
          appraisalCount: 0,
          createdAt: d.createdAt as string,
          updatedAt: d.updatedAt as string,
        }));
        setDepartments(list);
      }
    } catch {
      // Server unavailable - show empty state gracefully
      console.warn('Server unavailable, showing empty department list');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    setLoading(true);
    fetchDepartments();
  }, [fetchDepartments]);

  const filtered = departments.filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingDept(null);
    setFormName('');
    setDialogOpen(true);
  };

  const openEdit = (dept: DepartmentDetail) => {
    setEditingDept(dept);
    setFormName(dept.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Department name is required');
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editingDept;
      const url = isEdit ? `/api/departments/${editingDept.id}` : '/api/departments';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { name: formName.trim() } : { name: formName.trim() };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(isEdit ? 'Department updated successfully' : 'Department created successfully');
        setDialogOpen(false);
        fetchDepartments();
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${isEdit ? 'update' : 'create'} department`);
      }
    } catch {
      toast.error(`Failed to ${editingDept ? 'update' : 'create'} department`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/departments/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.deactivated) {
          toast.success(data.message || 'Department deactivated successfully');
        } else {
          toast.success(data.message || 'Department deleted permanently');
        }
        fetchDepartments();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete department');
      }
    } catch {
      toast.error('Failed to delete department');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (dept: DepartmentDetail) => {
    setTogglingId(dept.id);
    try {
      const res = await fetch(`/api/departments/${dept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dept.name, isActive: !dept.isActive }),
      });
      if (res.ok) {
        toast.success(`Department ${dept.isActive ? 'deactivated' : 'activated'} successfully`);
        fetchDepartments();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update department');
      }
    } catch {
      toast.error('Failed to update department');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Departments</h2>
        <Button className="eci-btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Department
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive-depts"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <Label htmlFor="show-inactive-depts" className="text-sm cursor-pointer">
            {showInactive ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}
            Show Inactive
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
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">Employees</TableHead>
                  <TableHead className="text-center">Designations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {search ? 'No departments match your search' : 'No departments found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((dept) => (
                    <TableRow key={dept.id} className={!dept.isActive ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell className="text-center">{dept.employeeCount ?? 0}</TableCell>
                      <TableCell className="text-center">{dept.designationCount ?? 0}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            dept.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                          }
                        >
                          {dept.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {dept.createdAt ? new Date(dept.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(dept)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(dept)}
                            disabled={togglingId === dept.id}
                            title={dept.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {togglingId === dept.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Switch className="scale-75" checked={dept.isActive} />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteTarget(dept)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Edit Department' : 'Create Department'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="dept-name">Department Name *</Label>
            <Input
              id="dept-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Enter department name"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="eci-btn-primary" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingDept ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget && deleteTarget.employeeCount > 0
                ? 'Deactivate Department'
                : 'Delete Department'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {deleteTarget && deleteTarget.employeeCount > 0 ? (
                  <>
                    <p className="font-medium text-orange-700 mb-2">
                      This department has {deleteTarget.employeeCount} active employee{deleteTarget.employeeCount > 1 ? 's' : ''}.
                    </p>
                    <p>
                      It will be <strong>deactivated instead of deleted</strong> to preserve data integrity.
                      Inactive departments can be reactivated later.
                    </p>
                  </>
                ) : (
                  <p>
                    This department has no linked records and will be <strong>permanently deleted</strong>.
                    This action cannot be undone.
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
              className={
                deleteTarget && deleteTarget.employeeCount > 0
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deleteTarget && deleteTarget.employeeCount > 0 ? 'Deactivate' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}