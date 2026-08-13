-- 001_create_facilities_and_dispositions.sql
-- 전용주차구역 및 충전시설 의무설치/행정처분 관리를 위한 Supabase DB 스키마

-- 1. 암호화 확장기능 (pgcrypto) 활성화
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. 통합 시설 마스터 테이블 생성
CREATE TABLE IF NOT EXISTS public.facilities (
    facility_key VARCHAR(50) PRIMARY KEY, -- BU열 고유 Key (K0001 등)
    facility_name VARCHAR(200) NOT NULL, -- E열 시설명
    facility_category VARCHAR(100), -- B열 시설구분
    address_jibun TEXT, -- F열 지번주소
    address_doro TEXT, -- G열 도로명주소
    dong_name VARCHAR(100), -- H열 행정동
    building_register_num VARCHAR(100), -- I열 건축물대장
    permission_date DATE, -- K열 건축허가일
    approval_date DATE, -- L열 사용승인일자
    is_new_building VARCHAR(50), -- M열 신축기축
    facility_ownership_type VARCHAR(50), -- N열 공공시설(LH)
    
    -- 주차면수 관련
    parking_required_cnt INT DEFAULT 0, -- P열 의무 주차면수
    parking_uninstalled_cnt INT DEFAULT 0, -- T열/AQ열 미설치면수
    parking_status VARCHAR(50), -- U열 주차면수 이행여부
    
    -- 충전시설 관련
    charger_required_cnt INT DEFAULT 0, -- V열 의무 충전시설
    charger_uninstalled_cnt INT DEFAULT 0, -- AA열/AX열 미설치기수
    charger_status VARCHAR(50), -- AB열 충전시설 이행여부
    
    -- 의무 및 실태조사 상태
    compliance_status VARCHAR(50), -- C열 의무설치 이행여부
    investigation_status VARCHAR(50), -- D열 실태조사 완료여부
    
    -- 관리자 민감 정보 (암호화 보관)
    manager_name_encrypted TEXT, -- AJ열 시설관리자 성명 (암호화)
    manager_contact_encrypted TEXT, -- AK, AL열 연락처 (암호화)
    
    management_body VARCHAR(100), -- BR열 관리주체
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 행정처분 및 소유자/관리자 상세 테이블 생성 (시설 1 : N 소유자/관리자)
CREATE TABLE IF NOT EXISTS public.dispositions (
    id BIGSERIAL PRIMARY KEY,
    facility_key VARCHAR(50) NOT NULL REFERENCES public.facilities(facility_key) ON DELETE CASCADE,
    seq INT, -- A열 연번
    current_status VARCHAR(100), -- B열 현상태
    target_type VARCHAR(50), -- E열 구분 ('시설' 또는 '소유자')
    
    -- 암호화 관리 대상 개인정보
    target_name_encrypted TEXT, -- C열/W열 시정명령대상/소유자명 (암호화)
    recipient_name_encrypted TEXT, -- AE열 수신인 (암호화)
    reg_num_encrypted TEXT, -- AC열 법인번호/주민번호 (암호화)
    contact_encrypted TEXT, -- BC열 연락처 (암호화)
    mail_address_encrypted TEXT, -- I열 사전통지 우편발송 도로명주소 (암호화)
    zip_code VARCHAR(20), -- J열 우편번호
    
    -- 사전통지 이력
    advance_notice_target VARCHAR(10), -- F열 사전통지대상
    advance_notice_date DATE, -- G열 사전통지일자
    advance_notice_method VARCHAR(100), -- H열 사전통지방법
    advance_notice_send_date DATE, -- K열 사전통지 발송일
    advance_notice_return_status VARCHAR(100), -- L열 사전통지반송여부
    abstract_send_date DATE, -- M열 사전통지 초본주소 발송일자
    abstract_address_encrypted TEXT, -- N열 초본주소 (암호화)
    abstract_return_status VARCHAR(100), -- O열 초본주소반송여부
    notice_public VARCHAR(200), -- P열 사전통지 고시/공고
    notice_public_period VARCHAR(200), -- Q열 사전통지 고시/공고기간
    
    -- 의견제출 이력
    opinion_submitted VARCHAR(10), -- R열 의견제출여부
    opinion_submit_date DATE, -- S열 의견제출일
    opinion_content TEXT, -- T열 의견내용
    
    -- 시정명령 이력
    correction_order VARCHAR(50), -- U열 시정명령 여부
    correction_order_date DATE, -- V열 시정명령 일자
    correction_reason TEXT, -- X열 시정명령대상 선정사유
    correction_period VARCHAR(100), -- Y열 시정기간
    correction_notice_method VARCHAR(100), -- Z열 시정명령 통지방법
    correction_return_details TEXT, -- AA열 시정명령 반송내역
    correction_public TEXT, -- AB열 시정명령 고시/공고
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_facilities_compliance ON public.facilities(compliance_status);
CREATE INDEX IF NOT EXISTS idx_facilities_category ON public.facilities(facility_category);
CREATE INDEX IF NOT EXISTS idx_dispositions_facility_key ON public.dispositions(facility_key);
CREATE INDEX IF NOT EXISTS idx_dispositions_target_type ON public.dispositions(target_type);
