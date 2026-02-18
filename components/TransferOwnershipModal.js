'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './OKRTModal.module.css';
import { processCacheUpdateFromData } from '@/lib/apiClient';

export default function TransferOwnershipModal({
  isOpen,
  onClose,
  objective,
  onTransferred
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setShowDropdown(false);
      setSelectedUser(null);
      setError('');
      setSuccess('');
      setSaving(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const searchUsers = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/users?q=${encodeURIComponent(query.trim())}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        const ownerId = objective?.owner_id;
        const filtered = (data.users || []).filter(
          (user) => String(user.id) !== String(ownerId)
        );
        setSearchResults(filtered);
        setShowDropdown(filtered.length > 0);
      }
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSelectedUser(null);
    setError('');
    setSuccess('');
    searchUsers(query);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchQuery(user.email || user.display_name || '');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleTransfer = async () => {
    if (!objective?.id || !selectedUser?.id) {
      setError('Please select a user to transfer ownership to.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/okrt/${objective.id}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ target_user_id: selectedUser.id })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to transfer ownership.');
        return;
      }

      processCacheUpdateFromData(data);
      setSuccess('Ownership transferred successfully.');

      if (onTransferred) {
        onTransferred(data);
      }

      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err) {
      console.error('Error transferring ownership:', err);
      setError('Network error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !objective) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Transfer Ownership</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div className={`${styles.modalBody} ${styles.modalBodySingle}`}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && <div className={styles.successMessage}>{success}</div>}

          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label className={styles.label}>
              Transfer to (email)
            </label>
            <div className={styles.searchWrapper} ref={searchRef}>
              <input
                type="text"
                className={styles.input}
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by name or email"
                disabled={saving}
              />
              {showDropdown && (
                <div className={styles.searchResults}>
                  {searchResults.map((user) => {
                    const name = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ');
                    return (
                      <div
                        key={user.id}
                        className={styles.searchItem}
                        onClick={() => handleSelectUser(user)}
                      >
                        <div className={styles.searchItemName}>{name || user.email}</div>
                        {user.email && <div className={styles.searchItemEmail}>{user.email}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {searching && <div className={styles.helperText}>Searching...</div>}
            {selectedUser && (
              <div className={styles.selectedUser}>
                <div className={styles.selectedUserInfo}>
                  <div className={styles.selectedUserName}>
                    {selectedUser.display_name || [selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(' ') || selectedUser.email}
                  </div>
                  {selectedUser.email && (
                    <div className={styles.selectedUserEmail}>{selectedUser.email}</div>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.clearSelectionButton}
                  onClick={handleClearSelection}
                  disabled={saving}
                >
                  Clear
                </button>
              </div>
            )}
            <div className={styles.helperText}>
              Ownership will be transferred for this objective, its key results, and tasks.
            </div>
          </div>
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
            onClick={handleTransfer}
            disabled={saving || !selectedUser}
          >
            {saving ? 'Transferring...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
