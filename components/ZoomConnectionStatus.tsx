'use client';

import { useState, useEffect } from 'react';

interface ZoomStatus {
  connected: boolean;
  mode?: string;
}

export default function ZoomConnectionStatus() {
  const [status, setStatus] = useState<ZoomStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/zoom/status');
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to check Zoom status:', error);
        setStatus({ connected: false });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
        <span className="text-gray-600 dark:text-gray-300 text-sm">Checking Zoom...</span>
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-green-700 dark:text-green-400 text-sm font-medium">Zoom Connected</span>
        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  // Not configured - show warning
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
      <span className="text-yellow-700 dark:text-yellow-400 text-sm font-medium">
        Zoom not configured
      </span>
      <span className="text-yellow-600 dark:text-yellow-500 text-xs">
        (Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET)
      </span>
    </div>
  );
}
