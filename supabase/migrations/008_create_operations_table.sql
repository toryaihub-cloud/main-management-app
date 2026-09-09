-- 008_create_operations_table.sql
-- 충전시설 운영 및 미운영 현황 관리를 위한 operations 테이블 생성

CREATE TABLE IF NOT EXISTS public.operations (
    id BIGSERIAL PRIMARY KEY,
    facility_key VARCHAR(100) NOT NULL,
    facility_name TEXT,
    address_doro TEXT,
    investigator VARCHAR(100),
    investigation_date VARCHAR(50),
    parking_ground_cnt INT DEFAULT 0,
    parking_underground_cnt INT DEFAULT 0,
    parking_uninstalled_cnt INT DEFAULT 0,
    charger_installed_cnt INT DEFAULT 0,
    charger_fast_cnt INT DEFAULT 0,
    charger_slow_cnt INT DEFAULT 0,
    charger_uninstalled_cnt INT DEFAULT 0,
    normal_operator_qty TEXT,
    unoperated_cnt INT DEFAULT 0,
    location TEXT,
    unoperated_operator TEXT,
    initial_install_date VARCHAR(100),
    operation_status VARCHAR(100) DEFAULT '정상운영',
    unoperated_reason TEXT,
    unoperated_date VARCHAR(100),
    note TEXT,
    complaint_and_plan TEXT,
    manager_name_encrypted TEXT,
    manager_contact_encrypted TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operations_facility_key ON public.operations(facility_key);
CREATE INDEX IF NOT EXISTS idx_operations_status ON public.operations(operation_status);

ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for operations" ON public.operations;
CREATE POLICY "Allow all for operations" ON public.operations FOR ALL USING (true) WITH CHECK (true);
