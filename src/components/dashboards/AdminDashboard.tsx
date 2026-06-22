'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Award,
  Plus,
  FileBarChart,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { DashboardStats, AppraisalStatus } from '@/lib/types';
import { APPRAISAL_STATUS_LABELS, APPRAISAL_STATUS_COLORS } from '@/lib/constants';

const COLORS = ['#1a3a5c', '#2a5a8c', '#3a7aac', '#4a9acc', '#5abae8'];

const MOCK_STATS: DashboardStats = {
  activeCycles: 1,
  totalAssigned: 6,
  pendingAppraisals: 2,
  submittedAppraisals: 1,
  overdueAppraisals: 0,
  returnedCases: 1,
  approvedAppraisals: 1,
  totalEmployees: 10,
  totalAppraisals: 6,
  pendingApproval: 0,
  ratingDistribution: [],
  topPerformers: [],
  needsImprovement: [],
  approvalQueue: [],
  departmentProgress: [
    { name: 'Engineering', total: 3, completed: 1 },
    { name: 'Finance', total: 1, completed: 0 },
    { name: 'Operations', total: 1, completed: 1 },
    { name: 'Marketing', total: 1, completed: 0 },
  ],
};

interface RecentActivity {
  id: string;
  employeeName: string;
  cycleName: string;
  status: AppraisalStatus;
  updatedAt: string;
}

export default function AdminDashboard() {
  const { currentUser, setCurrentView } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.id;
    async function fetchData() {
      try {
        const res = await fetch(`/api/dashboard/stats?userId=${uid}&role=admin`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
          setRecentActivity([]);
        } else {
          setStats(MOCK_STATS);
        }
      } catch {
        // Use mock data when API is unavailable (sandbox demo mode)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const statCards = [
    { label: 'Active Cycles', value: stats?.activeCycles ?? 0, icon: Calendar, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Assigned Employees', value: stats?.totalAssigned ?? 0, icon: Users, color: 'text-slate-600 bg-slate-50' },
    { label: 'Pending Appraisals', value: stats?.pendingAppraisals ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Submitted Appraisals', value: stats?.submittedAppraisals ?? 0, icon: CheckCircle, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Overdue Appraisals', value: stats?.overdueAppraisals ?? 0, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Returned Cases', value: stats?.returnedCases ?? 0, icon: RotateCcw, color: 'text-amber-700 bg-amber-50' },
    { label: 'Approved Appraisals', value: stats?.approvedAppraisals ?? 0, icon: Award, color: 'text-green-600 bg-green-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="eci-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${card.color}`}>
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setCurrentView('cycle-create')} className="eci-btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Cycle
        </Button>
        <Button variant="outline" onClick={() => setCurrentView('reports')}>
          <FileBarChart className="h-4 w-4 mr-2" />
          View Reports
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Progress Chart */}
        <Card className="eci-card">
          <CardHeader>
            <CardTitle className="text-lg">Department-wise Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.departmentProgress && stats.departmentProgress.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.departmentProgress} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    formatter={(value: number, name: string) => [value, name === 'completed' ? 'Completed' : 'Total']}
                  />
                  <Bar dataKey="total" fill="#e2e8f0" name="total" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="completed" radius={[4, 4, 0, 0]}>
                    {stats.departmentProgress.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No department data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="eci-card">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivity.map((item) => (
                      <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                        setCurrentView('appraisal-form');
                        useAppStore.getState().setViewParams({ id: item.id });
                      }}>
                        <TableCell className="font-medium">{item.employeeName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.cycleName}</TableCell>
                        <TableCell>
                          <Badge className={APPRAISAL_STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-800'}>
                            {APPRAISAL_STATUS_LABELS[item.status] || item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.updatedAt ? format(new Date(item.updatedAt), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}