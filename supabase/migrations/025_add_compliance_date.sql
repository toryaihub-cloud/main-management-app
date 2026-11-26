-- 025: 의무설치 이행완료 일자(통합시설 기준) 및 행정처분 이행상태 별도 관리
ALTER TABLE public.facilities          ADD COLUMN IF NOT EXISTS compliance_date DATE;
ALTER TABLE public.gwangsan_facilities ADD COLUMN IF NOT EXISTS compliance_date DATE;
ALTER TABLE public.correction_orders   ADD COLUMN IF NOT EXISTS compliance_date DATE;
ALTER TABLE public.dispositions        ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(20);
ALTER TABLE public.dispositions        ADD COLUMN IF NOT EXISTS compliance_date DATE;
NOTIFY pgrst, 'reload schema';
