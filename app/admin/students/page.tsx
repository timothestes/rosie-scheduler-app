'use client';

import { useState, useEffect } from 'react';
import StudentCard from '@/components/StudentCard';
import Modal from '@/components/Modal';
import LessonCard from '@/components/LessonCard';
import { formatDate } from '@/lib/utils';
import type { User, Lesson, StudentNote } from '@/types';

interface StudentWithLessons {
  student: User;
  lessons: Lesson[];
  unpaidCount: number;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentWithLessons[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [studentLessons, setStudentLessons] = useState<Lesson[]>([]);
  const [studentNotes, setStudentNotes] = useState<StudentNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const [studentsRes, lessonsRes] = await Promise.all([
        fetch('/api/students'),
        fetch('/api/lessons'),
      ]);

      if (studentsRes.ok && lessonsRes.ok) {
        const studentsData: User[] = await studentsRes.json();
        const lessonsData: Lesson[] = await lessonsRes.json();

        const studentsWithLessons = studentsData.map((student) => {
          const studentLessons = lessonsData.filter((l) => l.student_id === student.id);
          const unpaidCount = studentLessons.filter(
            (l) => !l.is_paid && l.status === 'scheduled'
          ).length;

          return {
            student,
            lessons: studentLessons,
            unpaidCount,
          };
        });

        setStudents(studentsWithLessons);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudentDetails = async (studentId: string) => {
    try {
      const res = await fetch(`/api/students/${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setStudentLessons(data.lessons);
        setStudentNotes(data.notes);
      }
    } catch (error) {
      console.error('Error fetching student details:', error);
    }
  };

  const handleViewDetails = async (student: User) => {
    setSelectedStudent(student);
    setShowDetails(true);
    await fetchStudentDetails(student.id);
  };

  const handleAddNote = async () => {
    if (!selectedStudent || !newNote.trim()) return;

    try {
      const res = await fetch(`/api/students/${selectedStudent.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote }),
      });

      if (res.ok) {
        const data = await res.json();
        setStudentNotes((prev) => [data, ...prev]);
        setNewNote('');
      }
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleTogglePaid = async (lessonId: string, isPaid: boolean) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paid: isPaid }),
      });

      if (res.ok) {
        setStudentLessons((prev) =>
          prev.map((l) => (l.id === lessonId ? { ...l, is_paid: isPaid } : l))
        );
        // Update the main list too
        setStudents((prev) =>
          prev.map((s) => ({
            ...s,
            lessons: s.lessons.map((l) =>
              l.id === lessonId ? { ...l, is_paid: isPaid } : l
            ),
            unpaidCount: s.lessons.filter(
              (l) => l.id === lessonId ? !isPaid : (!l.is_paid && l.status === 'scheduled')
            ).length,
          }))
        );
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  const handleCancelLesson = async (lessonId: string) => {
    if (!confirm('Are you sure you want to cancel this lesson?')) return;

    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (res.ok) {
        setStudentLessons((prev) =>
          prev.map((l) => (l.id === lessonId ? { ...l, status: 'cancelled' } : l))
        );
      }
    } catch (error) {
      console.error('Error cancelling lesson:', error);
    }
  };

  const handleSendReminder = async (student: User) => {
    // Placeholder for email reminder functionality
    alert(`Balance reminder would be sent to ${student.email}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Students</h1>

      {students.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No students yet</p>
          <p className="text-sm text-gray-400 mt-2">
            Students will appear here once they sign up and book lessons
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map(({ student, lessons, unpaidCount }) => (
            <StudentCard
              key={student.id}
              student={student}
              lessons={lessons}
              unpaidCount={unpaidCount}
              onViewDetails={() => handleViewDetails(student)}
              onSendReminder={unpaidCount > 0 ? () => handleSendReminder(student) : undefined}
            />
          ))}
        </div>
      )}

      {/* Student Details Modal */}
      <Modal
        isOpen={showDetails}
        onClose={() => {
          setShowDetails(false);
          setSelectedStudent(null);
          setStudentLessons([]);
          setStudentNotes([]);
        }}
        title={selectedStudent?.full_name || selectedStudent?.email || 'Student Details'}
        size="xl"
      >
        {selectedStudent && (
          <div className="space-y-6">
            {/* Student Info */}
            <div className="flex items-center space-x-4">
              {selectedStudent.avatar_url ? (
                <img
                  src={selectedStudent.avatar_url}
                  alt={selectedStudent.full_name || ''}
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600 font-semibold text-2xl">
                    {(selectedStudent.full_name || selectedStudent.email)[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900">
                  {selectedStudent.full_name || 'No name'}
                </h3>
                <p className="text-gray-500">{selectedStudent.email}</p>
                {selectedStudent.phone && (
                  <p className="text-gray-500">{selectedStudent.phone}</p>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8">
                <button className="py-2 px-1 border-b-2 border-indigo-500 font-medium text-indigo-600">
                  Lessons ({studentLessons.length})
                </button>
              </nav>
            </div>

            {/* Lessons List */}
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {studentLessons.length > 0 ? (
                studentLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    isAdmin
                    onTogglePaid={handleTogglePaid}
                    onCancel={handleCancelLesson}
                  />
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No lessons</p>
              )}
            </div>

            {/* Notes Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Private Notes</h4>
              
              {/* Add Note */}
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>

              {/* Notes List */}
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {studentNotes.map((note) => (
                  <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700">{note.note}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(new Date(note.created_at))}
                    </p>
                  </div>
                ))}
                {studentNotes.length === 0 && (
                  <p className="text-sm text-gray-500 text-center">No notes yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
