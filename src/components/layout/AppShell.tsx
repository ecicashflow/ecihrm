'use client';

import { useAppStore } from '@/store/app-store';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import AppFooter from './AppFooter';
import LoginPage from './LoginPage';
import { cn } from '@/lib/utils';
import ServiceStatusBanner from '@/components/ServiceStatus';

export default function AppShell() {
  const { isLoggedIn, currentView } = useAppStore();

  // Show login page if not authenticated
  if (!isLoggedIn || currentView === 'login') {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-eci-grey-light">
      {/* Header */}
      <AppHeader />

      {/* Body: Sidebar + Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <ServiceStatusBanner />
          <div className="flex-1 overflow-y-auto eci-scroll p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              {/* Main content will be rendered here based on currentView */}
              <AppViewRouter />
            </div>
          </div>
          <AppFooter />
        </main>
      </div>
    </div>
  );
}

/**
 * Temporary placeholder that renders the current view name.
 * Future tasks will replace this with actual view components.
 */
function AppViewRouter() {
  const { currentView, viewParams } = useAppStore();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="eci-card p-8 max-w-md w-full">
        <h2 className="text-xl font-bold text-eci-blue mb-2">
          {viewLabel(currentView)}
        </h2>
        <p className="text-sm text-muted-foreground">
          This view is currently under development.
        </p>
        {Object.keys(viewParams).length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted px-3 py-1.5 rounded-md">
            Params: {JSON.stringify(viewParams)}
          </p>
        )}
      </div>
    </div>
  );
}

function viewLabel(view: string): string {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    cycles: 'Appraisal Cycles',
    cycle_create: 'Create Cycle',
    cycle_detail: 'Cycle Detail',
    employees: 'Employees',
    employee_create: 'Add Employee',
    employee_detail: 'Employee Detail',
    departments: 'Departments',
    designations: 'Designations',
    'appraisal-list': 'Appraisals',
    'appraisal-form': 'Appraisal Form',
    'appraisal-view': 'Appraisal View',
    notifications: 'Notifications',
    reports: 'Reports',
    settings: 'Settings',
    'audit-logs': 'Audit Logs',
  };
  return labels[view] || view;
}