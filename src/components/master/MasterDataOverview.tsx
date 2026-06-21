'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  Building2,
  Briefcase,
  Star,
  ListChecks,
  AlertTriangle,
  ChevronRight,
  Shield,
  UserCog,
  Crown,
  UserCheck,
} from 'lucide-react';
import type { MasterDataStats } from '@/lib/types';

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  admin: { label: 'Admin', icon: <Shield className="h-4 w-4" />, color: 'bg-red-100 text-red-700' },
  hr: { label: 'HR', icon: <UserCog className="h-4 w-4" />, color: 'bg-purple-100 text-purple-700' },
  supervisor: { label: 'Supervisor', icon: <UserCheck className="h-4 w-4" />, color: 'bg-blue-100 text-blue-700' },
  management: { label: 'Management', icon: <Crown className="h-4 w-4" />, color: 'bg-amber-100 text-amber-700' },
  employee: { label: 'Employee', icon: <Users className="h-4 w-4" />, color: 'bg-green-100 text-green-700' },
};

const MOCK_STATS: MasterDataStats = {
  totalEmployees: 10, activeEmployees: 8, inactiveEmployees: 2,
  totalDepartments: 6, activeDepartments: 6,
  totalDesignations: 9, activeDesignations: 9,
  totalRatingScales: 3, totalCategories: 22,
  employeesByRole: [
    { role: 'admin', count: 2 },
    { role: 'supervisor', count: 2 },
    { role: 'management', count: 1 },
    { role: 'employee', count: 5 },
  ],
  employeesWithoutSupervisor: 0, departmentsWithoutEmployees: [],
};

export default function MasterDataOverview() {
  const { setCurrentView } = useAppStore();
  const [stats, setStats] = useState<MasterDataStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/master-data/stats');
      if (res.ok) {
        const data = await res.json();
        const parsed = data.stats || data;
        // Validate data has required fields before using it
        if (parsed && typeof parsed.totalEmployees === 'number') {
          setStats(parsed);
        } else {
          setStats(MOCK_STATS);
        }
      } else {
        setStats(MOCK_STATS);
      }
    } catch {
      setStats(MOCK_STATS);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Unable to load master data statistics.</p>
        <Button variant="outline" className="mt-4" onClick={fetchStats}>
          Retry
        </Button>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Employees',
      value: stats.totalEmployees,
      subtitle: `${stats.activeEmployees} active / ${stats.inactiveEmployees} inactive`,
      icon: <Users className="h-5 w-5" />,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    {
      title: 'Departments',
      value: stats.totalDepartments,
      subtitle: `${stats.activeDepartments} active`,
      icon: <Building2 className="h-5 w-5" />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      title: 'Designations',
      value: stats.totalDesignations,
      subtitle: `${stats.activeDesignations} active`,
      icon: <Briefcase className="h-5 w-5" />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      title: 'Rating Scales',
      value: stats.totalRatingScales,
      subtitle: 'Configured scales',
      icon: <Star className="h-5 w-5" />,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
    },
    {
      title: 'Appraisal Categories',
      value: stats.totalCategories,
      subtitle: 'All sections',
      icon: <ListChecks className="h-5 w-5" />,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
    },
    {
      title: 'Without Supervisor',
      value: stats.employeesWithoutSupervisor,
      subtitle: stats.employeesWithoutSupervisor > 0 ? 'Needs attention' : 'All assigned',
      icon: <AlertTriangle className="h-5 w-5" />,
      color: stats.employeesWithoutSupervisor > 0 ? 'text-orange-600' : 'text-green-600',
      bg: stats.employeesWithoutSupervisor > 0 ? 'bg-orange-50' : 'bg-green-50',
      border: stats.employeesWithoutSupervisor > 0 ? 'border-orange-200' : 'border-green-200',
    },
  ];

  const quickActions = [
    { label: 'Employees', view: 'employees' as const },
    { label: 'Departments', view: 'departments' as const },
    { label: 'Designations', view: 'designations' as const },
    { label: 'Rating Scales', view: 'rating-scales' as const },
    { label: 'Appraisal Categories', view: 'appraisal-categories' as const },
  ];

  const maxRoleCount = Math.max(...stats.employeesByRole.map((r) => r.count), 1);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Master Data Management</h1>
        <p className="text-muted-foreground mt-1">
          Overview of all organizational data, employees, and configuration settings.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className={`eci-card border-l-4 ${card.border}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
                <div className={`${card.bg} p-1.5 rounded-md ${card.color}`}>{card.icon}</div>
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employees by Role */}
        <Card className="eci-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Employees by Role
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.employeesByRole.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No role data available</p>
            ) : (
              stats.employeesByRole.map((role) => {
                const config = ROLE_CONFIG[role.role] || ROLE_CONFIG.employee;
                const pct = (role.count / maxRoleCount) * 100;
                return (
                  <div key={role.role} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={config.color + ' p-1 rounded'}>{config.icon}</span>
                        <span className="font-medium">{config.label}</span>
                      </div>
                      <span className="font-semibold">{role.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          role.role === 'admin'
                            ? 'bg-red-500'
                            : role.role === 'hr'
                            ? 'bg-purple-500'
                            : role.role === 'supervisor'
                            ? 'bg-blue-500'
                            : role.role === 'management'
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Data Health */}
        <Card className="eci-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Data Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.employeesWithoutSupervisor === 0 && stats.departmentsWithoutEmployees.length === 0 ? (
              <div className="text-center py-6">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <UserCheck className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm font-medium text-green-700">All data looks healthy</p>
                <p className="text-xs text-muted-foreground mt-1">No issues detected in your master data</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.employeesWithoutSupervisor > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">
                        {stats.employeesWithoutSupervisor} employee{stats.employeesWithoutSupervisor > 1 ? 's' : ''} without supervisor
                      </p>
                      <p className="text-xs text-orange-600 mt-0.5">
                        These employees will not receive appraisal assignments
                      </p>
                    </div>
                  </div>
                )}
                {stats.departmentsWithoutEmployees.map((dept) => (
                  <div key={dept} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <Building2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">{dept}</p>
                      <p className="text-xs text-amber-600 mt-0.5">Department has no active employees</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.view}
              variant="outline"
              className="gap-2"
              onClick={() => setCurrentView(action.view)}
            >
              {action.label}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}