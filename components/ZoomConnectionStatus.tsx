'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ZoomStatus {
  connected: boolean;
  expired?: boolean;
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

  if (status?.connected && !status.expired) {
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

  return (
    <Link
      href="/api/auth/zoom"
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.585 4.585C1.553 7.617 1.553 12.424 4.585 15.456L7.756 12.285L4.585 9.114V4.585ZM12 1.414L8.829 4.585H15.171L12 1.414ZM19.415 4.585V9.114L16.244 12.285L19.415 15.456C22.447 12.424 22.447 7.617 19.415 4.585ZM12 22.586L15.171 19.415H8.829L12 22.586ZM12 7.414C9.477 7.414 7.414 9.477 7.414 12C7.414 14.523 9.477 16.586 12 16.586C14.523 16.586 16.586 14.523 16.586 12C16.586 9.477 14.523 7.414 12 7.414Z"/>
      </svg>
      {status?.expired ? 'Reconnect Zoom' : 'Connect Zoom'}
    </Link>
  );
}
