-- 007_add_note_settings_photos.sql
-- 1. dispositions 테이블에 비고(note) 컬럼 추가
ALTER TABLE public.dispositions ADD COLUMN IF NOT EXISTS note TEXT;

-- 2. system_settings 테이블 생성
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 설정값 삽입
INSERT INTO public.system_settings (key, value, updated_at)
VALUES ('general', '{"photo_dir_path": "사진"}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- 3. facility_photos 테이블 생성 (신규 업로드 사진 영구 보존)
CREATE TABLE IF NOT EXISTS public.facility_photos (
    id BIGSERIAL PRIMARY KEY,
    facility_key VARCHAR(100) NOT NULL,
    filename TEXT NOT NULL,
    file_data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_photos_key ON public.facility_photos(facility_key);

-- RLS 정책 설정
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for system_settings" ON public.system_settings;
CREATE POLICY "Allow all for system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.facility_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for facility_photos" ON public.facility_photos;
CREATE POLICY "Allow all for facility_photos" ON public.facility_photos FOR ALL USING (true) WITH CHECK (true);
