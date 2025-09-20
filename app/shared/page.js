'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RiUserSharedLine } from 'react-icons/ri';
import { GrTrophy } from 'react-icons/gr';
import { FaUser } from 'react-icons/fa';
import styles from './page.module.css';

export default function SharedGoalsPage() {
  const [sharedOKRTs, setSharedOKRTs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followingLoading, setFollowingLoading] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchCurrentUser();
    fetchSharedOKRTs();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/me');
      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData.user); // Extract the user object from the response
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchSharedOKRTs = async () => {
    try {
      const response = await fetch('/api/shared');
      if (response.ok) {
        const data = await response.json();
        setSharedOKRTs(data.okrts);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch shared goals');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'O':
        return <GrTrophy className={styles.typeIcon} />;
      case 'K':
        return <span className={styles.typeIcon}>🎯</span>;
      case 'T':
        return <span className={styles.typeIcon}>✓</span>;
      default:
        return null;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'O':
        return 'Objective';
      case 'K':
        return 'Key Result';
      case 'T':
        return 'Task';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'A':
        return 'var(--success)';
      case 'C':
        return 'var(--brand-primary)';
      case 'D':
      default:
        return 'var(--text-secondary)';
    }
  };

  const handleOKRTClick = (okrtId) => {
    router.push(`/okrt/${okrtId}`);
  };

  const handleFollowToggle = async (okrtId, isCurrentlyFollowing, event) => {
    event.stopPropagation(); // Prevent card click
    
    setFollowingLoading(prev => ({ ...prev, [okrtId]: true }));
    
    try {
      const method = isCurrentlyFollowing ? 'DELETE' : 'POST';
      const response = await fetch('/api/follow', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ objective_id: okrtId }),
      });

      if (response.ok) {
        // Update the local state
        setSharedOKRTs(prev =>
          prev.map(okrt =>
            okrt.id === okrtId
              ? { ...okrt, is_following: isCurrentlyFollowing ? 0 : 1 }
              : okrt
          ).sort((a, b) => {
            // Sort followed items to the top
            if (a.is_following && !b.is_following) return -1;
            if (!a.is_following && b.is_following) return 1;
            return new Date(b.updated_at) - new Date(a.updated_at);
          })
        );
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update follow status');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setFollowingLoading(prev => ({ ...prev, [okrtId]: false }));
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <RiUserSharedLine className={styles.pageIcon} />
            <h1>Shared Goals</h1>
          </div>
        </div>
        <div className={styles.loading}>Loading shared goals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <RiUserSharedLine className={styles.pageIcon} />
            <h1>Shared Goals</h1>
          </div>
        </div>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <RiUserSharedLine className={styles.pageIcon} />
          <h1>Shared Goals</h1>
          <span className={styles.count}>({sharedOKRTs.length})</span>
        </div>
      </div>

      {sharedOKRTs.length === 0 ? (
        <div className={styles.emptyState}>
          <RiUserSharedLine className={styles.emptyIcon} />
          <h3>No Shared Goals</h3>
          <p>Goals shared with you by other users or groups will appear here.</p>
        </div>
      ) : (
        <div className={styles.okrtGrid}>
          {sharedOKRTs.map((okrt) => (
            <div
              key={okrt.id}
              className={`${styles.okrtCard} ${okrt.is_following ? styles.followedCard : ''}`}
              onClick={() => handleOKRTClick(okrt.id)}
            >
              <div className={styles.cardHeader}>
                <div className={styles.typeInfo}>
                  {getTypeIcon(okrt.type)}
                  <span className={styles.typeLabel}>{getTypeLabel(okrt.type)}</span>
                </div>
                <div className={styles.headerActions}>
                  <div className={styles.ownerInfo}>
                    <FaUser className={styles.ownerIcon} />
                    <span className={styles.ownerName}>{okrt.owner_name}</span>
                  </div>
                  {currentUser && String(okrt.owner_id) !== String(currentUser.id) && (
                    <button
                      className={`${styles.followButton} ${okrt.is_following ? styles.following : ''}`}
                      onClick={(e) => handleFollowToggle(okrt.id, okrt.is_following, e)}
                      disabled={followingLoading[okrt.id]}
                      title={okrt.is_following ? 'Unfollow' : 'Follow'}
                    >
                      {followingLoading[okrt.id] ? (
                        <span className={styles.spinner}>⟳</span>
                      ) : (
                        <span className={styles.followText}>
                          {okrt.is_following ? 'Unfollow' : 'Follow'}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.cardContent}>
                <h3 className={styles.title}>{okrt.title}</h3>
                {okrt.description && (
                  <p className={styles.description}>{okrt.description}</p>
                )}
              </div>

              <div className={styles.cardFooter}>
                <div className={styles.progressSection}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${okrt.progress}%` }}
                    />
                  </div>
                  <span className={styles.progressText}>{okrt.progress}%</span>
                </div>
                <div
                  className={styles.status}
                  style={{ color: getStatusColor(okrt.status) }}
                >
                  {okrt.status === 'D' && 'Draft'}
                  {okrt.status === 'A' && 'Active'}
                  {okrt.status === 'C' && 'Complete'}
                </div>
              </div>

              {okrt.area && (
                <div className={styles.area}>
                  <span className={styles.areaLabel}>Area:</span>
                  <span className={styles.areaValue}>{okrt.area}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}