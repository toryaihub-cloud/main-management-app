-- 012_add_charger_detail_counts_to_facilities.sql
-- 시설 테이블(facilities)에 완속/급속 충전기 상세 수량 컬럼을 추가합니다.

ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS charger_fast_req_cnt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS charger_fast_cnt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS charger_slow_cnt integer DEFAULT 0;
