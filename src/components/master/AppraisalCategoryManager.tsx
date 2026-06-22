'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AppraisalCategoryItem, RatingScaleItem } from '@/lib/types';

const SECTION_OPTIONS = [
  { value: 'goals', label: 'Goals', color: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  { value: 'technical_skills', label: 'Technical Skills', color: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
  { value: 'leadership_skills', label: 'Leadership Skills', color: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  { value: 'managerial_skills', label: 'Managerial Skills', color: 'bg-purple-100 text-purple-800 hover:bg-purple-100' },
  { value: 'explanations', label: 'Explanations', color: 'bg-rose-100 text-rose-800 hover:bg-rose-100' },
];

const SECTION_FILTERS = [
  { value: 'all', label: 'All', color: '' },
  ...SECTION_OPTIONS,
];

function getSectionBadgeClass(section: string): string {
  const opt = SECTION_OPTIONS.find((s) => s.value === section);
  return opt?.color || 'bg-gray-100 text-gray-800 hover:bg-gray-100';
}

function getSectionLabel(section: string): string {
  const opt = SECTION_OPTIONS.find((s) => s.value === section);
  return opt?.label || section;
}

export default function AppraisalCategoryManager() {
  const [categories, setCategories] = useState<AppraisalCategoryItem[]>([]);
  const [ratingScales, setRatingScales] = useState<RatingScaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState('all');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AppraisalCategoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formSection, setFormSection] = useState('goals');
  const [formDesc, setFormDesc] = useState('');
  const [formScaleId, setFormScaleId] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<AppraisalCategoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/appraisal-categories');
      if (res.ok) {
        const data = await res.json();
        // API returns { appraisalCategories: [...] }
        setCategories(data.appraisalCategories || data.categories || []);
      }
    } catch {
      // Server unavailable - show empty state gracefully
      console.warn('Server unavailable, showing empty categories list');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScales = useCallback(async () => {
    try {
      const res = await fetch('/api/rating-scales');
      if (res.ok) {
        const data = await res.json();
        // API returns { ratingScales: [...] }
        setRatingScales(data.ratingScales || data.scales || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCategories(), fetchScales()]).finally(() => setLoading(false));
  }, [fetchCategories, fetchScales]);

  const filtered = categories.filter(
    (c) => sectionFilter === 'all' || c.section === sectionFilter
  );

  const resetForm = () => {
    setFormName('');
    setFormSection('goals');
    setFormDesc('');
    setFormScaleId('');
    setFormSortOrder(0);
    setEditingCat(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (cat: AppraisalCategoryItem) => {
    setEditingCat(cat);
    setFormName(cat.name);
    setFormSection(cat.section);
    setFormDesc(cat.description || '');
    setFormScaleId(cat.ratingScaleId || '');
    setFormSortOrder(cat.sortOrder);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Category name is required');
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editingCat;
      const url = isEdit ? `/api/appraisal-categories/${editingCat.id}` : '/api/appraisal-categories';
      const method = isEdit ? 'PUT' : 'POST';

      const body = {
        name: formName.trim(),
        section: formSection,
        description: formDesc.trim(),
        ratingScaleId: formScaleId || null,
        sortOrder: formSortOrder,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(isEdit ? 'Category updated' : 'Category created');
        setDialogOpen(false);
        fetchCategories();
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${isEdit ? 'update' : 'create'} category`);
      }
    } catch {
      toast.error(`Failed to ${editingCat ? 'update' : 'create'} category`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/appraisal-categories/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Category deleted');
        fetchCategories();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete category');
      }
    } catch {
      toast.error('Failed to delete category');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (cat: AppraisalCategoryItem) => {
    setTogglingId(cat.id);
    try {
      const res = await fetch(`/api/appraisal-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cat.name,
          section: cat.section,
          description: cat.description,
          ratingScaleId: cat.ratingScaleId,
          sortOrder: cat.sortOrder,
          isActive: !cat.isActive,
        }),
      });
      if (res.ok) {
        toast.success(`Category ${cat.isActive ? 'deactivated' : 'activated'}`);
        fetchCategories();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update category');
      }
    } catch {
      toast.error('Failed to update category');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Appraisal Categories</h2>
        <Button className="eci-btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Section Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {SECTION_FILTERS.map((s) => (
          <Button
            key={s.value}
            variant={sectionFilter === s.value ? 'default' : 'outline'}
            size="sm"
            className={
              sectionFilter === s.value && s.value !== 'all'
                ? s.color
                : sectionFilter === s.value
                ? 'eci-btn-primary'
                : ''
            }
            onClick={() => setSectionFilter(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="eci-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="hidden sm:table-cell">Rating Scale</TableHead>
                  <TableHead className="text-center">Sort Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {sectionFilter !== 'all'
                        ? `No categories in "${getSectionLabel(sectionFilter)}" section`
                        : 'No appraisal categories configured yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((cat) => (
                    <TableRow key={cat.id} className={!cat.isActive ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell>
                        <Badge className={getSectionBadgeClass(cat.section)}>
                          {getSectionLabel(cat.section)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-48 truncate">
                        {cat.description || '-'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {cat.ratingScale?.name || cat.ratingScaleName || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{cat.sortOrder}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            cat.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                          }
                        >
                          {cat.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(cat)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {/* Use a div (not Button) to avoid nested-button hydration error with Switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(cat)}
                            disabled={togglingId === cat.id}
                            title={cat.isActive ? 'Deactivate' : 'Activate'}
                            aria-label={cat.isActive ? 'Deactivate category' : 'Activate category'}
                            className="inline-flex items-center justify-center h-8 px-2 rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {togglingId === cat.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <span className="inline-flex items-center">
                                <span
                                  className={`inline-flex h-[1.15rem] w-8 items-center rounded-full border border-transparent shadow-xs transition-all ${cat.isActive ? 'bg-primary' : 'bg-input'}`}
                                >
                                  <span className={`h-3.5 w-3.5 bg-white rounded-full shadow-sm transition-transform ${cat.isActive ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                </span>
                              </span>
                            )}
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteTarget(cat)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCat ? 'Edit Category' : 'Create Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name *</Label>
              <Input
                id="cat-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Technical Knowledge"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-section">Section *</Label>
                <Select value={formSection} onValueChange={setFormSection}>
                  <SelectTrigger className="w-full" id="cat-section">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTION_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-order">Sort Order</Label>
                <Input
                  id="cat-order"
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Describe this appraisal category..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-scale">Rating Scale</Label>
              <Select value={formScaleId} onValueChange={setFormScaleId}>
                <SelectTrigger className="w-full" id="cat-scale">
                  <SelectValue placeholder="Optional — select a rating scale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {ratingScales
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.minScore}–{s.maxScore})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Link a rating scale to define valid score range for this category
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="eci-btn-primary" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCat ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appraisal Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This category is
              part of the {deleteTarget ? getSectionLabel(deleteTarget.section) : ''} section
              and may affect appraisal form configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}