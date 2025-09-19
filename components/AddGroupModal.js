'use client';

import { useState, useEffect } from 'react';
import { generateAvatarSVG } from '@/lib/avatarGenerator';
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
    thumbnail_file: null
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [previewUrl, setPreviewUrl] = useState('');

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingGroup) {
        // Edit mode - populate with existing data
        setFormData({
          name: editingGroup.name || '',
          type: editingGroup.type || 'Group',
          parent_group_id: editingGroup.parent_group_id || '',
          thumbnail_file: null
        });
        // Set preview URL for existing thumbnail
        setPreviewUrl(editingGroup.thumbnail_url || '');
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          type: 'Group',
          parent_group_id: '',
          thumbnail_file: null
        });
        setPreviewUrl('');
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setFormData(prev => ({ ...prev, thumbnail_file: null }));
      setPreviewUrl('');
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, thumbnail_file: 'Please select a valid image file (JPEG, PNG, GIF, or WebP)' }));
      return;
    }

    // Validate file size (1MB = 1024 * 1024 bytes)
    const maxSize = 1024 * 1024;
    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, thumbnail_file: 'File size must be less than 1MB' }));
      return;
    }

    // Clear any previous errors
    setErrors(prev => ({ ...prev, thumbnail_file: undefined }));
    
    // Set file and create preview URL
    setFormData(prev => ({ ...prev, thumbnail_file: file }));
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
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
      
      // Handle file upload - convert to base64 for API
      if (saveData.thumbnail_file) {
        const reader = new FileReader();
        const fileData = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(saveData.thumbnail_file);
        });
        saveData.thumbnail_data = fileData;
        delete saveData.thumbnail_file;
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

          {/* Thumbnail File Upload */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Group Thumbnail Image</label>
            <input
              type="file"
              accept="image/*"
              className={`${styles.input} ${errors.thumbnail_file ? styles.inputError : ''}`}
              onChange={handleFileChange}
            />
            {errors.thumbnail_file && <span className={styles.errorText}>{errors.thumbnail_file}</span>}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              Upload an image file (JPEG, PNG, GIF, WebP) under 1MB. Leave empty to auto-generate a unique avatar.
            </div>
          </div>

          {/* Preview thumbnail */}
          {(previewUrl || formData.name) && (
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>Preview</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {previewUrl ? (
                  <img
                    src={previewUrl}
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
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)'
                    }}
                    dangerouslySetInnerHTML={{ __html: generateAvatarSVG(formData.name, 60) }}
                  />
                ) : null}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {previewUrl
                    ? 'This is how your uploaded thumbnail will appear'
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