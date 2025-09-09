'use client';

import { useState, useEffect } from 'react';
import styles from './OKRTModal.module.css';

const AREAS = ['Life', 'Work', 'Health', 'Finance', 'Education', 'Relationships'];
const KR_UNITS = ['%', '$', 'count', 'hrs', 'days', 'points', 'users'];
const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'team', label: 'Team' },
  { value: 'org', label: 'Organization' }
];

// Generate quarter options for current and next 2 years
const generateQuarterOptions = () => {
  const quarters = [];
  const currentYear = new Date().getFullYear();
  
  for (let year = currentYear; year <= currentYear + 2; year++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      quarters.push(`${year}-Q${quarter}`);
    }
  }
  
  return quarters;
};

export default function OKRTModal({ 
  isOpen, 
  onClose, 
  onSave, 
  okrt = null, 
  parentOkrt = null,
  mode = 'create' // 'create' or 'edit'
}) {
  const [formData, setFormData] = useState({
    type: 'O',
    title: '',
    description: '',
    area: '',
    cycle_qtr: '',
    visibility: 'private',
    status: 'D',
    objective_kind: 'committed',
    kr_target_number: '',
    kr_unit: '%',
    kr_baseline_number: '',
    header_image_url: '',
    weight: 1.0,
    task_status: 'todo',
    due_date: '',
    progress: 0
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageInputMode, setImageInputMode] = useState('url'); // 'url' or 'upload'

  const quarterOptions = generateQuarterOptions();

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && okrt) {
        const headerImageUrl = okrt.type === 'O' ? (okrt.header_image_url || '') : '';
        setFormData({
          type: okrt.type,
          title: okrt.title || '',
          description: okrt.description || '',
          area: okrt.type === 'O' ? (okrt.area || '') : '',
          cycle_qtr: okrt.type === 'O' ? (okrt.cycle_qtr || '') : '',
          visibility: okrt.type === 'O' ? (okrt.visibility || 'private') : 'private',
          status: okrt.status || 'D',
          objective_kind: okrt.objective_kind || 'committed',
          kr_target_number: okrt.kr_target_number || '',
          kr_unit: okrt.kr_unit || '%',
          kr_baseline_number: okrt.type === 'O' ? (okrt.kr_baseline_number || '') : '',
          header_image_url: headerImageUrl,
          weight: okrt.weight || 1.0,
          task_status: okrt.task_status || 'todo',
          due_date: okrt.due_date || '',
          progress: okrt.progress || 0
        });
        // Set input mode based on existing data
        setImageInputMode(headerImageUrl ? 'url' : 'upload');
      } else {
        // Create mode - reset form and set parent if provided
        const defaultType = parentOkrt ? 
          (parentOkrt.type === 'O' ? 'K' : 'T') : 'O';
          
        setFormData({
          type: defaultType,
          title: '',
          description: '',
          area: defaultType === 'O' ? (parentOkrt?.area || '') : '',
          cycle_qtr: defaultType === 'O' ? (parentOkrt?.cycle_qtr || '') : '',
          visibility: defaultType === 'O' ? 'private' : 'private',
          status: 'D',
          objective_kind: 'committed',
          kr_target_number: '',
          kr_unit: '%',
          kr_baseline_number: defaultType === 'O' ? '' : '',
          header_image_url: '',
          weight: 1.0,
          task_status: 'todo',
          due_date: '',
          progress: 0
        });
        // Default to upload mode for new objectives
        setImageInputMode('upload');
      }
      setErrors({});
      setUploadingImage(false);
    }
  }, [isOpen, mode, okrt, parentOkrt]);

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

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type on client side
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({
        ...prev,
        header_image_url: 'Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed.'
      }));
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setErrors(prev => ({
        ...prev,
        header_image_url: 'File too large. Maximum size is 5MB.'
      }));
      return;
    }

    setUploadingImage(true);
    setErrors(prev => ({ ...prev, header_image_url: undefined }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        handleInputChange('header_image_url', data.url);
      } else {
        setErrors(prev => ({
          ...prev,
          header_image_url: data.error || 'Failed to upload image'
        }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrors(prev => ({
        ...prev,
        header_image_url: 'Failed to upload image. Please try again.'
      }));
    } finally {
      setUploadingImage(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Common validations
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    // Type-specific validations
    if (formData.type === 'O') {
      if (!formData.title.trim()) {
        newErrors.title = 'Title is required for Objectives';
      }
    }
    
    if (formData.type === 'K') {
      if (!formData.kr_target_number || formData.kr_target_number <= 0) {
        newErrors.kr_target_number = 'Target number must be greater than 0';
      }
      if (!formData.kr_unit) {
        newErrors.kr_unit = 'Unit is required for Key Results';
      }
    }
    
    if (formData.type === 'T' && formData.due_date) {
      const dueDate = new Date(formData.due_date);
      if (dueDate < new Date()) {
        newErrors.due_date = 'Due date cannot be in the past';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setSaving(true);
    
    try {
      const saveData = { ...formData };
      
      // Clean up type-specific fields
      if (formData.type === 'O') {
        delete saveData.kr_target_number;
        delete saveData.kr_unit;
        delete saveData.weight;
        delete saveData.task_status;
        delete saveData.due_date;
        // keep kr_baseline_number for Objectives
        // keep header_image_url for Objectives
      } else if (formData.type === 'K') {
        delete saveData.objective_kind;
        delete saveData.task_status;
        delete saveData.due_date;
        delete saveData.kr_baseline_number; // baseline only for Objectives
        delete saveData.header_image_url;
      } else if (formData.type === 'T') {
        delete saveData.objective_kind;
        delete saveData.kr_target_number;
        delete saveData.kr_unit;
        delete saveData.kr_baseline_number;
        delete saveData.header_image_url;
      }
      
      // Add parent ID if creating under a parent
      if (mode === 'create' && parentOkrt) {
        saveData.parent_id = parentOkrt.id;
      }
      
      await onSave(saveData);
      onClose();
    } catch (error) {
      console.error('Error saving OKRT:', error);
      setErrors({ general: 'Failed to save OKRT. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'O': return 'Objective';
      case 'K': return 'Key Result';
      case 'T': return 'Task';
      default: return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>
            {mode === 'edit' ? 'Edit' : 'Create'} {getTypeLabel(formData.type)}
          </h2>
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

          {/* Type selection removed - defaulting to Objective for create */}

          {/* Title (for Objectives) */}
          {formData.type === 'O' && (
            <div className={`${styles.objectiveFormGroup} ${styles.fullWidth}`}>
              <label className={styles.objectiveLabel}>
                Title <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={`${styles.objectiveInput} ${errors.title ? styles.inputError : ''}`}
                value={formData.title}
                onChange={e => handleInputChange('title', e.target.value)}
                placeholder="Enter objective title"
              />
              {errors.title && <span className={styles.errorText}>{errors.title}</span>}
            </div>
          )}

          {/* Description */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>
              Description <span className={styles.required}>*</span>
            </label>
            <textarea
              className={`${styles.textarea} ${errors.description ? styles.inputError : ''}`}
              value={formData.description}
              onChange={e => handleInputChange('description', e.target.value)}
              placeholder="Enter detailed description"
              rows={3}
            />
            {errors.description && <span className={styles.errorText}>{errors.description}</span>}
          </div>

          {/* Area and Cycle (Objectives only) */}
          {formData.type === 'O' && (
            <div className={styles.objectiveFormRowThree}>
              <div className={styles.objectiveFormGroup}>
                <label className={styles.objectiveLabel}>Area</label>
                <select
                  className={styles.objectiveSelect}
                  value={formData.area}
                  onChange={e => handleInputChange('area', e.target.value)}
                >
                  <option value="">Select area</option>
                  {AREAS.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>

              <div className={styles.objectiveFormGroup}>
                <label className={styles.objectiveLabel}>Cycle Quarter</label>
                <select
                  className={styles.objectiveSelect}
                  value={formData.cycle_qtr}
                  onChange={e => handleInputChange('cycle_qtr', e.target.value)}
                >
                  <option value="">Select quarter</option>
                  {quarterOptions.map(quarter => (
                    <option key={quarter} value={quarter}>{quarter}</option>
                  ))}
                </select>
              </div>

              <div className={styles.objectiveFormGroup}>
                <label className={styles.objectiveLabel}>Progress (%)</label>
                <div>
                  <input
                    type="range"
                    className={styles.objectiveProgressSlider}
                    value={formData.progress}
                    onChange={e => handleInputChange('progress', Number(e.target.value))}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className={styles.objectiveHelperText}>{formData.progress}%</div>
                </div>
              </div>

              <div className={styles.objectiveFormGroup}>
                <label className={styles.objectiveLabel}>Visibility</label>
                <select
                  className={styles.objectiveSelect}
                  value={formData.visibility}
                  onChange={e => handleInputChange('visibility', e.target.value)}
                >
                  {VISIBILITY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.objectiveFormGroup}>
                <label className={styles.objectiveLabel}>Status</label>
                <select
                  className={styles.objectiveSelect}
                  value={formData.status}
                  onChange={e => handleInputChange('status', e.target.value)}
                >
                  <option value="D">Draft</option>
                  <option value="A">Active</option>
                  <option value="C">Complete</option>
                </select>
              </div>
            </div>
          )}

          

          {/* Header image (Objectives only) */}
          {formData.type === 'O' && (
            <div className={`${styles.objectiveFormGroup} ${styles.fullWidth}`}>
              <label className={styles.objectiveLabel}>Header Image</label>
              
              {/* Input mode toggle */}
              <div className={styles.objectiveImageInputToggle}>
                <button
                  type="button"
                  className={`${styles.objectiveToggleButton} ${imageInputMode === 'url' ? styles.active : ''}`}
                  onClick={() => setImageInputMode('url')}
                >
                  URL
                </button>
                <button
                  type="button"
                  className={`${styles.objectiveToggleButton} ${imageInputMode === 'upload' ? styles.active : ''}`}
                  onClick={() => setImageInputMode('upload')}
                >
                  Upload
                </button>
              </div>

              {/* URL Input */}
              {imageInputMode === 'url' && (
                <input
                  type="url"
                  className={`${styles.objectiveInput} ${errors.header_image_url ? styles.inputError : ''}`}
                  value={formData.header_image_url}
                  onChange={e => handleInputChange('header_image_url', e.target.value)}
                  placeholder="https://..."
                />
              )}

              {/* File Upload */}
              {imageInputMode === 'upload' && (
                <div className={styles.objectiveFileUploadArea}>
                  <input
                    type="file"
                    id="headerImageUpload"
                    className={styles.objectiveFileInput}
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadingImage}
                  />
                  <label htmlFor="headerImageUpload" className={styles.objectiveFileUploadLabel}>
                    {uploadingImage ? (
                      'Uploading...'
                    ) : (
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Click to upload image or drag and drop
                        <span className={styles.objectiveFileUploadHint}>PNG, JPG, GIF, WebP up to 5MB</span>
                      </>
                    )}
                  </label>
                </div>
              )}

              {/* Error message */}
              {errors.header_image_url && (
                <span className={styles.errorText}>{errors.header_image_url}</span>
              )}

              {/* Image preview */}
              {formData.header_image_url && (
                <>
                  <div className={styles.objectiveHelperText}>Preview:</div>
                  <div className={styles.objectiveImagePreviewContainer}>
                    <img
                      src={formData.header_image_url}
                      alt="Header preview"
                      className={styles.objectiveImagePreview}
                    />
                    <button
                      type="button"
                      className={styles.objectiveRemoveImageButton}
                      onClick={() => handleInputChange('header_image_url', '')}
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Type-specific fields */}
          
          {/* Objective-specific fields */}
          {formData.type === 'O' && (
            <>
              <div className={`${styles.objectiveFormGroup} ${styles.fullWidth}`}>
                <label className={styles.objectiveLabel}>Objective Kind</label>
                <div className={styles.objectiveRadioGroup}>
                  <label className={styles.objectiveRadioLabel}>
                    <input
                      type="radio"
                      name="objective_kind"
                      value="committed"
                      checked={formData.objective_kind === 'committed'}
                      onChange={e => handleInputChange('objective_kind', e.target.value)}
                    />
                    Committed
                  </label>
                  <label className={styles.objectiveRadioLabel}>
                    <input
                      type="radio"
                      name="objective_kind"
                      value="stretch"
                      checked={formData.objective_kind === 'stretch'}
                      onChange={e => handleInputChange('objective_kind', e.target.value)}
                    />
                    Stretch
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Key Result-specific fields */}
          {formData.type === 'K' && (
            <>
              <div className={styles.krFormRowThree}>
                <div className={styles.krFormGroup}>
                  <label className={styles.krLabel}>
                    Target Number <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="number"
                    className={`${styles.krInput} ${errors.kr_target_number ? styles.inputError : ''}`}
                    value={formData.kr_target_number}
                    onChange={e => handleInputChange('kr_target_number', Number(e.target.value))}
                    min={0}
                  />
                  {errors.kr_target_number && (
                    <span className={styles.errorText}>{errors.kr_target_number}</span>
                  )}
                </div>

                <div className={styles.krFormGroup}>
                  <label className={styles.krLabel}>Unit</label>
                  <select
                    className={styles.krSelect}
                    value={formData.kr_unit}
                    onChange={e => handleInputChange('kr_unit', e.target.value)}
                  >
                    {KR_UNITS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.krFormGroup}>
                  <label className={styles.krLabel}>Weight</label>
                  <input
                    type="number"
                    className={styles.krInput}
                    value={formData.weight}
                    onChange={e => handleInputChange('weight', Number(e.target.value))}
                    min={0.1}
                    max={5}
                    step={0.1}
                  />
                </div>

                <div className={styles.krFormGroup}>
                <label className={styles.krLabel}>Progress (%)</label>
                <div>
                  <input
                    type="range"
                    className={styles.krProgressSlider}
                    value={formData.progress}
                    onChange={e => handleInputChange('progress', Number(e.target.value))}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className={styles.krHelperText}>{formData.progress}%</div>
                </div>
              </div>
              
              </div>

              
            </>
          )}

          {/* Task-specific fields */}
          {formData.type === 'T' && (
            <>
              <div className={styles.taskFormRowThree}>
                <div className={styles.taskFormGroup}>
                  <label className={styles.taskLabel}>Task Status</label>
                  <select
                    className={styles.taskSelect}
                    value={formData.task_status}
                    onChange={e => handleInputChange('task_status', e.target.value)}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>

                <div className={styles.taskFormGroup}>
                  <label className={styles.taskLabel}>Weight</label>
                  <input
                    type="number"
                    className={styles.taskInput}
                    value={formData.weight}
                    onChange={e => handleInputChange('weight', Number(e.target.value))}
                    min={0.1}
                    max={5}
                    step={0.1}
                  />
                </div>

                <div className={styles.taskFormGroup}>
                  <label className={styles.taskLabel}>Due Date</label>
                  <input
                    type="date"
                    className={`${styles.taskInput} ${errors.due_date ? styles.inputError : ''}`}
                    value={formData.due_date}
                    onChange={e => handleInputChange('due_date', e.target.value)}
                  />
                  {errors.due_date && <span className={styles.errorText}>{errors.due_date}</span>}
                </div>

                <div className={styles.taskFormGroup}>
                <label className={styles.taskLabel}>Progress (%)</label>
                <div>
                  <input
                    type="range"
                    className={styles.taskProgressSlider}
                    value={formData.progress}
                    onChange={e => handleInputChange('progress', Number(e.target.value))}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className={styles.taskHelperText}>{formData.progress}%</div>
                </div>
              </div>
              </div>

              
            </>
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
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
