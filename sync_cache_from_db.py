"""
배포 전 캐시 동기화 스크립트 (개선판)
Git에 커밋되는 facilities_cache.json과 dispositions_cache.json을
Supabase DB의 최신 데이터와 로컬의 상세 수정값을 스마트하게 병합하여 업데이트합니다.

1. DB 암호화 필드를 복호화하여 *_decrypted 필드 생성
2. parking_installed_cnt, charger_installed_cnt 등 파생 필드 보존
3. DB에 컬럼이 없는 상세 필드(완속/급속 등)는 기존 캐시의 최신값 보존
"""
import requests
import json
import os
import sys

# 프로젝트 루트를 sys.path에 추가
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from crypto_utils import decrypt_data
from crypto_server import (
    process_facility_item, process_disposition_item, merge_facility_extra_fields,
    load_deleted_keys, DELETED_FACILITY_KEYS, DELETED_DISPOSITION_IDS
)

SUPABASE_URL = 'https://vijiacxcmtfekbmegjlf.supabase.co'
SECRET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpamlhY3hjbXRmZWtibWVnamxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgyMzgyNiwiZXhwIjoyMTAxMzk5ODI2fQ.Noa3eCRZLGLp67fRYu4ZlsFC4_d2X1C7KxQ_g2_zP00'
HEADERS = {
    'apikey': SECRET_KEY,
    'Authorization': 'Bearer ' + SECRET_KEY
}

def sync():
    print("[sync] Supabase DB에서 최신 데이터를 가져와 캐시 파일을 동기화합니다...")
    load_deleted_keys()

    # 기존 캐시 파일 로드 (DB에 없는 특수 필드 보존용)
    old_fac_map = {}
    if os.path.exists('facilities_cache.json'):
        try:
            with open('facilities_cache.json', 'r', encoding='utf-8') as f:
                for item in json.load(f):
                    k = item.get('facility_key')
                    if k: old_fac_map[k] = item
        except Exception as e:
            print("[sync] Warning: Could not read existing facilities_cache.json:", e)

    old_disp_map = {}
    if os.path.exists('dispositions_cache.json'):
        try:
            with open('dispositions_cache.json', 'r', encoding='utf-8') as f:
                for item in json.load(f):
                    did = str(item.get('id'))
                    if did: old_disp_map[did] = item
        except Exception as e:
            print("[sync] Warning: Could not read existing dispositions_cache.json:", e)

    # 1. Facilities 동기화
    try:
        res = requests.get(f"{SUPABASE_URL}/rest/v1/facilities?select=*&order=facility_key.asc", headers=HEADERS, timeout=15)
        if res.status_code == 200:
            db_data = res.json()
            processed_facilities = []
            for raw_item in db_data:
                k = raw_item.get('facility_key')
                old_item = old_fac_map.get(k, {})
                
                # 기존 캐시에 저장되어 있던 완속/급속 및 부가 운영 필드 보존
                raw_item = merge_facility_extra_fields(raw_item, old_item)
                item = process_facility_item(raw_item)
                
                # K0107 농협은행 광주영업본부 특별 보정 (사용자 요청: 완속 2기 / 급속 2기)
                if k == 'K0107':
                    item['charger_slow_cnt'] = 2
                    item['charger_fast_cnt'] = 2
                    item['charger_fast_req_cnt'] = 2
                    item['charger_installed_cnt'] = 4
                    item['parking_installed_cnt'] = 4

                processed_facilities.append(item)

            processed_facilities = [f for f in processed_facilities if f.get('facility_key') not in DELETED_FACILITY_KEYS]
            with open('facilities_cache.json', 'w', encoding='utf-8') as f:
                json.dump(processed_facilities, f, ensure_ascii=False, indent=2)
            print(f"[sync] facilities_cache.json 업데이트 완료 ({len(processed_facilities)}건 - 복호화 및 파생필드 완벽 반영)")
        else:
            print(f"[sync] ERROR: facilities fetch status={res.status_code}")
            return False
    except Exception as e:
        print(f"[sync] ERROR: facilities fetch failed: {e}")
        return False

    # 2. Dispositions 동기화
    try:
        res = requests.get(f"{SUPABASE_URL}/rest/v1/dispositions?select=*&order=id.asc", headers=HEADERS, timeout=15)
        if res.status_code == 200:
            db_data = res.json()
            processed_dispositions = []
            for raw_item in db_data:
                did = str(raw_item.get('id'))
                old_item = old_disp_map.get(did, {})

                # process_disposition_item을 통해 복호화 필드 생성 (*_decrypted)
                item = process_disposition_item(raw_item)

                # 복호화 필드가 비어있고 기존 캐시에 유효한 값이 있다면 보존
                for dec_field in ['target_name_decrypted', 'recipient_name_decrypted', 'mail_address_decrypted', 'abstract_address_decrypted', 'reg_num_decrypted', 'contact_decrypted']:
                    if not item.get(dec_field) and old_item.get(dec_field):
                        item[dec_field] = old_item[dec_field]

                processed_dispositions.append(item)

            processed_dispositions = [d for d in processed_dispositions if str(d.get('id')) not in DELETED_DISPOSITION_IDS and d.get('facility_key') not in DELETED_FACILITY_KEYS]
            with open('dispositions_cache.json', 'w', encoding='utf-8') as f:
                json.dump(processed_dispositions, f, ensure_ascii=False, indent=2)
            print(f"[sync] dispositions_cache.json 업데이트 완료 ({len(processed_dispositions)}건 - 복호화 필드 완벽 반영)")
        else:
            print(f"[sync] ERROR: dispositions fetch status={res.status_code}")
            return False
    except Exception as e:
        print(f"[sync] ERROR: dispositions fetch failed: {e}")
        return False

    print("[sync] 캐시 동기화 완료! 이제 git add/commit/push 해도 안전합니다.")
    return True

if __name__ == '__main__':
    success = sync()
    sys.exit(0 if success else 1)
