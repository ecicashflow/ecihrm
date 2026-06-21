'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
  Minus,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import type { RatingScaleItem } from '@/lib/types';

interface LabelRow {
  score: number;
  label: string;
}

const APPLIES_TO_OPTIONS = [
  { value: 'Goals', label: 'Goals' },
  { value: 'Competencies', label: 'Competencies' },
  { value: 'Explanations', label: 'Explanations' },
  { value: 'General', label: 'General' },
];

export default function RatingScaleManager() {
  const [scales, setScales] = useState<RatingScaleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<RatingScaleItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMinScore, setFormMinScore] = useState(0);
  const [formMaxScore, setFormMaxScore] = useState(5);
  const [formAppliesTo, setFormAppliesTo] = useState('General');
  const [formLabels, setFormLabels] = useState<LabelRow[]>([]);
  const [formSortOrder, setFormSortOrder] = useState(0);

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<RatingScaleItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchScales = useCallback(async () => {
    try {
      const res = await fetch('/api/rating-scales');
      if (res.ok) {
        const data = await res.json();
        setScales(data.ratingScales || data || []);
      }
    } catch {
      // Server unavailable - show empty state gracefully
      console.warn('Server unavailable, showing empty rating scales list');
      setScales([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScales();
  }, [fetchScales]);

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormMinScore(0);
    setFormMaxScore(5);
    setFormAppliesTo('General');
    setFormLabels([]);
    setFormSortOrder(0);
    setEditingScale(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (scale: RatingScaleItem) => {
    setEditingScale(scale);
    setFormName(scale.name);
    setFormDesc(scale.description || '');
    setFormMinScore(scale.minScore);
    setFormMaxScore(scale.maxScore);
    setFormAppliesTo(scale.appliesTo || 'General');
    setFormLabels(scale.labels || []);
    setFormSortOrder(scale.sortOrder);
    setDialogOpen(true);
  };

  const addLabelRow = () => {
    const nextScore = formLabels.length > 0
      ? Math.max(...formLabels.map((l) => l.score)) + 1
      : formMinScore;
    setFormLabels([...formLabels, { score: nextScore, label: '' }]);
  };

  const removeLabelRow = (index: number) => {
    setFormLabels(formLabels.filter((_, i) => i !== index));
  };

  const updateLabelRow = (index: number, field: 'score' | 'label', value: number | string) => {
    const updated = [...formLabels];
    if (field === 'score') {
      updated[index] = { ...updated[index], score: value as number };
    } else {
      updated[index] = { ...updated[index], label: value as string };
    }
    setFormLabels(updated);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Scale name is required');
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editingScale;
      const url = isEdit ? `/api/rating-scales/${editingScale.id}` : '/api/rating-scales';
      const method = isEdit ? 'PUT' : 'POST';

      const body = {
        name: formName.trim(),
        description: formDesc.trim(),
        minScore: formMinScore,
        maxScore: formMaxScore,
        appliesTo: formAppliesTo,
        labels: formLabels,
        sortOrder: formSortOrder,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(isEdit ? 'Rating scale updated' : 'Rating scale created');
        setDialogOpen(false);
        fetchScales();
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${isEdit ? 'update' : 'create'} rating scale`);
      }
    } catch {
      toast.error(`Failed to ${editingScale ? 'update' : 'create'} rating scale`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/rating-scales/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Rating scale deleted');
        fetchScales();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete rating scale');
      }
    } catch {
      toast.error('Failed to delete rating scale');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (scale: RatingScaleItem) => {
    setTogglingId(scale.id);
    try {
      const res = await fetch(`/api/rating-scales/${scale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scale.name,
          description: scale.description,
          minScore: scale.minScore,
          maxScore: scale.maxScore,
          appliesTo: scale.appliesTo,
          labels: scale.labels,
          sortOrder: scale.sortOrder,
          isActive: !scale.isActive,
        }),
      });
      if (res.ok) {
        toast.success(`Rating scale ${scale.isActive ? 'deactivated' : 'activated'}`);
        fetchScales();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update rating scale');
      }
    } catch {
      toast.error('Failed to update rating scale');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-44" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Rating Scales</h2>
        <Button className="eci-btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rating Scale
        </Button>
      </div>

      {/* Table */}
      <Card className="eci-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Applies To</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Categories</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No rating scales configured yet
                    </TableCell>
                  </TableRow>
                ) : (
                  scales.map((scale) => (
                    <TableRow key={scale.id} className={!scale.isActive ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{scale.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-48 truncate">
                        {scale.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {scale.minScore} – {scale.maxScore}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            scale.appliesTo === 'Goals'
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                              : scale.appliesTo === 'Competencies'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                              : scale.appliesTo === 'Explanations'
                              ? 'bg-rose-100 text-rose-800 hover:bg-rose-100'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                          }
                        >
                          {scale.appliesTo || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        {scale.categoryCount ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            scale.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                          }
                        >
                          {scale.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(scale)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(scale)}
                            disabled={togglingId === scale.id}
                            title={scale.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {togglingId === scale.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Switch className="scale-75" checked={scale.isActive} />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteTarget(scale)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingScale ? 'Edit Rating Scale' : 'Create Rating Scale'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scale-name">Name *</Label>
                <Input
                  id="scale-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., 5-Point Competency Scale"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scale-applies">Applies To</Label>
                <Select value={formAppliesTo} onValueChange={setFormAppliesTo}>
                  <SelectTrigger className="w-full" id="scale-applies">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLIES_TO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scale-desc">Description</Label>
              <Textarea
                id="scale-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Describe when and how this scale is used..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-score">Min Score</Label>
                <Input
                  id="min-score"
                  type="number"
                  value={formMinScore}
                  onChange={(e) => setFormMinScore(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-score">Max Score</Label>
                <Input
                  id="max-score"
                  type="number"
                  value={formMaxScore}
                  onChange={(e) => setFormMaxScore(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort-order">Sort Order</Label>
                <Input
                  id="sort-order"
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Labels Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Score Labels</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLabelRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Label
                </Button>
              </div>
              {formLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                  No labels added yet. Click &quot;Add Label&quot; to define score meanings.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {formLabels.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        type="number"
                        value={row.score}
                        onChange={(e) => updateLabelRow(idx, 'score', parseInt(e.target.value) || 0)}
                        className="w-20 shrink-0"
                        placeholder="Score"
                      />
                      <Input
                        value={row.label}
                        onChange={(e) => updateLabelRow(idx, 'label', e.target.value)}
                        className="flex-1 min-w-0"
                        placeholder="Label text"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 shrink-0"
                        onClick={() => removeLabelRow(idx)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="eci-btn-primary" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingScale ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rating Scale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This may affect
              appraisal categories linked to this scale.
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