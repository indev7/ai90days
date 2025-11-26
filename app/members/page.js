'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import styles from './page.module.css';

export default function MembersPage() {
  const router = useRouter();
  const { user: currentUser, isLoading: userLoading } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check if user is Admin
  useEffect(() => {
    if (!userLoading && currentUser) {
      if (currentUser.role !== 'Admin') {
        router.push('/dashboard');
      }
    }
  }, [currentUser, userLoading, router]);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users?all=true');
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }
        const data = await response.json();
        setUsers(data.users);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser && currentUser.role === 'Admin') {
      fetchUsers();
    }
  }, [currentUser]);

  const handleUserClick = (user) => {
    setSelectedUser({
      id: user.id,
      display_name: user.display_name || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      role: user.role || 'User'
    });
    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: selectedUser.display_name,
          first_name: selectedUser.first_name,
          last_name: selectedUser.last_name,
          email: selectedUser.email,
          role: selectedUser.role
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      const data = await response.json();
      
      // Update users list
      setUsers(users.map(u => u.id === data.user.id ? data.user : u));
      
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSelectedUser(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (userLoading || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Members</h1>
        <p className={styles.subtitle}>Manage user accounts and roles</p>
      </div>

      <div className={styles.usersGrid}>
        {users.map(user => (
          <div
            key={user.id}
            className={styles.userCard}
            onClick={() => handleUserClick(user)}
          >
            <div className={styles.userAvatar}>
              {user.profile_picture_url ? (
                <img src={user.profile_picture_url} alt={user.display_name} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {(user.display_name || user.email).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user.display_name || user.email}</div>
              <div className={styles.userEmail}>{user.email}</div>
              <div className={styles.userMeta}>
                <span className={`${styles.roleBadge} ${styles[`role${user.role}`]}`}>
                  {user.role || 'User'}
                </span>
                <span className={styles.authProvider}>
                  {user.auth_provider === 'microsoft' ? 'Microsoft' : 'Email'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Edit User</h2>
              <button
                className={styles.closeButton}
                onClick={handleCloseModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Display Name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={selectedUser.display_name}
                  onChange={e => handleInputChange('display_name', e.target.value)}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>First Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={selectedUser.first_name}
                    onChange={e => handleInputChange('first_name', e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Last Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={selectedUser.last_name}
                    onChange={e => handleInputChange('last_name', e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <input
                  type="email"
                  className={styles.input}
                  value={selectedUser.email}
                  onChange={e => handleInputChange('email', e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Role</label>
                <select
                  className={styles.select}
                  value={selectedUser.role}
                  onChange={e => handleInputChange('role', e.target.value)}
                >
                  <option value="User">User</option>
                  <option value="Leader">Leader</option>
                  <option value="Owner">Owner</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.cancelButton}
                onClick={handleCloseModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className={styles.saveButton}
                onClick={handleSaveUser}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}