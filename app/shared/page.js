'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RiUserSharedLine } from 'react-icons/ri';
import { GrTrophy } from 'react-icons/gr';
import { FaUser } from 'react-icons/fa';
import styles from './page.module.css';
import useMainTreeStore from '@/store/mainTreeStore';
import { useMainTree } from '@/hooks/useMainTree';

export default function SharedGoalsPage() {
  const [followingLoading, setFollowingLoading] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const router = useRouter();
  
  // Subscribe to mainTreeStore
  const { mainTree, isLoading } = useMainTree();
  const { setSharedOKRTs } = useMainTreeStore();
  const sharedOKRTs = mainTree.sharedOKRTs || [];

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/me');
      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData.user);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
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
    router.push(`/shared/${okrtId}`);
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
        // Update the store with new follow status
        const updatedOKRTs = sharedOKRTs
          .map(okrt =>
            okrt.id === okrtId
              ? { ...okrt, is_following: isCurrentlyFollowing ? 0 : 1 }
              : okrt
          )
          .sort((a, b) => {
            // Sort followed items to the top
            if (a.is_following && !b.is_following) return -1;
            if (!a.is_following && b.is_following) return 1;
            return new Date(b.updated_at) - new Date(a.updated_at);
          });
        
        setSharedOKRTs(updatedOKRTs);
      } else {
        const errorData = await response.json();
        console.error(errorData.error || 'Failed to update follow status');
      }
    } catch (err) {
      console.error('Network error occurred:', err);
    } finally {
      setFollowingLoading(prev => ({ ...prev, [okrtId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <RiUserSharedLine className={styles.pageIcon} />
            <h1>Shared OKRs</h1>
          </div>
        </div>
        <div className={styles.loading}>Loading shared OKRs...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <RiUserSharedLine className={styles.pageIcon} />
          <h1>Shared OKRs</h1>
          <span className={styles.count}>({sharedOKRTs.length})</span>
        </div>
      </div>

      {sharedOKRTs.length === 0 ? (
        <div className={styles.emptyState}>
          <RiUserSharedLine className={styles.emptyIcon} />
          <h3>No Shared OKRs</h3>
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
                      title={okrt.is_following ? 'Following' : 'Follow'}
                    >
                      {followingLoading[okrt.id] ? (
                        <span className={styles.spinner}>⟳</span>
                      ) : (
                        <span className={styles.followText}>
                          {okrt.is_following ? 'Following' : 'Follow'}
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