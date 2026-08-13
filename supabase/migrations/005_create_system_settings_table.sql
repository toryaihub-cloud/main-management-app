-- Migration: 005_create_system_settings_table.sql
-- Create system_settings table to persist application settings in Supabase DB

CREATE TABLE IF NOT EXISTS public.system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Default initial photo directory path setting
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES ('photo_dir_path', 'c:\Users\Administrator\Desktop\프로젝트\관리페이지_HTML\사진')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
