'use client';

import { useState, useEffect } from 'react';
import StudentCard from '@/components/StudentCard';
import Modal from '@/components/Modal';
import LessonCard from '@/components/LessonCard';
import CancelLessonModal from '@/components/CancelLessonModal';
import { formatDate } from '@/lib/utils';
import { getLessonType } from '@/config/lessonTypes';
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
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [lessonToCancel, setLessonToCancel] = useState<Lesson | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);
  const [studentAddress, setStudentAddress] = useState<string>('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

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
    setDiscountPercent(student.discount_percent || 0);
    setStudentAddress(student.address || '');
    setIsEditingDiscount(false);
    setIsEditingAddress(false);
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
    // Optimistic update - update UI immediately
    setStudentLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, is_paid: isPaid } : l))
    );

    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paid: isPaid }),
      });

      if (res.ok) {
        // Refetch all data to get updated paid status for recurring series
        await fetchStudents();
        if (selectedStudent) {
          await fetchStudentDetails(selectedStudent.id);
        }
      } else {
        // Revert on failure
        setStudentLessons((prev) =>
          prev.map((l) => (l.id === lessonId ? { ...l, is_paid: !isPaid } : l))
        );
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
      // Revert on error
      setStudentLessons((prev) =>
        prev.map((l) => (l.id === lessonId ? { ...l, is_paid: !isPaid } : l))
      );
    }
  };

  const openCancelModal = (lessonId: string) => {
    const lesson = studentLessons.find((l) => l.id === lessonId);
    if (lesson) {
      setLessonToCancel(lesson);
      setCancelModalOpen(true);
    }
  };

  const handleCancelLesson = async (cancelSeries?: boolean) => {
    if (!lessonToCancel) return;

    const res = await fetch(`/api/lessons/${lessonToCancel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancel_series: cancelSeries }),
    });

    if (res.ok) {
      if (cancelSeries && lessonToCancel.recurring_series_id) {
        // Update all future lessons in the series locally
        const updateLessons = (lessons: Lesson[]) =>
          lessons.map((l) => {
            if (l.id === lessonToCancel.id) {
              return { ...l, status: 'cancelled' as const };
            }
            if (
              l.recurring_series_id === lessonToCancel.recurring_series_id &&
              new Date(l.start_time) > new Date(lessonToCancel.start_time) &&
              l.status === 'scheduled'
            ) {
              return { ...l, status: 'cancelled' as const };
            }
            return l;
          });

        setStudentLessons(updateLessons);
        setStudents((prev) =>
          prev.map((s) => ({
            ...s,
            lessons: updateLessons(s.lessons),
          }))
        );
      } else {
        setStudentLessons((prev) =>
          prev.map((l) => (l.id === lessonToCancel.id ? { ...l, status: 'cancelled' } : l))
        );
      }
    }
    
    setLessonToCancel(null);
  };

  // Count future lessons in the same series for the cancel modal
  const getFutureLessonsCount = () => {
    if (!lessonToCancel?.recurring_series_id) return 0;
    return studentLessons.filter(
      (l) =>
        l.recurring_series_id === lessonToCancel.recurring_series_id &&
        l.id !== lessonToCancel.id &&
        new Date(l.start_time) > new Date(lessonToCancel.start_time) &&
        l.status === 'scheduled'
    ).length;
  };

  const handleSendReminder = async (student: User) => {
    // Placeholder for email reminder functionality
    alert(`Balance reminder would be sent to ${student.email}`);
  };

  const handleSaveDiscount = async () => {
    if (!selectedStudent) return;
    
    setIsSavingDiscount(true);
    try {
      const res = await fetch(`/api/students/${selectedStudent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discount_percent: discountPercent }),
      });

      if (res.ok) {
        const updatedStudent = await res.json();
        // Update local state
        setSelectedStudent(updatedStudent);
        setStudents((prev) =>
          prev.map((s) =>
            s.student.id === selectedStudent.id
              ? { ...s, student: updatedStudent }
              : s
          )
        );
        setIsEditingDiscount(false);
      }
    } catch (error) {
      console.error('Error saving discount:', error);
    } finally {
      setIsSavingDiscount(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!selectedStudent) return;
    
    setIsSavingAddress(true);
    try {
      const res = await fetch(`/api/students/${selectedStudent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: studentAddress }),
      });

      if (res.ok) {
        const updatedStudent = await res.json();
        // Update local state
        setSelectedStudent(updatedStudent);
        setStudents((prev) =>
          prev.map((s) =>
            s.student.id === selectedStudent.id
              ? { ...s, student: updatedStudent }
              : s
          )
        );
        setIsEditingAddress(false);
      }
    } catch (error) {
      console.error('Error saving address:', error);
    } finally {
      setIsSavingAddress(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Students</h1>

      {students.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-8 text-center border border-transparent dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No students yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
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
          setDiscountPercent(0);
          setIsEditingDiscount(false);
          setStudentAddress('');
          setIsEditingAddress(false);
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
                <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-2xl">
                    {(selectedStudent.full_name || selectedStudent.email)[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {selectedStudent.full_name || 'No name'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">{selectedStudent.email}</p>
                {selectedStudent.phone && (
                  <p className="text-gray-500 dark:text-gray-400">{selectedStudent.phone}</p>
                )}
              </div>
            </div>

            {/* Discount Section */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Discount
                  </span>
                  {!isEditingDiscount && (
                    <span className={`px-2 py-0.5 text-sm font-medium rounded-full ${
                      (selectedStudent.discount_percent || 0) > 0
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                    }`}>
                      {selectedStudent.discount_percent || 0}% off
                    </span>
                  )}
                </div>
                
                {isEditingDiscount ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-l-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-600 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md text-gray-600 dark:text-gray-300">
                        %
                      </span>
                    </div>
                    <button
                      onClick={handleSaveDiscount}
                      disabled={isSavingDiscount}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {isSavingDiscount ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setDiscountPercent(selectedStudent.discount_percent || 0);
                        setIsEditingDiscount(false);
                      }}
                      className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingDiscount(true)}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                  >
                    Edit
                  </button>
                )}
              </div>
              {(selectedStudent.discount_percent || 0) > 0 && !isEditingDiscount && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  This discount applies to current and future lessons (not past ones).
                </p>
              )}
            </div>

            {/* Address Section */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    📍 Address
                  </span>
                  {!isEditingAddress && !selectedStudent.address && (
                    <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                      Not set
                    </span>
                  )}
                </div>
                
                {!isEditingAddress && (
                  <button
                    onClick={() => setIsEditingAddress(true)}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                  >
                    Edit
                  </button>
                )}
              </div>
              
              {isEditingAddress ? (
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={studentAddress}
                    onChange={(e) => setStudentAddress(e.target.value)}
                    placeholder="123 Main St, Santa Maria, CA 93454"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAddress}
                      disabled={isSavingAddress}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {isSavingAddress ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setStudentAddress(selectedStudent.address || '');
                        setIsEditingAddress(false);
                      }}
                      className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : selectedStudent.address ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {selectedStudent.address}
                </p>
              ) : null}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Used for in-person lessons. Students can also set this when booking.
              </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-8">
                <button className="py-2 px-1 border-b-2 border-indigo-500 font-medium text-indigo-600 dark:text-indigo-400">
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
                    onCancel={openCancelModal}
                    discountPercent={selectedStudent.discount_percent || 0}
                  />
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No lessons</p>
              )}
            </div>

            {/* Notes Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                📝 Private Notes
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                  (only visible to you)
                </span>
              </h4>
              
              {/* Add Note */}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 mb-4 border border-gray-200 dark:border-gray-600">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Add a new note about this student
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="e.g., Working on breath support, prefers morning lessons..."
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {studentNotes.map((note) => (
                  <div key={note.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{note.note}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatDate(new Date(note.created_at))}
                    </p>
                  </div>
                ))}
                {studentNotes.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No notes yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Lesson Modal */}
      <CancelLessonModal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setLessonToCancel(null);
        }}
        onConfirm={handleCancelLesson}
        lessonDate={lessonToCancel ? new Date(lessonToCancel.start_time) : undefined}
        lessonType={lessonToCancel ? getLessonType(lessonToCancel.lesson_type)?.name : undefined}
        isRecurring={lessonToCancel?.is_recurring || false}
        futureLessonsCount={getFutureLessonsCount()}
      />
    </div>
  );
}
