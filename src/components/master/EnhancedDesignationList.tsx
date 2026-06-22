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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { DesignationDetail } from '@/lib/types';

interface Department {
  id: string;
  name: string;
}

export default function EnhancedDesignationList() {
  const [designations, setDesignations] = useState<DesignationDetail[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDesig, setEditingDesig] = useState<DesignationDetail | null>(null);
  const [form, setForm] = useState({
    title: '',
    requiredExp: '',
    requiredEdu: '',
    department: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<DesignationDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchDesignations = useCallback(async () => {
    try {
      const url = showInactive
        ? '/api/designations?includeInactive=true'
        : '/api/designations';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list: DesignationDetail[] = (data.designations || data || []).map((d: Record<string, unknown>) => ({
          id: d.id as string,
          title: d.title as string,
          requiredExp: (d.requiredExp as string) || '',
          requiredEdu: (d.requiredEdu as string) || '',
          department: (d.department as string) || '',
          isActive: d.isActive as boolean,
          employeeCount: (d.employeeCount as number) || 0,
          createdAt: d.createdAt as string,
          updatedAt: d.updatedAt as string,
        }));
        setDesignations(list);
      }
    } catch {
      // Server unavailable - show empty state gracefully
      console.warn('Server unavailable, showing empty designation list');
      setDesignations([]);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || data || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDepartments();
    fetchDesignations();
  }, [fetchDesignations, fetchDepartments]);

  const filtered = designations.filter((d) => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'all' || d.department === deptFilter;
    return matchSearch && matchDept;
  });

  const resetForm = () => {
    setForm({ title: '', requiredExp: '', requiredEdu: '', department: '' });
    setEditingDesig(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (desig: DesignationDetail) => {
    setEditingDesig(desig);
    setForm({
      title: desig.title,
      requiredExp: (desig as unknown as Record<string, unknown>).requiredExp as string || '',
      requiredEdu: (desig as unknown as Record<string, unknown>).requiredEdu as string || '',
      department: desig.department,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Designation title is required');
      return;
    }
    if (!form.department) {
      toast.error('Department is required');
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editingDesig;
      const url = isEdit ? `/api/designations/${editingDesig.id}` : '/api/designations';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast.success(isEdit ? 'Designation updated successfully' : 'Designation created successfully');
        setDialogOpen(false);
        fetchDesignations();
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${isEdit ? 'update' : 'create'} designation`);
      }
    } catch {
      toast.error(`Failed to ${editingDesig ? 'update' : 'create'} designation`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/designations/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.deactivated) {
          toast.success(data.message || 'Designation deactivated successfully');
        } else {
          toast.success(data.message || 'Designation deleted permanently');
        }
        fetchDesignations();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete designation');
      }
    } catch {
      toast.error('Failed to delete designation');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (desig: DesignationDetail) => {
    setTogglingId(desig.id);
    try {
      // Use the PUT endpoint to toggle isActive
      const res = await fetch(`/api/designations/${desig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: desig.title,
          requiredExp: (desig as unknown as Record<string, unknown>).requiredExp as string || '',
          requiredEdu: (desig as unknown as Record<string, unknown>).requiredEdu as string || '',
          department: desig.department,
          isActive: !desig.isActive,
        }),
      });
      if (res.ok) {
        toast.success(`Designation ${desig.isActive ? 'deactivated' : 'activated'} successfully`);
        fetchDesignations();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update designation');
      }
    } catch {
      toast.error('Failed to update designation');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-10" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Designations</h2>
        <Button className="eci-btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Designation
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search designations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-48">
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
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive-desigs"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <Label htmlFor="show-inactive-desigs" className="text-sm cursor-pointer">
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
                  <TableHead>Title</TableHead>
                  <TableHead>Required Exp</TableHead>
                  <TableHead>Required Edu</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search || deptFilter !== 'all'
                        ? 'No designations match your filters'
                        : 'No designations found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((desig) => (
                    <TableRow key={desig.id} className={!desig.isActive ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{desig.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(desig as unknown as Record<string, unknown>).requiredExp as string || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(desig as unknown as Record<string, unknown>).requiredEdu as string || '-'}
                      </TableCell>
                      <TableCell className="text-sm">{desig.department || '-'}</TableCell>
                      <TableCell className="text-center">{desig.employeeCount ?? 0}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            desig.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                          }
                        >
                          {desig.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {desig.createdAt ? new Date(desig.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(desig)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {/* Use a native button (not shadcn Button) to avoid nested-button hydration error with Switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(desig)}
                            disabled={togglingId === desig.id}
                            title={desig.isActive ? 'Deactivate' : 'Activate'}
                            aria-label={desig.isActive ? 'Deactivate designation' : 'Activate designation'}
                            className="inline-flex items-center justify-center h-8 px-2 rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {togglingId === desig.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <span className={`inline-flex h-[1.15rem] w-8 items-center rounded-full border border-transparent shadow-xs transition-all ${desig.isActive ? 'bg-primary' : 'bg-input'}`}>
                                <span className={`h-3.5 w-3.5 bg-white rounded-full shadow-sm transition-transform ${desig.isActive ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                              </span>
                            )}
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteTarget(desig)}
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
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDesig ? 'Edit Designation' : 'Create Designation'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="desig-title">Title *</Label>
              <Input
                id="desig-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g., Senior Manager"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="desig-exp">Required Experience</Label>
                <Input
                  id="desig-exp"
                  value={form.requiredExp}
                  onChange={(e) => setForm((p) => ({ ...p, requiredExp: e.target.value }))}
                  placeholder="e.g., 5 Years"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desig-edu">Required Education</Label>
                <Input
                  id="desig-edu"
                  value={form.requiredEdu}
                  onChange={(e) => setForm((p) => ({ ...p, requiredEdu: e.target.value }))}
                  placeholder="e.g., MBA"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Department *</Label>
              <Select
                value={form.department}
                onValueChange={(v) => setForm((p) => ({ ...p, department: v }))}
              >
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="eci-btn-primary" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingDesig ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget && (deleteTarget.employeeCount ?? 0) > 0
                ? 'Deactivate Designation'
                : 'Delete Designation'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {deleteTarget && (deleteTarget.employeeCount ?? 0) > 0 ? (
                  <>
                    <p className="font-medium text-orange-700 mb-2">
                      This designation has {deleteTarget.employeeCount} active employee{(deleteTarget.employeeCount ?? 0) > 1 ? 's' : ''}.
                    </p>
                    <p>
                      It will be <strong>deactivated instead of deleted</strong> to preserve data integrity.
                      Inactive designations can be reactivated later.
                    </p>
                  </>
                ) : (
                  <p>
                    This designation has no linked records and will be <strong>permanently deleted</strong>.
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
                deleteTarget && (deleteTarget.employeeCount ?? 0) > 0
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deleteTarget && (deleteTarget.employeeCount ?? 0) > 0 ? 'Deactivate' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}