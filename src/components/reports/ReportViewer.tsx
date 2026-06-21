'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, FileSpreadsheet, Sparkles, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import type { CycleDetail } from '@/lib/types';

interface ReportData {
  summary: {
    totalEmployees: number;
    totalAppraised: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
  };
  ratingDistribution: { name: string; value: number; color: string }[];
  departmentComparison: { name: string; avgScore: number; total: number; completed: number }[];
}

const RATING_COLORS = ['#16a34a', '#2563eb', '#ca8a04', '#ea580c', '#dc2626'];

export default function ReportViewer() {
  const { currentUser } = useAppStore();
  const isAdmin = currentUser?.role === 'admin';
  const [cycles, setCycles] = useState<CycleDetail[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedCycle, setSelectedCycle] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [selectedCycle, selectedDept]);

  async function fetchFilters() {
    try {
      const [cycleRes, deptRes] = await Promise.all([
        fetch('/api/cycles'),
        fetch('/api/departments'),
      ]);
      if (cycleRes.ok) setCycles((await cycleRes.json()).cycles || []);
      if (deptRes.ok) setDepartments((await deptRes.json()).departments || []);
    } catch {
      // Server unavailable - show empty state gracefully
      console.warn('Server unavailable, using empty filters');
      setCycles([]);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReport() {
    try {
      const params = new URLSearchParams();
      if (selectedCycle !== 'all') params.set('cycleId', selectedCycle);
      if (selectedDept !== 'all') params.set('department', selectedDept);
      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch {
      // silently fail
    }
  }

  const handleAiAnalysis = async () => {
    setAiLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCycle !== 'all') params.set('cycleId', selectedCycle);
      const res = await fetch(`/api/ai/cycle-summary?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.summary || 'No analysis available.');
      } else {
        toast.error('Failed to generate AI analysis');
      }
    } catch {
      toast.error('Failed to generate AI analysis');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Reports & Analytics</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const params = new URLSearchParams();
              if (selectedCycle !== 'all') params.set('cycleId', selectedCycle);
              if (selectedDept !== 'all') params.set('department', selectedDept);
              window.open(`/api/reports/export?type=excel&${params.toString()}`, '_blank');
            }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedCycle} onValueChange={setSelectedCycle}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select Cycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cycles</SelectItem>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedDept} onValueChange={setSelectedDept}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={handleAiAnalysis} disabled={aiLoading}>
            <Sparkles className="h-4 w-4 mr-2" />
            {aiLoading ? 'Analyzing...' : 'AI Analysis'}
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="eci-card">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Employees</p>
              <p className="text-2xl font-bold">{reportData.summary.totalEmployees}</p>
            </CardContent>
          </Card>
          <Card className="eci-card">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Appraised</p>
              <p className="text-2xl font-bold">{reportData.summary.totalAppraised}</p>
            </CardContent>
          </Card>
          <Card className="eci-card">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Average Score</p>
              <p className="text-2xl font-bold">{reportData.summary.averageScore}%</p>
            </CardContent>
          </Card>
          <Card className="eci-card">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Highest</p>
              <p className="text-2xl font-bold text-green-600">{reportData.summary.highestScore}%</p>
            </CardContent>
          </Card>
          <Card className="eci-card">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Lowest</p>
              <p className="text-2xl font-bold text-red-600">{reportData.summary.lowestScore}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <Card className="eci-card">
          <CardHeader>
            <CardTitle className="text-lg">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {reportData?.ratingDistribution && reportData.ratingDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={reportData.ratingDistribution}
                    cx="50%"
                    cy="50%"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {reportData.ratingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department Comparison */}
        <Card className="eci-card">
          <CardHeader>
            <CardTitle className="text-lg">Department-wise Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {reportData?.departmentComparison && reportData.departmentComparison.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData.departmentComparison} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Avg Score']} />
                  <Bar dataKey="avgScore" fill="#1a3a5c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Summary (admin only) */}
      {isAdmin && aiSummary && (
        <Card className="eci-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-eci-blue" />
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg">
              {aiSummary}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}