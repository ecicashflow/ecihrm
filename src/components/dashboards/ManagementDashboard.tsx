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
import { Users, CheckCircle, TrendingUp, TrendingDown, FileBarChart, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { APPRAISAL_STATUS_LABELS, APPRAISAL_STATUS_COLORS } from '@/lib/constants';
import type { AppraisalStatus } from '@/lib/types';

interface ManagementStats {
  totalEmployees: number;
  totalAppraisals: number;
  approvedAppraisals: number;
  pendingApproval: number;
  ratingDistribution: { name: string; value: number; color: string }[];
  topPerformers: { name: string; department: string; score: number }[];
  needsImprovement: { name: string; department: string; score: number }[];
  approvalQueue: {
    id: string;
    employeeName: string;
    department: string;
    cycleName: string;
    score: number;
  }[];
}

const MOCK_STATS: ManagementStats = {
  totalEmployees: 10,
  totalAppraisals: 6,
  approvedAppraisals: 2,
  pendingApproval: 1,
  ratingDistribution: [
    { name: 'Outstanding', value: 1, color: '#16a34a' },
    { name: 'Good', value: 3, color: '#2563eb' },
    { name: 'Satisfactory', value: 1, color: '#d97706' },
    { name: 'Needs Improvement', value: 1, color: '#dc2626' },
  ],
  topPerformers: [
    { name: 'Zainab Malik', department: 'Finance', score: 91 },
    { name: 'Ayesha Khan', department: 'Marketing', score: 88 },
  ],
  needsImprovement: [
    { name: 'Hassan Ahmed', department: 'Operations', score: 52 },
  ],
  approvalQueue: [
    { id: 'aq1', employeeName: 'Ali Rashid', department: 'Engineering', cycleName: 'Annual 2025', score: 78 },
  ],
};

export default function ManagementDashboard() {
  const { currentUser, setCurrentView, setViewParams } = useAppStore();
  const [stats, setStats] = useState<ManagementStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.id;
    async function fetchData() {
      try {
        const res = await fetch(`/api/dashboard/stats?userId=${uid}&role=management`);
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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const cards = [
    { label: 'Total Employees', value: stats?.totalEmployees ?? 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Appraisals', value: stats?.totalAppraisals ?? 0, icon: FileBarChart, color: 'text-slate-600 bg-slate-50' },
    { label: 'Approved', value: stats?.approvedAppraisals ?? 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Pending Approval', value: stats?.pendingApproval ?? 0, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <Card className="eci-card">
          <CardHeader>
            <CardTitle className="text-lg">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.ratingDistribution && stats.ratingDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.ratingDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.ratingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No rating data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performers & Needs Improvement */}
        <div className="space-y-6">
          <Card className="eci-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.topPerformers && stats.topPerformers.length > 0 ? (
                <div className="space-y-2">
                  {stats.topPerformers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-green-50/50">
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.department}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">{p.score}%</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              )}
            </CardContent>
          </Card>

          <Card className="eci-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Needs Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.needsImprovement && stats.needsImprovement.length > 0 ? (
                <div className="space-y-2">
                  {stats.needsImprovement.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-red-50/50">
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.department}</p>
                      </div>
                      <Badge className="bg-red-100 text-red-800">{p.score}%</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Final Approval Queue */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg">Final Approval Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.approvalQueue && stats.approvalQueue.length > 0 ? (
            <div className="overflow-x-auto max-h-96 overflow-y-auto eci-scroll">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.approvalQueue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.employeeName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.department}</TableCell>
                      <TableCell className="text-sm">{item.cycleName}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            item.score >= 86
                              ? 'bg-green-100 text-green-800'
                              : item.score >= 71
                              ? 'bg-blue-100 text-blue-800'
                              : item.score >= 56
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {item.score}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCurrentView('appraisal-form');
                            setViewParams({ id: item.id });
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              No pending approvals
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}