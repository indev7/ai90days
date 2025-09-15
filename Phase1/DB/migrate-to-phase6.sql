-- Migration script to add Groups functionality for Phase 6
-- Run this script after Phase 3 to add Groups and Sharing functionality

-- Create GROUP table
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('Organisation', 'Department', 'Team', 'Chapter', 'Squad', 'Tribe', 'Group')),
    parent_group_id TEXT,
    thumbnail_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (parent_group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- Create USER_GROUP table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_group (
    user_id INTEGER NOT NULL,
    group_id TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- Create SHARE table for OKRT sharing
CREATE TABLE IF NOT EXISTS share (
    okrt_id TEXT NOT NULL,
    group_or_user_id TEXT NOT NULL,
    share_type TEXT NOT NULL CHECK(share_type IN ('G', 'U')),
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (okrt_id, group_or_user_id, share_type),
    FOREIGN KEY (okrt_id) REFERENCES okrt(id) ON DELETE CASCADE
);

-- Update OKRT table visibility field to only allow 'private' and 'shared'
-- First, update existing records that have 'team' or 'org' to 'shared'
UPDATE okrt SET visibility = 'shared' WHERE visibility IN ('team', 'org');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_parent_id ON groups(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_groups_type ON groups(type);
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_user_group_user_id ON user_group(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_group_id ON user_group(group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_admin ON user_group(is_admin);
CREATE INDEX IF NOT EXISTS idx_share_okrt_id ON share(okrt_id);
CREATE INDEX IF NOT EXISTS idx_share_group_or_user_id ON share(group_or_user_id);
CREATE INDEX IF NOT EXISTS idx_share_type ON share(share_type);

-- Create trigger to update updated_at timestamp for groups
CREATE TRIGGER IF NOT EXISTS groups_updated_at 
    AFTER UPDATE ON groups
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE groups SET updated_at = datetime('now') WHERE id = NEW.id;
END;