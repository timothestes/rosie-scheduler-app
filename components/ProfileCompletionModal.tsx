'use client';

import { useState } from 'react';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onComplete: () => void;
  userEmail: string;
  showReturningStudentQuestion?: boolean;
  isProfileComplete?: boolean;
}

export default function ProfileCompletionModal({
  isOpen,
  onComplete,
  userEmail,
  showReturningStudentQuestion = false,
  isProfileComplete = false,
}: ProfileCompletionModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [isReturningStudent, setIsReturningStudent] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Validation helpers
  const isValidName = (name: string) => /^[a-zA-Z\s\-']+$/.test(name);
  const NAME_MIN_LENGTH = 1;
  const NAME_MAX_LENGTH = 50;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // If only showing returning student question (profile is complete)
    if (isProfileComplete && showReturningStudentQuestion) {
      if (isReturningStudent === null) {
        setError('Please let us know if you have taken lessons with Rosie before');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            is_returning_student: isReturningStudent,
          }),
        });

        if (res.ok) {
          onComplete();
        } else {
          const data = await res.json();
          setError(data.error || 'Failed to save');
        }
      } catch (err) {
        setError('An error occurred. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    // Validate first name
    if (!trimmedFirst) {
      setError('First name is required');
      return;
    }
    if (trimmedFirst.length > NAME_MAX_LENGTH) {
      setError(`First name must be ${NAME_MAX_LENGTH} characters or less`);
      return;
    }
    if (!isValidName(trimmedFirst)) {
      setError('First name can only contain letters, spaces, hyphens, and apostrophes');
      return;
    }

    // Validate last name
    if (!trimmedLast) {
      setError('Last name is required');
      return;
    }
    if (trimmedLast.length > NAME_MAX_LENGTH) {
      setError(`Last name must be ${NAME_MAX_LENGTH} characters or less`);
      return;
    }
    if (!isValidName(trimmedLast)) {
      setError('Last name can only contain letters, spaces, hyphens, and apostrophes');
      return;
    }

    // Validate phone number (must have 10 digits)
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    // Validate returning student question if shown
    if (showReturningStudentQuestion && isReturningStudent === null) {
      setError('Please let us know if you have taken lessons with Rosie before');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          phone: phone.trim(),
          ...(showReturningStudentQuestion && { is_returning_student: isReturningStudent }),
        }),
      });

      if (res.ok) {
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save profile');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format phone number as user types
  const handlePhoneChange = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      setPhone(digits);
    } else if (digits.length <= 6) {
      setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
    } else {
      setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`);
    }
  };

  if (!isOpen) return null;

  // If profile is complete but we need to ask about returning student
  if (isProfileComplete && showReturningStudentQuestion) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop - no click handler to prevent closing */}
        <div className="fixed inset-0 bg-black/50" />
        
        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-xl">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Welcome! 👋</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">One quick question before you get started</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Have you taken voice lessons with Rosie before?
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    isReturningStudent === true 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}>
                    <input
                      type="radio"
                      name="returningStudent"
                      value="yes"
                      checked={isReturningStudent === true}
                      onChange={() => setIsReturningStudent(true)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-900 dark:text-white">Yes, I&apos;m a returning student</span>
                  </label>
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    isReturningStudent === false 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}>
                    <input
                      type="radio"
                      name="returningStudent"
                      value="no"
                      checked={isReturningStudent === false}
                      onChange={() => setIsReturningStudent(false)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-900 dark:text-white">No, I&apos;m new here!</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isReturningStudent === null}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Continue'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop - no click handler to prevent closing */}
      <div className="fixed inset-0 bg-black/50" />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-xl">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Complete Your Profile</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Please fill in your details to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Email display */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</p>
              <p className="mt-1 text-gray-900 dark:text-white">{userEmail}</p>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="John"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Smith"
                  required
                />
              </div>
            </div>

            {/* Phone field */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder="(555) 123-4567"
                required
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Used for lesson reminders and updates
              </p>
            </div>

            {/* Returning student question */}
            {showReturningStudentQuestion && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Have you taken voice lessons with Rosie before? <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    isReturningStudent === true 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}>
                    <input
                      type="radio"
                      name="returningStudent"
                      value="yes"
                      checked={isReturningStudent === true}
                      onChange={() => setIsReturningStudent(true)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-900 dark:text-white">Yes, I&apos;m a returning student</span>
                  </label>
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    isReturningStudent === false 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}>
                    <input
                      type="radio"
                      name="returningStudent"
                      value="no"
                      checked={isReturningStudent === false}
                      onChange={() => setIsReturningStudent(false)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-900 dark:text-white">No, I&apos;m new here!</span>
                  </label>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
