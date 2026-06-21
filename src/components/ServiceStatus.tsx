'use client';

import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { RefreshCw, WifiOff } from 'lucide-react';

export default function ServiceStatusBanner() {
  const serverAvailable = useAppStore((state) => state.serverAvailable);
  const setServerAvailable = useAppStore((state) => state.setServerAvailable);

  if (serverAvailable) {
    return null;
  }

  const handleReconnect = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        setServerAvailable(true);
      }
    } catch {
      // Server still unavailable, keep banner visible
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-amber-800 text-sm">
        <WifiOff className="w-4 h-4 shrink-0 text-amber-600" />
        <span>
          Server connection lost — showing demo data. Some features may be limited.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleReconnect}
        className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100 hover:text-amber-900 text-xs"
      >
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Reconnect
      </Button>
    </div>
  );
}
