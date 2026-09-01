-- 008_create_correction_orders_table.sql
-- 시정명령 차수별 내역 관리를 위한 테이블 생성

CREATE TABLE IF NOT EXISTS public.correction_orders (
    id BIGSERIAL PRIMARY KEY,
    batch_round VARCHAR(50) NOT NULL,          -- 차수 구분 (예: '2026-06-30', '2026-07-28', '2026-08-19')
    batch_title VARCHAR(200) NOT NULL,         -- 차수 제목 (예: '6.29.공문결재, 6.30.등기발송')
    order_date VARCHAR(50),                    -- 시정명령일자
    approval_date VARCHAR(50),                 -- 공문결재일자
    send_date VARCHAR(50),                     -- 등기/발송일자
    facility_name VARCHAR(200) NOT NULL,       -- 시설명
    facility_key VARCHAR(100),                 -- 시설 KEY
    send_address TEXT,                         -- 우편발송 도로명주소
    zip_code VARCHAR(20),                      -- 우편번호
    target_name TEXT,                          -- 시정명령대상
    notice_method VARCHAR(50),                 -- 통지방법 ('등기' / '공문')
    recipient_name TEXT,                       -- 수신인
    delivery_status VARCHAR(50),               -- 우편도달여부
    note TEXT,                                 -- 비고
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_correction_orders_batch ON public.correction_orders(batch_round);
CREATE INDEX IF NOT EXISTS idx_correction_orders_fac_name ON public.correction_orders(facility_name);

-- RLS 정책 설정
ALTER TABLE public.correction_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for correction_orders" ON public.correction_orders;
CREATE POLICY "Allow all for correction_orders" ON public.correction_orders FOR ALL USING (true) WITH CHECK (true);
