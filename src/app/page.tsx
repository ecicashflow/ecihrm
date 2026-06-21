'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Login view - loaded immediately (small, critical)
import LoginView from '@/components/auth/LoginView';

// Layout components - loaded after login (small)
import AppSidebar from '@/components/layout/AppSidebar';
import AppHeader from '@/components/layout/AppHeader';

// Lazy load ALL view components to reduce initial Turbopack compilation
const AdminDashboard = lazy(() => import('@/components/dashboards/AdminDashboard'));
const SupervisorDashboard = lazy(() => import('@/components/dashboards/SupervisorDashboard'));
const ManagementDashboard = lazy(() => import('@/components/dashboards/ManagementDashboard'));
const EmployeeDashboard = lazy(() => import('@/components/dashboards/EmployeeDashboard'));

const MasterDataOverview = lazy(() => import('@/components/master/MasterDataOverview'));
const EnhancedEmployeeList = lazy(() => import('@/components/master/EnhancedEmployeeList'));
const EnhancedEmployeeForm = lazy(() => import('@/components/master/EnhancedEmployeeForm'));
const EnhancedDepartmentList = lazy(() => import('@/components/master/EnhancedDepartmentList'));
const EnhancedDesignationList = lazy(() => import('@/components/master/EnhancedDesignationList'));
const RatingScaleManager = lazy(() => import('@/components/master/RatingScaleManager'));
const AppraisalCategoryManager = lazy(() => import('@/components/master/AppraisalCategoryManager'));

const CycleList = lazy(() => import('@/components/cycles/CycleList'));
const CycleForm = lazy(() => import('@/components/cycles/CycleForm'));
const CycleDetail = lazy(() => import('@/components/cycles/CycleDetail'));
const AppraisalList = lazy(() => import('@/components/appraisal/AppraisalList'));
const AppraisalForm = lazy(() => import('@/components/appraisal/AppraisalForm'));
const AppraisalView = lazy(() => import('@/components/appraisal/AppraisalView'));

const NotificationPanel = lazy(() => import('@/components/notifications/NotificationPanel'));
const ReportViewer = lazy(() => import('@/components/reports/ReportViewer'));
const AuditLogViewer = lazy(() => import('@/components/reports/AuditLogViewer'));
const SettingsView = lazy(() => import('@/components/settings/SettingsView'));

// Simple loading spinner for lazy-loaded components
function ViewLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-eci-blue border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function DashboardRouter() {
  const { currentUser } = useAppStore();
  const role = currentUser?.role;

  if (role === 'admin') return <AdminDashboard />;
  if (role === 'supervisor') return <SupervisorDashboard />;
  if (role === 'management') return <ManagementDashboard />;
  return <EmployeeDashboard />;
}

function ViewRouter() {
  const { currentView } = useAppStore();

  return (
    <Suspense fallback={<ViewLoader />}>
      {(() => {
        switch (currentView) {
          case 'dashboard':
            return <DashboardRouter />;
          // Master Data
          case 'master-data':
            return <MasterDataOverview />;
          case 'employees':
            return <EnhancedEmployeeList />;
          case 'employee-create':
          case 'employee-detail':
            return <EnhancedEmployeeForm />;
          case 'departments':
            return <EnhancedDepartmentList />;
          case 'designations':
            return <EnhancedDesignationList />;
          case 'rating-scales':
            return <RatingScaleManager />;
          case 'appraisal-categories':
            return <AppraisalCategoryManager />;
          // Appraisal
          case 'cycles':
            return <CycleList />;
          case 'cycle-create':
            return <CycleForm />;
          case 'cycle-detail':
            return <CycleDetail />;
          case 'appraisal-list':
            return <AppraisalList />;
          case 'appraisal-form':
            return <AppraisalForm />;
          case 'appraisal-view':
            return <AppraisalView />;
          // Other
          case 'notifications':
            return <NotificationPanel />;
          case 'reports':
            return <ReportViewer />;
          case 'audit-logs':
            return <AuditLogViewer />;
          case 'settings':
            return <SettingsView />;
          default:
            return <DashboardRouter />;
        }
      })()}
    </Suspense>
  );
}

function AppShell() {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && <AppSidebar />}
      <div className="flex-1 flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
          <ViewRouter />
        </main>
        <footer className="eci-gradient-header text-white text-center text-xs py-3 mt-auto">
          © 2025 ECI Pvt Ltd. All Rights Reserved. Performance Appraisal Management System
        </footer>
      </div>
    </div>
  );
}

export default function Home() {
  const { isLoggedIn, setCurrentUser, setIsLoggedIn, setCurrentView } = useAppStore();
  const [restoring, setRestoring] = useState(true);

  // Restore session from httpOnly cookie on mount / page refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const user = await res.json();
          if (user && !cancelled) {
            setCurrentUser(user);
            setIsLoggedIn(true);
            setCurrentView('dashboard');
          }
        }
      } catch {
        // Not logged in — leave store as-is (shows login view).
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCurrentUser, setIsLoggedIn, setCurrentView]);

  if (restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-eci-blue border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {isLoggedIn ? <AppShell /> : <LoginView />}
    </ErrorBoundary>
  );
}