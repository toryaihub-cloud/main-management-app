-- 022: 광산구 관리시설 테이블 생성(014가 DB에 적용되지 않았던 문제 보완) + 통합시설 관리부서 칸 추가
-- 실행 위치: Supabase 대시보드 > SQL Editor

-- 1) 통합시설관리(facilities)에 관리부서 칸 추가
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS dept_name VARCHAR(100);

-- 2) 광산구 관리시설 테이블 생성
CREATE TABLE IF NOT EXISTS public.gwangsan_facilities (
    id BIGSERIAL PRIMARY KEY,
    seq INT,
    facility_category VARCHAR(100),
    compliance_status VARCHAR(50),
    facility_name VARCHAR(200) NOT NULL,
    address_jibun TEXT,
    address_doro TEXT,
    building_register_num VARCHAR(100),
    bylaws_etc VARCHAR(100),
    permission_date DATE,
    approval_date DATE,
    is_new_building VARCHAR(50),
    facility_ownership_type VARCHAR(50),
    parking_required_cnt INT DEFAULT 0,
    parking_installed_cnt INT DEFAULT 0,
    parking_ground_cnt INT DEFAULT 0,
    parking_underground_cnt INT DEFAULT 0,
    parking_uninstalled_cnt INT DEFAULT 0,
    parking_compliance_status VARCHAR(50),
    charger_required_cnt INT DEFAULT 0,
    charger_fast_req_cnt INT DEFAULT 0,
    charger_installed_cnt INT DEFAULT 0,
    charger_fast_cnt INT DEFAULT 0,
    charger_slow_cnt INT DEFAULT 0,
    charger_uninstalled_cnt INT DEFAULT 0,
    charger_compliance_status VARCHAR(50),
    manager_name_encrypted TEXT,
    manager_contact_encrypted TEXT,
    survey1_type TEXT, survey1_date DATE, survey1_inspector TEXT, survey1_check TEXT, survey1_plan TEXT, survey1_note TEXT,
    survey2_type TEXT, survey2_date DATE, survey2_inspector TEXT, survey2_check TEXT, survey2_plan TEXT, survey2_note TEXT,
    survey3_type TEXT, survey3_date DATE, survey3_inspector TEXT, survey3_check TEXT, survey3_plan TEXT, survey3_note TEXT,
    survey4_type TEXT, survey4_date DATE, survey4_inspector TEXT, survey4_check TEXT, survey4_plan TEXT, survey4_note TEXT,
    survey5_type TEXT, survey5_date DATE, survey5_inspector TEXT, survey5_check TEXT, survey5_plan TEXT, survey5_note TEXT,
    final_conclusion TEXT,
    management_body VARCHAR(100),
    facility_key VARCHAR(50) NOT NULL UNIQUE,
    dept_name VARCHAR(100) NOT NULL,
    dept_action_plan TEXT,
    subsidy_apply VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gwangsan_dept ON public.gwangsan_facilities(dept_name);

ALTER TABLE public.gwangsan_facilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for gwangsan_facilities" ON public.gwangsan_facilities;
CREATE POLICY "Allow all for gwangsan_facilities" ON public.gwangsan_facilities FOR ALL USING (true) WITH CHECK (true);

-- 3) API가 새 테이블/칸을 바로 인식하도록 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
