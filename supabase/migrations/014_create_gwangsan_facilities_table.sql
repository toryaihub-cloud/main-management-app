-- 014_create_gwangsan_facilities_table.sql
-- 광산구 관리시설 현황 및 1~5차 세부 조사내용, 부서 조치계획 보존용 테이블

CREATE TABLE IF NOT EXISTS public.gwangsan_facilities (
    id BIGSERIAL PRIMARY KEY,
    seq INT,                                   -- A열: 연번
    facility_category VARCHAR(100),            -- B열: 시설구분 (공공시설(광산구))
    compliance_status VARCHAR(50),             -- C열: 의무설치 이행여부 (이행완료/미이행)
    facility_name VARCHAR(200) NOT NULL,       -- D열: 시설명
    address_jibun TEXT,                        -- E열: 지번주소
    address_doro TEXT,                         -- F열: 도로명주소
    building_register_num VARCHAR(100),        -- G열: 건축물대장
    bylaws_etc VARCHAR(100),                   -- H열: 규약 등
    permission_date DATE,                      -- I열: 건축허가일
    approval_date DATE,                        -- J열: 사용승인일자
    is_new_building VARCHAR(50),               -- K열: 신축기축
    facility_ownership_type VARCHAR(50),       -- L열: 공공시설(LH)
    
    -- 전용주차구역 현황
    parking_required_cnt INT DEFAULT 0,        -- M열: 의무_면수
    parking_installed_cnt INT DEFAULT 0,       -- N열: 면수합
    parking_ground_cnt INT DEFAULT 0,          -- O열: 지상면수
    parking_underground_cnt INT DEFAULT 0,     -- P열: 지하면수
    parking_uninstalled_cnt INT DEFAULT 0,     -- Q열: 미설치면수
    parking_compliance_status VARCHAR(50),     -- R열: 주차면수 이행여부
    
    -- 충전시설 현황
    charger_required_cnt INT DEFAULT 0,        -- S열: 의무_시설
    charger_fast_req_cnt INT DEFAULT 0,        -- T열: 의무_급속
    charger_installed_cnt INT DEFAULT 0,       -- U열: 시설합
    charger_fast_cnt INT DEFAULT 0,            -- V열: 급속기수
    charger_slow_cnt INT DEFAULT 0,            -- W열: 완속기수
    charger_uninstalled_cnt INT DEFAULT 0,     -- X열: 미설치기수
    charger_compliance_status VARCHAR(50),     -- Y열: 충전시설 이행여부
    
    -- 관리자 개인정보 (암호화)
    manager_name_encrypted TEXT,               -- Z열: 시설관리자
    manager_contact_encrypted TEXT,            -- AA열: 연락처
    
    -- 1차 자체조사
    survey1_type TEXT,                         -- AB열: 자체조사(1차)
    survey1_date DATE,                         -- AC열: 조사일자1
    survey1_inspector TEXT,                    -- AD열: 조사자1
    survey1_check TEXT,                        -- AE열: 확인사항1
    survey1_plan TEXT,                         -- AF열: 이행계획1
    survey1_note TEXT,                         -- AG열: 비고1
    
    -- 2차 자체조사
    survey2_type TEXT,                         -- AH열: 자체조사(2차)
    survey2_date DATE,                         -- AI열: 조사일자2
    survey2_inspector TEXT,                    -- AJ열: 조사자2
    survey2_check TEXT,                        -- AK열: 확인사항2
    survey2_plan TEXT,                         -- AL열: 이행계획2
    survey2_note TEXT,                         -- AM열: 비고2
    
    -- 3차 실태조사
    survey3_type TEXT,                         -- AN열: 실태조사(3차)
    survey3_date DATE,                         -- AO열: 조사일자3
    survey3_inspector TEXT,                    -- AP열: 조사자3
    survey3_check TEXT,                        -- AQ열: 확인사항3
    survey3_plan TEXT,                         -- AR열: 이행계획3
    survey3_note TEXT,                         -- AS열: 비고3
    
    -- 4차 자체조사
    survey4_type TEXT,                         -- AT열: 자체조사(4차)
    survey4_date DATE,                         -- AU열: 조사일자4
    survey4_inspector TEXT,                    -- AV열: 조사자4
    survey4_check TEXT,                        -- AW열: 확인사항4
    survey4_plan TEXT,                         -- AX열: 이행계획4
    survey4_note TEXT,                         -- AY열: 비고4
    
    -- 5차 자체조사
    survey5_type TEXT,                         -- AZ열: 자체조사(5차)
    survey5_date DATE,                         -- BA열: 조사일자5
    survey5_inspector TEXT,                    -- BB열: 조사자5
    survey5_check TEXT,                        -- BC열: 확인사항5
    survey5_plan TEXT,                         -- BD열: 이행계획5
    survey5_note TEXT,                         -- BE열: 비고5
    
    -- 최종결론 및 관리 정보
    final_conclusion TEXT,                     -- BF열: 최종결론
    management_body VARCHAR(100),              -- BG열: 관리주체 (광산구청)
    facility_key VARCHAR(50) NOT NULL UNIQUE,  -- BH열: KEY (K0442 등)
    dept_name VARCHAR(100) NOT NULL,           -- BI열: 관리부서 (시민경제과 등)
    dept_action_plan TEXT,                     -- BJ열: 부서 조치계획
    subsidy_apply VARCHAR(50),                 -- BK열: 설치지원 보조사업 신청
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_gwangsan_fac_key ON public.gwangsan_facilities(facility_key);
CREATE INDEX IF NOT EXISTS idx_gwangsan_dept ON public.gwangsan_facilities(dept_name);
CREATE INDEX IF NOT EXISTS idx_gwangsan_compliance ON public.gwangsan_facilities(compliance_status);

-- RLS 활성화 및 권한 설정
ALTER TABLE public.gwangsan_facilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for gwangsan_facilities" ON public.gwangsan_facilities;
CREATE POLICY "Allow all for gwangsan_facilities" ON public.gwangsan_facilities FOR ALL USING (true) WITH CHECK (true);
