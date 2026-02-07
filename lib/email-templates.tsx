import * as React from 'react';

interface LessonReminderProps {
  studentName: string;
  lessonType: string;
  lessonDate: string; // e.g., "Tuesday, February 10, 2026"
  lessonTime: string; // e.g., "2:00 PM"
  locationType: 'in-person' | 'zoom';
  locationAddress?: string | null;
  zoomJoinUrl?: string | null;
  hoursUntil: number; // 24 or 1
  appUrl: string;
}

export function LessonReminderEmail({
  studentName,
  lessonType,
  lessonDate,
  lessonTime,
  locationType,
  locationAddress,
  zoomJoinUrl,
  hoursUntil,
  appUrl,
}: LessonReminderProps): React.ReactElement {
  const isUrgent = hoursUntil <= 1;
  const timeLabel = hoursUntil === 1 ? 'in 1 hour' : 'tomorrow';

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#4F46E5', padding: '24px', borderRadius: '8px 8px 0 0' }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: '24px' }}>
          🎵 Lesson Reminder
        </h1>
      </div>

      {/* Body */}
      <div style={{ backgroundColor: '#ffffff', padding: '24px', border: '1px solid #e5e7eb', borderTop: 'none' }}>
        <p style={{ fontSize: '16px', color: '#374151', margin: '0 0 16px' }}>
          Hi {studentName}! 👋
        </p>

        <p style={{ fontSize: '16px', color: '#374151', margin: '0 0 24px' }}>
          {isUrgent ? (
            <strong>Your voice lesson is coming up {timeLabel}!</strong>
          ) : (
            <>Just a friendly reminder that you have a voice lesson {timeLabel}.</>
          )}
        </p>

        {/* Lesson Details Card */}
        <div style={{ 
          backgroundColor: '#F9FAFB', 
          borderRadius: '8px', 
          padding: '20px',
          marginBottom: '24px',
          border: '1px solid #E5E7EB'
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '18px', color: '#111827' }}>
            Lesson Details
          </h2>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0', color: '#6B7280', width: '100px' }}>Type:</td>
                <td style={{ padding: '8px 0', color: '#111827', fontWeight: 500 }}>{lessonType}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#6B7280' }}>Date:</td>
                <td style={{ padding: '8px 0', color: '#111827', fontWeight: 500 }}>{lessonDate}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#6B7280' }}>Time:</td>
                <td style={{ padding: '8px 0', color: '#111827', fontWeight: 500 }}>{lessonTime} <span style={{ color: '#6B7280', fontWeight: 400 }}>(Pacific Time)</span></td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#6B7280' }}>Location:</td>
                <td style={{ padding: '8px 0', color: '#111827', fontWeight: 500 }}>
                  {locationType === 'zoom' ? '📹 Zoom (Online)' : '📍 In-Person'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Zoom Link or Address */}
          {locationType === 'zoom' && zoomJoinUrl && (
            <div style={{ marginTop: '16px' }}>
              <a
                href={zoomJoinUrl}
                style={{
                  display: 'inline-block',
                  backgroundColor: '#2563EB',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Join Zoom Meeting
              </a>
            </div>
          )}

          {locationType === 'in-person' && locationAddress && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: '#E0E7FF', borderRadius: '6px' }}>
                <p style={{ margin: 0, color: '#3730A3', fontSize: '14px' }}>
                  <strong>Address:</strong> {locationAddress}
                </p>
              </div>
              <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#FFF3CD', borderRadius: '6px', borderLeft: '3px solid #FFC107' }}>
                <p style={{ margin: 0, color: '#856404', fontSize: '13px' }}>
                  <strong>Note:</strong> Additional fees may apply to accommodate driving costs.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* View Schedule Button */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <a
            href={`${appUrl}/lessons`}
            style={{
              display: 'inline-block',
              backgroundColor: '#4F46E5',
              color: 'white',
              padding: '12px 32px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            View Your Schedule
          </a>
        </div>

        {hoursUntil === 24 && (
          <p style={{ fontSize: '14px', color: '#6B7280', margin: '0' }}>
            Need to reschedule? Please let me know as soon as possible.
          </p>
        )}
      </div>
    </div>
  );
}

// Plain text version for email clients that don't support HTML
export function getLessonReminderText({
  studentName,
  lessonType,
  lessonDate,
  lessonTime,
  locationType,
  locationAddress,
  zoomJoinUrl,
  hoursUntil,
  appUrl,
}: LessonReminderProps): string {
  const timeLabel = hoursUntil === 1 ? 'in 1 hour' : 'tomorrow';
  
  let text = `Hi ${studentName}!\n\n`;
  text += `Your voice lesson is coming up ${timeLabel}.\n\n`;
  text += `LESSON DETAILS\n`;
  text += `--------------\n`;
  text += `Type: ${lessonType}\n`;
  text += `Date: ${lessonDate}\n`;
  text += `Time: ${lessonTime} (Pacific Time)\n`;
  text += `Location: ${locationType === 'zoom' ? 'Zoom (Online)' : 'In-Person'}\n`;
  
  if (locationType === 'zoom' && zoomJoinUrl) {
    text += `\nJoin Zoom: ${zoomJoinUrl}\n`;
  }
  
  if (locationType === 'in-person' && locationAddress) {
    text += `Address: ${locationAddress}\n`;
    text += `\nNote: Additional fees may apply to accommodate driving costs.\n`;
  }
  
  text += `\nView your schedule: ${appUrl}/lessons\n\n`;

  if (hoursUntil === 24) {
    text += `Need to reschedule? Please let me know as soon as possible.`;
  }

  return text;
}
