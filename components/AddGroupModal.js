'use client';

import { useState, useEffect } from 'react';
import styles from './OKRTModal.module.css'; // Reuse OKRT modal styles

const GROUP_TYPES = [
  'Organisation',
  'Department', 
  'Team',
  'Chapter',
  'Squad',
  'Tribe',
  'Group'
];

export default function AddGroupModal({ 
  isOpen, 
  onClose, 
  onSave,
  groups = [], // Available groups for parent selection
  mode = 'create' // 'create' or 'edit'
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'Group',
    parent_group_id: '',
    thumbnail_url: ''
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        type: 'Group',
        parent_group_id: '',
        thumbnail_url: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Group name is required';
    }
    
    if (!formData.type) {
      newErrors.type = 'Group type is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setSaving(true);
    
    try {
      const saveData = { ...formData };
      
      // Convert empty parent_group_id to null
      if (!saveData.parent_group_id) {
        saveData.parent_group_id = null;
      }
      
      // Use default thumbnail if none provided
      if (!saveData.thumbnail_url) {
        saveData.thumbnail_url = '/brand/90d-logo.png';
      }
      
      await onSave(saveData);
      onClose();
    } catch (error) {
      console.error('Error saving group:', error);
      setErrors({ general: 'Failed to save group. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Create New Group</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {errors.general && (
            <div className={styles.errorMessage}>{errors.general}</div>
          )}

          {/* Group Name */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>
              Group Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
              value={formData.name}
              onChange={e => handleInputChange('name', e.target.value)}
              placeholder="Enter group name"
            />
            {errors.name && <span className={styles.errorText}>{errors.name}</span>}
          </div>

          {/* Group Type and Parent Group */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Group Type <span className={styles.required}>*</span>
              </label>
              <select
                className={`${styles.select} ${errors.type ? styles.inputError : ''}`}
                value={formData.type}
                onChange={e => handleInputChange('type', e.target.value)}
              >
                {GROUP_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.type && <span className={styles.errorText}>{errors.type}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Parent Group</label>
              <select
                className={styles.select}
                value={formData.parent_group_id}
                onChange={e => handleInputChange('parent_group_id', e.target.value)}
              >
                <option value="">No parent (Root group)</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Thumbnail URL */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Thumbnail Image URL</label>
            <input
              type="url"
              className={styles.input}
              value={formData.thumbnail_url}
              onChange={e => handleInputChange('thumbnail_url', e.target.value)}
              placeholder="https://example.com/image.jpg (optional - will use default if empty)"
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '0.25rem' }}>
              Leave empty to use the default 90 Days logo
            </div>
          </div>

          {/* Preview thumbnail if URL provided */}
          {formData.thumbnail_url && (
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>Preview</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img
                  src={formData.thumbnail_url}
                  alt="Thumbnail preview"
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    border: '1px solid var(--color-border)'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  This is how your group thumbnail will appear
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button 
            className={styles.cancelButton}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}