'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function CreateGroup() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'Group'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/groups');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create group');
      }
    } catch (err) {
      setError('An error occurred while creating the group');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Create New Group</h1>
        <button 
          onClick={() => router.back()}
          className={styles.backButton}
        >
          ← Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}
        
        <div className={styles.formGroup}>
          <label htmlFor="name">Group Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter group name"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="type">Group Type</label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
          >
            <option value="Organisation">Organisation</option>
            <option value="Department">Department</option>
            <option value="Team">Team</option>
            <option value="Chapter">Chapter</option>
            <option value="Squad">Squad</option>
            <option value="Tribe">Tribe</option>
            <option value="Group">Group</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter group description (optional)"
            rows={4}
          />
        </div>

        <div className={styles.actions}>
          <button 
            type="button" 
            onClick={() => router.back()}
            className={styles.cancelButton}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading || !formData.name.trim()}
            className={styles.submitButton}
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
}