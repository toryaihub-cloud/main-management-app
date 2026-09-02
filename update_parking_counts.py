import pandas as pd
import json
import requests
import os

SUPABASE_URL = 'https://vijiacxcmtfekbmegjlf.supabase.co'
SECRET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpamlhY3hjbXRmZWtibWVnamxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgyMzgyNiwiZXhwIjoyMTAxMzk5ODI2fQ.Noa3eCRZLGLp67fRYu4ZlsFC4_d2X1C7KxQ_g2_zP00'
HEADERS = {
    'apikey': SECRET_KEY,
    'Authorization': f'Bearer {SECRET_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

print("Loading DB.xlsx...")
df = pd.read_excel('DB.xlsx', sheet_name=0)

# 인덱스 17: 지상면수, 인덱스 18: 지하면수, 인덱스 72: KEY
updates = []
for idx, row in df.iterrows():
    key = str(row.iloc[72]).strip()
    if not key or key == 'nan' or key == 'None':
        continue
    
    try:
        ground = int(row.iloc[17]) if pd.notna(row.iloc[17]) else 0
    except:
        ground = 0
        
    try:
        underground = int(row.iloc[18]) if pd.notna(row.iloc[18]) else 0
    except:
        underground = 0
        
    updates.append({
        'facility_key': key,
        'parking_ground_cnt': ground,
        'parking_underground_cnt': underground
    })

print(f"Extracted {len(updates)} records to update.")

# 1. 로컬 캐시 업데이트
cache_file = 'facilities_cache.json'
if os.path.exists(cache_file):
    with open(cache_file, 'r', encoding='utf-8') as f:
        cache_data = json.load(f)
    
    updated_count_local = 0
    for item in cache_data:
        fac_key = item.get('facility_key')
        match = next((u for u in updates if u['facility_key'] == fac_key), None)
        if match:
            item['parking_ground_cnt'] = match['parking_ground_cnt']
            item['parking_underground_cnt'] = match['parking_underground_cnt']
            updated_count_local += 1
            
    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(cache_data, f, ensure_ascii=False, indent=2)
    print(f"Updated {updated_count_local} records in local {cache_file}.")

# 2. Supabase DB 일괄 업데이트
# PostgREST 에서는 컬럼 업데이트 시 PATCH 를 사용하는 것이 일반적이나,
# PATCH는 다건 처리가 제한적일 수 있으므로(query parameter로 필터링해야 함),
# ThreadPoolExecutor를 사용해 병렬로 전송합니다.
import concurrent.futures

def update_db(u):
    payload = {
        'parking_ground_cnt': u['parking_ground_cnt'],
        'parking_underground_cnt': u['parking_underground_cnt']
    }
    res = requests.patch(f"{SUPABASE_URL}/rest/v1/facilities?facility_key=eq.{u['facility_key']}", headers=HEADERS, json=payload)
    return res.status_code

db_success = 0
db_fail = 0

with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    futures = [executor.submit(update_db, u) for u in updates]
    for future in concurrent.futures.as_completed(futures):
        status = future.result()
        if status in [200, 204]:
            db_success += 1
        else:
            db_fail += 1

print(f"Supabase DB updates: {db_success} success, {db_fail} failed.")
if db_fail > 0:
    print("Warning: DB update failures are likely due to missing columns in DB. Please execute 011_add_parking_location_counts_to_facilities.sql in Supabase.")
