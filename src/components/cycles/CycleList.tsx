'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Plus, Eye, Play, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { CycleDetail, CycleStatus } from '@/lib/types';
import { CYCLE_STATUS_LABELS, CYCLE_TYPE_LABELS } from '@/lib/constants';

export default function CycleList() {
  const { setCurrentView, setViewParams, currentUser } = useAppStore();
  const [cycles, setCycles] = useState<CycleDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activateId, setActivateId] = useState<string | null>(null);
  const [closeId, setCloseId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchCycles();
  }, []);

  async function fetchCycles() {
    try {
      const res = await fetch('/api/cycles');
      if (res.ok) {
        const data = await res.json();
        setCycles(data.cycles || []);
      }
    } catch {
      // Server unavailable - show empty state gracefully
      console.warn('Server unavailable, showing empty cycle list');
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }

  const handleActivate = async () => {
    if (!activateId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/cycles/${activateId}/activate`, { method: 'POST' });
      if (res.ok) {
        toast.success('Cycle activated successfully');
        fetchCycles();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to activate cycle');
      }
    } catch {
      toast.error('Failed to activate cycle');
    } finally {
      setActionLoading(false);
      setActivateId(null);
    }
  };

  const handleClose = async () => {
    if (!closeId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/cycles/${closeId}/close`, { method: 'POST' });
      if (res.ok) {
        toast.success('Cycle closed successfully');
        fetchCycles();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to close cycle');
      }
    } catch {
      toast.error('Failed to close cycle');
    } finally {
      setActionLoading(false);
      setCloseId(null);
    }
  };

  const filteredCycles = cycles.filter((c) => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.year.includes(searchQuery);
    return matchStatus && matchSearch;
  });

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    closed: 'bg-slate-100 text-slate-800',
    archived: 'bg-slate-50 text-slate-500',
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Appraisal Cycles</h2>
        {currentUser?.role === 'admin' && (
          <Button className="eci-btn-primary" onClick={() => setCurrentView('cycle-create')}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Cycle
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cycles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="eci-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Employees</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCycles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No cycles found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCycles.map((cycle) => (
                    <TableRow
                      key={cycle.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setCurrentView('cycle-detail');
                        setViewParams({ id: cycle.id });
                      }}
                    >
                      <TableCell className="font-medium">{cycle.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CYCLE_TYPE_LABELS[cycle.cycleType] || cycle.cycleType}</Badge>
                      </TableCell>
                      <TableCell>{cycle.year}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cycle.periodFrom && cycle.periodTo
                          ? `${cycle.periodFrom} - ${cycle.periodTo}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor[cycle.status] || ''}>
                          {CYCLE_STATUS_LABELS[cycle.status] || cycle.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{cycle._count?.assignments ?? 0}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCurrentView('cycle-detail');
                              setViewParams({ id: cycle.id });
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {currentUser?.role === 'admin' && cycle.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => setActivateId(cycle.id)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {currentUser?.role === 'admin' && cycle.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setCloseId(cycle.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Activate Dialog */}
      <AlertDialog open={!!activateId} onOpenChange={(open) => !open && setActivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Cycle</AlertDialogTitle>
            <AlertDialogDescription>
              This will activate the cycle and create appraisal assignments for all selected employees. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate} disabled={actionLoading}>
              {actionLoading ? 'Activating...' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Dialog */}
      <AlertDialog open={!!closeId} onOpenChange={(open) => !open && setCloseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Cycle</AlertDialogTitle>
            <AlertDialogDescription>
              This will close the cycle. No further changes will be allowed. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} disabled={actionLoading}>
              {actionLoading ? 'Closing...' : 'Close Cycle'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}