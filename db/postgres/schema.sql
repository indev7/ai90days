-- PostgreSQL Database Schema for 90 Days Goal & Coaching App
-- Converted from SQLite schema with PostgreSQL-compatible data types and syntax

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    display_name VARCHAR NOT NULL,
    email VARCHAR UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Phase 2: Microsoft OAuth fields
    microsoft_id VARCHAR UNIQUE,
    first_name VARCHAR,
    last_name VARCHAR,
    profile_picture_url VARCHAR,
    auth_provider VARCHAR DEFAULT 'email'
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_microsoft_id ON users(microsoft_id);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    type VARCHAR NOT NULL CHECK(type IN ('Organisation', 'Department', 'Team', 'Chapter', 'Squad', 'Tribe', 'Group')),
    parent_group_id VARCHAR,
    thumbnail_url VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- User group membership table
CREATE TABLE IF NOT EXISTS user_group (
    user_id INTEGER NOT NULL,
    group_id VARCHAR NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- OKRT table (Objectives, Key Results, Tasks)
CREATE TABLE IF NOT EXISTS okrt (
    id VARCHAR PRIMARY KEY,
    type VARCHAR NOT NULL CHECK(type IN ('O', 'K', 'T')),
    owner_id INTEGER NOT NULL,
    parent_id VARCHAR,
    title VARCHAR,
    description TEXT,
    progress NUMERIC DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    status VARCHAR DEFAULT 'D' CHECK(status IN ('D', 'A', 'C')),
    area VARCHAR,
    cycle_qtr VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    order_index INTEGER DEFAULT 0,
    visibility VARCHAR DEFAULT 'private' CHECK(visibility IN ('private', 'shared')),
    objective_kind VARCHAR CHECK(objective_kind IN ('committed', 'stretch')),
    kr_target_number NUMERIC,
    kr_unit VARCHAR,
    kr_baseline_number NUMERIC,
    weight NUMERIC DEFAULT 1.0,
    task_status VARCHAR CHECK(task_status IN ('todo', 'in_progress', 'done', 'blocked')),
    due_date DATE,
    recurrence_json TEXT,
    blocked_by VARCHAR,
    header_image_url VARCHAR,
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES okrt(id),
    FOREIGN KEY (blocked_by) REFERENCES okrt(id)
);

CREATE INDEX IF NOT EXISTS idx_okrt_owner_id ON okrt(owner_id);
CREATE INDEX IF NOT EXISTS idx_okrt_parent_id ON okrt(parent_id);
CREATE INDEX IF NOT EXISTS idx_okrt_type ON okrt(type);
CREATE INDEX IF NOT EXISTS idx_okrt_status ON okrt(status);
CREATE INDEX IF NOT EXISTS idx_okrt_cycle_qtr ON okrt(cycle_qtr);

-- Share table
CREATE TABLE IF NOT EXISTS share (
    okrt_id VARCHAR NOT NULL,
    group_or_user_id VARCHAR NOT NULL,
    share_type VARCHAR NOT NULL CHECK(share_type IN ('G', 'U')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (okrt_id, group_or_user_id, share_type),
    FOREIGN KEY (okrt_id) REFERENCES okrt(id) ON DELETE CASCADE
);

-- Follows table
CREATE TABLE IF NOT EXISTS follows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    objective_id VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (objective_id) REFERENCES okrt(id) ON DELETE CASCADE,
    UNIQUE(user_id, objective_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_user_id ON follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_objective_id ON follows(objective_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR NOT NULL CHECK(type IN (
        'comment', 'reply', 'mention', 'group_added', 'okrt_shared', 
        'ownership_changed', 'progress_update', 'task_due', 'kr_due', 
        'weekly_review_due', 'weekly_review_missed', 'quarter_start', 
        'mid_cycle_checkpoint', 'quarter_ending', 'visibility_changed'
    )),
    title VARCHAR NOT NULL,
    message VARCHAR NOT NULL,
    related_okrt_id VARCHAR,
    related_group_id VARCHAR,
    related_user_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_okrt_id) REFERENCES okrt(id) ON DELETE CASCADE,
    FOREIGN KEY (related_group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    comment TEXT,
    parent_comment_id INTEGER,
    type VARCHAR NOT NULL DEFAULT 'text',
    count INTEGER DEFAULT 1,
    sending_user INTEGER NOT NULL,
    receiving_user INTEGER NOT NULL,
    okrt_id VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (sending_user) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiving_user) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (okrt_id) REFERENCES okrt(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_okrt_id ON comments(okrt_id);
CREATE INDEX IF NOT EXISTS idx_comments_sending_user ON comments(sending_user);
CREATE INDEX IF NOT EXISTS idx_comments_receiving_user ON comments(receiving_user);
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- PostgreSQL trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for okrt table
DROP TRIGGER IF EXISTS okrt_updated_at ON okrt;
CREATE TRIGGER okrt_updated_at 
    BEFORE UPDATE ON okrt
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for users table
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for groups table
DROP TRIGGER IF EXISTS groups_updated_at ON groups;
CREATE TRIGGER groups_updated_at 
    BEFORE UPDATE ON groups
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for comments table
DROP TRIGGER IF EXISTS comments_updated_at ON comments;
CREATE TRIGGER comments_updated_at 
    BEFORE UPDATE ON comments
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();