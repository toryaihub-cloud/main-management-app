# -*- coding: utf-8 -*-
"""
추가데이터.xlsx에서 충전시설 지상/지하 기수 및 설치장소를 추출하여
facilities_cache.json, Supabase DB extra_info, 마이그레이션 SQL에 반영하는 스크립트
"""
import openpyxl
import json
import sys
import os
import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

SUPABASE_URL = 'https://vijiacxcmtfekbmegjlf.supabase.co'
SECRET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpamlhY3hjbXRmZWtibWVnamxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgyMzgyNiwiZXhwIjoyMTAxMzk5ODI2fQ.Noa3eCRZLGLp67fRYu4ZlsFC4_d2X1C7KxQ_g2_zP00'
HEADERS = {
    'apikey': SECRET_KEY,
    'Authorization': 'Bearer ' + SECRET_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

def to_int(val):
    if val is None:
        return 0
    s = str(val).strip()
    if not s or s == '-' or s.lower() == 'none':
        return 0
    try:
        return int(float(s))
    except Exception:
        return 0

def to_str(val):
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() == 'none':
        return None
    return s

def main():
    print(">>> 1단계: 추가데이터.xlsx 파싱 시작...")
    excel_path = os.path.join(BASE_DIR, '추가데이터.xlsx')
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    sheet = wb.active

    excel_data = {}
    sql_updates = []

    for r in range(2, sheet.max_row + 1):
        key = sheet['N' + str(r)].value
        if not key:
            continue
        key = str(key).strip()

        ground_cnt = to_int(sheet['H' + str(r)].value)
        underground_cnt = to_int(sheet['I' + str(r)].value)
        location = to_str(sheet['M' + str(r)].value)

        excel_data[key] = {
            'charger_ground_cnt': ground_cnt,
            'charger_underground_cnt': underground_cnt,
            'charger_location': location
        }

        # SQL escape helper
        def sql_esc(v):
            if v is None:
                return "NULL"
            return "'" + str(v).replace("'", "''") + "'"

        sql_updates.append(
            f"UPDATE public.facilities SET "
            f"charger_ground_cnt = {ground_cnt}, "
            f"charger_underground_cnt = {underground_cnt}, "
            f"charger_location = {sql_esc(location)} "
            f"WHERE facility_key = {sql_esc(key)};"
        )

    print(f"  [확인] 엑셀에서 {len(excel_data)}개 시설 데이터 파싱 완료!")

    # >>> 2단계: 021_add_charger_location_and_counts_to_facilities.sql 생성
    print(">>> 2단계: supabase/migrations/021_add_charger_location_and_counts_to_facilities.sql 생성...")
    migration_file = os.path.join(BASE_DIR, 'supabase', 'migrations', '021_add_charger_location_and_counts_to_facilities.sql')
    
    update_statements = "\n".join(sql_updates)
    sql_content = f"""-- 021_add_charger_location_and_counts_to_facilities.sql
-- facilities 테이블에 충전시설 지상/지하 기수 및 설치장소 컬럼 추가 및 데이터 반영

ALTER TABLE public.facilities
ADD COLUMN IF NOT EXISTS charger_ground_cnt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS charger_underground_cnt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS charger_location text;

{update_statements}
"""
    with open(migration_file, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    print(f"  [완료] {migration_file} 생성 완료!")

    # >>> 3단계: facilities_cache.json 업데이트
    print(">>> 3단계: facilities_cache.json 갱신...")
    cache_path = os.path.join(BASE_DIR, 'facilities_cache.json')
    with open(cache_path, 'r', encoding='utf-8') as f:
        facs = json.load(f)

    matched_cnt = 0
    for f in facs:
        k = f.get('facility_key')
        if k and k in excel_data:
            item_data = excel_data[k]
            f['charger_ground_cnt'] = item_data['charger_ground_cnt']
            f['charger_underground_cnt'] = item_data['charger_underground_cnt']
            f['charger_location'] = item_data['charger_location']

            # extra_info 에도 보존
            if not isinstance(f.get('extra_info'), dict):
                f['extra_info'] = {}
            f['extra_info']['charger_ground_cnt'] = item_data['charger_ground_cnt']
            f['extra_info']['charger_underground_cnt'] = item_data['charger_underground_cnt']
            f['extra_info']['charger_location'] = item_data['charger_location']
            matched_cnt += 1
        else:
            # 기본값 설정
            if 'charger_ground_cnt' not in f:
                f['charger_ground_cnt'] = 0
            if 'charger_underground_cnt' not in f:
                f['charger_underground_cnt'] = 0
            if 'charger_location' not in f:
                f['charger_location'] = None

    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(facs, f, ensure_ascii=False, indent=2)
    print(f"  [완료] facilities_cache.json에 {matched_cnt}개 시설 매핑 저장 완료 (총 {len(facs)}개 시설)!")

    # >>> 4단계: Supabase DB의 extra_info 컬럼에 동기화 (스키마 제약 없이 영구 보존)
    print(">>> 4단계: Supabase DB extra_info에 동기화...")
    # 배치로 extra_info 업데이트
    db_updated_cnt = 0
    for idx, (k, item_data) in enumerate(excel_data.items()):
        # extra_info jsonb 패치
        patch_payload = {
            'extra_info': {
                'charger_ground_cnt': item_data['charger_ground_cnt'],
                'charger_underground_cnt': item_data['charger_underground_cnt'],
                'charger_location': item_data['charger_location']
            }
        }
        try:
            res = requests.patch(
                f"{SUPABASE_URL}/rest/v1/facilities?facility_key=eq.{k}",
                headers=HEADERS,
                json=patch_payload,
                timeout=5
            )
            if res.status_code in (200, 204):
                db_updated_cnt += 1
        except Exception:
            pass
        if (idx + 1) % 100 == 0 or (idx + 1) == len(excel_data):
            print(f"  DB 동기화 진행중... ({idx + 1} / {len(excel_data)})")

    print(f"  [완료] Supabase DB extra_info {db_updated_cnt}개 동기화 완료!")
    print("\n=================================================================")
    print("  [성공] 충전시설 지상/지하 기수 및 설치장소 데이터 반영 완료!")
    print("=================================================================")
    return True

if __name__ == '__main__':
    ok = main()
    sys.exit(0 if ok else 1)
