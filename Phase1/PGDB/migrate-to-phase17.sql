-- Phase 17: Strategic Objectives for Groups
-- Migration script to add Strategic_Objectives mapping table

-- ============================================================================
-- STRATEGIC_OBJECTIVES TABLE (Phase 17)
-- Mapping table between Groups and OKRT (Objectives)
-- ============================================================================
CREATE TABLE IF NOT EXISTS strategic_objectives (
    id SERIAL PRIMARY KEY,
    group_id TEXT NOT NULL,
    okrt_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (okrt_id) REFERENCES okrt(id) ON DELETE CASCADE,
    UNIQUE(group_id, okrt_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_strategic_objectives_group_id ON strategic_objectives(group_id);
CREATE INDEX IF NOT EXISTS idx_strategic_objectives_okrt_id ON strategic_objectives(okrt_id);

-- Add comment for documentation
COMMENT ON TABLE strategic_objectives IS 'Maps strategic objectives (OKRTs) to groups. Each group can have up to 5 strategic objectives.';
COMMENT ON COLUMN strategic_objectives.group_id IS 'Reference to the group';
COMMENT ON COLUMN strategic_objectives.okrt_id IS 'Reference to the OKRT (objective) - only type O objectives should be used';