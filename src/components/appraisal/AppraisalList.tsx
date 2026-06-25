'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Search, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import type { AssignmentDetail, AppraisalStatus, CycleDetail, CycleStatus } from '@/lib/types';
import { APPRAISAL_STATUS_LABELS, APPRAISAL_STATUS_COLORS, CYCLE_TYPE_LABELS } from '@/lib/constants';

type TabValue = 'my' | 'team';

export default function AppraisalList() {
  const { currentUser, setCurrentView, setViewParams } = useAppStore();
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [cycles, setCycles] = useState<CycleDetail[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cycleFilter, setCycleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  // Dual-role tab state
  const isDualRole = currentUser?.isSupervisor || currentUser?.role === 'supervisor';
  const isManagement = currentUser?.role === 'management' || currentUser?.role === 'admin' || currentUser?.role === 'hr';
  const [activeTab, setActiveTab] = useState<TabValue>('my');

  useEffect(() => {
    // Guard against stale responses: if the user switches tabs quickly,
    // a slow response from the previous tab could overwrite the new data.
    // We track the latest fetch and ignore any response that isn't current.
    let stale = false;

    async function fetchData() {
      try {
        const role = currentUser?.role || 'employee';
        const params = new URLSearchParams();

        if (isManagement) {
          // Management/admin/HR see all — no tabs needed
          if (currentUser?.role === 'supervisor') params.set('supervisorId', currentUser.id);
          if (currentUser?.role === 'management' || currentUser?.role === 'admin' || currentUser?.role === 'hr') params.set('managementView', 'true');
        } else if (isDualRole) {
          // Dual-role: fetch based on active tab
          if (activeTab === 'team') {
            params.set('supervisorId', currentUser!.id);
          } else {
            params.set('employeeId', currentUser!.id);
          }
        } else if (role === 'employee') {
          params.set('employeeId', currentUser!.id);
        } else if (role === 'supervisor') {
          params.set('supervisorId', currentUser!.id);
        }

        const [assignRes, cycleRes, deptRes] = await Promise.all([
          fetch(`/api/assignments?${params.toString()}`),
          fetch('/api/cycles'),
          fetch('/api/departments'),
        ]);

        // Ignore stale responses from a previous tab to prevent a slow
        // response from overwriting the current tab's data (race condition).
        if (stale) return;

        if (assignRes.ok) setAssignments((await assignRes.json()).assignments || []);
        if (cycleRes.ok) setCycles((await cycleRes.json()).cycles || []);
        if (deptRes.ok) setDepartments((await deptRes.json()).departments || []);
      } catch {
        // Server unavailable - show empty state gracefully
        if (stale) return;
        console.warn('Server unavailable, showing empty assignment list');
        setAssignments([]);
      } finally {
        if (!stale) setLoading(false);
      }
    }

    fetchData();
    return () => { stale = true; };
  }, [activeTab]);

  const filteredAssignments = assignments.filter((a) => {
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchCycle = cycleFilter === 'all' || a.cycleId === cycleFilter;
    const matchDept = deptFilter === 'all' || a.employee?.department === deptFilter;
    const matchSearch =
      !searchQuery ||
      a.employee?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.employee?.employeeId?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchCycle && matchDept && matchSearch;
  });

  const statusOptions = [...new Set(assignments.map((a) => a.status))];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const showTabs = isDualRole && !isManagement;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Appraisal Assignments</h2>
        <Button variant="outline" onClick={() => window.print()}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Dual-role Tabs */}
      {showTabs && (
        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as TabValue);
          // Reset filters when switching tabs
          setSearchQuery('');
          setStatusFilter('all');
          setCycleFilter('all');
          setDeptFilter('all');
        }}>
          <TabsList>
            <TabsTrigger value="my">My Appraisals</TabsTrigger>
            <TabsTrigger value="team">Team Appraisals</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>{APPRAISAL_STATUS_LABELS[s] || s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cycleFilter} onValueChange={setCycleFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by cycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cycles</SelectItem>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by dept" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
            ))}
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
                  <TableHead>Employee</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No assignments found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssignments.map((assignment) => (
                    <TableRow
                      key={assignment.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        const isViewOnly =
                          assignment.status === 'approved' ||
                          assignment.status === 'shared_with_employee' ||
                          assignment.status === 'acknowledged_by_employee' ||
                          assignment.status === 'closed';
                        setCurrentView(isViewOnly ? 'appraisal-view' : 'appraisal-form');
                        setViewParams({ id: assignment.id });
                      }}
                    >
                      <TableCell className="font-medium">
                        {assignment.employee?.name || '-'}
                        <p className="text-xs text-muted-foreground">{assignment.employee?.employeeId}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {assignment.cycle?.name || '-'}
                        <p className="text-xs text-muted-foreground">{CYCLE_TYPE_LABELS[assignment.cycle?.cycleType || '']}</p>
                      </TableCell>
                      <TableCell className="text-sm">{assignment.employee?.department || '-'}</TableCell>
                      <TableCell>
                        <Badge className={APPRAISAL_STATUS_COLORS[assignment.status] || ''}>
                          {APPRAISAL_STATUS_LABELS[assignment.status] || assignment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{assignment.supervisor?.name || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assignment.deadline ? format(new Date(assignment.deadline), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const isViewOnly =
                              assignment.status === 'approved' ||
                              assignment.status === 'shared_with_employee' ||
                              assignment.status === 'acknowledged_by_employee' ||
                              assignment.status === 'closed';
                            setCurrentView(isViewOnly ? 'appraisal-view' : 'appraisal-form');
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