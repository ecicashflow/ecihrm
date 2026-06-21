'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import type { AppraisalStatus, AssignmentDetail } from '@/lib/types';
import { APPRAISAL_STATUS_LABELS, APPRAISAL_STATUS_COLORS, CYCLE_STATUS_LABELS, CYCLE_TYPE_LABELS } from '@/lib/constants';

export default function CycleDetail() {
  const { viewParams, setCurrentView, setViewParams } = useAppStore();
  const cycleId = viewParams?.id;

  const [cycle, setCycle] = useState<any>(null);
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cycleId) return;
    async function fetchData() {
      try {
        setError(null);
        const [cycleRes, assignRes] = await Promise.all([
          fetch(`/api/cycles/${cycleId}`),
          fetch(`/api/assignments?cycleId=${cycleId}`),
        ]);
        if (cycleRes.ok) setCycle(await cycleRes.json());
        if (assignRes.ok) {
          const data = await assignRes.json();
          setAssignments(data.assignments || []);
        }
      } catch {
        console.warn('Server unavailable, could not load cycle details');
        setError('Cycle not found. The server may be temporarily unavailable.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [cycleId]);

  const completed = assignments.filter(
    (a) => a.status === 'approved' || a.status === 'shared_with_employee' || a.status === 'closed'
  ).length;
  const inProgress = assignments.filter(
    (a) => a.status !== 'approved' && a.status !== 'closed' && a.status !== 'shared_with_employee'
  ).length;
  const total = assignments.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const handleExport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!cycle || error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{error || 'Cycle not found'}</p>
        <Button variant="outline" onClick={() => setCurrentView('cycles')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cycles
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('cycles')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{cycle.name}</h2>
            <p className="text-sm text-muted-foreground">{cycle.year} · {CYCLE_TYPE_LABELS[cycle.cycleType]}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Cycle Info */}
      <Card className="eci-card">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Period</p>
              <p className="font-medium">
                {cycle.periodFrom && cycle.periodTo
                  ? `${format(new Date(cycle.periodFrom), 'MMM dd, yyyy')} - ${format(new Date(cycle.periodTo), 'MMM dd, yyyy')}`
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Start Date</p>
              <p className="font-medium">{cycle.startDate ? format(new Date(cycle.startDate), 'MMM dd, yyyy') : '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">End Date</p>
              <p className="font-medium">{cycle.endDate ? format(new Date(cycle.endDate), 'MMM dd, yyyy') : '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Submission Deadline</p>
              <p className="font-medium">{cycle.submissionDeadline ? format(new Date(cycle.submissionDeadline), 'MMM dd, yyyy') : '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card className="eci-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Progress</CardTitle>
            <Badge
              className={
                cycle.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : cycle.status === 'draft'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-slate-100 text-slate-800'
              }
            >
              {CYCLE_STATUS_LABELS[cycle.status] || cycle.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{completed} of {total} completed</span>
              <span className="font-semibold">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Completed: {completed}</span>
              <span>In Progress: {inProgress}</span>
              <span>Total: {total}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Assignments Table */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg">Assigned Employees</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No assignments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {assignment.employee?.name || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assignment.employee?.department || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {assignment.supervisor?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={APPRAISAL_STATUS_COLORS[assignment.status] || ''}>
                          {APPRAISAL_STATUS_LABELS[assignment.status] || assignment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assignment.deadline ? format(new Date(assignment.deadline), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCurrentView('appraisal-form');
                            setViewParams({ id: assignment.id });
                          }}
                        >
                          <Eye className="h-4 w-4" />
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
    </div>
  );
}