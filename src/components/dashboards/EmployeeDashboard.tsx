'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Clock, CheckCircle, AlertCircle, Info, Shield } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { APPRAISAL_STATUS_LABELS, APPRAISAL_STATUS_COLORS, OVERALL_RATING_SCALE } from '@/lib/constants';
import type { AppraisalStatus } from '@/lib/types';

interface EmployeeStats {
  currentAssignment: {
    id: string;
    cycleName: string;
    status: AppraisalStatus;
    deadline: string;
  } | null;
  appraisalHistory: {
    id: string;
    cycleName: string;
    year: string;
    status: AppraisalStatus;
    overallScore: number;
    rating: string;
  }[];
}

const MOCK_STATS: EmployeeStats = {
  currentAssignment: {
    id: 'demo-assignment-1',
    cycleName: 'Annual Appraisal 2025',
    status: 'assigned_to_employee',
    deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
  },
  appraisalHistory: [
    { id: 'h1', cycleName: 'Mid-Year Review 2025', year: '2025', status: 'approved', overallScore: 82, rating: 'Good' },
    { id: 'h2', cycleName: 'Annual Appraisal 2024', year: '2024', status: 'approved', overallScore: 76, rating: 'Good' },
  ],
};

export default function EmployeeDashboard() {
  const { currentUser, setCurrentView, setViewParams } = useAppStore();
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.id;
    async function fetchData() {
      try {
        const res = await fetch(`/api/dashboard/stats?userId=${uid}&role=employee`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else {
          setStats(MOCK_STATS);
        }
      } catch {
        setStats(MOCK_STATS);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const currentAssignment = stats?.currentAssignment;
  const deadline = currentAssignment?.deadline ? new Date(currentAssignment.deadline) : null;
  const daysLeft = deadline ? differenceInDays(deadline, new Date()) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;

  return (
    <div className="space-y-6">
      {/* Supervisor Privileges Banner */}
      {currentUser?.isSupervisor && (
        <Card className="eci-card border-l-4 border-l-eci-blue bg-eci-blue/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1">
              <Shield className="h-5 w-5 text-eci-blue shrink-0" />
              <div>
                <p className="font-semibold text-sm">You have supervisor privileges.</p>
                <p className="text-sm text-muted-foreground">
                  View your team&apos;s appraisals in the Appraisals section.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setCurrentView('appraisal-list')}
            >
              View Team Appraisals
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current Appraisal Status */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-eci-blue" />
            My Appraisal Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentAssignment ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cycle</p>
                  <p className="font-semibold">{currentAssignment.cycleName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={APPRAISAL_STATUS_COLORS[currentAssignment.status] || ''}>
                    {APPRAISAL_STATUS_LABELS[currentAssignment.status] || currentAssignment.status}
                  </Badge>
                </div>
                {currentAssignment.status === 'assigned_to_employee' && (
                  <Button
                    className="eci-btn-primary"
                    onClick={() => {
                      setCurrentView('appraisal-form');
                      setViewParams({ id: currentAssignment.id });
                    }}
                  >
                    Fill Appraisal Form
                  </Button>
                )}
                {(currentAssignment.status === 'returned_for_correction') && (
                  <Button
                    className="eci-btn-primary"
                    onClick={() => {
                      setCurrentView('appraisal-form');
                      setViewParams({ id: currentAssignment.id });
                    }}
                  >
                    Revise & Resubmit
                  </Button>
                )}
                {currentAssignment.status === 'shared_with_employee' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentView('appraisal-view');
                      setViewParams({ id: currentAssignment.id });
                    }}
                  >
                    View Approved Appraisal
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No active appraisal assignment</p>
          )}
        </CardContent>
      </Card>

      {/* Deadline Countdown */}
      {currentAssignment && deadline && (
        <Card className={`eci-card border-l-4 ${isOverdue ? 'border-l-red-500' : daysLeft !== null && daysLeft <= 3 ? 'border-l-amber-500' : 'border-l-green-500'}`}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isOverdue ? 'text-red-600 bg-red-50' : daysLeft !== null && daysLeft <= 3 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'}`}>
              {isOverdue ? <AlertCircle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
            </div>
            <div>
              <p className="font-semibold">
                {isOverdue
                  ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`
                  : daysLeft === 0
                  ? 'Due Today!'
                  : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
              </p>
              <p className="text-sm text-muted-foreground">
                Deadline: {format(deadline, 'MMMM dd, yyyy')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appraisal History */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            My Appraisal History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.appraisalHistory && stats.appraisalHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.appraisalHistory.map((item) => {
                    const ratingInfo = OVERALL_RATING_SCALE.find(
                      (r) => item.overallScore >= r.min && item.overallScore <= r.max
                    );
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.cycleName}</TableCell>
                        <TableCell>{item.year}</TableCell>
                        <TableCell>
                          <span className="font-semibold" style={{ color: ratingInfo?.color || '#000' }}>
                            {item.overallScore}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm max-w-48">{item.rating || '-'}</TableCell>
                        <TableCell>
                          <Badge className={APPRAISAL_STATUS_COLORS[item.status] || ''}>
                            {APPRAISAL_STATUS_LABELS[item.status] || item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCurrentView('appraisal-view');
                              setViewParams({ id: item.id });
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              No appraisal history yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="eci-card bg-eci-blue/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-eci-blue mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">How to complete your appraisal:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Fill in your key accomplishments and goals for the year</li>
                <li>Rate yourself on technical, leadership, and managerial skills</li>
                <li>Set goals for the upcoming year (minimum 3 required)</li>
                <li>Review and submit your form before the deadline</li>
              </ol>
              <p>Your supervisor will then review and rate your performance. HR and management will provide final approval.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}