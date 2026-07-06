import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getLessonDuration, getLessonType } from '@/config/lessonTypes';
import { updateZoomMeeting } from '@/lib/zoom';
import { updateGoogleCalendarEvent } from '@/lib/google-calendar';
import { checkOccurrenceConflicts } from '@/lib/conflicts';
import { sendRescheduleNotification } from '@/lib/reschedule-notification';

// PATCH /api/lessons/[id]/reschedule - move a single lesson to a new time.
// Admin-only. Side effects (Zoom, Calendar, email) are best-effort.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin-only
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { start_time, notify_student, lesson_type } = body as { start_time?: string; notify_student?: boolean; lesson_type?: string };

  if (!start_time) {
    return NextResponse.json({ error: 'start_time is required' }, { status: 400 });
  }
  const newStart = new Date(start_time);
  if (isNaN(newStart.getTime())) {
    return NextResponse.json({ error: 'Invalid start_time' }, { status: 400 });
  }

  // Load the lesson (with student for the email)
  const { data: lesson } = await supabase
    .from('lessons')
    .select('*, student:users!lessons_student_id_fkey(*)')
    .eq('id', id)
    .single();

  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  // Resolve the (optionally changed) lesson type. Unknown id → 400.
  let effectiveType: string = lesson.lesson_type;
  if (lesson_type && lesson_type !== lesson.lesson_type) {
    if (!getLessonType(lesson_type)) {
      return NextResponse.json({ error: 'Unknown lesson type' }, { status: 400 });
    }
    effectiveType = lesson_type;
  }

  const duration = getLessonDuration(effectiveType);
  const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);
  const oldStart = lesson.start_time;
  const typeChanged = effectiveType !== lesson.lesson_type;
  const newTypeName = getLessonType(effectiveType)?.name || effectiveType;

  // Re-check conflicts (advisory: log only, do not block — the client already
  // presented a conscious "Reschedule anyway" confirm). Excludes this lesson.
  try {
    const statuses = await checkOccurrenceConflicts([newStart], {
      duration,
      locationType: lesson.location_type,
      bookingStudentId: lesson.student_id,
      excludeLessonId: lesson.id,
    });
    if (statuses[0]?.status === 'conflict') {
      console.warn(`Reschedule of lesson ${id} proceeds over a ${statuses[0].reason} conflict`);
    }
  } catch (err) {
    console.error('Reschedule conflict re-check failed (continuing):', err);
  }

  // Persist the move
  const { data: updated, error } = await supabase
    .from('lessons')
    .update({
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      lesson_type: effectiveType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, student:users!lessons_student_id_fkey(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // --- Best-effort side effects (never fail the response) ---

  // Zoom: update the existing meeting in place (link preserved)
  if (lesson.zoom_meeting_id && lesson.admin_id) {
    try {
      await updateZoomMeeting(lesson.admin_id, lesson.zoom_meeting_id, {
        start_time: newStart,
        duration,
        ...(typeChanged ? { topic: `${newTypeName} - Rosie Scheduler` } : {}),
      });
    } catch (err) {
      console.error('Reschedule: Zoom update failed:', err);
    }
  }

  // Google Calendar: PATCH the event's start/end
  if (lesson.google_calendar_event_id && lesson.admin_id) {
    try {
      const gcalStudentName = lesson.student?.full_name || lesson.student?.email || 'Student';
      const recurringLabel = lesson.recurring_frequency === 'weekly' ? 'Weekly' : lesson.recurring_frequency === 'biweekly' ? 'Bi-Weekly' : 'Monthly';
      const gcalSummary = lesson.is_recurring
        ? `${recurringLabel}: ${newTypeName} with ${gcalStudentName}`
        : `${newTypeName} with ${gcalStudentName}`;
      await updateGoogleCalendarEvent(lesson.admin_id, lesson.google_calendar_event_id, {
        startTime: newStart,
        endTime: newEnd,
        ...(typeChanged ? { summary: gcalSummary } : {}),
      });
    } catch (err) {
      console.error('Reschedule: Google Calendar update failed:', err);
    }
  }

  // Notify the student (opt-in)
  if (notify_student && lesson.student?.email) {
    try {
      const lessonTypeInfo = getLessonType(effectiveType);
      await sendRescheduleNotification({
        studentEmail: lesson.student.email,
        studentName: lesson.student.full_name || lesson.student.email,
        oldStart,
        newStart: newStart.toISOString(),
        lessonTypeName: lessonTypeInfo?.name || effectiveType,
        locationLabel: lesson.location_type === 'zoom' ? 'Zoom' : (lesson.location_address || 'In-Person'),
        zoomUrl: lesson.zoom_join_url,
      });
    } catch (err) {
      console.error('Reschedule: student notification failed:', err);
    }
  }

  return NextResponse.json(updated);
}
