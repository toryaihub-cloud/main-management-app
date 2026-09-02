-- 010_add_installed_counts_to_facilities.sql
-- facilities 테이블에 실제 설치 수량 및 충전기 상세 수량 컬럼 영구 추가

ALTER TABLE public.facilities
    ADD COLUMN IF NOT EXISTS parking_installed_cnt INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charger_installed_cnt INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charger_fast_req_cnt INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charger_fast_cnt INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charger_slow_cnt INTEGER DEFAULT 0;