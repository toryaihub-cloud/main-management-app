-- 016_add_correction_order_target_to_facilities.sql
-- facilities 테이블에 대표 시정명령대상(소유자가 여러 명인 경우 대표 표시) 컬럼 추가

ALTER TABLE public.facilities
    ADD COLUMN IF NOT EXISTS correction_order_target TEXT;

COMMENT ON COLUMN public.facilities.correction_order_target IS '대표 시정명령대상 (소유자가 여러 명인 경우 대표로 표시하는 시정명령대상)';
