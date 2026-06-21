'use client';

import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Menu,
  Bell,
  LogOut,
  User,
  ChevronRight,
} from 'lucide-react';

const viewLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  cycles: 'Appraisal Cycles',
  'cycle-create': 'Create Cycle',
  'cycle-detail': 'Cycle Detail',
  employees: 'Employees',
  'employee-create': 'Create Employee',
  'employee-detail': 'Employee Detail',
  departments: 'Departments',
  designations: 'Designations',
  'appraisal-list': 'Appraisals',
  'appraisal-form': 'Appraisal Form',
  'appraisal-view': 'View Appraisal',
  notifications: 'Notifications',
  reports: 'Reports',
  settings: 'Settings',
  'audit-logs': 'Audit Log',
};

export default function AppHeader() {
  const {
    currentUser,
    currentView,
    sidebarOpen,
    setSidebarOpen,
    setCurrentView,
    setCurrentUser,
    setIsLoggedIn,
    unreadCount,
    notifications,
  } = useAppStore();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore — proceed with client-side logout anyway
    }
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-30">
      {/* Left: Menu + Breadcrumb */}
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">ECI HRM</span>
          {currentView !== 'dashboard' && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{viewLabels[currentView] || currentView}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Notifications Bell */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative"
          onClick={() => setCurrentView('notifications')}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-3">
              <div className="h-7 w-7 rounded-full bg-eci-blue text-white flex items-center justify-center text-xs font-bold">
                {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-xs font-medium leading-tight">{currentUser?.name || 'User'}</span>
                <span className="text-xs text-muted-foreground leading-tight capitalize">{currentUser?.role || ''}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{currentUser?.name}</p>
                <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCurrentView('settings')}>
              <User className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}