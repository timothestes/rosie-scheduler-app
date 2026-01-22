'use client';

import { useState, useEffect } from 'react';
import ProfileCompletionModal from './ProfileCompletionModal';

interface ProfileCheckWrapperProps {
  children: React.ReactNode;
  userEmail: string;
}

export default function ProfileCheckWrapper({ children, userEmail }: ProfileCheckWrapperProps) {
  const [needsProfile, setNeedsProfile] = useState(false);
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
        setNeedsProfile(missingName || missingPhone);
      }
    } catch (error) {
      console.error('Error checking profile:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleProfileComplete = () => {
    setNeedsProfile(false);
  };

  // Don't block rendering while checking
  return (
    <>
      {children}
      <ProfileCompletionModal
        isOpen={needsProfile && !isChecking}
        onComplete={handleProfileComplete}
        userEmail={userEmail}
      />
    </>
  );
}
