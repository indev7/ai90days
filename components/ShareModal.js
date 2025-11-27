'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { processCacheUpdateFromData } from '@/lib/apiClient';
import styles from './ShareModal.module.css';

export default function ShareModal({ isOpen, onClose, okrtId, currentVisibility = 'private' }) {
  const [visibility, setVisibility] = useState(currentVisibility);
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setVisibility(currentVisibility);
      fetchGroups();
      fetchCurrentShares();
    }
  }, [isOpen, currentVisibility, okrtId]);

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups');
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups.sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const fetchCurrentShares = async () => {
    try {
      const response = await fetch(`/api/okrt/${okrtId}/share`);
      if (response.ok) {
        const data = await response.json();
        const groupShares = data.shares.filter(s => s.share_type === 'G');
        const userShares = data.shares.filter(s => s.share_type === 'U');
        
        setSelectedGroups(groupShares.map(s => s.group_or_user_id));
        setSelectedUsers(userShares.map(s => s.group_or_user_id));
        setVisibility(data.visibility);
      }
    } catch (err) {
      console.error('Error fetching current shares:', err);
    }
  };

  const handleVisibilityChange = (newVisibility) => {
    setVisibility(newVisibility);
    if (newVisibility === 'private') {
      setSelectedGroups([]);
      setSelectedUsers([]);
    }
  };

  const handleGroupToggle = (groupId) => {
    setSelectedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleAddUser = () => {
    if (newUserEmail.trim() && !selectedUsers.includes(newUserEmail.trim())) {
      setSelectedUsers(prev => [...prev, newUserEmail.trim()]);
      setNewUserEmail('');
    }
  };

  const handleRemoveUser = (email) => {
    setSelectedUsers(prev => prev.filter(e => e !== email));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/okrt/${okrtId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visibility,
          groups: selectedGroups,
          users: selectedUsers,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        processCacheUpdateFromData(data);
        setVisibility(data.visibility || visibility);
        setSuccess('Sharing settings updated successfully!');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(data.error || 'Failed to update sharing settings');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Share Objective</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.content}>
          {error && (
            <div className={styles.error}>{error}</div>
          )}
          
          {success && (
            <div className={styles.success}>{success}</div>
          )}

          {/* Visibility Toggle */}
          <div className={styles.section}>
            <label className={styles.sectionTitle}>Visibility</label>
            <div className={styles.visibilityToggle}>
              <button
                className={`${styles.toggleButton} ${visibility === 'private' ? styles.active : ''}`}
                onClick={() => handleVisibilityChange('private')}
              >
                Private
              </button>
              <button
                className={`${styles.toggleButton} ${visibility === 'shared' ? styles.active : ''}`}
                onClick={() => handleVisibilityChange('shared')}
              >
                Shared
              </button>
            </div>
          </div>

          {visibility === 'shared' && (
            <>
              {/* Groups Section */}
              <div className={styles.section}>
                <label className={styles.sectionTitle}>Share with Groups</label>
                <div className={styles.groupsList}>
                  {groups.map((group) => (
                    <div key={group.id} className={styles.groupItem}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(group.id)}
                          onChange={() => handleGroupToggle(group.id)}
                          className={styles.checkbox}
                        />
                        <div className={styles.groupInfo}>
                          <img
                            src={group.thumbnail_url || '/brand/90d-logo.png'}
                            alt="Group thumbnail"
                            className={styles.groupThumbnail}
                          />
                          <div className={styles.groupDetails}>
                            <div className={styles.groupName}>{group.name}</div>
                            <div className={styles.groupType}>{group.type}</div>
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                
                {selectedGroups.length > 0 && (
                  <div className={styles.selectedGroups}>
                    <div className={styles.selectedTitle}>Selected Groups:</div>
                    <div className={styles.selectedList}>
                      {selectedGroups.map(groupId => {
                        const group = groups.find(g => g.id === groupId);
                        return group ? (
                          <span key={groupId} className={styles.selectedTag}>
                            {group.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Users Section */}
              <div className={styles.section}>
                <label className={styles.sectionTitle}>Share with Users</label>
                <div className={styles.userInput}>
                  <input
                    type="email"
                    placeholder="Enter user email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddUser()}
                    className={styles.emailInput}
                  />
                  <button
                    onClick={handleAddUser}
                    className={styles.addButton}
                    disabled={!newUserEmail.trim()}
                  >
                    <Plus className={styles.addIcon} />
                    Add
                  </button>
                </div>

                {selectedUsers.length > 0 && (
                  <div className={styles.selectedUsers}>
                    <div className={styles.selectedTitle}>Selected Users:</div>
                    <div className={styles.usersList}>
                      {selectedUsers.map((email) => (
                        <div key={email} className={styles.userItem}>
                          <span className={styles.userEmail}>{email}</span>
                          <button
                            onClick={() => handleRemoveUser(email)}
                            className={styles.removeButton}
                            aria-label="Remove user"
                          >
                            <Trash2 className={styles.removeIcon} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
