-- 024: 시정명령 건별 이행완료 칸 추가 (통합시설/행정처분 이행완료와 연동)
ALTER TABLE public.correction_orders ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_correction_orders_facility_key ON public.correction_orders(facility_key);
NOTIFY pgrst, 'reload schema';
