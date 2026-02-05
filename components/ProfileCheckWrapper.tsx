'use client';

import { useState, useEffect } from 'react';
import ProfileCompletionModal from './ProfileCompletionModal';

interface ProfileCheckWrapperProps {
  children: React.ReactNode;
  userEmail: string;
}

export default function ProfileCheckWrapper({ children, userEmail }: ProfileCheckWrapperProps) {
  const [needsProfile, setNeedsProfile] = useState(false);
  const [needsReturningStudentQuestion, setNeedsReturningStudentQuestion] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkProfile();
  }, []);

  const checkProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const profile = await res.json();
        // Show modal if full_name or phone is missing
        const missingName = !profile.full_name || profile.full_name.trim() === '';
        const missingPhone = !profile.phone || profile.phone.trim() === '';
        // Show returning student question if not yet answered (null)
        const needsReturningQuestion = profile.is_returning_student === null;
        setNeedsProfile(missingName || missingPhone);
        setNeedsReturningStudentQuestion(needsReturningQuestion);
      }
    } catch (error) {
      console.error('Error checking profile:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleProfileComplete = () => {
    setNeedsProfile(false);
    setNeedsReturningStudentQuestion(false);
  };

  // Show modal if profile incomplete OR if we need to ask the returning student question
  const showModal = (needsProfile || needsReturningStudentQuestion) && !isChecking;

  // Don't block rendering while checking
  return (
    <>
      {children}
      <ProfileCompletionModal
        isOpen={showModal}
        onComplete={handleProfileComplete}
        userEmail={userEmail}
        showReturningStudentQuestion={needsReturningStudentQuestion}
        isProfileComplete={!needsProfile}
      />
    </>
  );
}
