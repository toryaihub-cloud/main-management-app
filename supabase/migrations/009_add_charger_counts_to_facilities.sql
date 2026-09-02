-- 009_add_charger_counts_to_facilities.sql
-- facilities 테이블에 설치 완속/급속 및 설치 면수 상세 컬럼 추가

ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS parking_installed_cnt INTEGER DEFAULT 0;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS charger_installed_cnt INTEGER DEFAULT 0;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS charger_fast_req_cnt INTEGER DEFAULT 0;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS charger_fast_cnt INTEGER DEFAULT 0;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS charger_slow_cnt INTEGER DEFAULT 0;
