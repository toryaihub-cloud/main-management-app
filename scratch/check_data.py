import sys
sys.stdout.reconfigure(encoding='utf-8')
import json

# The issue: when sync_cache_from_db.py runs, it calls merge_facility_extra_fields(raw_item, old_item)
# This merges old_item's charger_ground_cnt into raw_item if raw_item doesn't have it
# BUT: the DB response does NOT have charger_ground_cnt column at all
# So raw_item won't have 'charger_ground_cnt' key, and it will be merged from old_item (cache)

# However, there's a critical problem:
# When deploy_safe.py runs sync first, it fetches from DB.
# If it's a FRESH sync (no prior cache), there's no old_item to merge from!
# But in our case, the cache already has the values, so merge should work.

# The REAL problem is in the BROWSER:
# The browser fetches directly from Supabase (path 1 in fetchFacilities)
# The DB response has NO charger_ground_cnt column
# Our JS code does: const extra = f.extra_info || {};
# Then: charger_ground_cnt: (f.charger_ground_cnt !== undefined && f.charger_ground_cnt !== null) ? f.charger_ground_cnt : (extra.charger_ground_cnt !== undefined ? extra.charger_ground_cnt : 0)

# Since f.charger_ground_cnt is undefined (key doesn't exist in DB response), 
# it should fall through to extra.charger_ground_cnt which IS 2

# Let me simulate this exactly:
class Undefined:
    pass

UNDEFINED = Undefined()

# Simulate JS behavior: 
# When a property doesn't exist on a JS object, accessing it returns undefined, not KeyError
db_response = {
    "facility_key": "K0014",
    "extra_info": {"charger_ground_cnt": 2, "charger_underground_cnt": 0, "charger_location": "관리동앞 주차장(전용2, 급속2)"}
    # NOTE: charger_ground_cnt is NOT in this dict
}

# In JS: f.charger_ground_cnt would be undefined
f_cgc = db_response.get("charger_ground_cnt", UNDEFINED)
print(f"f.charger_ground_cnt = {f_cgc}")
print(f"Is undefined: {isinstance(f_cgc, Undefined)}")

extra = db_response.get("extra_info") or {}
print(f"extra.charger_ground_cnt = {extra.get('charger_ground_cnt')}")

# JS logic: (f.charger_ground_cnt !== undefined && f.charger_ground_cnt !== null) ? f.charger_ground_cnt : (extra.charger_ground_cnt !== undefined ? extra.charger_ground_cnt : 0)
if isinstance(f_cgc, Undefined):
    # goes to fallback
    result = extra.get("charger_ground_cnt", 0)
else:
    result = f_cgc
    
print(f"Result should be: {result}")
print()

# Wait - but there's something subtle in JS. 
# When we do {...f}, if f doesn't have charger_ground_cnt, it won't be in the spread result
# Then when we override with charger_ground_cnt: ..., the value is whatever the ternary gives
# f.charger_ground_cnt where f is the raw DB row - since the key doesn't exist, it's undefined
# So the logic should work...

# UNLESS: the browser is not actually using the Supabase direct path!
# Maybe the Supabase call fails and falls back to the backend or static file
# The static file already has charger_ground_cnt at top level, so it should be fine

# Let me check if maybe the issue is something else entirely - 
# like maybe the DB response DOES include charger_ground_cnt as null because of the table schema?

import requests
SUPABASE_REST_URL = 'https://vijiacxcmtfekbmegjlf.supabase.co/rest/v1'
SUPABASE_SECRET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpamlhY3hjbXRmZWtibWVnamxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgyMzgyNiwiZXhwIjoyMTAxMzk5ODI2fQ.Noa3eCRZLGLp67fRYu4ZlsFC4_d2X1C7KxQ_g2_zP00'

r = requests.get(f'{SUPABASE_REST_URL}/facilities?facility_key=eq.K0014&select=*', 
    headers={'apikey': SUPABASE_SECRET_KEY, 'Authorization': f'Bearer {SUPABASE_SECRET_KEY}'})
raw_text = r.text
print("=== Raw JSON response (first 2000 chars) ===")
print(raw_text[:2000])
print()

# Check if charger_ground_cnt appears as a key in the raw JSON
print("'charger_ground_cnt' in raw response:", 'charger_ground_cnt' in raw_text)
print("'charger_underground_cnt' in raw response:", 'charger_underground_cnt' in raw_text)

# Parse and check keys
data = r.json()[0]
print()
print("Keys containing 'charger':")
for k in sorted(data.keys()):
    if 'charger' in k:
        print(f"  {k}: {data[k]}")
