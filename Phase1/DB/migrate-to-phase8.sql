-- Migration to Phase 8: Notifications System

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN (
        'comment', 'reply', 'mention', 'group_added', 'okrt_shared', 
        'ownership_changed', 'progress_update', 'task_due', 'kr_due', 
        'weekly_review_due', 'weekly_review_missed', 'quarter_start', 
        'mid_cycle_checkpoint', 'quarter_ending', 'visibility_changed'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_okrt_id TEXT,
    related_group_id TEXT,
    related_user_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_okrt_id) REFERENCES okrt(id) ON DELETE CASCADE,
    FOREIGN KEY (related_group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);