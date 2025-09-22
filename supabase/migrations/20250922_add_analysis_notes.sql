-- Add analysis_notes column to words table
ALTER TABLE words
ADD COLUMN analysis_notes TEXT;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN words.analysis_notes IS 'User notes from word analysis for learning context and personal observations';