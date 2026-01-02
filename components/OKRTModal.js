'use client';

import { useState, useEffect } from 'react';
import styles from './OKRTModal.module.css';
import { Calendar } from 'primereact/calendar';
import 'primereact/resources/primereact.min.css';

const AREAS = ['Life', 'Work', 'Health', 'Finance', 'Education', 'Relationships'];
const KR_UNITS = ['%', '$', 'count', 'hrs', 'days', 'points', 'users'];
const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'shared', label: 'Shared' }
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

// Get current quarter in format YYYY-Q#
const getCurrentQuarter = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const quarter = Math.floor(month / 3) + 1; // 1-4
  return `${year}-Q${quarter}`;
};

// Normalize various date inputs (Date objects, ISO strings) to YYYY-MM-DD for the UI
const normalizeDateInput = (value) => {
  if (!value) return '';
  try {
    // If already a simple YYYY-MM-DD string
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    // Convert to local date to avoid timezone shifts
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

export default function OKRTModal({
  isOpen,
  onClose,
  onSave,
  okrt = null,
  parentOkrt = null,
  mode = 'create', // 'create' or 'edit'
  onDelete = null // Delete handler
}) {
  const [formData, setFormData] = useState({
    type: 'O',
    title: '',
    description: '',
    area: '',
    cycle_qtr: '',
    visibility: 'private',
    objective_kind: 'committed',
    kr_target_number: '',
    kr_unit: '%',
    kr_baseline_number: '',
    weight: 1.0,
    task_status: 'todo',
    due_date: '',
    progress: '',
    parent_objective_id: '' // New field for parent objective
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);
  const [childRecords, setChildRecords] = useState([]);
  const [availableObjectives, setAvailableObjectives] = useState([]);

  const quarterOptions = generateQuarterOptions();

  // Fetch available objectives when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableObjectives();
    }
  }, [isOpen]);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && okrt) {
        setFormData({
          type: okrt.type,
          title: okrt.title || '',
          description: okrt.description || '',
          area: okrt.area || '',
          cycle_qtr: okrt.cycle_qtr || '',
          visibility: okrt.visibility || 'private',
          objective_kind: okrt.objective_kind || 'committed',
          kr_target_number: okrt.kr_target_number || '',
          kr_unit: okrt.kr_unit || '%',
          kr_baseline_number: okrt.kr_baseline_number || '',
          weight: okrt.weight || 1.0,
          task_status: okrt.task_status || 'todo',
          due_date: normalizeDateInput(okrt.due_date),
          progress: okrt.progress === 0 || okrt.progress ? okrt.progress : '',
          parent_objective_id: okrt.parent_id || ''
        });
      } else {
        // Create mode - reset form and set parent if provided
        const defaultType = parentOkrt ? 
          (parentOkrt.type === 'O' ? 'K' : 'T') : 'O';
          
        setFormData({
          type: defaultType,
          title: '',
          description: '',
          area: parentOkrt?.area || '',
          cycle_qtr: parentOkrt?.cycle_qtr || getCurrentQuarter(),
          visibility: 'private',
          objective_kind: 'committed',
          kr_target_number: '',
          kr_unit: '%',
          kr_baseline_number: '',
          weight: 1.0,
          task_status: 'todo',
          due_date: '',
          progress: '',
          parent_objective_id: parentOkrt?.id || ''
        });
      }
      setErrors({});
    }
  }, [isOpen, mode, okrt, parentOkrt]);

  const fetchAvailableObjectives = async () => {
    try {
      // Fetch both owned and shared objectives
      const [ownedResponse, sharedResponse] = await Promise.all([
        fetch('/api/okrt'),
        fetch('/api/shared')
      ]);
      
      const [ownedData, sharedData] = await Promise.all([
        ownedResponse.json(),
        sharedResponse.json()
      ]);
      
      const objectives = [];
      
      // Add owned objectives
      if (ownedResponse.ok && ownedData.okrts) {
        const ownedObjectives = ownedData.okrts
          .filter(item => item.type === 'O' && (!okrt || item.id !== okrt.id))
          .map(obj => ({
            id: obj.id,
            title: obj.title,
            owner_name: obj.owner_name || 'You'
          }));
        objectives.push(...ownedObjectives);
      }
      
      // Add shared objectives
      if (sharedResponse.ok && sharedData.okrts) {
        const sharedObjectives = sharedData.okrts
          .filter(item => item.type === 'O' && (!okrt || item.id !== okrt.id))
          .map(obj => ({
            id: obj.id,
            title: obj.title,
            owner_name: obj.owner_name || 'Unknown'
          }));
        objectives.push(...sharedObjectives);
      }
      
      // Remove duplicates based on id and sort by owner name then title
      const uniqueObjectives = objectives
        .filter((obj, index, self) => 
          index === self.findIndex(o => o.id === obj.id)
        )
        .sort((a, b) => {
          const ownerCompare = a.owner_name.localeCompare(b.owner_name);
          if (ownerCompare !== 0) return ownerCompare;
          return a.title.localeCompare(b.title);
        });
      
      setAvailableObjectives(uniqueObjectives);
    } catch (error) {
      console.error('Error fetching objectives:', error);
    }
  };

  const handleInputChange = (field, value) => {
    // Special handling for date fields
    if (field === 'due_date') {
      // Ensure the date is in YYYY-MM-DD format
      if (value && typeof value === 'string' && value.includes('T')) {
        value = value.split('T')[0];
      }
    }

    if (field === 'progress') {
      // Allow clearing the field; store empty string for blank UI
      if (value === '' || value === null || Number.isNaN(value)) {
        setFormData(prev => ({ ...prev, [field]: '' }));
        if (errors[field]) {
          setErrors(prev => ({ ...prev, [field]: undefined }));
        }
        return;
      }
    }
    
    // Reset due date if changing cycle quarter
    if (field === 'cycle_qtr') {
      setFormData(prev => ({
        ...prev,
        [field]: value,
        due_date: '' // Reset due date when quarter changes
      }));
      return;
    }
    
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
        delete saveData.kr_baseline_number;
        delete saveData.weight;
        delete saveData.task_status;
        
        // Handle parent objective ID for objectives
        if (saveData.parent_objective_id) {
          saveData.parent_id = saveData.parent_objective_id;
        }
        delete saveData.parent_objective_id; // Remove the UI field
      } else if (formData.type === 'K') {
        delete saveData.objective_kind;
        delete saveData.task_status;
        delete saveData.parent_objective_id; // Not used for KRs
        // Convert empty strings to null for numeric fields
        if (saveData.kr_baseline_number === '' || saveData.kr_baseline_number === 0) {
          saveData.kr_baseline_number = null;
        }
        // Keep the due_date for Key Results
      } else if (formData.type === 'T') {
        delete saveData.objective_kind;
        delete saveData.kr_target_number;
        delete saveData.kr_unit;
        delete saveData.kr_baseline_number;
        delete saveData.parent_objective_id; // Not used for Tasks
        // Keep the due_date for Tasks
      }
      
      // Add parent ID if creating under a parent (for KRs and Tasks)
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

  // Check for child records before deletion
  const checkChildRecords = async () => {
    if (!okrt || mode !== 'edit') return [];
    
    try {
      const response = await fetch(`/api/okrt?parent_id=${okrt.id}`);
      if (response.ok) {
        const data = await response.json();
        return data.okrts || [];
      }
    } catch (error) {
      console.error('Error checking child records:', error);
    }
    return [];
  };

  // Handle delete with child record validation
  const handleDelete = async () => {
    if (!okrt || !onDelete) return;
    
    setDeleting(true);
    
    try {
      // Check for child records
      const children = await checkChildRecords();
      
      if (children.length > 0) {
        const childType = okrt.type === 'O' ? 'Key Results' : 'Tasks';
        setErrors({
          general: `Cannot delete this ${getTypeLabel(okrt.type)}. Please delete all ${childType} first (${children.length} found).`
        });
        setDeleting(false);
        return;
      }
      
      // Confirm deletion
      const confirmMessage = `Are you sure you want to delete this ${getTypeLabel(okrt.type)}? This action cannot be undone.`;
      if (!window.confirm(confirmMessage)) {
        setDeleting(false);
        return;
      }
      
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Error deleting OKRT:', error);
      setErrors({ general: 'Failed to delete. Please try again.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!okrt || !onSave) return;
    if (okrt.type !== 'O') return;

    const visibility = okrt.visibility || formData.visibility;
    if (visibility === 'shared') {
      setErrors({
        general: 'This objective is shared. Remove sharing first, then try again.'
      });
      return;
    }

    setArchiving(true);
    setErrors(prev => ({ ...prev, general: undefined }));

    try {
      await onSave({ status: 'R' });
      onClose();
    } catch (error) {
      console.error('Error archiving OKRT:', error);
      setErrors({ general: 'Failed to archive. Please try again.' });
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!okrt || !onSave) return;
    if (okrt.type !== 'O') return;

    setUnarchiving(true);
    setErrors(prev => ({ ...prev, general: undefined }));

    try {
      await onSave({ status: 'A' });
      onClose();
    } catch (error) {
      console.error('Error unarchiving OKRT:', error);
      setErrors({ general: 'Failed to unarchive. Please try again.' });
    } finally {
      setUnarchiving(false);
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

  const calendarAppendTarget = typeof window !== 'undefined' ? document.body : undefined;

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
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>
                Title <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
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

          {/* Parent Objective - Only show for Objectives */}
          {formData.type === 'O' && (
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>Parent Objective</label>
              <select
                className={styles.select}
                value={formData.parent_objective_id}
                onChange={e => handleInputChange('parent_objective_id', e.target.value)}
              >
                <option value="">No parent objective (standalone)</option>
                {availableObjectives.map(objective => (
                  <option key={objective.id} value={objective.id}>
                    {objective.owner_name} - {objective.title}
                  </option>
                ))}
              </select>
              {errors.parent_objective_id && <span className={styles.errorText}>{errors.parent_objective_id}</span>}
            </div>
          )}

          {/* Area and Cycle - Only show for Objectives */}
          {formData.type === 'O' && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Area</label>
                <select
                  className={styles.select}
                  value={formData.area}
                  onChange={e => handleInputChange('area', e.target.value)}
                >
                  <option value="">Select area</option>
                  {AREAS.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Cycle Quarter</label>
                <select
                  className={styles.select}
                  value={formData.cycle_qtr}
                  onChange={e => handleInputChange('cycle_qtr', e.target.value)}
                >
                  <option value="">Select quarter</option>
                  {quarterOptions.map(quarter => (
                    <option key={quarter} value={quarter}>{quarter}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Progress and Due Date */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Progress (%)</label>
              <input
                type="number"
                className={styles.input}
                value={formData.progress === '' ? '' : formData.progress}
                onChange={e => {
                  const val = e.target.value;
                  handleInputChange('progress', val === '' ? '' : Number(val));
                }}
                min={0}
                max={100}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Due Date</label>
              <Calendar
                value={formData.due_date ? new Date(formData.due_date + 'T00:00:00') : null}
                onChange={(e) => {
                  if (e.value) {
                    const date = new Date(e.value);
                    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                    const dateStr = localDate.toISOString().split('T')[0];
                    handleInputChange('due_date', dateStr);
                  } else {
                    handleInputChange('due_date', '');
                  }
                }}
                className={`${errors.due_date ? styles.inputError : ''}`}
                dateFormat="yy-mm-dd"
                showIcon
                showButtonBar
                monthNavigator
                yearNavigator
                yearRange={`${new Date().getFullYear()}:${new Date().getFullYear() + 5}`}
                showOtherMonths={false}
                selectOtherMonths={false}
                appendTo={calendarAppendTarget}
              />
              {errors.due_date && <span className={styles.errorText}>{errors.due_date}</span>}
            </div>
          </div>

          {/* Type-specific fields */}
          
          {/* Objective-specific fields */}
          {formData.type === 'O' && (
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>Objective Kind</label>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="objective_kind"
                    value="committed"
                    checked={formData.objective_kind === 'committed'}
                    onChange={e => handleInputChange('objective_kind', e.target.value)}
                  />
                  Committed
                </label>
                <label className={styles.radioLabel}>
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
          )}

          {/* Key Result-specific fields */}
          {formData.type === 'K' && (
            <>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Target Number <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="number"
                    className={`${styles.input} ${errors.kr_target_number ? styles.inputError : ''}`}
                    value={formData.kr_target_number}
                    onChange={e => handleInputChange('kr_target_number', Number(e.target.value))}
                    min={0}
                  />
                  {errors.kr_target_number && (
                    <span className={styles.errorText}>{errors.kr_target_number}</span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Unit</label>
                  <select
                    className={styles.select}
                    value={formData.kr_unit}
                    onChange={e => handleInputChange('kr_unit', e.target.value)}
                  >
                    {KR_UNITS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Baseline Number</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={formData.kr_baseline_number}
                    onChange={e => handleInputChange('kr_baseline_number', e.target.value === '' ? '' : Number(e.target.value))}
                    min={0}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Weight</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={formData.weight}
                    onChange={e => handleInputChange('weight', Number(e.target.value))}
                    min={0.1}
                    max={5}
                    step={0.1}
                  />
                </div>
              </div>


            </>
          )}

          {/* Task-specific fields */}
          {formData.type === 'T' && (
            <>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Task Status</label>
                  <select
                    className={styles.select}
                    value={formData.task_status}
                    onChange={e => handleInputChange('task_status', e.target.value)}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Weight</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={formData.weight}
                    onChange={e => handleInputChange('weight', Number(e.target.value))}
                    min={0.1}
                    max={5}
                    step={0.1}
                  />
                </div>
              </div>

            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          {mode === 'edit' && onDelete && (
            <div style={{ display: 'flex', gap: '0.75rem', marginRight: 'auto' }}>
              {okrt?.type === 'O' && (
                okrt?.status === 'R' ? (
                  <button
                    className={styles.archiveButton}
                    onClick={handleUnarchive}
                    disabled={saving || deleting || archiving || unarchiving}
                  >
                    {unarchiving ? 'Restoring...' : 'Restore'}
                  </button>
                ) : (
                  <button
                    className={styles.archiveButton}
                    onClick={handleArchive}
                    disabled={saving || deleting || archiving || unarchiving}
                  >
                    {archiving ? 'Archiving...' : 'Archive'}
                  </button>
                )
              )}
              <button
                className={styles.deleteButton}
                onClick={handleDelete}
                disabled={saving || deleting || archiving || unarchiving}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  {deleting ? 'Deleting...' : 'Delete'}
                </span>
              </button>
            </div>
          )}
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={saving || deleting || archiving || unarchiving}
          >
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving || deleting || archiving || unarchiving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
