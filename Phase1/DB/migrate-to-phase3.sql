-- Migration script to add OKRT table for Phase 3
-- Run this script after Phase 2 to add OKRT functionality

-- Create OKRT table
CREATE TABLE IF NOT EXISTS okrt (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('O', 'K', 'T')),
    owner_id TEXT NOT NULL,
    parent_id TEXT,
    title TEXT,
    description TEXT,
    progress REAL DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    status TEXT DEFAULT 'D' CHECK(status IN ('D', 'A', 'C')),
    area TEXT,
    cycle_qtr TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    order_index INTEGER DEFAULT 0,
    visibility TEXT DEFAULT 'private' CHECK(visibility IN ('private', 'team', 'org')),
    objective_kind TEXT CHECK(objective_kind IN ('committed', 'stretch')),
    kr_target_number REAL,
    kr_unit TEXT,
    kr_baseline_number REAL,
    weight REAL DEFAULT 1.0,
    task_status TEXT CHECK(task_status IN ('todo', 'in_progress', 'done', 'blocked')),
    due_date DATE,
    recurrence_json TEXT,
    blocked_by TEXT,
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES okrt(id),
    FOREIGN KEY (blocked_by) REFERENCES okrt(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_okrt_owner_id ON okrt(owner_id);
CREATE INDEX IF NOT EXISTS idx_okrt_parent_id ON okrt(parent_id);
CREATE INDEX IF NOT EXISTS idx_okrt_type ON okrt(type);
CREATE INDEX IF NOT EXISTS idx_okrt_status ON okrt(status);
CREATE INDEX IF NOT EXISTS idx_okrt_cycle_qtr ON okrt(cycle_qtr);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS okrt_updated_at 
    AFTER UPDATE ON okrt
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE okrt SET updated_at = datetime('now') WHERE id = NEW.id;
END;
