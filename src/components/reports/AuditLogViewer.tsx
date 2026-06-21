'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { AuditLogItem } from '@/lib/types';

const statusColorMap: Record<string, string> = {
  assigned_to_employee: 'bg-blue-500',
  submitted_by_employee: 'bg-cyan-500',
  under_supervisor_review: 'bg-amber-500',
  submitted_by_supervisor: 'bg-yellow-500',
  under_hr_review: 'bg-purple-500',
  submitted_to_management: 'bg-indigo-500',
  under_management_review: 'bg-violet-500',
  returned_for_correction: 'bg-red-500',
  approved: 'bg-green-500',
  shared_with_employee: 'bg-emerald-500',
  acknowledged_by_employee: 'bg-teal-500',
  closed: 'bg-gray-400',
};

export default function AuditLogViewer() {
  const { viewParams, setCurrentView } = useAppStore();
  const assignmentId = viewParams?.id;

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assignmentId) return;
    async function fetchLogs() {
      try {
        const res = await fetch(`/api/audit-logs?assignmentId=${assignmentId}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch {
        // Server unavailable - show empty state gracefully
        console.warn('Server unavailable, showing empty audit log');
        setLogs([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [assignmentId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setCurrentView('appraisal-list')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">Audit Log</h2>
      </div>

      {/* Timeline */}
      <Card className="eci-card">
        <CardHeader>
          <CardTitle className="text-lg">Status History</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found for this assignment
            </div>
          ) : (
            <div className="relative pl-8">
              {/* Vertical line */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />

              <div className="space-y-6">
                {logs.map((log, index) => (
                  <div key={log.id} className="relative">
                    {/* Dot */}
                    <div
                      className={`absolute -left-5 top-1.5 w-4 h-4 rounded-full border-2 border-white ${
                        statusColorMap[log.newStatus] || 'bg-gray-400'
                      }`}
                    />

                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{log.action}</span>
                          <span className="text-xs text-muted-foreground">by {log.userName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>

                      {/* Status Change */}
                      {log.previousStatus && log.newStatus && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {log.previousStatus.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge className={`text-xs ${statusColorMap[log.newStatus] || ''} text-white`}>
                            {log.newStatus.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      )}

                      {/* Details */}
                      {log.details && (
                        <p className="text-sm text-muted-foreground mt-2 bg-white/50 p-2 rounded">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}