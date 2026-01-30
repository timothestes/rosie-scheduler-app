import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { deleteZoomMeeting } from '@/lib/zoom';
import { deleteGoogleCalendarEvent } from '@/lib/google-calendar';

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
    ? ['status', 'is_paid', 'notes', 'location_type', 'cancelled_at', 'cancellation_reason']
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

  const { data, error } = await supabase
    .from('lessons')
    .update(updates)
    .eq('id', id)
    .select('*, student:users!lessons_student_id_fkey(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
