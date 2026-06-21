'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Designation {
  id: string;
  title: string;
  requiredExp: string;
  requiredEdu: string;
  department: string;
  _count?: { users: number };
}

interface Department {
  id: string;
  name: string;
}

export default function DesignationList() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    requiredExp: '',
    requiredEdu: '',
    department: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [desigRes, deptRes] = await Promise.all([
        fetch('/api/designations'),
        fetch('/api/departments'),
      ]);
      if (desigRes.ok) setDesignations((await desigRes.json()).designations || []);
      if (deptRes.ok) setDepartments((await deptRes.json()).departments || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async () => {
    if (!form.title.trim() || !form.department) {
      toast.error('Title and Department are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/designations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Designation created successfully');
        setForm({ title: '', requiredExp: '', requiredEdu: '', department: '' });
        setDialogOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create designation');
      }
    } catch {
      toast.error('Failed to create designation');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/designations/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Designation deleted');
        setDesignations((prev) => prev.filter((d) => d.id !== deleteId));
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete designation');
      }
    } catch {
      toast.error('Failed to delete designation');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Designations</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="eci-btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add Designation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Designation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Senior Manager"
                />
              </div>
              <div className="space-y-2">
                <Label>Required Experience</Label>
                <Input
                  value={form.requiredExp}
                  onChange={(e) => setForm((p) => ({ ...p, requiredExp: e.target.value }))}
                  placeholder="e.g., 5 Years"
                />
              </div>
              <div className="space-y-2">
                <Label>Required Education</Label>
                <Input
                  value={form.requiredEdu}
                  onChange={(e) => setForm((p) => ({ ...p, requiredEdu: e.target.value }))}
                  placeholder="e.g., MBA"
                />
              </div>
              <div className="space-y-2">
                <Label>Department *</Label>
                <Select value={form.department} onValueChange={(v) => setForm((p) => ({ ...p, department: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="eci-btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card className="eci-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Required Experience</TableHead>
                  <TableHead>Required Education</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Employees</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {designations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No designations found
                    </TableCell>
                  </TableRow>
                ) : (
                  designations.map((desig) => (
                    <TableRow key={desig.id}>
                      <TableCell className="font-medium">{desig.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{desig.requiredExp || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{desig.requiredEdu || '-'}</TableCell>
                      <TableCell className="text-sm">{desig.department}</TableCell>
                      <TableCell className="text-center">{desig._count?.users || 0}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setDeleteId(desig.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Designation</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this designation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}