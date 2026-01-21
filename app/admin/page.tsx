import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/utils';
import { getLessonType, formatRate } from '@/config/lessonTypes';

export default async function AdminDashboard() {
  const supabase = await createClient();
  
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get upcoming lessons
  const { data: upcomingLessons } = await supabase
    .from('lessons')
    .select('*, student:users!lessons_student_id_fkey(*)')
    .gte('start_time', startOfToday.toISOString())
    .lte('start_time', endOfWeek.toISOString())
    .eq('status', 'scheduled')
    .order('start_time', { ascending: true })
    .limit(5);

  // Get total stats
  const { count: totalUpcoming } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .gte('start_time', now.toISOString())
    .eq('status', 'scheduled');

  const { count: unpaidCount } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .eq('is_paid', false)
    .eq('status', 'scheduled');

  const { count: todayCount } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .gte('start_time', startOfToday.toISOString())
    .lt('start_time', new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000).toISOString())
    .eq('status', 'scheduled');

  const { count: studentCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  // Get recent activity (last 5 bookings)
  const { data: recentBookings } = await supabase
    .from('lessons')
    .select('*, student:users!lessons_student_id_fkey(*)')
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Today&apos;s Lessons</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{todayCount || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Upcoming Lessons</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{totalUpcoming || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Unpaid Lessons</p>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500 mt-2">{unpaidCount || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Students</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{studentCount || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Lessons */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Lessons</h2>
            <Link href="/admin/calendar" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
              View Calendar →
            </Link>
          </div>
          <div className="divide-y dark:divide-gray-700">
            {upcomingLessons && upcomingLessons.length > 0 ? (
              upcomingLessons.map((lesson) => {
                const lessonType = getLessonType(lesson.lesson_type);
                return (
                  <div key={lesson.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {lesson.student?.full_name || lesson.student?.email || 'Unknown Student'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(new Date(lesson.start_time))} at {formatTime(new Date(lesson.start_time))}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {lessonType?.name} • {lesson.location_type === 'zoom' ? '📹 Zoom' : '📍 In-Person'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        lesson.is_paid 
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' 
                          : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
                      }`}>
                        {lesson.is_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                No upcoming lessons this week
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Bookings</h2>
            <Link href="/admin/students" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
              View Students →
            </Link>
          </div>
          <div className="divide-y dark:divide-gray-700">
            {recentBookings && recentBookings.length > 0 ? (
              recentBookings.map((lesson) => {
                const lessonType = getLessonType(lesson.lesson_type);
                return (
                  <div key={lesson.id} className="px-6 py-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {lesson.student?.full_name || lesson.student?.email}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Booked {lessonType?.name || lesson.lesson_type}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        lesson.status === 'scheduled' 
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                          : lesson.status === 'cancelled'
                            ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>
                        {lesson.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatDate(new Date(lesson.start_time))} at {formatTime(new Date(lesson.start_time))}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                No recent bookings
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/calendar"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
          >
            Manage Availability
          </Link>
          <Link
            href="/admin/students"
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            View All Students
          </Link>
        </div>
      </div>
    </div>
  );
}
