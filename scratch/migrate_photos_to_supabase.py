"""
로컬 사진 폴더의 사진들을 Supabase facility_photos 테이블에 일괄 등록하는 스크립트.
- 이미 DB에 있는 파일명은 건너뜀 (중복 방지)
- 대용량이므로 배치 단위로 처리
"""
import os, sys, re, base64, time, requests

# MIGRATION_DISABLED (2026-11-21)
# 사진을 base64로 DB 테이블에 넣으면 Supabase 무료 플랜 DB 용량(500MB)을 초과합니다.
# 기존 사진은 GitHub '사진' 폴더로 서빙하고, 신규 사진은 Supabase Storage에 저장하므로
# 이 스크립트는 더 이상 실행하지 않습니다.
print("이 스크립트는 사용 중지되었습니다. (DB 용량 초과 방지)")
sys.exit(0)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from crypto_server import SUPABASE_URL, SECRET_KEY, HEADERS, PHOTO_PATH_CACHE

if not SUPABASE_URL or not SECRET_KEY:
    print("❌ Supabase 자격증명 없음. 중단.")
    sys.exit(1)

# 현재 DB에 등록된 파일명 목록 가져오기
print("1. Supabase에서 기존 등록 파일명 조회...")
try:
    db_res = requests.get(
        f"{SUPABASE_URL}/rest/v1/facility_photos?select=filename",
        headers=HEADERS, timeout=10
    )
    already_in_db = {row["filename"] for row in db_res.json()}
    print(f"   → DB에 이미 등록된 사진: {len(already_in_db)}건")
except Exception as e:
    print(f"❌ DB 조회 실패: {e}")
    sys.exit(1)

# 스캔할 사진 폴더 목록
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
search_dirs = [
    os.path.join(base_dir, "사진"),
    r"C:\Users\Administrator\Desktop\전기차\사진",
]

# 로컬 사진 수집 (파일명 중복 방지)
print("2. 로컬 사진 파일 수집...")
found_files = {}
for sdir in search_dirs:
    if not os.path.exists(sdir):
        continue
    for root, _, files in os.walk(sdir):
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
                if fname not in found_files:
                    found_files[fname] = os.path.join(root, fname)

print(f"   → 로컬 사진 총: {len(found_files)}개")

# DB에 없는 것만 필터링
to_upload = {k: v for k, v in found_files.items() if k not in already_in_db}
print(f"   → 신규 등록 대상: {len(to_upload)}개")

if not to_upload:
    print("✅ 모든 사진이 이미 DB에 등록되어 있습니다.")
    sys.exit(0)

# 배치 업로드 (1건씩 처리 - file_data가 크므로)
h_prefer = dict(HEADERS)
h_prefer["Prefer"] = "return=minimal"

success_count = 0
fail_count = 0
fail_list = []

for i, (fname, fpath) in enumerate(sorted(to_upload.items())):
    match = re.search(r'(K\d{4})', fname, re.IGNORECASE)
    if not match:
        print(f"  [SKIP] {fname} - K번호 없음")
        continue
    k_upper = match.group(1).upper()

    try:
        with open(fpath, "rb") as f:
            img_bytes = f.read()
        raw_b64 = base64.b64encode(img_bytes).decode("utf-8")

        payload = [{
            "facility_key": k_upper,
            "filename": fname,
            "file_data": raw_b64
        }]

        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/facility_photos",
            headers=h_prefer, json=payload, timeout=15
        )
        if res.status_code in [200, 201]:
            success_count += 1
            if (i + 1) % 50 == 0:
                print(f"  진행: {i+1}/{len(to_upload)} | 성공: {success_count}, 실패: {fail_count}")
        else:
            fail_count += 1
            fail_list.append(f"{fname}: HTTP {res.status_code} - {res.text[:100]}")
            print(f"  [FAIL] {fname}: {res.status_code}")

    except Exception as e:
        fail_count += 1
        fail_list.append(f"{fname}: {e}")
        print(f"  [ERROR] {fname}: {e}")

    time.sleep(0.05)  # 초당 20건 제한

print(f"\n✅ 완료! 성공: {success_count}건, 실패: {fail_count}건")
if fail_list:
    print("\n실패 목록:")
    for f in fail_list[:20]:
        print(" -", f)
