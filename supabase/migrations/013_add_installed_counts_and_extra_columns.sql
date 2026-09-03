-- 013_add_installed_counts_and_extra_columns.sql
-- facilities 테이블에 엑셀 DB.xlsx의 주차/충전 설치합 및 부가 필드 컬럼들을 추가합니다.

ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS parking_installed_cnt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS charger_installed_cnt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_households integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ev_registered_cnt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS charger_reported text,
ADD COLUMN IF NOT EXISTS insurance_enrolled text,
ADD COLUMN IF NOT EXISTS parallel_parking_status text,
ADD COLUMN IF NOT EXISTS parallel_parking_cnt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS fire_manual_distributed text,
ADD COLUMN IF NOT EXISTS extra_info jsonb;
