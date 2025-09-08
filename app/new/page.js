'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OKRTModal from '@/components/OKRTModal';
import styles from './page.module.css';

export default function NewObjectivePage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(true); // Open modal immediately

  const handleSave = async (formData) => {
    try {
      const response = await fetch('/api/okrt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create: ${errorText}`);
      }

      // Success - redirect to OKRT page
      router.push('/okrt');
    } catch (error) {
      console.error('Error creating objective:', error);
      alert(`Failed to create objective: ${error.message}`);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    // Navigate back to My Goals page when modal is closed
    router.push('/okrt');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Create New Objective</h1>
        <p className={styles.subtitle}>Define your goal and start tracking your progress</p>
      </div>

      <div className={styles.content}>
        <div className={styles.infoCard}>
          <h2>Getting Started</h2>
          <p>
            Create a clear, measurable objective that you want to achieve in the next 90 days. 
            You can add Key Results and Tasks to break down your objective into actionable steps.
          </p>
        </div>
      </div>

      {showModal && (
        <OKRTModal
          isOpen={showModal}
          onClose={handleClose}
          onSave={handleSave}
          okrt={null}
          parentOkrt={null}
          mode="create"
        />
      )}
    </div>
  );
}
