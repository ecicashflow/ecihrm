'use client';

import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  RefreshCw,
  Users,
  Building2,
  Briefcase,
  FileText,
  Bell,
  BarChart3,
  Settings,
  ChevronLeft,
  Database,
  Star,
  ListChecks,
  ClipboardList,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  view: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  showBadge?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  roles: string[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Main',
    icon: LayoutDashboard,
    roles: ['admin', 'supervisor', 'management', 'employee'],
    items: [
      { view: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'supervisor', 'management', 'employee'] },
    ],
  },
  {
    label: 'Master Data',
    icon: Database,
    roles: ['admin'],
    items: [
      { view: 'master-data' as const, label: 'Overview', icon: Database, roles: ['admin'] },
      { view: 'employees' as const, label: 'Employees & Users', icon: Users, roles: ['admin'] },
      { view: 'departments' as const, label: 'Departments', icon: Building2, roles: ['admin'] },
      { view: 'designations' as const, label: 'Designations', icon: Briefcase, roles: ['admin'] },
      { view: 'rating-scales' as const, label: 'Rating Scales', icon: Star, roles: ['admin'] },
      { view: 'appraisal-categories' as const, label: 'Appraisal Categories', icon: ListChecks, roles: ['admin'] },
    ],
  },
  {
    label: 'Appraisal',
    icon: ClipboardList,
    roles: ['admin', 'supervisor', 'management', 'employee'],
    items: [
      { view: 'cycles' as const, label: 'Appraisal Cycles', icon: RefreshCw, roles: ['admin'] },
      { view: 'appraisal-list' as const, label: 'Appraisals', icon: FileText, roles: ['admin', 'supervisor', 'management', 'employee'] },
    ],
  },
  {
    label: 'Communication',
    icon: Bell,
    roles: ['admin', 'supervisor', 'management', 'employee'],
    items: [
      { view: 'notifications' as const, label: 'Notifications', icon: Bell, roles: ['admin', 'supervisor', 'management', 'employee'], showBadge: true },
    ],
  },
  {
    label: 'Reports & Settings',
    icon: BarChart3,
    roles: ['admin', 'management', 'supervisor', 'employee'],
    items: [
      { view: 'reports' as const, label: 'Reports', icon: BarChart3, roles: ['admin', 'management'] },
      { view: 'audit-logs' as const, label: 'Audit Logs', icon: Shield, roles: ['admin'] },
      { view: 'settings' as const, label: 'Settings', icon: Settings, roles: ['admin', 'supervisor', 'management', 'employee'] },
    ],
  },
];

export default function AppSidebar() {
  const { currentUser, currentView, setCurrentView, sidebarOpen, setSidebarOpen, unreadCount } = useAppStore();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0 shrink-0">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <img src="/eci-logo.jpg" alt="ECI" className="w-9 h-9 object-contain" />
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">ECI HRM</p>
          <p className="text-xs text-sidebar-foreground/60 truncate">Performance Appraisal</p>
        </div>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-1 px-2">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !currentUser || item.roles.includes(currentUser.role)
            );
            if (visibleItems.length === 0) return null;

            const isCollapsed = collapsedGroups[group.label] || false;
            const GroupIcon = group.icon;

            return (
              <div key={group.label} className="mt-3 first:mt-0">
                {/* Group Header */}
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors"
                  onClick={() => toggleGroup(group.label)}
                >
                  <GroupIcon className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 transition-transform',
                      isCollapsed && '-rotate-90'
                    )}
                  />
                </button>

                {/* Group Items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 mt-0.5">
                    {visibleItems.map((item) => {
                      const isActive = currentView === item.view;
                      return (
                        <Button
                          key={item.view}
                          variant="ghost"
                          className={cn(
                            'w-full justify-start gap-3 h-9 text-sm relative ml-1',
                            isActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                          )}
                          onClick={() => setCurrentView(item.view as 'dashboard')}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {item.showBadge && unreadCount > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-1.5 min-w-5 text-center">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground"
          onClick={() => setSidebarOpen(false)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}