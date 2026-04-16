-- Season management: add current_season to club_settings
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS current_season TEXT DEFAULT '2025/26';
