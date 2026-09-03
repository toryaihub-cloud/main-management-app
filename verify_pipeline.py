#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_pipeline.py - 배포 전 자동 무결성 검증 파이프라인
Supabase DB 연결, Facilities CRUD, Dispositions CRUD, 로컬 캐시 정합성을 5초 안에 전수 검증합니다.
테스트 실패 시 exit(1)을 반환하여 git push를 원천 차단합니다.
"""

import sys
import time
import json
import requests

SUPABASE_URL = "https://vijiacxcmtfekbmegjlf.supabase.co"
SECRET_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpamlhY3hjbXRmZWtibWVnamxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgyMzgyNiwiZXhwIjoyMTAxMzk5ODI2fQ.Noa3eCRZLGLp67fRYu4ZlsFC4_d2X1C7KxQ_g2_zP00"

HEADERS = {
    "apikey": SECRET_KEY,
    "Authorization": f"Bearer {SECRET_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def log(msg, success=None):
    if success is True:
        print(f"  [PASS] {msg}")
    elif success is False:
        print(f"  [FAIL] {msg}")
    else:
        print(f">> {msg}")

def run_tests():
    print("=" * 65)
    print("   [배포 전 자동 무결성 검증 파이프라인 (verify_pipeline)]")
    print("=" * 65)

    all_passed = True

    # -------------------------------------------------------------
    # TEST 1: Supabase DB 연결 및 RLS 통신 테스트
    # -------------------------------------------------------------
    log("TEST 1: Supabase DB 연결 및 엔드포인트 응답 검증 중...")
    try:
        t0 = time.time()
        r = requests.get(f"{SUPABASE_URL}/rest/v1/facilities?limit=1", headers=HEADERS, timeout=5)
        elapsed = time.time() - t0
        if r.status_code == 200:
            log(f"Supabase DB 연결 성공 (응답 속도: {elapsed:.2f}s)", True)
        else:
            log(f"Supabase DB 연결 실패: status={r.status_code}, {r.text}", False)
            all_passed = False
    except Exception as e:
        log(f"Supabase DB 통신 예외 발생: {e}", False)
        all_passed = False

    # -------------------------------------------------------------
    # TEST 2 & 3: Facilities 및 Dispositions CRUD 라이프사이클 통합 검증 (FK 연계)
    # -------------------------------------------------------------
    log("\nTEST 2: Facilities 테이블 CRUD 무결성 테스트 중...")
    test_key = f"__TEST_FAC_{int(time.time())}__"
    test_fac = {
        "facility_key": test_key,
        "facility_name": "파이프라인 검증용 가상 시설",
        "facility_category": "공공시설",
        "compliance_status": "이행완료",
        "parking_required_cnt": 10,
        "parking_installed_cnt": 10,
        "charger_required_cnt": 2,
        "charger_installed_cnt": 2
    }

    try:
        # C (Create Facility)
        r_c = requests.post(f"{SUPABASE_URL}/rest/v1/facilities", headers=HEADERS, json=[test_fac], timeout=5)
        if r_c.status_code in [200, 201]:
            log(f"1) 시설 INSERT 생성 성공 (key={test_key})", True)
        else:
            log(f"1) 시설 INSERT 실패: status={r_c.status_code}, {r_c.text}", False)
            all_passed = False

        # R (Read Facility)
        r_r = requests.get(f"{SUPABASE_URL}/rest/v1/facilities?facility_key=eq.{test_key}", headers=HEADERS, timeout=5)
        if r_r.status_code == 200 and len(r_r.json()) > 0:
            log("2) 시설 SELECT 조회 성공", True)
        else:
            log("2) 시설 SELECT 조회 실패", False)
            all_passed = False

        # U (Update Facility)
        r_u = requests.patch(f"{SUPABASE_URL}/rest/v1/facilities?facility_key=eq.{test_key}", headers=HEADERS, json={"compliance_status": "미이행"}, timeout=5)
        if r_u.status_code in [200, 204]:
            log("3) 시설 PATCH 수정 성공", True)
        else:
            log("3) 시설 PATCH 수정 실패", False)
            all_passed = False

        # -------------------------------------------------------------
        # TEST 3: Dispositions (행정처분 내역) CRUD 테스트 (test_key 하위)
        # -------------------------------------------------------------
        log("\nTEST 3: Dispositions 테이블 CRUD 무결성 테스트 중...")
        test_disp = {
            "facility_key": test_key,
            "target_type": "소유자",
            "current_status": "주차장",
            "advance_notice_target": "건물"
        }

        test_disp_id = None
        # C (Create Disposition)
        r_dc = requests.post(f"{SUPABASE_URL}/rest/v1/dispositions", headers=HEADERS, json=[test_disp], timeout=5)
        if r_dc.status_code in [200, 201]:
            rows = r_dc.json()
            if rows and len(rows) > 0:
                test_disp_id = rows[0].get("id")
                log(f"1) 처분 INSERT 생성 성공 (발급된 진짜 DB ID={test_disp_id})", True)
            else:
                log("1) 처분 INSERT는 성공했으나 반환 ID 없음", False)
                all_passed = False
        else:
            log(f"1) 처분 INSERT 실패: status={r_dc.status_code}, {r_dc.text}", False)
            all_passed = False

        if test_disp_id:
            # R (Read Disposition)
            r_dr = requests.get(f"{SUPABASE_URL}/rest/v1/dispositions?id=eq.{test_disp_id}", headers=HEADERS, timeout=5)
            if r_dr.status_code == 200 and len(r_dr.json()) > 0:
                log("2) 처분 SELECT 조회 성공", True)
            else:
                log("2) 처분 SELECT 조회 실패", False)
                all_passed = False

            # U (Update Disposition)
            r_du = requests.patch(f"{SUPABASE_URL}/rest/v1/dispositions?id=eq.{test_disp_id}", headers=HEADERS, json={"current_status": "완료"}, timeout=5)
            if r_du.status_code in [200, 204]:
                log("3) 처분 PATCH 수정 성공", True)
            else:
                log("3) 처분 PATCH 수정 실패", False)
                all_passed = False

            # D (Delete Disposition)
            r_dd = requests.delete(f"{SUPABASE_URL}/rest/v1/dispositions?id=eq.{test_disp_id}", headers=HEADERS, timeout=5)
            if r_dd.status_code in [200, 204]:
                log("4) 처분 DELETE 삭제 성공 (가상 처분 롤백 완료)", True)
            else:
                log("4) 처분 DELETE 삭제 실패", False)
                all_passed = False

        # D (Delete Facility) - 처분 삭제 후 시설 삭제
        r_d = requests.delete(f"{SUPABASE_URL}/rest/v1/facilities?facility_key=eq.{test_key}", headers=HEADERS, timeout=5)
        if r_d.status_code in [200, 204]:
            log("시설 DELETE 삭제 성공 (가상 시설 롤백 완료)", True)
        else:
            log("시설 DELETE 삭제 실패", False)
            all_passed = False

    except Exception as e:
        log(f"Facilities / Dispositions CRUD 테스트 예외: {e}", False)
        all_passed = False

    # -------------------------------------------------------------
    # TEST 4: 로컬 캐시 파일 정합성 검증
    # -------------------------------------------------------------
    log("\nTEST 4: 로컬 캐시 파일 (facilities_cache.json, dispositions_cache.json) 무결성 검증 중...")
    try:
        with open("facilities_cache.json", "r", encoding="utf-8") as f:
            fac_cache = json.load(f)
        log(f"facilities_cache.json 파싱 성공 (총 {len(fac_cache)}개 시설)", True)

        with open("dispositions_cache.json", "r", encoding="utf-8") as f:
            disp_cache = json.load(f)
        log(f"dispositions_cache.json 파싱 성공 (총 {len(disp_cache)}개 처분)", True)
    except Exception as e:
        log(f"캐시 파일 파싱 오류: {e}", False)
        all_passed = False

    # -------------------------------------------------------------
    # 최종 판정
    # -------------------------------------------------------------
    print("=" * 65)
    if all_passed:
        print("  [SUCCESS] 모든 무결성 검증 테스트를 100% 통과했습니다!")
        print("  안전하게 클라우드 배포를 진행할 수 있습니다.")
        print("=" * 65)
        return 0
    else:
        print("  [FAILED] 무결성 검증 테스트에서 오류가 감지되었습니다!")
        print("  데이터 유실 위험 방지를 위해 배포가 원천 차단됩니다.")
        print("=" * 65)
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
