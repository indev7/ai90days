-- Phase 11 Migration: Time Blocking (Task Scheduling)
-- Add time_blocks table for scheduling tasks

CREATE TABLE IF NOT EXISTS time_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL, -- Reference to OKRT table
    user_id INTEGER NOT NULL, -- Reference to users table
    start_time TEXT NOT NULL, -- ISO 8601 datetime string
    duration INTEGER NOT NULL, -- Duration in minutes
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES okrt(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for faster queries by user and date
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_date ON time_blocks(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_time_blocks_task ON time_blocks(task_id);