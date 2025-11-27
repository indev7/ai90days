'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import styles from './OKRTModal.module.css'; // Reuse OKRT modal styles
import { useUser } from '@/hooks/useUser';

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
  onDelete = null, // Delete handler
  onMemberRemoved = null, // Callback when member is removed
  existingMembersFromMainTree, // Members from mainTree (for edit mode)
  mainTree = null // MainTree data for objectives
}) {
  const { user: currentUser } = useUser();
  const [formData, setFormData] = useState({
    name: '',
    type: 'Group',
    parent_group_id: '',
    vision: '',
    mission: '',
    members: [], // Array of selected users with admin status
    strategic_objectives: [] // Array of selected objective IDs
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  
  // User search states
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const memberSearchRef = useRef(null);
  
  // Existing members state (for edit mode)
  const [existingMembers, setExistingMembers] = useState([]);

  // Get available objectives from mainTree
  const availableObjectives = useMemo(() => {
    if (!mainTree || !mainTree.sharedOKRTs || !mainTree.groups) {
      return [];
    }

    return mainTree.sharedOKRTs
      .filter(okrt => okrt.type === 'O') // Only objectives
      .map(okrt => {
        // Find which groups this objective is shared with
        const sharedGroupNames = mainTree.groups
          .filter(group => group.objectiveIds?.includes(okrt.id))
          .map(group => group.name)
          .join(', ') || 'No Group';

        return {
          id: okrt.id,
          title: okrt.title,
          owner_name: okrt.owner_name,
          sharedGroups: sharedGroupNames
        };
      });
  }, [mainTree]);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingGroup) {
        // Edit mode - populate with existing data
        setFormData({
          name: editingGroup.name || '',
          type: editingGroup.type || 'Group',
          parent_group_id: editingGroup.parent_group_id || '',
          vision: editingGroup.vision || '',
          mission: editingGroup.mission || '',
          members: [], // Start with empty members for edit mode
          strategic_objectives: editingGroup.strategicObjectiveIds || []
        });
        // Set existing members from mainTree
        setExistingMembers(existingMembersFromMainTree || []);
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          type: 'Group',
          parent_group_id: '',
          vision: '',
          mission: '',
          members: [],
          strategic_objectives: []
        });
        setMemberSearchQuery('');
        setMemberSearchResults([]);
        setShowMemberDropdown(false);
        setExistingMembers([]);
      }
      setErrors({});
    }
  }, [isOpen, editingGroup, existingMembersFromMainTree]);

  // Handle clicks outside member search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (memberSearchRef.current && !memberSearchRef.current.contains(event.target)) {
        setShowMemberDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Search for users
  const searchMembers = async (query) => {
    if (!query || query.trim().length < 2) {
      setMemberSearchResults([]);
      setShowMemberDropdown(false);
      return;
    }

    setSearchingMembers(true);
    try {
      const response = await fetch(`/api/users?q=${encodeURIComponent(query.trim())}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        // Filter out already selected members and existing members
        const filteredUsers = data.users.filter(user =>
          !formData.members.some(member => member.id === user.id) &&
          !existingMembers.some(member => member.id === user.id)
        );
        setMemberSearchResults(filteredUsers);
        setShowMemberDropdown(filteredUsers.length > 0);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchingMembers(false);
    }
  };

  // Handle member search input change
  const handleMemberSearchChange = (e) => {
    const query = e.target.value;
    setMemberSearchQuery(query);
    searchMembers(query);
  };

  // Add member to selection
  const addMember = (user) => {
    setFormData(prev => ({
      ...prev,
      members: [...prev.members, { ...user, isAdmin: false }]
    }));
    setMemberSearchQuery('');
    setMemberSearchResults([]);
    setShowMemberDropdown(false);
  };

  // Remove member from selection
  const removeMember = (userId) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter(member => member.id !== userId)
    }));
  };

  // Toggle admin status for a member
  const toggleMemberAdmin = (userId) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.map(member =>
        member.id === userId
          ? { ...member, isAdmin: !member.isAdmin }
          : member
      )
    }));
  };

  // State for selected items in the listboxes
  const [selectedAvailable, setSelectedAvailable] = useState([]);
  const [selectedStrategic, setSelectedStrategic] = useState([]);

  // Get available objectives (not yet selected)
  const availableForSelection = useMemo(() => {
    return availableObjectives.filter(obj =>
      !formData.strategic_objectives.includes(obj.id)
    );
  }, [availableObjectives, formData.strategic_objectives]);

  // Get selected strategic objectives with details
  const selectedStrategicObjectives = useMemo(() => {
    return formData.strategic_objectives
      .map(id => availableObjectives.find(obj => obj.id === id))
      .filter(Boolean);
  }, [formData.strategic_objectives, availableObjectives]);

  // Add selected objectives to strategic objectives
  const handleAddObjectives = () => {
    if (formData.strategic_objectives.length + selectedAvailable.length > 5) {
      alert('You can only select up to 5 strategic objectives');
      return;
    }
    setFormData(prev => ({
      ...prev,
      strategic_objectives: [...prev.strategic_objectives, ...selectedAvailable]
    }));
    setSelectedAvailable([]);
  };

  // Remove selected objectives from strategic objectives
  const handleRemoveObjectives = () => {
    setFormData(prev => ({
      ...prev,
      strategic_objectives: prev.strategic_objectives.filter(id =>
        !selectedStrategic.includes(id)
      )
    }));
    setSelectedStrategic([]);
  };

  // Remove existing member from group
  const removeExistingMember = async (userId) => {
    if (!editingGroup) return;
    
    try {
      const response = await fetch(`/api/groups/${editingGroup.id}/members/${userId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Remove from existing members list
        setExistingMembers(prev => prev.filter(member => member.id !== userId));
        
        // Notify parent component to refresh group details
        if (onMemberRemoved) {
          onMemberRemoved(editingGroup.id);
        }
      } else {
        console.error('Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

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

  const validateForm = async () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Group name is required';
    }
    
    if (!formData.type) {
      newErrors.type = 'Group type is required';
    }
    
    // Check for duplicate Organisation group
    if (formData.type === 'Organisation') {
      const existingOrgGroup = groups.find(g =>
        g.type === 'Organisation' && (!editingGroup || g.id !== editingGroup.id)
      );
      
      if (existingOrgGroup) {
        newErrors.general = 'An Organisation already exists. There can be only one group of type Organisation';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!(await validateForm())) return;
    
    setSaving(true);
    
    try {
      const saveData = { ...formData };
      
      // Convert empty parent_group_id to null
      if (!saveData.parent_group_id) {
        saveData.parent_group_id = null;
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
                {GROUP_TYPES.filter(type => {
                  // Only show "Organisation" option if user is Admin
                  if (type === 'Organisation') {
                    return currentUser?.role === 'Admin';
                  }
                  return true;
                }).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.type && <span className={styles.errorText}>{errors.type}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Parent Group</label>
              <select
                className={styles.select}
                value={formData.parent_group_id || ''}
                onChange={e => handleInputChange('parent_group_id', e.target.value)}
              >
                <option value="">No parent (Root group)</option>
                {groups
                  .filter(group => !editingGroup || group.id !== editingGroup.id)
                  .map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.type})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Vision Field */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Vision</label>
            <textarea
              className={styles.textarea}
              value={formData.vision}
              onChange={e => handleInputChange('vision', e.target.value)}
              placeholder="Enter the group's vision statement"
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Mission Field */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>Mission</label>
            <textarea
              className={styles.textarea}
              value={formData.mission}
              onChange={e => handleInputChange('mission', e.target.value)}
              placeholder="Enter the group's mission statement"
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Strategic Objectives Section - Dual Listbox */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>
              Choose Strategic Objectives
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Available Objectives List */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Shared Objectives
                </div>
                <select
                  multiple
                  value={selectedAvailable}
                  onChange={(e) => setSelectedAvailable(Array.from(e.target.selectedOptions, option => option.value))}
                  style={{
                    width: '100%',
                    minHeight: '150px',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {availableForSelection.length === 0 ? (
                    <option disabled>No objectives available</option>
                  ) : (
                    availableForSelection.map(obj => (
                      <option key={obj.id} value={obj.id}>
                        {obj.sharedGroups} - {obj.owner_name} - {obj.title.length > 35 ? obj.title.substring(0, 35) + '...' : obj.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Add/Remove Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleAddObjectives}
                  disabled={selectedAvailable.length === 0 || formData.strategic_objectives.length >= 5}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: selectedAvailable.length > 0 && formData.strategic_objectives.length < 5 ? 'var(--primary)' : 'var(--border)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: selectedAvailable.length > 0 && formData.strategic_objectives.length < 5 ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '500',
                    minWidth: '60px'
                  }}
                  title="Add selected objectives"
                >
                  Add →
                </button>
                <button
                  type="button"
                  onClick={handleRemoveObjectives}
                  disabled={selectedStrategic.length === 0}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: selectedStrategic.length > 0 ? 'var(--primary)' : 'var(--border)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: selectedStrategic.length > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '500',
                    minWidth: '60px'
                  }}
                  title="Remove selected objectives"
                >
                  ← Remove
                </button>
              </div>

              {/* Strategic Objectives List */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Strategic Objectives ({formData.strategic_objectives.length}/5)
                </div>
                <select
                  multiple
                  value={selectedStrategic}
                  onChange={(e) => setSelectedStrategic(Array.from(e.target.selectedOptions, option => option.value))}
                  style={{
                    width: '100%',
                    minHeight: '150px',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {selectedStrategicObjectives.length === 0 ? (
                    <option disabled>No objectives selected</option>
                  ) : (
                    selectedStrategicObjectives.map(obj => (
                      <option key={obj.id} value={obj.id}>
                        {obj.sharedGroups} - {obj.owner_name} - {obj.title.length > 35 ? obj.title.substring(0, 35) + '...' : obj.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
              Select objectives from the left list and click "Add" to add them as strategic objectives. You can select up to 5 objectives.
            </div>
          </div>


          {/* Existing Members Section (Edit Mode Only) */}
          {editingGroup && (
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>Current Members</label>
              {existingMembers.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {existingMembers.map(member => (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        backgroundColor: 'var(--surface-secondary)',
                        borderRadius: '16px',
                        fontSize: '14px',
                        border: member.is_admin ? '1px solid var(--primary)' : '1px solid var(--border)'
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: member.is_admin ? 'var(--primary)' : 'var(--text-secondary)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        {member.display_name?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase()}
                      </div>
                      <span>{member.display_name || member.email}</span>
                      {member.is_admin && (
                        <span style={{
                          fontSize: '10px',
                          color: 'var(--primary)',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}>
                          Admin
                        </span>
                      )}
                      {!member.is_admin && (
                        <button
                          type="button"
                          onClick={() => removeExistingMember(member.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Remove member"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No members in this group yet.
                </div>
              )}
            </div>
          )}

          {/* Add Members Section */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>
              {editingGroup ? 'Add New Members' : 'Add Members'}
            </label>
            <div style={{ position: 'relative' }} ref={memberSearchRef}>
              <input
                type="text"
                className={styles.input}
                value={memberSearchQuery}
                onChange={handleMemberSearchChange}
                placeholder="Search users by name or email..."
                onFocus={() => {
                  if (memberSearchResults.length > 0) {
                    setShowMemberDropdown(true);
                  }
                }}
              />
              
              {/* Search dropdown */}
              {showMemberDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000,
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {searchingMembers ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Searching...
                    </div>
                  ) : memberSearchResults.length > 0 ? (
                    memberSearchResults.map(user => (
                      <div
                        key={user.id}
                        onClick={() => addMember(user)}
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--surface-hover)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}>
                          {user.display_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '500' }}>{user.display_name || user.email}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.email}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No users found
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Selected members */}
            {formData.members.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Selected Members ({formData.members.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {formData.members.map(member => (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: 'var(--surface-secondary)',
                        borderRadius: '12px',
                        border: member.isAdmin ? '1px solid var(--primary)' : '1px solid var(--border)'
                      }}
                    >
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: member.isAdmin ? 'var(--primary)' : 'var(--text-secondary)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        {member.display_name?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase()}
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', fontSize: '14px' }}>
                          {member.display_name || member.email}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {member.email}
                        </div>
                      </div>

                      {/* Admin Toggle Slider */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          minWidth: '35px'
                        }}>
                          Admin
                        </span>
                        <label style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: '44px',
                          height: '24px',
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={member.isAdmin}
                            onChange={() => toggleMemberAdmin(member.id)}
                            style={{ display: 'none' }}
                          />
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: member.isAdmin ? 'var(--primary)' : 'var(--border)',
                            borderRadius: '12px',
                            transition: 'background-color 0.2s ease',
                            cursor: 'pointer'
                          }}>
                            <div style={{
                              position: 'absolute',
                              top: '2px',
                              left: member.isAdmin ? '22px' : '2px',
                              width: '20px',
                              height: '20px',
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              transition: 'left 0.2s ease',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                            }} />
                          </div>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--surface-hover)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        title="Remove member"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              Search and select users to add as members to this group. They will be added when you save the group.
            </div>
          </div>
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
