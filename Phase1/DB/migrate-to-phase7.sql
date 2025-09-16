-- Migration to Phase 7: Update visibility constraint to support 'private' and 'shared'
-- This fixes the ShareModal functionality

-- Create a new table with the updated constraint
CREATE TABLE okrt_new (
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
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES okrt_new(id),
    FOREIGN KEY (blocked_by) REFERENCES okrt_new(id)
);

-- Copy data from old table to new table, mapping 'team' and 'org' to 'shared'
INSERT INTO okrt_new SELECT
    id, type, owner_id, parent_id, title, description, progress, status, area, cycle_qtr, created_at, updated_at, order_index,
    CASE
        WHEN visibility IN ('team', 'org') THEN 'shared'
        ELSE visibility
    END as visibility,
    objective_kind, kr_target_number, kr_unit, kr_baseline_number, weight, task_status, due_date, recurrence_json, blocked_by, header_image_url
FROM okrt;

-- Drop the old table
DROP TABLE okrt;

-- Rename the new table
ALTER TABLE okrt_new RENAME TO okrt;

-- Recreate indexes
CREATE INDEX idx_okrt_owner_id ON okrt(owner_id);
CREATE INDEX idx_okrt_parent_id ON okrt(parent_id);
CREATE INDEX idx_okrt_type ON okrt(type);
CREATE INDEX idx_okrt_status ON okrt(status);
CREATE INDEX idx_okrt_cycle_qtr ON okrt(cycle_qtr);

-- Recreate trigger
CREATE TRIGGER okrt_updated_at
    AFTER UPDATE ON okrt
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE okrt SET updated_at = datetime('now') WHERE id = NEW.id;
END;