'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const EyeIcon = ({ isVisible }) => (
    <svg
      className={styles.toggleIcon}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {isVisible ? (
        <>
          <path
            d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="12"
            r="3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </>
      ) : (
        <>
          <path
            d="M3 3l18 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88M9.88 9.88 6.5 6.5m7.62 7.62 3.38 3.38m-1.64-4.96A7.8 7.8 0 0 1 21 12s-3.5-6-9-6a8.1 8.1 0 0 0-3.16.63m-2.3 1.32C4.3 9.54 3 12 3 12s1.3 2.46 3.54 3.54"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
  const getCurrentNameParts = (userData) => ({
    first: userData?.firstName || userData?.displayName?.split(' ')[0] || '',
    last: userData?.lastName || userData?.displayName?.split(' ').slice(1).join(' ') || '',
  });
  const hasChanges = (() => {
    if (!user) return false;
    const { first: currentFirstName, last: currentLastName } = getCurrentNameParts(user);
    const nameChanged =
      formData.firstName.trim() !== currentFirstName || formData.lastName.trim() !== currentLastName;
    const passwordChanged =
      formData.currentPassword || formData.newPassword || formData.confirmPassword;
    return nameChanged || passwordChanged;
  })();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          
          // Use actual first/last names if available, otherwise split display name
          const { first, last } = getCurrentNameParts(data.user);
          setFormData(prev => ({
            ...prev,
            firstName: first,
            lastName: last,
          }));
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const trimmedFirstName = formData.firstName.trim();
      const trimmedLastName = formData.lastName.trim();
      const { first: currentFirstName, last: currentLastName } = getCurrentNameParts(user);
      const hasNameChange =
        trimmedFirstName !== currentFirstName || trimmedLastName !== currentLastName;
      const hasPasswordChange =
        formData.currentPassword || formData.newPassword || formData.confirmPassword;

      if (!hasNameChange && !hasPasswordChange) {
        return;
      }

      const updateData = {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      };

      // Only include password if provided
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          setError('New passwords do not match');
          return;
        }
        if (!formData.currentPassword) {
          setError('Current password is required to change password');
          return;
        }
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Profile updated successfully');
        // Keep edit mode open after successful save
        // setIsEditing(false);
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
        
        // Refresh user data
        const userResponse = await fetch('/api/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData.user);
          // Update form data with new values
          const { first, last } = getCurrentNameParts(userData.user);
          setFormData(prev => ({
            ...prev,
            firstName: first,
            lastName: last,
          }));
        }
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
    setSuccess('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setSuccess('');
    
    // Reset form data
    const { first, last } = getCurrentNameParts(user);
    setFormData({
      firstName: first,
      lastName: last,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Profile</h1>
          <p className={styles.subtitle}>Manage your account information</p>
        </div>

        <div className={styles.card}>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          
          {success && (
            <div className={styles.success} role="alert">
              {success}
            </div>
          )}

          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Personal Information</h2>
              
              <div className={styles.info}>
                <div className={styles.field}>
                  <label htmlFor="firstName" className={styles.label}>First Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                    />
                  ) : (
                    <div className={styles.value}>{formData.firstName || 'Not set'}</div>
                  )}
                </div>
                
                <div className={styles.field}>
                  <label htmlFor="lastName" className={styles.label}>Last Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={styles.input}
                    />
                  ) : (
                    <div className={styles.value}>{formData.lastName || 'Not set'}</div>
                  )}
                </div>
                
                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <div className={styles.value + ' ' + styles.readonly}>{user.username}</div>
                </div>
              </div>
            </div>

            {isEditing && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Change Password (Optional)</h2>
                
                <div className={styles.info}>
                  <div className={styles.field}>
                    <label htmlFor="currentPassword" className={styles.label}>Current Password</label>
                    <div className={styles.passwordField}>
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        id="currentPassword"
                        name="currentPassword"
                        value={formData.currentPassword}
                        onChange={handleInputChange}
                        className={styles.input}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={() => togglePasswordVisibility('current')}
                        aria-label={showPasswords.current ? 'Hide current password' : 'Show current password'}
                      >
                        <EyeIcon isVisible={showPasswords.current} />
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.field}>
                    <label htmlFor="newPassword" className={styles.label}>New Password</label>
                    <div className={styles.passwordField}>
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        id="newPassword"
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        className={styles.input}
                        autoComplete="new-password"
                        placeholder="8+ characters with letters and numbers"
                      />
                      <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={() => togglePasswordVisibility('new')}
                        aria-label={showPasswords.new ? 'Hide new password' : 'Show new password'}
                      >
                        <EyeIcon isVisible={showPasswords.new} />
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.field}>
                    <label htmlFor="confirmPassword" className={styles.label}>Confirm New Password</label>
                    <div className={styles.passwordField}>
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className={styles.input}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={() => togglePasswordVisibility('confirm')}
                        aria-label={showPasswords.confirm ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        <EyeIcon isVisible={showPasswords.confirm} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              {isEditing ? (
                <>
                  <button type="submit" className="btn btn-primary" disabled={!hasChanges}>
                    Save Changes
                  </button>
                  <button type="button" onClick={handleCancel} className="btn btn-secondary">
                    {success ? 'Done' : 'Cancel'}
                  </button>
                </>
              ) : (
                <button type="button" onClick={handleEdit} className="btn btn-primary">
                  Edit Profile
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
