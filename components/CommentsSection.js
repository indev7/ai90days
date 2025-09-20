'use client';

import React, { useState, useEffect } from 'react';
import styles from './CommentsSection.module.css';

const CommentsSection = ({ okrtId, currentUserId, okrtOwnerId, onRewardUpdate }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [rewardType, setRewardType] = useState('text');
  const [rewardCount, setRewardCount] = useState(1);
  const [replyingTo, setReplyingTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [okrtId]);

  // Reset reward type to 'text' if user is viewing their own objective
  useEffect(() => {
    if (currentUserId === okrtOwnerId && rewardType !== 'text') {
      setRewardType('text');
    }
  }, [currentUserId, okrtOwnerId, rewardType]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/comments?okrtId=${okrtId}`);
      const data = await response.json();
      
      if (response.ok) {
        setComments(data.comments || []);
      } else {
        console.error('Error fetching comments:', data.error);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Validate input
    if (rewardType === 'text' && !newComment.trim()) {
      alert('Please enter a comment');
      return;
    }

    try {
      setSubmitting(true);
      const commentData = {
        okrt_id: okrtId,
        receiving_user: okrtOwnerId,
        type: rewardType,
        parent_comment_id: replyingTo?.id || null
      };

      if (rewardType === 'text') {
        commentData.comment = newComment.trim();
      } else {
        commentData.count = rewardCount;
        // Use the user's comment if provided, otherwise use default message
        commentData.comment = newComment.trim() || `Sent ${rewardCount} ${rewardType}${rewardCount > 1 ? 's' : ''}`;
      }

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commentData),
      });

      const data = await response.json();

      if (response.ok) {
        // Reset form
        setNewComment('');
        setRewardType('text');
        setRewardCount(1);
        setReplyingTo(null);
        setShowCommentForm(false);
        
        // Refresh comments
        await fetchComments();
        
        // Trigger reward update if this was a reward
        if (rewardType !== 'text' && onRewardUpdate) {
          onRewardUpdate();
        }
      } else {
        alert(data.error || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = (comment) => {
    setReplyingTo(comment);
    setShowCommentForm(true);
    setRewardType('text');
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getRewardIcon = (type, count) => {
    const icons = {
      medal: '🏅',
      cookie: '🍪',
      star: '⭐'
    };
    
    if (type === 'text') return null;
    
    const icon = icons[type] || '🎁';
    return count > 1 ? `${icon} x${count}` : icon;
  };

  const organizeComments = (comments) => {
    const topLevel = comments.filter(c => !c.parent_comment_id);
    const replies = comments.filter(c => c.parent_comment_id);
    
    return topLevel.map(comment => ({
      ...comment,
      replies: replies.filter(r => r.parent_comment_id === comment.id)
    }));
  };

  const organizedComments = organizeComments(comments);

  if (loading) {
    return (
      <div className={styles.commentsSection}>
        <div className={styles.loading}>Loading comments...</div>
      </div>
    );
  }

  return (
    <div className={styles.commentsSection}>
      <div className={styles.commentsHeader}>
        <h4>Comments & Rewards</h4>
        <button 
          className={styles.addCommentButton}
          onClick={() => setShowCommentForm(!showCommentForm)}
        >
          {showCommentForm ? 'Cancel' : '+ Add Comment'}
        </button>
      </div>

      {showCommentForm && (
        <form className={styles.commentForm} onSubmit={handleSubmitComment}>
          {replyingTo && (
            <div className={styles.replyingTo}>
              Replying to {replyingTo.sender_name}
              <button 
                type="button" 
                onClick={() => setReplyingTo(null)}
                className={styles.cancelReply}
              >
                ×
              </button>
            </div>
          )}
          
          <div className={styles.commentTypeSelector}>
            <label>
              <input
                type="radio"
                value="text"
                checked={rewardType === 'text'}
                onChange={(e) => setRewardType(e.target.value)}
              />
              Comment
            </label>
            {/* Only show reward options if current user is not the owner */}
            {currentUserId !== okrtOwnerId && (
              <>
                <label>
                  <input
                    type="radio"
                    value="medal"
                    checked={rewardType === 'medal'}
                    onChange={(e) => setRewardType(e.target.value)}
                  />
                  🏅 Medal
                </label>
                <label>
                  <input
                    type="radio"
                    value="cookie"
                    checked={rewardType === 'cookie'}
                    onChange={(e) => setRewardType(e.target.value)}
                  />
                  🍪 Cookie
                </label>
                <label>
                  <input
                    type="radio"
                    value="star"
                    checked={rewardType === 'star'}
                    onChange={(e) => setRewardType(e.target.value)}
                  />
                  ⭐ Star
                </label>
              </>
            )}
          </div>

          <textarea
            className={styles.commentInput}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={rewardType === 'text' ? "Write your comment..." : "Add a reason/comment for this reward..."}
            rows={3}
            required={rewardType === 'text'}
          />

          {rewardType !== 'text' && currentUserId !== okrtOwnerId && (
            <div className={styles.rewardSelector}>
              <label>
                {rewardType === 'medal' ? 'Medals' : rewardType === 'cookie' ? 'Cookies' : 'Stars'} (1-5):
                <select
                  value={rewardCount}
                  onChange={(e) => setRewardCount(parseInt(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className={styles.formActions}>
            <button 
              type="submit" 
              disabled={submitting}
              className={styles.submitButton}
            >
              {submitting ? 'Posting...' : (rewardType === 'text' || currentUserId === okrtOwnerId ? 'Post Comment' : 'Send Reward')}
            </button>
          </div>
        </form>
      )}

      <div className={styles.commentsList}>
        {organizedComments.length === 0 ? (
          <div className={styles.noComments}>
            No comments yet. Be the first to comment!
          </div>
        ) : (
          organizedComments.map((comment) => (
            <div key={comment.id} className={styles.commentThread}>
              <div className={styles.comment}>
                <div className={styles.commentHeader}>
                  <div className={styles.commentAuthor}>
                    {comment.sender_avatar && (
                      <img 
                        src={comment.sender_avatar} 
                        alt={comment.sender_name}
                        className={styles.avatar}
                      />
                    )}
                    <span className={styles.authorName}>{comment.sender_name}</span>
                    <span className={styles.commentDate}>{formatDate(comment.created_at)}</span>
                  </div>
                  {comment.type !== 'text' && (
                    <div className={styles.rewardBadge}>
                      {getRewardIcon(comment.type, comment.count)}
                    </div>
                  )}
                </div>
                <div className={styles.commentContent}>
                  {comment.comment}
                </div>
                <div className={styles.commentActions}>
                  <button 
                    className={styles.replyButton}
                    onClick={() => handleReply(comment)}
                  >
                    Reply
                  </button>
                </div>
              </div>

              {comment.replies && comment.replies.length > 0 && (
                <div className={styles.replies}>
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className={styles.reply}>
                      <div className={styles.commentHeader}>
                        <div className={styles.commentAuthor}>
                          {reply.sender_avatar && (
                            <img 
                              src={reply.sender_avatar} 
                              alt={reply.sender_name}
                              className={styles.avatar}
                            />
                          )}
                          <span className={styles.authorName}>{reply.sender_name}</span>
                          <span className={styles.commentDate}>{formatDate(reply.created_at)}</span>
                        </div>
                        {reply.type !== 'text' && (
                          <div className={styles.rewardBadge}>
                            {getRewardIcon(reply.type, reply.count)}
                          </div>
                        )}
                      </div>
                      <div className={styles.commentContent}>
                        {reply.comment}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommentsSection;