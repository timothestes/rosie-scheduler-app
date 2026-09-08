import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createZoomMeeting, deleteZoomMeeting } from '@/lib/zoom';
import { deleteGoogleCalendarEvent, updateGoogleCalendarEvent } from '@/lib/google-calendar';
import { getLessonDuration, getLessonType } from '@/config/lessonTypes';
import {
  buildCalendarDescription,
  buildCalendarLocation,
  formatRecurringPosition,
  planLessonEditSync,
} from '@/lib/lesson-calendar';
import { sendCancellationNotification } from '@/lib/cancellation-notification';

// GET /api/lessons/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('lessons')
    .select('*, student:users!lessons_student_id_fkey(*)')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  // Check authorization
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!admin && data.student_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  return NextResponse.json(data);
}

// PATCH /api/lessons/[id] - Update a lesson
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

  const body = await request.json();

  // Get the lesson
  const { data: lesson } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', id)
    .single();

  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  // Check authorization
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  const isOwner = lesson.student_id === user.id;
  const isAdmin = !!admin;

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Students can only update certain fields
  const allowedFields = isAdmin
    ? ['status', 'is_paid', 'notes', 'location_type', 'location_address', 'cancelled_at', 'cancellation_reason']
    : ['status', 'notes', 'cancelled_at', 'cancellation_reason'];

  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  // Set paid_at timestamp when marking as paid
  if (body.is_paid === true && !lesson.is_paid) {
    updates.paid_at = new Date().toISOString();
    
    // For recurring lessons, mark ALL lessons in the same month as paid (monthly billing)
    if (lesson.is_recurring && lesson.recurring_series_id) {
      // Get the month of the current lesson
      const lessonDate = new Date(lesson.start_time);
      const year = lessonDate.getFullYear();
      const month = lessonDate.getMonth();
      const monthStart = new Date(year, month, 1).toISOString();
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
      
      // Update all lessons in the same recurring series for this month
      await supabase
        .from('lessons')
        .update({
          is_paid: true,
          paid_at: new Date().toISOString()
        })
        .eq('recurring_series_id', lesson.recurring_series_id)
        .gte('start_time', monthStart)
        .lte('start_time', monthEnd)
        .eq('is_paid', false);
    }
  } else if (body.is_paid === false) {
    updates.paid_at = null;
    
    // For recurring lessons, unmark ALL lessons in the same month as unpaid (monthly billing)
    if (lesson.is_recurring && lesson.recurring_series_id) {
      const lessonDate = new Date(lesson.start_time);
      const year = lessonDate.getFullYear();
      const month = lessonDate.getMonth();
      const monthStart = new Date(year, month, 1).toISOString();
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
      
      await supabase
        .from('lessons')
        .update({
          is_paid: false,
          paid_at: null
        })
        .eq('recurring_series_id', lesson.recurring_series_id)
        .gte('start_time', monthStart)
        .lte('start_time', monthEnd)
        .eq('is_paid', true);
    }
  }

  // Handle cancellation
  if (body.status === 'cancelled') {
    updates.cancelled_at = new Date().toISOString();
    updates.cancelled_by = user.id;

    // Delete Zoom meeting if exists
    if (lesson.zoom_meeting_id && lesson.admin_id) {
      await deleteZoomMeeting(lesson.admin_id, lesson.zoom_meeting_id);
    }

    // Delete Google Calendar event if exists
    if (lesson.google_calendar_event_id && lesson.admin_id) {
      await deleteGoogleCalendarEvent(lesson.admin_id, lesson.google_calendar_event_id);
    }

    // Cancel all future lessons in series if requested
    if (body.cancel_series && lesson.recurring_series_id) {
      const { data: futureLessons } = await supabase
        .from('lessons')
        .select('id, zoom_meeting_id, google_calendar_event_id, admin_id')
        .eq('recurring_series_id', lesson.recurring_series_id)
        .neq('id', id)
        .gt('start_time', lesson.start_time)
        .eq('status', 'scheduled');

      if (futureLessons && futureLessons.length > 0) {
        // Cancel each future lesson and clean up integrations
        for (const futureLesson of futureLessons) {
          // Delete Zoom meeting
          if (futureLesson.zoom_meeting_id && futureLesson.admin_id) {
            await deleteZoomMeeting(futureLesson.admin_id, futureLesson.zoom_meeting_id);
          }
          // Delete Google Calendar event
          if (futureLesson.google_calendar_event_id && futureLesson.admin_id) {
            await deleteGoogleCalendarEvent(futureLesson.admin_id, futureLesson.google_calendar_event_id);
          }
        }

        // Batch update all future lessons to cancelled
        await supabase
          .from('lessons')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            cancellation_reason: body.cancellation_reason || 'Series cancelled',
          })
          .eq('recurring_series_id', lesson.recurring_series_id)
          .neq('id', id)
          .gt('start_time', lesson.start_time)
          .eq('status', 'scheduled');
      }
    }
  }

  // Keep Zoom in step with an edit that moves the lesson between Zoom and
  // in-person. Cancellations are handled above; the planner also leaves past
  // and already-cancelled lessons alone. Best-effort: never fail the response.
  const syncPlan = planLessonEditSync(lesson, updates);

  if (syncPlan.zoom === 'create' && lesson.admin_id) {
    try {
      const meeting = await createZoomMeeting(
        lesson.admin_id,
        `${getLessonType(lesson.lesson_type)?.name || 'Lesson'} - Rosie Scheduler`,
        new Date(lesson.start_time),
        getLessonDuration(lesson.lesson_type),
        (updates.notes ?? lesson.notes) || undefined
      );
      if (meeting) {
        updates.zoom_meeting_id = String(meeting.id);
        updates.zoom_join_url = meeting.join_url;
      }
    } catch (err) {
      console.error('Lesson edit: Zoom meeting creation failed:', err);
    }
  } else if (syncPlan.zoom === 'delete' && lesson.admin_id && lesson.zoom_meeting_id) {
    try {
      await deleteZoomMeeting(lesson.admin_id, lesson.zoom_meeting_id);
    } catch (err) {
      console.error('Lesson edit: Zoom meeting deletion failed:', err);
    }
    // The lesson is no longer virtual, so drop the link even if Zoom rejected
    // the delete — nobody should be handed a meeting that isn't happening.
    updates.zoom_meeting_id = null;
    updates.zoom_join_url = null;
  }

  const { data, error } = await supabase
    .from('lessons')
    .update(updates)
    .eq('id', id)
    .select('*, student:users!lessons_student_id_fkey(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the student when this specific cancellation was explicitly flagged
  // for it (currently: the admin "Block Out Days -> also cancel these lessons"
  // flow). Opt-in per request so every other caller of this route — the
  // regular cancel-lesson modal, students cancelling their own lesson — keeps
  // its existing silent behavior. Best-effort: never fail the response.
  if (body.status === 'cancelled' && body.notify_cancellation === true && data.student?.email) {
    try {
      await sendCancellationNotification({
        studentEmail: data.student.email,
        studentName: data.student.full_name || data.student.email,
        start: data.start_time,
        lessonTypeName: getLessonType(data.lesson_type)?.name || 'Lesson',
        reason: data.cancellation_reason,
      });
    } catch (err) {
      console.error('Lesson cancel: notification failed:', err);
    }
  }

  // Google Calendar: rewrite the saved event's location and description in
  // place. Title is untouched — an edit changes neither type nor student.
  if (syncPlan.calendar && lesson.admin_id && lesson.google_calendar_event_id) {
    try {
      let recurringPosition: string | null = null;
      if (data.is_recurring && data.recurring_series_id) {
        const { data: series } = await supabase
          .from('lessons')
          .select('start_time')
          .eq('recurring_series_id', data.recurring_series_id);

        if (series) {
          recurringPosition = formatRecurringPosition(
            series.map((l) => l.start_time),
            data.start_time
          );
        }
      }

      const fields = {
        lessonTypeName: getLessonType(data.lesson_type)?.name || 'Lesson',
        studentName: data.student?.full_name || data.student?.email || 'Student',
        locationType: data.location_type,
        locationAddress: data.location_address,
        notes: data.notes,
        zoomJoinUrl: data.zoom_join_url,
        isRecurring: data.is_recurring,
        recurringPosition,
      };

      await updateGoogleCalendarEvent(lesson.admin_id, lesson.google_calendar_event_id, {
        startTime: new Date(data.start_time),
        endTime: new Date(data.end_time),
        description: buildCalendarDescription(fields),
        location: buildCalendarLocation(fields),
      });
    } catch (err) {
      console.error('Lesson edit: Google Calendar update failed:', err);
    }
  }

  return NextResponse.json(data);
}

// DELETE /api/lessons/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admins can delete lessons
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
