'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  Award,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { NotificationItem } from '@/lib/types';
import { APPRAISAL_STATUS_LABELS, APPRAISAL_STATUS_COLORS } from '@/lib/constants';

const iconMap: Record<string, React.ElementType> = {
  assignment_created: FileText,
  status_changed: MessageSquare,
  deadline_reminder: Clock,
  returned: AlertTriangle,
  approved: Award,
  default: Bell,
};

export default function NotificationPanel() {
  const { currentUser, setCurrentView, setViewParams, setNotifications, setUnreadCount } = useAppStore();
  const [notifications, setLocalNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    fetchNotifications();
  }, [currentUser]);

  async function fetchNotifications() {
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser?.id}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.notifications || [];
        setLocalNotifications(items);
        setNotifications(items);
      }
    } catch {
      // Server unavailable - show empty state gracefully
      console.warn('Server unavailable, showing empty notification list');
      setLocalNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      const updated = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      setNotifications(updated);
    } catch {
      // silently fail
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch(`/api/notifications/mark-all-read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser?.id }) });
      setLocalNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClick = (notif: NotificationItem) => {
    if (!notif.isRead) handleMarkRead(notif.id);

    if (notif.assignmentId) {
      const isViewOnly =
        notif.title.toLowerCase().includes('approved') ||
        notif.title.toLowerCase().includes('shared');
      setCurrentView(isViewOnly ? 'appraisal-view' : 'appraisal-form');
      setViewParams({ id: notif.assignmentId });
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="bg-eci-blue text-white text-xs font-bold px-2 py-1 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markingAll}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Notification List */}
      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto eci-scroll">
        {notifications.length === 0 ? (
          <Card className="eci-card">
            <CardContent className="p-8 text-center">
              <BellOff className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No notifications</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notif) => {
            const IconComponent = iconMap[notif.type] || iconMap.default;
            return (
              <Card
                key={notif.id}
                className={`eci-card cursor-pointer transition-colors ${
                  notif.isRead ? 'opacity-70' : 'border-l-4 border-l-eci-blue'
                }`}
                onClick={() => handleClick(notif)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${notif.isRead ? 'bg-muted' : 'bg-eci-blue/10'}`}>
                    <IconComponent className={`h-5 w-5 ${notif.isRead ? 'text-muted-foreground' : 'text-eci-blue'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${notif.isRead ? 'text-muted-foreground' : 'font-medium'}`}>
                        {notif.title}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {notif.actionRequired && (
                        <span className="text-xs font-medium text-eci-blue">Action Required</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(notif.createdAt), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                  {!notif.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(notif.id);
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}