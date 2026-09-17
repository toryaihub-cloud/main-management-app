-- 015_add_second_correction_to_dispositions.sql
-- 행정처분 내역 관리에서 1차 시정명령 반송 이력 보존 및 2차 시정명령 기록을 위한 컬럼 추가

ALTER TABLE public.dispositions
    ADD COLUMN IF NOT EXISTS correction_order_2 VARCHAR(50),             -- 2차 시정명령 대상여부/구분
    ADD COLUMN IF NOT EXISTS correction_order_date_2 DATE,                -- 2차 시정명령일자
    ADD COLUMN IF NOT EXISTS correction_reason_2 TEXT,                    -- 2차 시정명령 사유 및 내용
    ADD COLUMN IF NOT EXISTS correction_period_2 VARCHAR(100),            -- 2차 시정기간 (예: 2026.09.25 ~ 2027.09.24)
    ADD COLUMN IF NOT EXISTS correction_notice_method_2 VARCHAR(100),     -- 2차 시정명령 통지방법 (등기 등)
    ADD COLUMN IF NOT EXISTS correction_return_details_2 TEXT,            -- 2차 시정명령 통지 반송내역 및 도달여부
    ADD COLUMN IF NOT EXISTS correction_public_2 TEXT;                    -- 2차 시정명령 고시/공고

COMMENT ON COLUMN public.dispositions.correction_order_2 IS '2차 시정명령 대상구분';
COMMENT ON COLUMN public.dispositions.correction_order_date_2 IS '2차 시정명령 일자';
COMMENT ON COLUMN public.dispositions.correction_reason_2 IS '2차 시정명령 사유 및 내용';
COMMENT ON COLUMN public.dispositions.correction_period_2 IS '2차 시정기간';
COMMENT ON COLUMN public.dispositions.correction_notice_method_2 IS '2차 시정명령 통지방법';
COMMENT ON COLUMN public.dispositions.correction_return_details_2 IS '2차 시정명령 반송내역 및 도달여부';
COMMENT ON COLUMN public.dispositions.correction_public_2 IS '2차 시정명령 고시/공고';
