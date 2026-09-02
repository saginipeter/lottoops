ALTER TABLE state_lottery_reports ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE state_lottery_reports ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE state_lottery_reports ADD COLUMN IF NOT EXISTS ocr_text TEXT;
ALTER TABLE state_lottery_reports ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'PENDING';