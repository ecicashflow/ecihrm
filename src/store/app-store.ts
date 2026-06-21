import { create } from 'zustand';
import type { AppView, EmployeeDetail, DashboardStats, NotificationItem } from '@/lib/types';

interface AppState {
  // Auth
  currentUser: EmployeeDetail | null;
  setCurrentUser: (user: EmployeeDetail | null) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;

  // Navigation
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  viewParams: Record<string, string>;
  setViewParams: (params: Record<string, string>) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;

  // Dashboard stats
  dashboardStats: DashboardStats | null;
  setDashboardStats: (stats: DashboardStats | null) => void;

  // Notifications
  notifications: NotificationItem[];
  setNotifications: (n: NotificationItem[]) => void;
  unreadCount: number;
  setUnreadCount: (n: number) => void;

  // Server status
  serverAvailable: boolean;
  setServerAvailable: (available: boolean) => void;

  // Global loading
  globalLoading: boolean;
  setGlobalLoading: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user, isLoggedIn: !!user }),
  isLoggedIn: false,
  setIsLoggedIn: (v) => set({ isLoggedIn: v }),

  currentView: 'login',
  setCurrentView: (view) => set({ currentView: view, viewParams: {} }),
  viewParams: {},
  setViewParams: (params) => set({ viewParams: params }),
  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  dashboardStats: null,
  setDashboardStats: (stats) => set({ dashboardStats: stats }),

  notifications: [],
  setNotifications: (n) => set({ notifications: n, unreadCount: n.filter(x => !x.isRead).length }),
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),

  serverAvailable: true,
  setServerAvailable: (available) => set({ serverAvailable: available }),

  globalLoading: false,
  setGlobalLoading: (v) => set({ globalLoading: v }),
}));