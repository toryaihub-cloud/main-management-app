-- 023: 행정처분 시정명령 차수/일자 칸 추가
ALTER TABLE public.dispositions ADD COLUMN IF NOT EXISTS correction_round VARCHAR(10);
ALTER TABLE public.dispositions ADD COLUMN IF NOT EXISTS correction_round_date DATE;
NOTIFY pgrst, 'reload schema';
