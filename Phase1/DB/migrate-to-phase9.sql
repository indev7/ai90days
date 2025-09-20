-- Phase 9 Migration: Comments System
-- Add comments table for OKRT comments and rewards

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment TEXT,
    parent_comment_id INTEGER,
    type TEXT NOT NULL DEFAULT 'text', -- 'text', 'medal', 'cookie', 'star'
    count INTEGER DEFAULT 1, -- For reward types, max 5
    sending_user INTEGER NOT NULL,
    receiving_user INTEGER NOT NULL,
    okrt_id TEXT NOT NULL, -- The OKRT this comment is related to
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (sending_user) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiving_user) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (okrt_id) REFERENCES okrt(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comments_okrt_id ON comments(okrt_id);
CREATE INDEX IF NOT EXISTS idx_comments_sending_user ON comments(sending_user);
CREATE INDEX IF NOT EXISTS idx_comments_receiving_user ON comments(receiving_user);
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);