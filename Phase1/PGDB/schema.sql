-- PostgreSQL Database Schema for 90 Days Goal & Coaching App
-- Complete schema including all phases (1-14)
-- Compatible with lib/db.js after PostgreSQL conversion

-- Enable UUID extension for generating IDs if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE (Phase 1 & 2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Phase 2: Microsoft OAuth fields
    microsoft_id TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    profile_picture_url TEXT,
    auth_provider TEXT DEFAULT 'email',
    -- Phase 14: User preferences
    preferences JSONB
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_microsoft_id ON users(microsoft_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- OKRT TABLE (Phase 3 & 7)
-- ============================================================================
CREATE TABLE IF NOT EXISTS okrt (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('O', 'K', 'T')),
    owner_id INTEGER NOT NULL,
    parent_id TEXT,
    title TEXT,
    description TEXT,
    progress REAL DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    status TEXT DEFAULT 'D' CHECK(status IN ('D', 'A', 'C')),
    area TEXT,
    cycle_qtr TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    order_index INTEGER DEFAULT 0,
    visibility TEXT DEFAULT 'private' CHECK(visibility IN ('private', 'shared')),
    objective_kind TEXT CHECK(objective_kind IN ('committed', 'stretch')),
    kr_target_number REAL,
    kr_unit TEXT,
    kr_baseline_number REAL,
    weight REAL DEFAULT 1.0,
    task_status TEXT CHECK(task_status IN ('todo', 'in_progress', 'done', 'blocked')),
    due_date DATE,
    recurrence_json TEXT,
    blocked_by TEXT,
    header_image_url TEXT,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES okrt(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_by) REFERENCES okrt(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_okrt_owner_id ON okrt(owner_id);
CREATE INDEX IF NOT EXISTS idx_okrt_parent_id ON okrt(parent_id);
CREATE INDEX IF NOT EXISTS idx_okrt_type ON okrt(type);
CREATE INDEX IF NOT EXISTS idx_okrt_status ON okrt(status);
CREATE INDEX IF NOT EXISTS idx_okrt_cycle_qtr ON okrt(cycle_qtr);
CREATE INDEX IF NOT EXISTS idx_okrt_visibility ON okrt(visibility);

-- Trigger to update updated_at timestamp
CREATE TRIGGER okrt_updated_at BEFORE UPDATE ON okrt
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- GROUPS TABLE (Phase 6)
-- ============================================================================
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('Organisation', 'Department', 'Team', 'Chapter', 'Squad', 'Tribe', 'Group')),
    parent_group_id TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_parent_id ON groups(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_groups_type ON groups(type);
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);

-- Trigger to update updated_at timestamp
CREATE TRIGGER groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- USER_GROUP TABLE (Phase 6)
-- Many-to-many relationship between users and groups
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_group (
    user_id INTEGER NOT NULL,
    group_id TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_group_user_id ON user_group(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_group_id ON user_group(group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_admin ON user_group(is_admin);

-- ============================================================================
-- SHARE TABLE (Phase 6)
-- OKRT sharing with groups or users
-- ============================================================================
CREATE TABLE IF NOT EXISTS share (
    okrt_id TEXT NOT NULL,
    group_or_user_id TEXT NOT NULL,
    share_type TEXT NOT NULL CHECK(share_type IN ('G', 'U')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (okrt_id, group_or_user_id, share_type),
    FOREIGN KEY (okrt_id) REFERENCES okrt(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_share_okrt_id ON share(okrt_id);
CREATE INDEX IF NOT EXISTS idx_share_group_or_user_id ON share(group_or_user_id);
CREATE INDEX IF NOT EXISTS idx_share_type ON share(share_type);

-- ============================================================================
-- FOLLOWS TABLE (Phase 7)
-- Users following shared objectives
-- ============================================================================
CREATE TABLE IF NOT EXISTS follows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    objective_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (objective_id) REFERENCES okrt(id) ON DELETE CASCADE,
    UNIQUE(user_id, objective_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_follows_user_id ON follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_objective_id ON follows(objective_id);

-- ============================================================================
-- NOTIFICATIONS TABLE (Phase 8)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

-- ============================================================================
-- COMMENTS TABLE (Phase 9)
-- Comments and rewards system
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    comment TEXT,
    parent_comment_id INTEGER,
    type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'medal', 'cookie', 'star')),
    count INTEGER DEFAULT 1 CHECK(count >= 1 AND count <= 5),
    sending_user INTEGER NOT NULL,
    receiving_user INTEGER NOT NULL,
    okrt_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

-- Trigger to update updated_at timestamp
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TIME_BLOCKS TABLE (Phase 11)
-- Task scheduling and time blocking
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_blocks (
    id SERIAL PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    start_time TIMESTAMP NOT NULL,
    duration INTEGER NOT NULL,
    objective_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES okrt(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (objective_id) REFERENCES okrt(id) ON DELETE CASCADE
);

-- Create indexes for faster queries by user and date
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_date ON time_blocks(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_time_blocks_task ON time_blocks(task_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_objective ON time_blocks(objective_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER time_blocks_updated_at BEFORE UPDATE ON time_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS (Optional - for common queries)
-- ============================================================================

-- View for user's OKRTs with owner information
CREATE OR REPLACE VIEW user_okrts_view AS
SELECT 
    o.*,
    u.display_name as owner_name,
    u.profile_picture_url as owner_avatar
FROM okrt o
JOIN users u ON o.owner_id = u.id;

-- View for shared OKRTs with sharing information
CREATE OR REPLACE VIEW shared_okrts_view AS
SELECT DISTINCT
    o.*,
    u.display_name as owner_name,
    s.group_or_user_id,
    s.share_type
FROM okrt o
JOIN users u ON o.owner_id = u.id
JOIN share s ON o.id = s.okrt_id
WHERE o.visibility = 'shared';

-- ============================================================================
-- COMMENTS
-- ============================================================================

-- This schema maintains exact compatibility with the SQLite version:
-- - All table names are identical
-- - All column names are identical
-- - All foreign key relationships are preserved
-- - All check constraints are maintained
-- 
-- Key PostgreSQL conversions made:
-- - INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
-- - TEXT for datetime → TIMESTAMP
-- - datetime('now') → CURRENT_TIMESTAMP
-- - BOOLEAN stored as actual BOOLEAN (not INTEGER 0/1)
-- - Added JSONB for preferences (more efficient than TEXT in PostgreSQL)
-- - Added triggers for automatic updated_at timestamp updates
-- - Added optional views for common query patterns
--
-- After running this schema, you'll need to update lib/db.js to:
-- 1. Use 'pg' package instead of 'sqlite3'
-- 2. Change parameter placeholders from ? to $1, $2, etc.
-- 3. Update query methods (run/get/all → query with rows)
-- 4. Handle RETURNING clause for INSERT operations
-- 5. Update datetime functions to use PostgreSQL syntax