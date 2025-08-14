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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          
          // Use actual first/last names if available, otherwise split display name
          setFormData(prev => ({
            ...prev,
            firstName: data.user.firstName || data.user.displayName.split(' ')[0] || '',
            lastName: data.user.lastName || data.user.displayName.split(' ').slice(1).join(' ') || '',
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

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
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
          setFormData(prev => ({
            ...prev,
            firstName: userData.user.firstName || userData.user.displayName.split(' ')[0] || '',
            lastName: userData.user.lastName || userData.user.displayName.split(' ').slice(1).join(' ') || '',
          }));
        }
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setSuccess('');
    
    // Reset form data
    setFormData({
      firstName: user.firstName || user.displayName.split(' ')[0] || '',
      lastName: user.lastName || user.displayName.split(' ').slice(1).join(' ') || '',
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
                    <input
                      type="password"
                      id="currentPassword"
                      name="currentPassword"
                      value={formData.currentPassword}
                      onChange={handleInputChange}
                      className={styles.input}
                      autoComplete="current-password"
                    />
                  </div>
                  
                  <div className={styles.field}>
                    <label htmlFor="newPassword" className={styles.label}>New Password</label>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      className={styles.input}
                      autoComplete="new-password"
                      placeholder="8+ characters with letters and numbers"
                    />
                  </div>
                  
                  <div className={styles.field}>
                    <label htmlFor="confirmPassword" className={styles.label}>Confirm New Password</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={styles.input}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              {isEditing ? (
                <>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                  <button type="button" onClick={handleCancel} className="btn btn-secondary">
                    {success ? 'Done' : 'Cancel'}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setIsEditing(true)} className="btn btn-primary">
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
