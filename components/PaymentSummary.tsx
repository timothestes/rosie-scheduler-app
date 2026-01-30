'use client';

import { useState, useEffect } from 'react';
import { formatRate, getLessonType, getWeeklyMonthlyRate } from '@/config/lessonTypes';

interface LessonDetail {
  id: string;
  lesson_type: string;
  start_time: string;
  is_recurring: boolean;
  recurring_series_id: string | null;
  paid_at: string;
  student_id: string;
  student: {
    full_name: string | null;
    email: string;
    discount_percent: number;
  };
}

interface PaymentData {
  totalAmount: number;
  totalDiscount: number;
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

  const handlePrint = async () => {
    if (!data) return;
    
    // Fetch lessons filtered by paid_at date range (for payment reports)
    const lessonsRes = await fetch(`/api/lessons?paidStartDate=${startDate}&paidEndDate=${endDate}`);
    if (!lessonsRes.ok) return;
    
    const paidLessons: LessonDetail[] = await lessonsRes.json();
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateRange = `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
    
    // Group lessons into payments:
    // - Non-recurring lessons: each lesson is a payment
    // - Recurring lessons: group by student + month + series = one monthly payment
    interface PaymentRow {
      paidDate: string;
      student: string;
      description: string;
      lessonCount: number;
      baseRate: number;
      discountPercent: number;
      discountAmount: number;
      finalAmount: number;
    }
    
    const payments: PaymentRow[] = [];
    const recurringPayments = new Map<string, { lessons: LessonDetail[], paidAt: Date }>();
    
    for (const lesson of paidLessons) {
      if (lesson.is_recurring && lesson.recurring_series_id) {
        // Group recurring lessons by student + series + month
        const lessonDate = new Date(lesson.start_time);
        const monthKey = `${lesson.student_id}-${lesson.recurring_series_id}-${lessonDate.getFullYear()}-${lessonDate.getMonth()}`;
        
        if (!recurringPayments.has(monthKey)) {
          recurringPayments.set(monthKey, { lessons: [], paidAt: new Date(lesson.paid_at) });
        }
        recurringPayments.get(monthKey)!.lessons.push(lesson);
        // Use earliest paid_at date for the payment
        const currentPaidAt = new Date(lesson.paid_at);
        if (currentPaidAt < recurringPayments.get(monthKey)!.paidAt) {
          recurringPayments.get(monthKey)!.paidAt = currentPaidAt;
        }
      } else {
        // Non-recurring: each lesson is a separate payment
        const lessonType = getLessonType(lesson.lesson_type);
        const baseRate = lessonType?.rate ?? 0;
        const discountPercent = lesson.student?.discount_percent || 0;
        const discountAmount = baseRate * (discountPercent / 100);
        const finalAmount = discountPercent > 0 ? Math.ceil(baseRate - discountAmount) : baseRate;
        
        payments.push({
          paidDate: new Date(lesson.paid_at).toLocaleDateString(),
          student: lesson.student?.full_name || lesson.student?.email || 'Unknown',
          description: `${lessonType?.name || lesson.lesson_type} - ${new Date(lesson.start_time).toLocaleDateString()}`,
          lessonCount: 1,
          baseRate,
          discountPercent,
          discountAmount: baseRate - finalAmount,
          finalAmount,
        });
      }
    }
    
    // Convert recurring groups into payment rows
    recurringPayments.forEach(({ lessons, paidAt }) => {
      const firstLesson = lessons[0];
      const lessonType = getLessonType(firstLesson.lesson_type);
      const monthlyRate = getWeeklyMonthlyRate(firstLesson.lesson_type);
      const discountPercent = firstLesson.student?.discount_percent || 0;
      const discountAmount = monthlyRate * (discountPercent / 100);
      const finalAmount = discountPercent > 0 ? Math.ceil(monthlyRate - discountAmount) : monthlyRate;
      
      const lessonDate = new Date(firstLesson.start_time);
      const monthName = lessonDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      payments.push({
        paidDate: paidAt.toLocaleDateString(),
        student: firstLesson.student?.full_name || firstLesson.student?.email || 'Unknown',
        description: `${lessonType?.name || firstLesson.lesson_type} - Monthly (${monthName})`,
        lessonCount: lessons.length,
        baseRate: monthlyRate,
        discountPercent,
        discountAmount: monthlyRate - finalAmount,
        finalAmount,
      });
    });
    
    // Sort by paid date
    payments.sort((a, b) => new Date(a.paidDate).getTime() - new Date(b.paidDate).getTime());
    
    const totalBase = payments.reduce((sum, r) => sum + r.baseRate, 0);
    const totalDiscount = payments.reduce((sum, r) => sum + r.discountAmount, 0);
    const totalFinal = payments.reduce((sum, r) => sum + r.finalAmount, 0);
    const totalLessons = payments.reduce((sum, r) => sum + r.lessonCount, 0);
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Report - ${dateRange}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; margin: 0 auto; font-size: 12px; }
          h1 { font-size: 20px; margin-bottom: 5px; }
          .date-range { color: #666; font-size: 12px; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
          th { background-color: #e0e0e0; font-weight: bold; }
          .amount { text-align: right; font-family: monospace; }
          .center { text-align: center; }
          .total-row { font-weight: bold; background-color: #f0f0f0; }
          .subtotal-row { background-color: #f5f5f5; }
          .print-date { font-size: 10px; color: #999; margin-top: 20px; text-align: right; }
          .summary-section { margin-bottom: 20px; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; }
          .summary-section h2 { margin: 0 0 10px 0; font-size: 14px; }
          @media print { 
            body { padding: 10px; } 
            @page { margin: 0.5in; }
          }
        </style>
      </head>
      <body>
        <h1>Payment Report</h1>
        <p class="date-range">Payments received: ${dateRange}</p>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Payment Date</th>
              <th>Student</th>
              <th>Description</th>
              <th class="center">Lessons</th>
              <th class="amount">Base Rate</th>
              <th class="center">Discount %</th>
              <th class="amount">Discount</th>
              <th class="amount">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map((row, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${row.paidDate}</td>
              <td>${row.student}</td>
              <td>${row.description}</td>
              <td class="center">${row.lessonCount}</td>
              <td class="amount">$${row.baseRate.toFixed(2)}</td>
              <td class="center">${row.discountPercent > 0 ? row.discountPercent + '%' : '-'}</td>
              <td class="amount">${row.discountAmount > 0 ? '-$' + row.discountAmount.toFixed(2) : '-'}</td>
              <td class="amount">$${row.finalAmount.toFixed(2)}</td>
            </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="4" style="text-align: right;">TOTALS:</td>
              <td class="center">${totalLessons}</td>
              <td class="amount">$${totalBase.toFixed(2)}</td>
              <td class="center">-</td>
              <td class="amount">${totalDiscount > 0 ? '-$' + totalDiscount.toFixed(2) : '-'}</td>
              <td class="amount">$${totalFinal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="summary-section">
          <h2>Summary</h2>
          <table style="width: auto;">
            <tr><td>Total Payments:</td><td class="amount"><strong>${payments.length}</strong></td></tr>
            <tr><td>Total Lessons:</td><td class="amount"><strong>${totalLessons}</strong></td></tr>
            <tr><td>Gross Amount:</td><td class="amount">$${totalBase.toFixed(2)}</td></tr>
            <tr><td>Total Discounts:</td><td class="amount">-$${totalDiscount.toFixed(2)}</td></tr>
            <tr class="total-row"><td>Net Received:</td><td class="amount"><strong>$${totalFinal.toFixed(2)}</strong></td></tr>
          </table>
        </div>

        ${data.recurring && data.recurring.activeStudents > 0 ? `
        <div class="summary-section">
          <h2>Monthly Recurring Revenue</h2>
          <table style="width: auto;">
            <tr><td>Active Recurring Students:</td><td class="amount"><strong>${data.recurring.activeStudents}</strong></td></tr>
            <tr><td>Expected Monthly Revenue:</td><td class="amount"><strong>$${data.recurring.monthlyRevenue.toFixed(2)}/mo</strong></td></tr>
          </table>
        </div>
        ` : ''}

        <p class="print-date">Generated on ${new Date().toLocaleString()}</p>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

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
      <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Summary</h2>
        {data && !loading && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        )}
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
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">${data.totalAmount.toFixed(2)}</p>
                {data.totalDiscount > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    after ${data.totalDiscount.toFixed(2)} in discounts
                  </p>
                )}
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Paid Lessons</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.lessonCount}</p>
              </div>
            </div>

            {/* Discounts Applied */}
            {data.totalDiscount > 0 && (
              <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center">
                      <span className="mr-2">🏷️</span> Student Discounts Applied
                    </h3>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Total savings given to students in this period
                    </p>
                  </div>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    -${data.totalDiscount.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

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
                      ${data.recurring.monthlyRevenue.toFixed(2)}/mo
                    </p>
                    <p className="text-xs text-indigo-500 dark:text-indigo-400">
                      from {data.recurring.activeStudents} active student{data.recurring.activeStudents !== 1 ? 's' : ''} (after discounts)
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-600 dark:text-purple-400">Recurring in Period</p>
                    <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                      ${data.recurring.amount.toFixed(2)}
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
