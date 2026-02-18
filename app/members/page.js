'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineUsers } from 'react-icons/hi2';
import { useUser } from '@/hooks/useUser';
import { useMainTree } from '@/hooks/useMainTree';
import useMainTreeStore from '@/store/mainTreeStore';
import styles from './page.module.css';
import { isValidEmail } from '@/lib/validators';

export default function MembersPage() {
  const router = useRouter();
  const { user: currentUser, isLoading: userLoading } = useUser();
  useMainTree();
  const mainTree = useMainTreeStore((state) => state.mainTree);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedUserEmailError, setSelectedUserEmailError] = useState('');

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
    // Validate email (show inline error near field)
    setSelectedUserEmailError('');
    if (!isValidEmail(selectedUser.email)) {
      setSelectedUserEmailError('Please enter a valid email address');
      setSaving(false);
      return;
    }
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

  const groups = useMemo(() => {
    return (mainTree?.groups || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [mainTree?.groups]);

  const filteredUsers = useMemo(() => {
    const normalizeRole = (role) => String(role || '').toLowerCase();
    const roleFiltered = roleFilter === 'all'
      ? users
      : users.filter((user) => normalizeRole(user.role) === roleFilter);

    if (groupFilter === 'all') {
      return roleFiltered;
    }

    const group = groups.find((g) => String(g.id) === String(groupFilter));
    const memberIds = new Set((group?.members || []).map((member) => String(member.id)));
    return roleFiltered.filter((user) => memberIds.has(String(user.id)));
  }, [users, roleFilter, groupFilter, groups]);

  if (userLoading || loading) {
    return (
      <div className={`app-page ${styles.page}`}>
        <div className="app-pageContent">
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`app-page ${styles.page}`}>
        <div className="app-pageContent">
          <div className={styles.error}>Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-page ${styles.page}`}>
      <div className="app-pageContent app-pageContent--wide">
        <div className="app-pageHeader">
          <div className="app-titleSection">
            <HiOutlineUsers className="app-pageIcon" />
            <h1 className="app-pageTitle">Members</h1>
            <span className="app-pageCount">({filteredUsers.length})</span>
          </div>
          <div className={styles.filtersRow}>
            <label className="app-headerLabel" htmlFor="groupFilter">
              Group
            </label>
            <select
              id="groupFilter"
              className="app-headerSelect"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="all">All</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className={`app-filterSwitcher ${styles.membersFilterSwitcher}`} role="group" aria-label="Role filter">
            <div
              className={`app-filterThumb ${styles.membersFilterThumb} ${
                roleFilter === 'user'
                  ? styles.thumbUser
                  : roleFilter === 'leader'
                    ? styles.thumbLeader
                    : roleFilter === 'owner'
                      ? styles.thumbOwner
                      : roleFilter === 'admin'
                        ? styles.thumbAdmin
                        : styles.thumbAll
              }`}
              aria-hidden="true"
            />
            <button
              type="button"
              className={`app-filterButton ${styles.membersFilterButton} ${roleFilter === 'all' ? 'app-filterButtonActive' : ''}`}
              onClick={() => setRoleFilter('all')}
              aria-pressed={roleFilter === 'all'}
            >
              All
            </button>
            <button
              type="button"
              className={`app-filterButton ${styles.membersFilterButton} ${roleFilter === 'user' ? 'app-filterButtonActive' : ''}`}
              onClick={() => setRoleFilter('user')}
              aria-pressed={roleFilter === 'user'}
            >
              User
            </button>
            <button
              type="button"
              className={`app-filterButton ${styles.membersFilterButton} ${roleFilter === 'leader' ? 'app-filterButtonActive' : ''}`}
              onClick={() => setRoleFilter('leader')}
              aria-pressed={roleFilter === 'leader'}
            >
              Leader
            </button>
            <button
              type="button"
              className={`app-filterButton ${styles.membersFilterButton} ${roleFilter === 'owner' ? 'app-filterButtonActive' : ''}`}
              onClick={() => setRoleFilter('owner')}
              aria-pressed={roleFilter === 'owner'}
            >
              Owner
            </button>
            <button
              type="button"
              className={`app-filterButton ${styles.membersFilterButton} ${roleFilter === 'admin' ? 'app-filterButtonActive' : ''}`}
              onClick={() => setRoleFilter('admin')}
              aria-pressed={roleFilter === 'admin'}
            >
              Admin
            </button>
          </div>
        </div>

        <div className={styles.container}>
          <div className={styles.usersGrid}>
            {filteredUsers.map(user => (
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
        </div>
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
                  onChange={e => {
                    handleInputChange('email', e.target.value);
                    setSelectedUserEmailError('');
                  }}
                />
              </div>
              {selectedUserEmailError && (
                <div className={styles.fieldError} role="alert">{selectedUserEmailError}</div>
              )}

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
