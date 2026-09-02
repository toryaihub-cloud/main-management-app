-- 011_add_parking_location_counts_to_facilities.sql
-- 시설 테이블(facilities)에 지상 및 지하 주차면수 컬럼을 추가합니다.

ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS parking_ground_cnt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS parking_underground_cnt integer DEFAULT 0;
