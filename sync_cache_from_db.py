"""
배포 전 캐시 동기화 스크립트
Git에 커밋되는 facilities_cache.json과 dispositions_cache.json을
Supabase DB의 최신 데이터로 업데이트합니다.

사용법: python sync_cache_from_db.py
"""
import requests
import json
import os
import sys

SUPABASE_URL = 'https://vijiacxcmtfekbmegjlf.supabase.co'
SECRET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpamlhY3hjbXRmZWtibWVnamxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgyMzgyNiwiZXhwIjoyMTAxMzk5ODI2fQ.Noa3eCRZLGLp67fRYu4ZlsFC4_d2X1C7KxQ_g2_zP00'
HEADERS = {
    'apikey': SECRET_KEY,
    'Authorization': 'Bearer ' + SECRET_KEY
}

def sync():
    print("[sync] Supabase DB에서 최신 데이터를 가져와 캐시 파일을 동기화합니다...")

    # Facilities
    try:
        res = requests.get(SUPABASE_URL + '/rest/v1/facilities?select=*&order=facility_key.asc', headers=HEADERS, timeout=15)
        if res.status_code == 200:
            data = res.json()
            with open('facilities_cache.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("[sync] facilities_cache.json 업데이트 완료 (%d건)" % len(data))
        else:
            print("[sync] ERROR: facilities fetch status=%d" % res.status_code)
            return False
    except Exception as e:
        print("[sync] ERROR: facilities fetch failed: %s" % str(e))
        return False

    # Dispositions
    try:
        res = requests.get(SUPABASE_URL + '/rest/v1/dispositions?select=*&order=id.asc', headers=HEADERS, timeout=15)
        if res.status_code == 200:
            data = res.json()
            with open('dispositions_cache.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("[sync] dispositions_cache.json 업데이트 완료 (%d건)" % len(data))
        else:
            print("[sync] ERROR: dispositions fetch status=%d" % res.status_code)
            return False
    except Exception as e:
        print("[sync] ERROR: dispositions fetch failed: %s" % str(e))
        return False

    print("[sync] 캐시 동기화 완료! 이제 git add/commit/push 해도 안전합니다.")
    return True

if __name__ == '__main__':
    success = sync()
    sys.exit(0 if success else 1)
