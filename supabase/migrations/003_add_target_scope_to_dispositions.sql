-- Add target_scope (G열 '대상' : 부지/건물, 토지, 건물 등) to dispositions table
ALTER TABLE dispositions ADD COLUMN IF NOT EXISTS target_scope TEXT;
