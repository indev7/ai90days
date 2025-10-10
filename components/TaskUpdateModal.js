'use client';

import { useState, useEffect } from 'react';
import styles from './TaskUpdateModal.module.css';

export default function TaskUpdateModal({ 
  isOpen, 
  onClose, 
  task, 
  onSave 
}) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Update form when task changes
  useEffect(() => {
    if (task) {
      setProgress(task.progress || 0);
    }
  }, [task]);

  // Determine task status based on progress
  const getTaskStatus = (progressValue) => {
    if (progressValue === 0) return 'todo';
    if (progressValue === 100) return 'done';
    return 'in_progress';
  };

  const handleSave = async () => {
    if (!task) return;

    setIsLoading(true);
    
    try {
      const taskStatus = getTaskStatus(progress);
      
      const updateData = {
        progress: progress,
        task_status: taskStatus
      };

      await onSave(task.id, updateData);
      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (task) {
      setProgress(task.progress || 0);
    }
    onClose();
  };

  if (!isOpen || !task) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Update Task</h2>
          <button 
            className={styles.closeButton} 
            onClick={handleCancel}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
              {/* Task Description - Read Only */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Task Description
                </label>
                <div className={styles.taskDescription}>
                  {task?.taskDescription || task?.description || task?.title || 'No description available'}
                </div>
              </div>          {/* Progress Slider */}
          <div className={styles.formGroup}>
            <label htmlFor="task-progress" className={styles.label}>
              Progress ({progress}%)
            </label>
            <div className={styles.sliderContainer}>
              <input
                id="task-progress"
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value))}
                className={styles.slider}
              />
              <div className={styles.sliderLabels}>
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Status Preview */}
          <div className={styles.statusPreview}>
            <span className={styles.statusLabel}>Status: </span>
            <span className={`${styles.statusBadge} ${styles[getTaskStatus(progress)]}`}>
              {getTaskStatus(progress).replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <button 
            className={styles.cancelButton} 
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className={styles.updateButton} 
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}