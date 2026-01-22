'use client';

import { useState, useEffect } from 'react';
import { formatRate } from '@/config/lessonTypes';

interface PaymentData {
  totalAmount: number;
  lessonCount: number;
  byType: { [key: string]: { count: number; amount: number; name: string } };
  recurring: {
    amount: number;
    count: number;
    monthlyRevenue: number;
    activeStudents: number;
  };
}

type QuickRange = 'mtd' | '1m' | '2m' | '3m' | '1y' | '3y' | 'custom';

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDateRangeForQuickSelect(range: QuickRange): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  
  switch (range) {
    case 'mtd':
      return { start: getStartOfMonth(now), end };
    case '1m': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      return { start, end };
    }
    case '2m': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 2);
      return { start, end };
    }
    case '3m': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      return { start, end };
    }
    case '1y': {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      return { start, end };
    }
    case '3y': {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 3);
      return { start, end };
    }
    default:
      return { start: getStartOfMonth(now), end };
  }
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function PaymentSummary() {
  const [quickRange, setQuickRange] = useState<QuickRange>('mtd');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize dates on mount and when quickRange changes
  useEffect(() => {
    if (quickRange !== 'custom') {
      const { start, end } = getDateRangeForQuickSelect(quickRange);
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(end));
    }
  }, [quickRange]);

  // Fetch data when dates are set
  useEffect(() => {
    // Don't fetch until we have valid dates
    if (!startDate || !endDate) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          startDate,
          endDate,
        });
        const response = await fetch(`/api/payments/summary?${params}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Error fetching payment data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  const quickButtons: { label: string; value: QuickRange }[] = [
    { label: 'MTD', value: 'mtd' },
    { label: '1 Month', value: '1m' },
    { label: '2 Months', value: '2m' },
    { label: '3 Months', value: '3m' },
    { label: '1 Year', value: '1y' },
    { label: '3 Years', value: '3y' },
    { label: 'Custom', value: 'custom' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-6 py-4 border-b dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Summary</h2>
      </div>
      
      <div className="p-6">
        {/* Quick Range Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {quickButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setQuickRange(btn.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                quickRange === btn.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {quickRange === 'custom' && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Date Range Display */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Showing payments from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : data ? (
          <div>
            {/* Total Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Total Received</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">${data.totalAmount}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Paid Lessons</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.lessonCount}</p>
              </div>
            </div>

            {/* Recurring Revenue */}
            {data.recurring && data.recurring.activeStudents > 0 && (
              <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 mb-3 flex items-center">
                  <span className="mr-2">🔄</span> Monthly Recurring Revenue
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">Expected Monthly</p>
                    <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                      ${data.recurring.monthlyRevenue}/mo
                    </p>
                    <p className="text-xs text-indigo-500 dark:text-indigo-400">
                      from {data.recurring.activeStudents} active student{data.recurring.activeStudents !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-600 dark:text-purple-400">Recurring in Period</p>
                    <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                      ${data.recurring.amount}
                    </p>
                    <p className="text-xs text-purple-500 dark:text-purple-400">
                      {data.recurring.count} lesson{data.recurring.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Breakdown by Type */}
            {Object.keys(data.byType).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Breakdown by Lesson Type</h3>
                <div className="space-y-2">
                  {Object.entries(data.byType).map(([typeId, typeData]) => (
                    <div
                      key={typeId}
                      className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
                    >
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{typeData.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">
                          ({typeData.count} lesson{typeData.count !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatRate(typeData.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.lessonCount === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                No paid lessons in this date range
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            Unable to load payment data
          </p>
        )}
      </div>
    </div>
  );
}
