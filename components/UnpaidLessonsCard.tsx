'use client';

import { useState } from 'react';
import UnpaidLessonsModal from './UnpaidLessonsModal';

interface UnpaidLessonsCardProps {
  count: number;
}

export default function UnpaidLessonsCard({ count }: UnpaidLessonsCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 cursor-pointer hover:ring-2 hover:ring-yellow-500 dark:hover:ring-yellow-400 transition-all"
      >
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Unpaid Lessons</p>
        <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500 mt-2">{count}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click to view details</p>
      </div>

      <UnpaidLessonsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
