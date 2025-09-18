'use client';

import { useState, useEffect } from 'react';
import Avatar from 'boring-avatars';
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
  editingGroup = null, // Group being edited
  onDelete = null // Delete handler
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
      if (editingGroup) {
        // Edit mode - populate with existing data
        setFormData({
          name: editingGroup.name || '',
          type: editingGroup.type || 'Group',
          parent_group_id: editingGroup.parent_group_id || '',
          thumbnail_url: editingGroup.thumbnail_url || ''
        });
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          type: 'Group',
          parent_group_id: '',
          thumbnail_url: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, editingGroup]);

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
      
      // Remove empty thumbnail_url so API can generate avatar
      if (!saveData.thumbnail_url) {
        delete saveData.thumbnail_url;
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
          <h2>{editingGroup ? 'Edit Group' : 'Create New Group'}</h2>
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
              placeholder="https://example.com/image.jpg (optional - will generate avatar if empty)"
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              Leave empty to auto-generate a unique avatar based on the group name
            </div>
          </div>

          {/* Preview thumbnail */}
          {(formData.thumbnail_url || formData.name) && (
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>Preview</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {formData.thumbnail_url ? (
                  <img
                    src={formData.thumbnail_url}
                    alt="Thumbnail preview"
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      border: '1px solid var(--border)'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : formData.name ? (
                  <Avatar
                    size={60}
                    name={formData.name}
                    variant="marble"
                    colors={['#92A1C6', '#146A7C', '#F0AB3D', '#C271B4', '#C20D90']}
                    style={{
                      borderRadius: '12px',
                      border: '1px solid var(--border)'
                    }}
                  />
                ) : null}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {formData.thumbnail_url
                    ? 'This is how your group thumbnail will appear'
                    : 'Auto-generated avatar based on group name'
                  }
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          {editingGroup && onDelete && (
            <button
              className={styles.deleteButton}
              onClick={onDelete}
              disabled={saving}
              style={{ marginRight: 'auto' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                Delete
              </span>
            </button>
          )}
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
            {saving ? (editingGroup ? 'Updating...' : 'Creating...') : (editingGroup ? 'Update Group' : 'Create Group')}
          </button>
        </div>
      </div>
    </div>
  );
}