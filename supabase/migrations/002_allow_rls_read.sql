-- 002_allow_rls_read.sql
-- RLS (Row Level Security) 읽기 허용 정책 설정

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositions ENABLE ROW LEVEL SECURITY;

-- 익명/공개 키 조회를 위한 Read Policy 추가
DROP POLICY IF EXISTS "Allow public select on facilities" ON public.facilities;
CREATE POLICY "Allow public select on facilities" ON public.facilities
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public select on dispositions" ON public.dispositions;
CREATE POLICY "Allow public select on dispositions" ON public.dispositions
    FOR SELECT USING (true);
