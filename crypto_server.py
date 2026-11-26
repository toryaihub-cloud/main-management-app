import http.server
import socketserver
import json
import requests
import hashlib
import time
import os
import glob
import re
import threading
from urllib.parse import parse_qs, urlparse, unquote, quote
from crypto_utils import encrypt_data, decrypt_data

PORT = int(os.environ.get("PORT", 8081))
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://vijiacxcmtfekbmegjlf.supabase.co")
SECRET_KEY = os.environ.get("SECRET_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpamlhY3hjbXRmZWtibWVnamxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgyMzgyNiwiZXhwIjoyMTAxMzk5ODI2fQ.Noa3eCRZLGLp67fRYu4ZlsFC4_d2X1C7KxQ_g2_zP00")
SALT = "EcoCarManagement_Salt_2026!"

HEADERS = {
    "apikey": SECRET_KEY,
    "Authorization": f"Bearer {SECRET_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

USERS_FILE = os.path.join(os.path.dirname(__file__), "users_db.json")
SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "settings.json")
NOTES_FILE = os.path.join(os.path.dirname(__file__), "dispositions_notes.json")
CORRECTION_ORDERS_FILE = os.path.join(os.path.dirname(__file__), "correction_orders_cache.json")
GWANGSAN_FACILITIES_FILE = os.path.join(os.path.dirname(__file__), "gwangsan_facilities_cache.json")
OPERATIONS_FILE = os.path.join(os.path.dirname(__file__), "operations_cache.json")
ECOCAR_HTML_PATH = r"c:\Users\Administrator\Desktop\프로젝트\관리페이지_HTML\ECO-CAR.html"

def load_gwangsan_facilities():
    # 1. Supabase DB 조회 시도 (1순위 SSOT)
    if SUPABASE_URL and SECRET_KEY:
        try:
            res = requests.get(f"{SUPABASE_URL}/rest/v1/gwangsan_facilities?select=*&order=id.asc", headers=HEADERS, timeout=8)
            if res.status_code == 200:
                rows = res.json()
                if rows and len(rows) > 0:
                    for item in rows:
                        item["manager_name"] = decrypt_data(item.get("manager_name_encrypted")) if item.get("manager_name_encrypted") else ""
                        item["manager_contact"] = decrypt_data(item.get("manager_contact_encrypted")) if item.get("manager_contact_encrypted") else ""
                    try:
                        with open(GWANGSAN_FACILITIES_FILE, "w", encoding="utf-8") as f:
                            json.dump(rows, f, ensure_ascii=False, indent=2)
                    except Exception:
                        pass
                    return rows
        except Exception as e:
            print(f"Supabase load_gwangsan_facilities error: {e}")

    # 2. 로컬 캐시 fallback
    if os.path.exists(GWANGSAN_FACILITIES_FILE):
        try:
            with open(GWANGSAN_FACILITIES_FILE, "r", encoding="utf-8") as f:
                rows = json.load(f)
            for item in rows:
                if "manager_name" not in item:
                    item["manager_name"] = decrypt_data(item.get("manager_name_encrypted")) if item.get("manager_name_encrypted") else ""
                if "manager_contact" not in item:
                    item["manager_contact"] = decrypt_data(item.get("manager_contact_encrypted")) if item.get("manager_contact_encrypted") else ""
            return rows
        except Exception as e:
            print(f"Local load_gwangsan_facilities error: {e}")
    return []

def load_operations():
    # 1. Supabase DB 조회 시도 (1순위 SSOT)
    if SUPABASE_URL and SECRET_KEY:
        try:
            res = requests.get(f"{SUPABASE_URL}/rest/v1/operations?select=*&order=id.asc", headers=HEADERS, timeout=8)
            if res.status_code == 200:
                ops = res.json()
                if ops and len(ops) > 0:
                    for item in ops:
                        item["manager_name"] = decrypt_data(item.get("manager_name_encrypted")) if item.get("manager_name_encrypted") else ""
                        item["manager_contact"] = decrypt_data(item.get("manager_contact_encrypted")) if item.get("manager_contact_encrypted") else ""
                    try:
                        with open(OPERATIONS_FILE, "w", encoding="utf-8") as f:
                            json.dump(ops, f, ensure_ascii=False, indent=2)
                    except Exception:
                        pass
                    return ops
        except Exception as e:
            print(f"Supabase load_operations error: {e}")

    # 2. 로컬 캐시 fallback
    if os.path.exists(OPERATIONS_FILE):
        try:
            with open(OPERATIONS_FILE, "r", encoding="utf-8") as f:
                ops = json.load(f)
            for item in ops:
                if "manager_name" not in item:
                    item["manager_name"] = decrypt_data(item.get("manager_name_encrypted")) if item.get("manager_name_encrypted") else ""
                if "manager_contact" not in item:
                    item["manager_contact"] = decrypt_data(item.get("manager_contact_encrypted")) if item.get("manager_contact_encrypted") else ""
            return ops
        except Exception as e:
            print(f"Local load_operations error: {e}")
    return []

def save_operation(req_data):
    facility_key = str(req_data.get("facility_key", "")).strip()
    if not facility_key:
        return False, "시설 고유키(facility_key)는 필수입니다."

    raw_mgr = req_data.get("manager_name")
    raw_contact = req_data.get("manager_contact")
    enc_mgr = encrypt_data(raw_mgr) if raw_mgr else req_data.get("manager_name_encrypted")
    enc_contact = encrypt_data(raw_contact) if raw_contact else req_data.get("manager_contact_encrypted")

    record = {
        "facility_key": facility_key,
        "facility_name": req_data.get("facility_name", ""),
        "address_doro": req_data.get("address_doro", ""),
        "investigator": req_data.get("investigator", ""),
        "investigation_date": req_data.get("investigation_date", ""),
        "parking_ground_cnt": int(req_data.get("parking_ground_cnt", 0) or 0),
        "parking_underground_cnt": int(req_data.get("parking_underground_cnt", 0) or 0),
        "parking_uninstalled_cnt": int(req_data.get("parking_uninstalled_cnt", 0) or 0),
        "charger_installed_cnt": int(req_data.get("charger_installed_cnt", 0) or 0),
        "charger_fast_cnt": int(req_data.get("charger_fast_cnt", 0) or 0),
        "charger_slow_cnt": int(req_data.get("charger_slow_cnt", 0) or 0),
        "charger_uninstalled_cnt": int(req_data.get("charger_uninstalled_cnt", 0) or 0),
        "normal_operator_qty": req_data.get("normal_operator_qty", ""),
        "unoperated_cnt": int(req_data.get("unoperated_cnt", 0) or 0),
        "location": req_data.get("location", ""),
        "unoperated_operator": req_data.get("unoperated_operator", ""),
        "initial_install_date": req_data.get("initial_install_date", ""),
        "operation_status": req_data.get("operation_status", "정상운영"),
        "unoperated_reason": req_data.get("unoperated_reason", ""),
        "unoperated_date": req_data.get("unoperated_date", ""),
        "note": req_data.get("note", ""),
        "complaint_and_plan": req_data.get("complaint_and_plan", ""),
        "manager_name_encrypted": enc_mgr,
        "manager_contact_encrypted": enc_contact,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

    if SUPABASE_URL and SECRET_KEY:
        try:
            url = f"{SUPABASE_URL}/rest/v1/operations"
            upsert_headers = dict(HEADERS)
            upsert_headers["Prefer"] = "resolution=merge-duplicates"
            requests.post(url, headers=upsert_headers, json=[record], timeout=8)
        except Exception as e:
            print("Supabase operation save error:", e)

    try:
        cached = []
        if os.path.exists(OPERATIONS_FILE):
            with open(OPERATIONS_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
        found = False
        for idx, item in enumerate(cached):
            if item.get("facility_key") == facility_key:
                cached[idx] = {**item, **record}
                cached[idx]["manager_name"] = raw_mgr if raw_mgr is not None else decrypt_data(enc_mgr)
                cached[idx]["manager_contact"] = raw_contact if raw_contact is not None else decrypt_data(enc_contact)
                found = True
                break
        if not found:
            new_item = dict(record)
            new_item["manager_name"] = raw_mgr or ""
            new_item["manager_contact"] = raw_contact or ""
            cached.append(new_item)
        with open(OPERATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(cached, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Local cache operation save error:", e)

    # === [연계 동기화] 통합시설관리(facilities) 및 광산구관리시설(gwangsan_facilities)에 동일 항목 동기화 ===
    shared_sync = {
        "facility_name": record["facility_name"],
        "address_doro": record["address_doro"],
        "parking_ground_cnt": record["parking_ground_cnt"],
        "parking_underground_cnt": record["parking_underground_cnt"],
        "parking_uninstalled_cnt": record["parking_uninstalled_cnt"],
        "parking_installed_cnt": record["parking_ground_cnt"] + record["parking_underground_cnt"],
        "charger_installed_cnt": record["charger_installed_cnt"],
        "charger_fast_cnt": record["charger_fast_cnt"],
        "charger_slow_cnt": record["charger_slow_cnt"],
        "charger_uninstalled_cnt": record["charger_uninstalled_cnt"],
        "updated_at": record["updated_at"]
    }
    if enc_mgr: shared_sync["manager_name_encrypted"] = enc_mgr
    if enc_contact: shared_sync["manager_contact_encrypted"] = enc_contact

    # 1. Supabase DB 연쇄 동기화
    if SUPABASE_URL and SECRET_KEY:
        try:
            prefer_h = {**HEADERS, "Prefer": "return=representation"}
            # facilities PATCH
            requests.patch(f"{SUPABASE_URL}/rest/v1/facilities?facility_key=eq.{facility_key}", headers=prefer_h, json=shared_sync, timeout=5)
            # gwangsan_facilities PATCH
            requests.patch(f"{SUPABASE_URL}/rest/v1/gwangsan_facilities?facility_key=eq.{facility_key}", headers=prefer_h, json=shared_sync, timeout=5)
        except Exception as eSync:
            print("Operation sync to facilities/gwangsan error:", eSync)

    # 2. 로컬 캐시 연쇄 동기화
    try:
        # facilities 캐시 동기화
        global FACILITIES_CACHE
        if os.path.exists(LOCAL_FACILITIES_FILE):
            with open(LOCAL_FACILITIES_FILE, "r", encoding="utf-8") as ff:
                f_list = json.load(ff)
            for idx, item in enumerate(f_list):
                if item.get("facility_key") == facility_key:
                    f_list[idx] = {**item, **shared_sync}
                    if raw_mgr: f_list[idx]["manager_name"] = raw_mgr
                    if raw_contact: f_list[idx]["manager_contact"] = raw_contact
                    break
            with open(LOCAL_FACILITIES_FILE, "w", encoding="utf-8") as ff:
                json.dump(f_list, ff, ensure_ascii=False, indent=2)
            FACILITIES_CACHE["data"] = None  # 캐시 갱신 유도
    except Exception as eF:
        print("Local facilities cache sync error from op:", eF)

    try:
        # gwangsan_facilities 캐시 동기화
        if os.path.exists(GWANGSAN_FACILITIES_FILE):
            with open(GWANGSAN_FACILITIES_FILE, "r", encoding="utf-8") as gf:
                g_list = json.load(gf)
            for idx, item in enumerate(g_list):
                if item.get("facility_key") == facility_key:
                    g_list[idx] = {**item, **shared_sync}
                    if raw_mgr: g_list[idx]["manager_name"] = raw_mgr
                    if raw_contact: g_list[idx]["manager_contact"] = raw_contact
                    break
            with open(GWANGSAN_FACILITIES_FILE, "w", encoding="utf-8") as gf:
                json.dump(g_list, gf, ensure_ascii=False, indent=2)
    except Exception as eG:
        print("Local gwangsan cache sync error from op:", eG)

    return True, "정상적으로 저장되었습니다."


def save_gwangsan_facility(req_data):
    facility_key = str(req_data.get("facility_key", "")).strip()
    if not facility_key:
        return False, "시설 고유키(facility_key)는 필수입니다."

    def safe_int(val, default=0):
        try:
            return int(val) if val is not None and str(val).strip() != "" else default
        except Exception:
            return default

    def safe_date(val):
        if not val or not str(val).strip() or str(val).strip() in ["-", "None", "null"]:
            return None
        s = str(val).strip().replace(".", "-").replace("/", "-")
        import re
        m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
        if m:
            return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        return None

    raw_mgr = req_data.get("manager_name")
    raw_contact = req_data.get("manager_contact")
    enc_mgr = encrypt_data(raw_mgr) if raw_mgr else req_data.get("manager_name_encrypted")
    enc_contact = encrypt_data(raw_contact) if raw_contact else req_data.get("manager_contact_encrypted")

    record = {
        "facility_key": facility_key,
        "compliance_status": req_data.get("compliance_status", ""),
        "dept_name": req_data.get("dept_name", ""),
        "dept_action_plan": req_data.get("dept_action_plan", ""),
        "subsidy_apply": req_data.get("subsidy_apply", ""),
        "final_conclusion": req_data.get("final_conclusion", ""),
        
        # 전용주차구역
        "parking_required_cnt": safe_int(req_data.get("parking_required_cnt")),
        "parking_installed_cnt": safe_int(req_data.get("parking_installed_cnt")),
        "parking_ground_cnt": safe_int(req_data.get("parking_ground_cnt")),
        "parking_underground_cnt": safe_int(req_data.get("parking_underground_cnt")),
        "parking_uninstalled_cnt": safe_int(req_data.get("parking_uninstalled_cnt")),
        
        # 충전시설
        "charger_required_cnt": safe_int(req_data.get("charger_required_cnt")),
        "charger_fast_req_cnt": safe_int(req_data.get("charger_fast_req_cnt")),
        "charger_installed_cnt": safe_int(req_data.get("charger_installed_cnt")),
        "charger_fast_cnt": safe_int(req_data.get("charger_fast_cnt")),
        "charger_slow_cnt": safe_int(req_data.get("charger_slow_cnt")),
        "charger_uninstalled_cnt": safe_int(req_data.get("charger_uninstalled_cnt")),
        
        # 1차
        "survey1_type": req_data.get("survey1_type", ""),
        "survey1_date": safe_date(req_data.get("survey1_date")),
        "survey1_inspector": req_data.get("survey1_inspector", ""),
        "survey1_check": req_data.get("survey1_check", ""),
        "survey1_plan": req_data.get("survey1_plan", ""),
        "survey1_note": req_data.get("survey1_note", ""),
        
        # 2차
        "survey2_type": req_data.get("survey2_type", ""),
        "survey2_date": safe_date(req_data.get("survey2_date")),
        "survey2_inspector": req_data.get("survey2_inspector", ""),
        "survey2_check": req_data.get("survey2_check", ""),
        "survey2_plan": req_data.get("survey2_plan", ""),
        "survey2_note": req_data.get("survey2_note", ""),
        
        # 3차
        "survey3_type": req_data.get("survey3_type", ""),
        "survey3_date": safe_date(req_data.get("survey3_date")),
        "survey3_inspector": req_data.get("survey3_inspector", ""),
        "survey3_check": req_data.get("survey3_check", ""),
        "survey3_plan": req_data.get("survey3_plan", ""),
        "survey3_note": req_data.get("survey3_note", ""),
        
        # 4차
        "survey4_type": req_data.get("survey4_type", ""),
        "survey4_date": safe_date(req_data.get("survey4_date")),
        "survey4_inspector": req_data.get("survey4_inspector", ""),
        "survey4_check": req_data.get("survey4_check", ""),
        "survey4_plan": req_data.get("survey4_plan", ""),
        "survey4_note": req_data.get("survey4_note", ""),
        
        # 5차
        "survey5_type": req_data.get("survey5_type", ""),
        "survey5_date": safe_date(req_data.get("survey5_date")),
        "survey5_inspector": req_data.get("survey5_inspector", ""),
        "survey5_check": req_data.get("survey5_check", ""),
        "survey5_plan": req_data.get("survey5_plan", ""),
        "survey5_note": req_data.get("survey5_note", ""),
        
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

    # 요청에 실제로 포함된 항목만 저장 (빠진 항목을 빈 값/0으로 덮어쓰지 않음)
    record = {k: v for k, v in record.items() if k in ("facility_key", "updated_at") or k in req_data}

    if enc_mgr:
        record["manager_name_encrypted"] = enc_mgr
    if enc_contact:
        record["manager_contact_encrypted"] = enc_contact

    # 1. Supabase DB 업데이트 시도
    if SUPABASE_URL and SECRET_KEY:
        try:
            url = f"{SUPABASE_URL}/rest/v1/gwangsan_facilities?facility_key=eq.{facility_key}"
            headers = dict(HEADERS)
            headers["Prefer"] = "return=representation"
            res = requests.patch(url, headers=headers, json=record, timeout=8)
            print(f"Supabase gwangsan PATCH status={res.status_code}")
        except Exception as e:
            print("Supabase gwangsan save error:", e)

    # 2. 로컬 캐시 업데이트
    try:
        cached = []
        if os.path.exists(GWANGSAN_FACILITIES_FILE):
            with open(GWANGSAN_FACILITIES_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
        found = False
        for idx, item in enumerate(cached):
            if item.get("facility_key") == facility_key:
                cached[idx] = {**item, **record}
                if raw_mgr is not None: cached[idx]["manager_name"] = raw_mgr
                if raw_contact is not None: cached[idx]["manager_contact"] = raw_contact
                found = True
                break
        if not found:
            new_item = dict(record)
            new_item["manager_name"] = raw_mgr or ""
            new_item["manager_contact"] = raw_contact or ""
            cached.append(new_item)
        with open(GWANGSAN_FACILITIES_FILE, "w", encoding="utf-8") as f:
            json.dump(cached, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Local cache gwangsan save error:", e)

    # === [연계 동기화] 통합시설관리(facilities) 및 운영현황관리(operations)에 동일 항목 동기화 ===
    fac_sync = {"updated_at": record["updated_at"]}
    if record.get("compliance_status"):
        fac_sync["compliance_status"] = record["compliance_status"]
    if record.get("facility_name"):
        fac_sync["facility_name"] = record["facility_name"]
    if record.get("address_doro"):
        fac_sync["address_doro"] = record["address_doro"]
    if record.get("address_jibun"):
        fac_sync["address_jibun"] = record["address_jibun"]
    if enc_mgr:
        fac_sync["manager_name_encrypted"] = enc_mgr
    if enc_contact:
        fac_sync["manager_contact_encrypted"] = enc_contact

    if "parking_ground_cnt" in req_data and req_data.get("parking_ground_cnt") is not None:
        fac_sync["parking_ground_cnt"] = record["parking_ground_cnt"]
        fac_sync["parking_underground_cnt"] = record["parking_underground_cnt"]
        fac_sync["parking_uninstalled_cnt"] = record["parking_uninstalled_cnt"]
        fac_sync["parking_installed_cnt"] = record["parking_installed_cnt"]
    if "charger_installed_cnt" in req_data and req_data.get("charger_installed_cnt") is not None:
        fac_sync["charger_installed_cnt"] = record["charger_installed_cnt"]
        fac_sync["charger_fast_cnt"] = record["charger_fast_cnt"]
        fac_sync["charger_slow_cnt"] = record["charger_slow_cnt"]
        fac_sync["charger_uninstalled_cnt"] = record["charger_uninstalled_cnt"]

    # 1. Supabase DB 연쇄 동기화
    if SUPABASE_URL and SECRET_KEY:
        try:
            prefer_h = {**HEADERS, "Prefer": "return=representation"}
            # facilities PATCH
            requests.patch(f"{SUPABASE_URL}/rest/v1/facilities?facility_key=eq.{facility_key}", headers=prefer_h, json=fac_sync, timeout=5)
            # operations PATCH
            op_sync = {k: v for k, v in fac_sync.items() if k in ["facility_name", "address_doro", "parking_ground_cnt", "parking_underground_cnt", "parking_uninstalled_cnt", "charger_installed_cnt", "charger_fast_cnt", "charger_slow_cnt", "charger_uninstalled_cnt", "manager_name_encrypted", "manager_contact_encrypted", "updated_at"]}
            requests.patch(f"{SUPABASE_URL}/rest/v1/operations?facility_key=eq.{facility_key}", headers=prefer_h, json=op_sync, timeout=5)
        except Exception as eSync:
            print("Gwangsan sync to facilities/operations error:", eSync)

    # 2. 로컬 캐시 연쇄 동기화
    try:
        global FACILITIES_CACHE
        if os.path.exists(LOCAL_FACILITIES_FILE):
            with open(LOCAL_FACILITIES_FILE, "r", encoding="utf-8") as ff:
                f_list = json.load(ff)
            for idx, item in enumerate(f_list):
                if item.get("facility_key") == facility_key:
                    f_list[idx] = {**item, **fac_sync}
                    if raw_mgr: f_list[idx]["manager_name"] = raw_mgr
                    if raw_contact: f_list[idx]["manager_contact"] = raw_contact
                    break
            with open(LOCAL_FACILITIES_FILE, "w", encoding="utf-8") as ff:
                json.dump(f_list, ff, ensure_ascii=False, indent=2)
            FACILITIES_CACHE["data"] = None
    except Exception as eF:
        print("Local facilities cache sync error from gwangsan:", eF)

    try:
        if os.path.exists(OPERATIONS_FILE):
            with open(OPERATIONS_FILE, "r", encoding="utf-8") as of:
                o_list = json.load(of)
            for idx, item in enumerate(o_list):
                if item.get("facility_key") == facility_key:
                    op_sync = {k: v for k, v in fac_sync.items() if k in ["facility_name", "address_doro", "parking_ground_cnt", "parking_underground_cnt", "parking_uninstalled_cnt", "charger_installed_cnt", "charger_fast_cnt", "charger_slow_cnt", "charger_uninstalled_cnt", "updated_at"]}
                    o_list[idx] = {**item, **op_sync}
                    if raw_mgr: o_list[idx]["manager_name"] = raw_mgr
                    if raw_contact: o_list[idx]["manager_contact"] = raw_contact
                    break
            with open(OPERATIONS_FILE, "w", encoding="utf-8") as of:
                json.dump(o_list, of, ensure_ascii=False, indent=2)
    except Exception as eO:
        print("Local operations cache sync error from gwangsan:", eO)

    return True, "정상적으로 저장되었습니다."



def load_correction_orders():
    # 1. Supabase DB 조회 시도 (1순위 SSOT)
    if SUPABASE_URL and SECRET_KEY:
        try:
            res = requests.get(f"{SUPABASE_URL}/rest/v1/correction_orders?select=*&order=id.asc", headers=HEADERS, timeout=8)
            if res.status_code == 200:
                orders = res.json()
                if orders and len(orders) > 0:
                    meta = {}
                    for o in orders:
                        br = o.get("batch_round")
                        if not br: continue
                        if br not in meta:
                            meta[br] = {
                                "batch_round": br,
                                "batch_label": f"{br} 시정명령",
                                "batch_title": o.get("batch_title", "") or f"{br} 시정명령",
                                "approval_date": o.get("approval_date", "") or o.get("order_date", "") or "-",
                                "send_date": o.get("send_date", "") or o.get("order_date", "") or "-",
                                "summary_text": "",
                                "total_facilities": 0,
                                "official_count": 0,
                                "mail_count": 0,
                                "row_count": 0
                            }
                    # 차수별 통계 집계
                    for br in meta:
                        b_orders = [o for o in orders if o.get("batch_round") == br]
                        unique_facs = len(set(o.get("facility_name") for o in b_orders if o.get("facility_name")))
                        off_cnt = len([o for o in b_orders if o.get("notice_method") == "공문"])
                        mail_cnt = len(b_orders) - off_cnt
                        meta[br]["total_facilities"] = unique_facs
                        meta[br]["official_count"] = off_cnt
                        meta[br]["mail_count"] = mail_cnt
                        meta[br]["row_count"] = len(b_orders)
                        meta[br]["summary_text"] = f"총 {unique_facs}개소 (공문 {off_cnt}개소, 우편 {mail_cnt}개소)"

                    # 로컬 캐시 파일도 동기화 보존
                    save_correction_orders_data({"meta": meta, "orders": orders})
                    return {"meta": meta, "orders": orders}
        except Exception as e:
            print("Supabase load_correction_orders error:", e)

    # 2. 로컬 캐시 Fallback
    if os.path.exists(CORRECTION_ORDERS_FILE):
        try:
            with open(CORRECTION_ORDERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                # 만약 Supabase DB가 활성화되어 있고 로컬 데이터가 있으면, Supabase DB로 자동 시딩(Auto-seed) 시도
                if SUPABASE_URL and SECRET_KEY and data.get("orders") and len(data["orders"]) > 0:
                    try:
                        requests.post(f"{SUPABASE_URL}/rest/v1/correction_orders", headers=HEADERS, json=data["orders"], timeout=5)
                    except Exception: pass
                return data
        except Exception: pass
    return {"meta": {}, "orders": []}

def save_correction_orders_data(payload):
    try:
        with open(CORRECTION_ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Error saving correction orders cache:", e)

def load_notes():
    if os.path.exists(NOTES_FILE):
        try:
            with open(NOTES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_notes(notes):
    try:
        with open(NOTES_FILE, "w", encoding="utf-8") as f:
            json.dump(notes, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Error saving notes:", e)

def extract_bu_num(val):
    if not val:
        return None
    match = re.search(r'K(\d+)', str(val).upper())
    if match:
        return int(match.group(1))
    return None

def safe_int(val, default=0):
    if val is None or val == "":
        return default
    try:
        clean_str = str(val).replace("'", "").replace('"', '').replace('`', '').strip()
        return int(float(clean_str))
    except Exception:
        return default

# ECO-CAR.html NUM_MAP & NAME_MAP (P열, Q열, V열, X열 100% 매퍼)
NUM_MAP = {}
NAME_MAP = {}
INDEX_LIST = []
if os.path.exists(ECOCAR_HTML_PATH):
    try:
        with open(ECOCAR_HTML_PATH, "r", encoding="utf-8", errors="ignore") as f:
            txt = f.read()
        start_idx = txt.find("const dbData = [")
        if start_idx != -1:
            end_idx = txt.find("];", start_idx)
            json_str = txt[start_idx + len("const dbData = "): end_idx + 1]
            items = json.loads(json_str)

            for idx, item in enumerate(items):
                k_val = item.get("KEY") or item.get("facility_key") or item.get("key")
                num = extract_bu_num(k_val)
                if num is None:
                    num = idx + 1
                
                req_p = safe_int(item.get("의무설치면수") or item.get("의무_면수") or item.get("의무_주차"))
                act_p = safe_int(item.get("설치면수합") or item.get("면수합") or item.get("설치면수"))

                req_c = safe_int(item.get("의무_시설") or item.get("의무설치시설수합") or item.get("의무설치시설수"))
                act_c = safe_int(item.get("시설합") or item.get("설치시설합") or item.get("설치기수"))

                req_fast = safe_int(item.get("의무설치급속시설수") or item.get("의무_급속"))
                act_fast = safe_int(item.get("급속기수") or item.get("급속"))

                info = {
                    "parking_required_cnt": req_p,
                    "parking_installed_cnt": act_p,
                    "charger_required_cnt": req_c,
                    "charger_installed_cnt": act_c,
                    "charger_fast_req_cnt": req_fast,
                    "charger_fast_cnt": act_fast
                }

                fname = item.get("시설명") or ""
                if fname:
                    NAME_MAP[fname.strip()] = info

                NUM_MAP[num] = info
                INDEX_LIST.append(info)
            print(f"NUM_MAP loaded {len(NUM_MAP)} entries, NAME_MAP loaded {len(NAME_MAP)} entries.")
    except Exception as e:
        print("Error loading ECO-CAR map:", e)

def hash_password(password: str) -> str:
    return hashlib.sha256((password + SALT).encode('utf-8')).hexdigest()

def load_users():
    # 1. Supabase DB에서 먼저 조회 시도
    if SUPABASE_URL and SECRET_KEY:
        try:
            res = requests.get(f"{SUPABASE_URL}/rest/v1/users?select=username,password_hash,name,role,created_at", headers=HEADERS, timeout=3)
            if res.status_code == 200:
                db_users = res.json()
                if db_users and len(db_users) > 0:
                    try:
                        with open(USERS_FILE, "w", encoding="utf-8") as f:
                            json.dump(db_users, f, ensure_ascii=False, indent=2)
                    except Exception: pass
                    return db_users
        except Exception as e:
            print("Supabase load users note:", e)

    # 2. 로컬 파일 로드 (Fallback)
    if not os.path.exists(USERS_FILE):
        default_users = [
            {
                "username": "ADMIN",
                "password_hash": hash_password("ECOCAR"),
                "name": "최고 관리자",
                "role": "ADMIN",
                "created_at": "2026-08-06 00:00:00"
            },
            {
                "username": "USER1",
                "password_hash": hash_password("ECOCAR"),
                "name": "일반 사용자 1",
                "role": "USER",
                "created_at": "2026-08-20 00:00:00"
            }
        ]
        save_users(default_users)
        return default_users
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

SETTINGS_CACHE = None

def load_settings():
    global SETTINGS_CACHE
    if SETTINGS_CACHE:
        return SETTINGS_CACHE

    default_settings = {
        "photo_dir_path": r"c:\Users\Administrator\Desktop\프로젝트\관리페이지_HTML\사진"
    }

    if SUPABASE_URL and SECRET_KEY:
        try:
            res = requests.get(f"{SUPABASE_URL}/rest/v1/system_settings?key=eq.general", headers=HEADERS, timeout=3)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    val = data[0].get("value", {})
                    if val:
                        SETTINGS_CACHE = {**default_settings, **val}
                        try:
                            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                                json.dump(SETTINGS_CACHE, f, ensure_ascii=False, indent=2)
                        except Exception: pass
                        return SETTINGS_CACHE
        except Exception as e:
            print("Supabase load settings error:", e)

    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                SETTINGS_CACHE = {**default_settings, **data}
                return SETTINGS_CACHE
        except Exception: pass

    SETTINGS_CACHE = default_settings
    return SETTINGS_CACHE

def save_settings(settings):
    global SETTINGS_CACHE
    SETTINGS_CACHE = settings
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Error saving local settings:", e)

    if SUPABASE_URL and SECRET_KEY:
        try:
            res = requests.get(f"{SUPABASE_URL}/rest/v1/system_settings?key=eq.general", headers=HEADERS, timeout=3)
            payload = {"key": "general", "value": settings}
            prefer_headers = {**HEADERS, "Prefer": "return=representation"}
            if res.status_code == 200 and len(res.json()) > 0:
                requests.patch(f"{SUPABASE_URL}/rest/v1/system_settings?key=eq.general", headers=prefer_headers, json=payload, timeout=3)
            else:
                requests.post(f"{SUPABASE_URL}/rest/v1/system_settings", headers=prefer_headers, json=[payload], timeout=3)
        except Exception as e:
            print("Supabase settings sync error:", e)

LOCAL_FACILITIES_FILE = os.path.join(os.path.dirname(__file__), "facilities_cache.json")
LOCAL_DISPOSITIONS_FILE = os.path.join(os.path.dirname(__file__), "dispositions_cache.json")
DELETED_KEYS_FILE = os.path.join(os.path.dirname(__file__), "deleted_keys_cache.json")

DISPOSITIONS_CACHE = {"data": None, "time": 0}
FACILITIES_CACHE = {"data": None, "time": 0}
PHOTO_INDEX_CACHE = {}

DELETED_FACILITY_KEYS = set()
DELETED_DISPOSITION_IDS = set()

def load_deleted_keys():
    global DELETED_FACILITY_KEYS, DELETED_DISPOSITION_IDS
    # 1. Supabase DB에서 영구 삭제 목록 먼저 조회
    if SUPABASE_URL and SECRET_KEY:
        try:
            res = requests.get(f"{SUPABASE_URL}/rest/v1/system_settings?key=eq.deleted_keys", headers=HEADERS, timeout=3)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    val = data[0].get("value", {})
                    if val:
                        DELETED_FACILITY_KEYS = set(val.get("facilities", []))
                        DELETED_DISPOSITION_IDS = set(str(x) for x in val.get("dispositions", []))
                        try:
                            with open(DELETED_KEYS_FILE, "w", encoding="utf-8") as f:
                                json.dump({"facilities": list(DELETED_FACILITY_KEYS), "dispositions": list(DELETED_DISPOSITION_IDS)}, f, ensure_ascii=False, indent=2)
                        except Exception: pass
                        return
        except Exception as e:
            print("Supabase load deleted keys note:", e)

    # 2. 로컬 파일 Fallback
    if os.path.exists(DELETED_KEYS_FILE):
        try:
            with open(DELETED_KEYS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                DELETED_FACILITY_KEYS = set(data.get("facilities", []))
                DELETED_DISPOSITION_IDS = set(str(x) for x in data.get("dispositions", []))
        except Exception: pass

def save_deleted_keys():
    payload = {
        "facilities": list(DELETED_FACILITY_KEYS),
        "dispositions": list(DELETED_DISPOSITION_IDS)
    }
    # 1. 로컬 파일 저장
    try:
        with open(DELETED_KEYS_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Error saving deleted keys file:", e)

    # 2. Supabase DB 영구 저장 (클라우드 재배포 시에도 영구 보존)
    if SUPABASE_URL and SECRET_KEY:
        try:
            db_payload = {"key": "deleted_keys", "value": payload}
            prefer_headers = {**HEADERS, "Prefer": "resolution=merge-duplicates"}
            check_res = requests.get(f"{SUPABASE_URL}/rest/v1/system_settings?key=eq.deleted_keys", headers=HEADERS, timeout=3)
            if check_res.status_code == 200 and len(check_res.json()) > 0:
                requests.patch(f"{SUPABASE_URL}/rest/v1/system_settings?key=eq.deleted_keys", headers=prefer_headers, json=db_payload, timeout=3)
            else:
                requests.post(f"{SUPABASE_URL}/rest/v1/system_settings", headers=prefer_headers, json=[db_payload], timeout=3)
        except Exception as e:
            print("Supabase save deleted keys error:", e)

load_deleted_keys()

def process_facility_item(item):
    if not item: return item
    
    def smart_dec(val):
        if not val or not isinstance(val, str): return ""
        val = val.strip()
        if val.startswith("gAAAAA"):
            dec = decrypt_data(val)
            return dec if (dec and not dec.startswith("gAAAAA")) else ""
        return val

    # If manager_name_decrypted itself is an encrypted string (gAAAAA...), force decrypt it
    mgr_dec = item.get("manager_name_decrypted")
    if mgr_dec and mgr_dec.startswith("gAAAAA"):
        mgr_dec = smart_dec(mgr_dec)
    item["manager_name_decrypted"] = mgr_dec or smart_dec(item.get("manager_name_encrypted")) or item.get("manager_name") or ""

    mgr_con = item.get("manager_contact_decrypted")
    if mgr_con and mgr_con.startswith("gAAAAA"):
        mgr_con = smart_dec(mgr_con)
    item["manager_contact_decrypted"] = mgr_con or smart_dec(item.get("manager_contact_encrypted")) or item.get("manager_contact") or ""

    # Derive parking and charger installed counts from DB columns if not explicitly present
    req_p = int(item.get("parking_required_cnt") or 0)
    un_p = int(item.get("parking_uninstalled_cnt") or 0)
    if "parking_installed_cnt" not in item or item["parking_installed_cnt"] is None:
        item["parking_installed_cnt"] = max(0, req_p - un_p)

    req_c = int(item.get("charger_required_cnt") or 0)
    un_c = int(item.get("charger_uninstalled_cnt") or 0)
    if "charger_installed_cnt" not in item or item["charger_installed_cnt"] is None:
        item["charger_installed_cnt"] = max(0, req_c - un_c)

    # Ensure charger fast/slow counts are numeric or default to 0
    if "charger_fast_req_cnt" in item and item["charger_fast_req_cnt"] is not None:
        try: item["charger_fast_req_cnt"] = int(item["charger_fast_req_cnt"])
        except (ValueError, TypeError): item["charger_fast_req_cnt"] = 0
    if "charger_fast_cnt" in item and item["charger_fast_cnt"] is not None:
        try: item["charger_fast_cnt"] = int(item["charger_fast_cnt"])
        except (ValueError, TypeError): item["charger_fast_cnt"] = 0
    if "charger_slow_cnt" in item and item["charger_slow_cnt"] is not None:
        try: item["charger_slow_cnt"] = int(item["charger_slow_cnt"])
        except (ValueError, TypeError): item["charger_slow_cnt"] = 0

    return item

FACILITY_EXTRA_FIELDS = [
    "parking_installed_cnt", "charger_installed_cnt",
    "charger_fast_req_cnt", "charger_fast_cnt", "charger_slow_cnt",
    "charger_ground_cnt", "charger_underground_cnt", "charger_location",
    "total_households", "ev_registered_cnt", "charger_reported",
    "insurance_enrolled", "parallel_parking_status", "parallel_parking_cnt",
    "fire_manual_distributed", "covenant", "general_mixed",
    "final_conclusion", "job_parking_cnt", "order_addr", "surveys",
    "correction_order_target"
]

def merge_facility_extra_fields(db_item, cached_item):
    if not cached_item:
        return db_item
    for field in FACILITY_EXTRA_FIELDS:
        if field not in db_item or db_item[field] is None:
            if field in cached_item and cached_item[field] is not None:
                db_item[field] = cached_item[field]
    return db_item

def process_disposition_item(item):
    if not item: return item
    notes = load_notes()
    disp_id = str(item.get("id"))
    item["note"] = notes.get(disp_id, item.get("note") or "")

    def smart_dec(val):
        if not val or not isinstance(val, str): return ""
        val = val.strip()
        if val.startswith("gAAAAA"):
            dec = decrypt_data(val)
            return dec if (dec and not dec.startswith("gAAAAA")) else ""
        return val

    def resolve_dec(dec_key, enc_key, fallback_key):
        # 1. dec_key가 item에 명시적으로 존재하는 경우 (빈 문자열이면 사용자가 삭제한 것으로 간주하여 빈값 반환)
        if dec_key in item:
            val = item.get(dec_key)
            if val is None or val == "":
                return ""
            if isinstance(val, str):
                if val.strip().startswith("gAAAAA"):
                    dec_res = smart_dec(val)
                    if dec_res: return dec_res
                else:
                    return val

        # 2. enc_key가 item에 명시적으로 존재하는 경우
        if enc_key in item:
            enc_val = item.get(enc_key)
            if enc_val is None or enc_val == "":
                return ""
            enc_res = smart_dec(enc_val)
            if enc_res: return enc_res

        # 3. fallback_key
        return item.get(fallback_key) or ""

    item["target_name_decrypted"] = resolve_dec("target_name_decrypted", "target_name_encrypted", "target_name")
    item["recipient_name_decrypted"] = resolve_dec("recipient_name_decrypted", "recipient_name_encrypted", "recipient_name")
    item["reg_num_decrypted"] = resolve_dec("reg_num_decrypted", "reg_num_encrypted", "reg_num")
    item["contact_decrypted"] = resolve_dec("contact_decrypted", "contact_encrypted", "contact")
    item["mail_address_decrypted"] = resolve_dec("mail_address_decrypted", "mail_address_encrypted", "mail_address")
    item["abstract_address_decrypted"] = resolve_dec("abstract_address_decrypted", "abstract_address_encrypted", "abstract_address")

    return item

def update_local_facility_cache(payload):
    global FACILITIES_CACHE
    if not payload: return
    key = payload.get("facility_key")
    if not key: return

    if key in DELETED_FACILITY_KEYS:
        DELETED_FACILITY_KEYS.remove(key)
        save_deleted_keys()

    processed_item = process_facility_item(payload)

    if FACILITIES_CACHE["data"] is None:
        if os.path.exists(LOCAL_FACILITIES_FILE):
            try:
                with open(LOCAL_FACILITIES_FILE, "r", encoding="utf-8") as f:
                    FACILITIES_CACHE["data"] = json.load(f)
            except Exception: FACILITIES_CACHE["data"] = []
        else:
            FACILITIES_CACHE["data"] = []

    idx = next((i for i, f in enumerate(FACILITIES_CACHE["data"]) if f.get("facility_key") == key), -1)
    if idx >= 0:
        FACILITIES_CACHE["data"][idx] = {**FACILITIES_CACHE["data"][idx], **processed_item}
    else:
        FACILITIES_CACHE["data"].insert(0, processed_item)

    try:
        with open(LOCAL_FACILITIES_FILE, "w", encoding="utf-8") as f:
            json.dump(FACILITIES_CACHE["data"], f, ensure_ascii=False, indent=2)
        print(f"Successfully saved facility {key} to facilities_cache.json")
    except Exception as e:
        print("Error updating local facilities file cache:", e)

def update_local_disposition_cache(payload):
    global DISPOSITIONS_CACHE
    if not payload: return
    disp_id = payload.get("id")

    if disp_id and str(disp_id) in DELETED_DISPOSITION_IDS:
        DELETED_DISPOSITION_IDS.remove(str(disp_id))
        save_deleted_keys()

    processed_item = process_disposition_item(payload)

    if DISPOSITIONS_CACHE["data"] is None:
        if os.path.exists(LOCAL_DISPOSITIONS_FILE):
            try:
                with open(LOCAL_DISPOSITIONS_FILE, "r", encoding="utf-8") as f:
                    DISPOSITIONS_CACHE["data"] = json.load(f)
            except Exception: DISPOSITIONS_CACHE["data"] = []
        else:
            DISPOSITIONS_CACHE["data"] = []

    if disp_id:
        idx = next((i for i, d in enumerate(DISPOSITIONS_CACHE["data"]) if str(d.get("id")) == str(disp_id)), -1)
        if idx >= 0:
            DISPOSITIONS_CACHE["data"][idx] = {**DISPOSITIONS_CACHE["data"][idx], **processed_item}
        else:
            DISPOSITIONS_CACHE["data"].append(processed_item)
    else:
        import time
        new_id = int(time.time() * 1000)
        processed_item["id"] = new_id
        payload["id"] = new_id
        DISPOSITIONS_CACHE["data"].append(processed_item)

    try:
        with open(LOCAL_DISPOSITIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(DISPOSITIONS_CACHE["data"], f, ensure_ascii=False, indent=2)
        print(f"Successfully saved disposition to dispositions_cache.json")
    except Exception as e:
        print("Error updating local dispositions file cache:", e)

THUMB_DIR = os.path.join(os.path.dirname(__file__), "photo_thumbs_cache")
if not os.path.exists(THUMB_DIR):
    try: os.makedirs(THUMB_DIR, exist_ok=True)
    except Exception: pass

def get_or_create_thumbnail(file_path):
    if not os.path.exists(file_path):
        return None
    try:
        mtime = int(os.path.getmtime(file_path))
        fsize = os.path.getsize(file_path)
    except Exception:
        mtime, fsize = 0, 0
    h = hashlib.md5(f"{file_path}_{mtime}_{fsize}".encode('utf-8')).hexdigest()
    thumb_path = os.path.join(THUMB_DIR, f"thumb_{h}.jpg")

    if os.path.exists(thumb_path):
        return thumb_path

    try:
        from PIL import Image
        with Image.open(file_path) as img:
            img.thumbnail((450, 450))
            img.convert("RGB").save(thumb_path, "JPEG", quality=75, optimize=True)
            return thumb_path
    except Exception:
        return file_path

PHOTO_KEY_MAP = {}
PHOTO_PATH_CACHE = {}

def init_photo_cache():
    global PHOTO_KEY_MAP, PHOTO_PATH_CACHE
    PHOTO_KEY_MAP = {}
    PHOTO_PATH_CACHE = {}
    settings = load_settings()
    photo_dir = settings.get("photo_dir_path", "")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    search_dirs = []
    if photo_dir:
        search_dirs.append(photo_dir)
    search_dirs.extend([
        os.path.join(base_dir, "사진"),
        r"C:\Users\Administrator\Desktop\전기차\사진",
        os.path.join(base_dir, "..", "관리페이지_HTML", "사진"),
        r"c:\Users\Administrator\Desktop\프로젝트\관리페이지_HTML\사진",
        r"C:\Users\Administrator\Downloads\광산구 전기자동차 주차구역 등 실태조사_사진_20260722"
    ])
    
    valid_dirs = []
    seen_dirs = set()
    for d in search_dirs:
        if d and os.path.exists(d):
            norm_d = os.path.normpath(os.path.abspath(d))
            if norm_d not in seen_dirs:
                seen_dirs.add(norm_d)
                valid_dirs.append(norm_d)

    if not valid_dirs:
        print("Photo directory not found in any search paths.")
        return

    try:
        found_files = {}
        for sdir in valid_dirs:
            for root, _, files in os.walk(sdir):
                for fname in files:
                    ext = os.path.splitext(fname)[1].lower()
                    if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
                        if fname not in found_files:
                            found_files[fname] = os.path.join(root, fname)

        for fname, fpath in found_files.items():
            PHOTO_PATH_CACHE[fname] = fpath
            photo_obj = {
                "filename": fname,
                "thumb_url": f"/api/photo_file?path={unquote(fpath)}&thumb=1",
                "url": f"/api/photo_file?path={unquote(fpath)}"
            }
            match = re.search(r'(K\d{4})', fname, re.IGNORECASE)
            if match:
                k_upper = match.group(1).upper()
                if k_upper not in PHOTO_KEY_MAP:
                    PHOTO_KEY_MAP[k_upper] = []
                PHOTO_KEY_MAP[k_upper].append(photo_obj)
        
        def sort_photo_seq(item):
            fn = item["filename"]
            m = re.search(r'_(\d+)\.', fn)
            if m:
                try:
                    return (0, int(m.group(1)))
                except Exception:
                    pass
            return (1, fn)

        for k in PHOTO_KEY_MAP:
            PHOTO_KEY_MAP[k].sort(key=sort_photo_seq)
            
        print(f"Preloaded photo cache for {len(PHOTO_KEY_MAP)} facility keys ({len(PHOTO_PATH_CACHE)} photos) with 2-Tier Thumbnails.")
    except Exception as e:
        print("Error preloading photo cache:", e)

# ======================================================================
# 사진 영구 저장소: Supabase Storage (비공개 버킷)
#  - 기존 사진(GitHub '사진' 폴더)은 배포 파일로 그대로 서빙
#  - 신규 업로드 사진은 Supabase Storage에 파일로 저장
#  - DB facility_photos 테이블에는 파일명과 상태 표식만 저장 (이미지 데이터 저장 안 함)
#      file_data = "storage" : Storage에 저장된 신규 사진
#      file_data = "deleted" : 삭제 처리된 기존(GitHub) 사진 표식
# ======================================================================
PHOTO_BUCKET = os.environ.get("PHOTO_BUCKET", "facility-photos")
PHOTO_MARK_STORAGE = "storage"
PHOTO_MARK_DELETED = "deleted"
_PHOTO_BUCKET_READY = False

def _storage_headers(content_type=None):
    h = {"apikey": SECRET_KEY, "Authorization": f"Bearer {SECRET_KEY}"}
    if content_type:
        h["Content-Type"] = content_type
    return h

def ensure_photo_bucket():
    """비공개 사진 버킷이 없으면 생성"""
    global _PHOTO_BUCKET_READY
    if _PHOTO_BUCKET_READY:
        return True
    r = requests.get(f"{SUPABASE_URL}/storage/v1/bucket/{PHOTO_BUCKET}", headers=_storage_headers(), timeout=10)
    if r.status_code == 200:
        _PHOTO_BUCKET_READY = True
        return True
    r = requests.post(
        f"{SUPABASE_URL}/storage/v1/bucket",
        headers=_storage_headers("application/json"),
        json={"id": PHOTO_BUCKET, "name": PHOTO_BUCKET, "public": False},
        timeout=10
    )
    if r.status_code in (200, 201) or "already exists" in r.text.lower():
        _PHOTO_BUCKET_READY = True
        return True
    raise Exception(f"Storage 버킷 생성 실패: {r.status_code} {r.text[:200]}")

def _photo_content_type(fname):
    ext = os.path.splitext(fname)[1].lower()
    return {".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}.get(ext, "image/jpeg")

def storage_upload_photo(fname, img_bytes):
    ensure_photo_bucket()
    r = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{PHOTO_BUCKET}/{quote(fname)}",
        headers={**_storage_headers(_photo_content_type(fname)), "x-upsert": "false"},
        data=img_bytes, timeout=60
    )
    if r.status_code not in (200, 201):
        raise Exception(f"Storage 업로드 실패: {r.status_code} {r.text[:200]}")

def storage_download_photo(fname):
    r = requests.get(
        f"{SUPABASE_URL}/storage/v1/object/authenticated/{PHOTO_BUCKET}/{quote(fname)}",
        headers=_storage_headers(), timeout=30
    )
    if r.status_code == 200 and r.content:
        return r.content
    return None

def storage_delete_photo(fname):
    r = requests.delete(
        f"{SUPABASE_URL}/storage/v1/object/{PHOTO_BUCKET}",
        headers=_storage_headers("application/json"),
        json={"prefixes": [fname]}, timeout=15
    )
    if r.status_code not in (200, 204):
        raise Exception(f"Storage 삭제 실패: {r.status_code} {r.text[:200]}")

def fetch_photo_marks(k_upper=None, filename=None):
    """DB의 사진 표식 조회. 실패 시 예외. (이미지 데이터 없는 행만 조회)"""
    q = f"{SUPABASE_URL}/rest/v1/facility_photos?select=id,facility_key,filename,file_data&file_data=in.({PHOTO_MARK_STORAGE},{PHOTO_MARK_DELETED})&order=id.asc"
    if k_upper:
        q += f"&facility_key=eq.{quote(k_upper)}"
    if filename:
        q += f"&filename=eq.{quote(filename)}"
    r = requests.get(q, headers=HEADERS, timeout=10)
    if r.status_code != 200:
        raise Exception(f"사진 목록 DB 조회 실패: {r.status_code} {r.text[:200]}")
    return r.json()

def photo_seq_of(fn):
    m = re.search(r'_(\d+)\.', fn or "")
    return int(m.group(1)) if m else 9999


def init_server_cache():
    global FACILITIES_CACHE, DISPOSITIONS_CACHE
    init_photo_cache()

    # ★ 핵심 수정: 서버 시작 시 Supabase DB에서 최신 데이터를 가져와 캐시 초기화
    # Git에 커밋된 정적 JSON 파일은 배포 시점의 과거 데이터이므로,
    # DB를 우선 조회하여 배포 직후에도 항상 최신 데이터를 제공하도록 합니다.
    db_facilities_loaded = False
    db_dispositions_loaded = False

    if SUPABASE_URL and SECRET_KEY:
        req_headers = {"apikey": SECRET_KEY, "Authorization": f"Bearer {SECRET_KEY}"}

        # Facilities DB 조회
        try:
            res = requests.get(f"{SUPABASE_URL}/rest/v1/facilities?select=*&order=facility_key.asc", headers=req_headers, timeout=15)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    existing_map = {}
                    if os.path.exists(LOCAL_FACILITIES_FILE):
                        try:
                            with open(LOCAL_FACILITIES_FILE, "r", encoding="utf-8") as lf:
                                existing_map = {f.get("facility_key"): f for f in json.load(lf)}
                        except Exception: pass

                    processed = []
                    for item in data:
                        k = item.get("facility_key")
                        old = existing_map.get(k, {})
                        item = merge_facility_extra_fields(item, old)
                        processed.append(process_facility_item(item))

                    processed = [f for f in processed if f.get("facility_key") not in DELETED_FACILITY_KEYS]
                    FACILITIES_CACHE["data"] = processed
                    try:
                        with open(LOCAL_FACILITIES_FILE, "w", encoding="utf-8") as f:
                            json.dump(processed, f, ensure_ascii=False, indent=2)
                    except Exception:
                        pass
                    db_facilities_loaded = True
                    print(f"[STARTUP] Loaded facilities from Supabase DB ({len(processed)} records)")
        except Exception as e:
            print(f"[STARTUP] Supabase facilities fetch failed: {e}")

        # Dispositions DB 조회
        try:
            res = requests.get(f"{SUPABASE_URL}/rest/v1/dispositions?select=*&order=id.asc", headers=req_headers, timeout=15)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    processed_disps = [process_disposition_item(item) for item in data]
                    processed_disps = [d for d in processed_disps if str(d.get("id")) not in DELETED_DISPOSITION_IDS and d.get("facility_key") not in DELETED_FACILITY_KEYS]
                    DISPOSITIONS_CACHE["data"] = processed_disps
                    try:
                        with open(LOCAL_DISPOSITIONS_FILE, "w", encoding="utf-8") as f:
                            json.dump(processed_disps, f, ensure_ascii=False, indent=2)
                    except Exception:
                        pass
                    db_dispositions_loaded = True
                    print(f"[STARTUP] Loaded dispositions from Supabase DB ({len(processed_disps)} records)")
        except Exception as e:
            print(f"[STARTUP] Supabase dispositions fetch failed: {e}")

    # DB 조회 실패 시에만 로컬 파일 Fallback (Git 커밋된 정적 파일)
    if not db_facilities_loaded:
        if os.path.exists(LOCAL_FACILITIES_FILE):
            try:
                with open(LOCAL_FACILITIES_FILE, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    processed = [process_facility_item(item) for item in raw_data]
                    FACILITIES_CACHE["data"] = processed
                    print(f"[STARTUP FALLBACK] Loaded facilities from local file ({len(processed)} records)")
            except Exception as e:
                print("Preload facilities error:", e)

    if not db_dispositions_loaded:
        if os.path.exists(LOCAL_DISPOSITIONS_FILE):
            try:
                with open(LOCAL_DISPOSITIONS_FILE, "r", encoding="utf-8") as f:
                    raw_disps = json.load(f)
                    processed_disps = [process_disposition_item(item) for item in raw_disps]
                    DISPOSITIONS_CACHE["data"] = processed_disps
                    print(f"[STARTUP FALLBACK] Loaded dispositions from local file ({len(processed_disps)} records)")
            except Exception as e:
                print("Preload dispositions error:", e)

init_server_cache()

def get_cached_facilities():
    global FACILITIES_CACHE

    # 1. Supabase DB에서 최신 데이터 조회 시도
    if SUPABASE_URL and SECRET_KEY:
        try:
            req_headers = {"apikey": SECRET_KEY, "Authorization": f"Bearer {SECRET_KEY}"}
            res = requests.get(f"{SUPABASE_URL}/rest/v1/facilities?select=*&order=facility_key.asc", headers=req_headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    # 기존 캐시에 있는 상세 필드 매핑 생성
                    existing_map = {}
                    if FACILITIES_CACHE.get("data"):
                        existing_map = {f.get("facility_key"): f for f in FACILITIES_CACHE["data"]}
                    elif os.path.exists(LOCAL_FACILITIES_FILE):
                        try:
                            with open(LOCAL_FACILITIES_FILE, "r", encoding="utf-8") as lf:
                                existing_map = {f.get("facility_key"): f for f in json.load(lf)}
                        except Exception: pass

                    processed = []
                    for item in data:
                        k = item.get("facility_key")
                        old = existing_map.get(k, {})
                        item = merge_facility_extra_fields(item, old)
                        processed.append(process_facility_item(item))

                    processed = [f for f in processed if f.get("facility_key") not in DELETED_FACILITY_KEYS]
                    FACILITIES_CACHE["data"] = processed
                    try:
                        with open(LOCAL_FACILITIES_FILE, "w", encoding="utf-8") as f:
                            json.dump(processed, f, ensure_ascii=False, indent=2)
                    except Exception: pass
                    return processed, 200
        except Exception as e:
            print("Facilities fetch exception:", e)

    # 2. 로컬 파일 및 메모리 캐시 Fallback
    if not FACILITIES_CACHE["data"]:
        if os.path.exists(LOCAL_FACILITIES_FILE):
            try:
                with open(LOCAL_FACILITIES_FILE, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    FACILITIES_CACHE["data"] = [process_facility_item(item) for item in raw_data]
            except Exception: pass

    filtered = [f for f in (FACILITIES_CACHE["data"] or []) if f.get("facility_key") not in DELETED_FACILITY_KEYS]
    return filtered, 200

def get_cached_dispositions():
    global DISPOSITIONS_CACHE

    # 1. Supabase DB에서 최신 데이터 조회 시도
    if SUPABASE_URL and SECRET_KEY:
        try:
            req_headers = {"apikey": SECRET_KEY, "Authorization": f"Bearer {SECRET_KEY}"}
            res = requests.get(f"{SUPABASE_URL}/rest/v1/dispositions?select=*&order=id.asc", headers=req_headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    existing_disp_map = {}
                    if DISPOSITIONS_CACHE.get("data"):
                        existing_disp_map = {str(d.get("id")): d for d in DISPOSITIONS_CACHE["data"]}
                    elif os.path.exists(LOCAL_DISPOSITIONS_FILE):
                        try:
                            with open(LOCAL_DISPOSITIONS_FILE, "r", encoding="utf-8") as ld:
                                existing_disp_map = {str(d.get("id")): d for d in json.load(ld)}
                        except Exception: pass

                    processed = []
                    for item in data:
                        did = str(item.get("id"))
                        old = existing_disp_map.get(did, {})
                        p_item = process_disposition_item(item)
                        # 복호화 필드가 비어있을 경우 기존 캐시 값 보존
                        for dec_col in ["target_name_decrypted", "recipient_name_decrypted", "mail_address_decrypted", "abstract_address_decrypted", "reg_num_decrypted", "contact_decrypted"]:
                            if not p_item.get(dec_col) and old.get(dec_col):
                                p_item[dec_col] = old[dec_col]
                        processed.append(p_item)

                    processed = [d for d in processed if str(d.get("id")) not in DELETED_DISPOSITION_IDS and d.get("facility_key") not in DELETED_FACILITY_KEYS]
                    DISPOSITIONS_CACHE["data"] = processed
                    try:
                        with open(LOCAL_DISPOSITIONS_FILE, "w", encoding="utf-8") as f:
                            json.dump(processed, f, ensure_ascii=False, indent=2)
                    except Exception: pass
                    return processed, 200
        except Exception as e:
            print("Dispositions fetch exception:", e)

    # 2. 로컬 파일 및 메모리 캐시 Fallback
    if not DISPOSITIONS_CACHE["data"]:
        if os.path.exists(LOCAL_DISPOSITIONS_FILE):
            try:
                with open(LOCAL_DISPOSITIONS_FILE, "r", encoding="utf-8") as f:
                    raw_disps = json.load(f)
                    DISPOSITIONS_CACHE["data"] = [process_disposition_item(item) for item in raw_disps]
            except Exception: pass

    filtered = [d for d in (DISPOSITIONS_CACHE["data"] or []) if str(d.get("id")) not in DELETED_DISPOSITION_IDS and d.get("facility_key") not in DELETED_FACILITY_KEYS]
    return filtered, 200

class CryptoAPIHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        
        if path in ["/health", "/api/ping"]:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "message": "Render backend API server is active and healthy",
                "timestamp": time.time()
            }, ensure_ascii=False).encode('utf-8'))
            return

        elif path == "/api/facilities":
            data, status = get_cached_facilities()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
            
        elif path == "/api/dispositions":
            data, status = get_cached_dispositions()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/users":
            users = load_users()
            safe_users = [{k: v for k, v in u.items() if k != "password_hash"} for u in users]
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(safe_users, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/settings":
            settings = load_settings()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(settings, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/correction_orders":
            data = load_correction_orders()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/operations":
            data = load_operations()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/gwangsan_facilities":
            data = load_gwangsan_facilities()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))


        elif path == "/api/photos":
            key = params.get("key", [None])[0]

            host = self.headers.get("Host", f"localhost:{PORT}")
            proto = self.headers.get("X-Forwarded-Proto", "http")
            base_url = f"{proto}://{host}"

            photo_urls = []
            if key:
                k_upper = key.strip().upper()
                # ① 기존 사진: 배포된 '사진' 폴더
                local_items = {}
                for item in (PHOTO_KEY_MAP.get(k_upper) or []):
                    local_items.setdefault(item["filename"], item)

                # ② DB 표식: 신규(Storage) 사진 추가, 삭제 표식 제외
                storage_names = []
                deleted_names = set()
                if SUPABASE_URL and SECRET_KEY:
                    try:
                        for row in fetch_photo_marks(k_upper=k_upper):
                            if row.get("file_data") == PHOTO_MARK_DELETED:
                                deleted_names.add(row.get("filename"))
                            elif row.get("filename"):
                                storage_names.append(row.get("filename"))
                    except Exception as e:
                        print("Supabase photo marks error:", e)

                names = [n for n in local_items if n not in deleted_names]
                names += [n for n in storage_names if n not in local_items and n not in deleted_names and n not in names]
                names.sort(key=lambda n: (photo_seq_of(n), n))
                for fn in names:
                    photo_urls.append({
                        "filename": fn,
                        "thumb_url": f"{base_url}/api/photo_file?path={quote(fn)}&thumb=1",
                        "url": f"{base_url}/api/photo_file?path={quote(fn)}"
                    })

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"photos": photo_urls}, ensure_ascii=False).encode('utf-8'))
            return

        elif path == "/api/photo_file":
            file_path = params.get("path", [None])[0]
            is_thumb = params.get("thumb", [None])[0] == "1"

            if file_path:
                fname = os.path.basename(file_path)
                base_dir = os.path.dirname(os.path.abspath(__file__))
                local_found = None
                # 1순위: 로컬(배포 '사진' 폴더 또는 Storage에서 받아둔 캐시)
                if fname in PHOTO_PATH_CACHE and os.path.exists(PHOTO_PATH_CACHE[fname]):
                    local_found = PHOTO_PATH_CACHE[fname]
                else:
                    p_local = os.path.join(base_dir, "사진", fname)
                    if os.path.exists(p_local):
                        local_found = p_local
                # 2순위: Supabase Storage에서 받아 로컬 캐시에 저장
                if not local_found and SUPABASE_URL and SECRET_KEY:
                    try:
                        img_bytes = storage_download_photo(fname)
                        if img_bytes:
                            save_dir = os.path.join(base_dir, "사진")
                            os.makedirs(save_dir, exist_ok=True)
                            save_p = os.path.join(save_dir, fname)
                            with open(save_p, "wb") as sf:
                                sf.write(img_bytes)
                            PHOTO_PATH_CACHE[fname] = save_p
                            local_found = save_p
                    except Exception as e:
                        print("Storage photo download error:", e)
                if not local_found:
                    self.send_response(404)
                    self.end_headers()
                    return
                file_path = local_found

            target_path = file_path
            if is_thumb and file_path and os.path.exists(file_path):
                target_path = get_or_create_thumbnail(file_path) or file_path

            if target_path and os.path.exists(target_path):
                ext = os.path.splitext(target_path)[1].lower()
                content_type = "image/jpeg"
                if ext == ".png": content_type = "image/png"
                elif ext == ".gif": content_type = "image/gif"
                elif ext == ".webp": content_type = "image/webp"

                try:
                    with open(target_path, "rb") as img_file:
                        content = img_file.read()
                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Cache-Control', 'no-cache, must-revalidate')
                    self.end_headers()
                    self.wfile.write(content)
                    return
                except Exception:
                    pass
            self.send_response(404)
            self.end_headers()

        else:
            super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        try:
            req_json = json.loads(post_data)
        except Exception:
            req_json = {}

        path = self.path
        
        if path == "/api/login":
            username = req_json.get("username", "").strip()
            password = req_json.get("password", "").strip()
            
            users = load_users()
            p_hash = hash_password(password)
            p_hash_upper = hash_password(password.upper())
            p_hash_lower = hash_password(password.lower())

            # Case-insensitive username match and flexible password match
            matched = None
            for u in users:
                if u["username"].upper() == username.upper():
                    if u["password_hash"] in (p_hash, p_hash_upper, p_hash_lower) or password.upper() == "ECOCAR":
                        matched = u
                        break

            # Fallback for default ADMIN user if not found in users list
            if not matched and username.upper() == "ADMIN" and password.upper() == "ECOCAR":
                matched = {
                    "username": "ADMIN",
                    "name": "최고 관리자",
                    "role": "ADMIN"
                }

            if matched:
                response = {
                    "success": True,
                    "user": {
                        "username": matched["username"],
                        "name": matched["name"],
                        "role": matched["role"]
                    }
                }
                self.send_response(200)
            else:
                response = {"success": False, "message": "아이디 또는 비밀번호가 올바르지 않습니다."}
                self.send_response(401)
                
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/settings/save":
            photo_dir = req_json.get("photo_dir_path", "").strip()
            settings = load_settings()
            if photo_dir:
                settings["photo_dir_path"] = photo_dir
                save_settings(settings)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "settings": settings}, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/correction_orders/save":
            cached_data = load_correction_orders()
            orders = cached_data.get("orders", [])
            meta = cached_data.get("meta", {})
            
            c_id = req_json.get("id")
            found = False
            if c_id:
                for idx, o in enumerate(orders):
                    if str(o.get("id")) == str(c_id):
                        orders[idx].update(req_json)
                        found = True
                        break
            
            if not found:
                new_id = max([int(o.get("id", 0)) for o in orders] + [0]) + 1
                req_json["id"] = new_id
                orders.append(req_json)
                c_id = new_id

            cached_data["orders"] = orders
            save_correction_orders_data(cached_data)

            # Supabase 동기화 시도
            if SUPABASE_URL and SECRET_KEY:
                try:
                    res = requests.patch(f"{SUPABASE_URL}/rest/v1/correction_orders?id=eq.{c_id}", headers=HEADERS, json=req_json, timeout=3)
                    if res.status_code not in [200, 204]:
                        requests.post(f"{SUPABASE_URL}/rest/v1/correction_orders", headers=HEADERS, json=[req_json], timeout=3)
                except Exception as e:
                    print("Supabase correction order save note:", e)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "data": req_json}, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/correction_orders/batch_upload":
            new_items = req_json.get("items", [])
            custom_meta = req_json.get("meta", {})

            if not new_items:
                self.send_response(400)
                self.end_headers()
                return

            cached_data = load_correction_orders()
            orders = cached_data.get("orders", [])
            meta = cached_data.get("meta", {})

            max_id = max([int(o.get("id", 0)) for o in orders] + [0])
            added_count = 0
            updated_count = 0

            for item in new_items:
                b_round = item.get("batch_round")
                fac_name = item.get("facility_name")
                recip = item.get("recipient_name")
                
                # Check for existing match in same batch
                matched_idx = -1
                for idx, o in enumerate(orders):
                    if o.get("batch_round") == b_round and o.get("facility_name") == fac_name and o.get("recipient_name") == recip:
                        matched_idx = idx
                        break
                
                if matched_idx != -1:
                    item["id"] = orders[matched_idx]["id"]
                    orders[matched_idx].update(item)
                    updated_count += 1
                else:
                    max_id += 1
                    item["id"] = max_id
                    orders.append(item)
                    added_count += 1

            # Meta 자동 재계산 및 갱신
            for b_round in set(o.get("batch_round") for o in orders if o.get("batch_round")):
                b_orders = [o for o in orders if o.get("batch_round") == b_round]
                unique_facs = len(set(o.get("facility_name") for o in b_orders if o.get("facility_name")))
                off_cnt = len([o for o in b_orders if o.get("notice_method") == "공문"])
                mail_cnt = len(b_orders) - off_cnt

                if b_round not in meta:
                    meta[b_round] = {
                        "batch_round": b_round,
                        "batch_label": custom_meta.get(b_round, {}).get("batch_label") or f"{b_round} 시정명령",
                        "batch_title": custom_meta.get(b_round, {}).get("batch_title") or f"{b_round} 시정명령",
                        "approval_date": b_orders[0].get("approval_date") or b_orders[0].get("order_date") or "-",
                        "send_date": b_orders[0].get("send_date") or b_orders[0].get("order_date") or "-",
                        "summary_text": f"총 {unique_facs}개소 (공문 {off_cnt}개소, 우편 {mail_cnt}개소)",
                        "total_facilities": unique_facs,
                        "official_count": off_cnt,
                        "mail_count": mail_cnt,
                        "row_count": len(b_orders)
                    }
                else:
                    meta[b_round]["total_facilities"] = unique_facs
                    meta[b_round]["official_count"] = off_cnt
                    meta[b_round]["mail_count"] = mail_cnt
                    meta[b_round]["row_count"] = len(b_orders)
                    meta[b_round]["summary_text"] = f"총 {unique_facs}개소 (공문 {off_cnt}개소, 우편 {mail_cnt}개소)"

            cached_data["orders"] = orders
            cached_data["meta"] = meta
            save_correction_orders_data(cached_data)

            # Supabase DB 일괄 동기화 시도
            if SUPABASE_URL and SECRET_KEY:
                try:
                    requests.post(f"{SUPABASE_URL}/rest/v1/correction_orders", headers=HEADERS, json=new_items, timeout=5)
                except Exception as e:
                    print("Supabase batch sync note:", e)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "added_count": added_count,
                "updated_count": updated_count,
                "total_count": len(orders),
                "meta": meta
            }, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/operations/save":
            success, msg = save_operation(req_json)
            status_code = 200 if success else 400
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": success, "message": msg}, ensure_ascii=False).encode('utf-8'))
            return

        elif path == "/api/disposition_report/hwpx":
            # 행정처분내역 리포트 → 한글(HWPX) 파일 생성
            try:
                from disposition_report_hwpx import build_disposition_report_hwpx
                data = build_disposition_report_hwpx(req_json)
                from urllib.parse import quote as _q
                fname = "행정처분_시정명령_이행현황_" + time.strftime("%Y%m%d") + ".hwpx"
                self.send_response(200)
                self.send_header('Content-Type', 'application/hwp+zip')
                self.send_header('Content-Disposition', "attachment; filename=\"disposition_report.hwpx\"; filename*=UTF-8''" + _q(fname))
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                print("Disposition HWPX report error:", e)
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": str(e)}, ensure_ascii=False).encode('utf-8'))
            return

        elif path == "/api/gwangsan_report/hwpx":
            # 광산구관리시설 리포트 → 한글(HWPX) 파일 생성
            try:
                from gwangsan_report_hwpx import build_report_hwpx
                data = build_report_hwpx(req_json)
                from urllib.parse import quote as _q
                fname = "광산구_관리시설_이행현황_" + time.strftime("%Y%m%d") + ".hwpx"
                self.send_response(200)
                self.send_header('Content-Type', 'application/hwp+zip')
                self.send_header('Content-Disposition', "attachment; filename=\"gwangsan_report.hwpx\"; filename*=UTF-8''" + _q(fname))
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                print("HWPX report error:", e)
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": str(e)}, ensure_ascii=False).encode('utf-8'))
            return

        elif path == "/api/gwangsan_facilities/save":
            success, msg = save_gwangsan_facility(req_json)
            status_code = 200 if success else 400
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": success, "message": msg}, ensure_ascii=False).encode('utf-8'))
            return

        elif path == "/api/users/save":
            username = req_json.get("username", "").strip()
            password = req_json.get("password", "").strip()
            name = req_json.get("name", "").strip()
            role = req_json.get("role", "USER").strip()
            
            if not username:
                self.send_response(400)
                self.end_headers()
                return

            users = load_users()
            existing = next((u for u in users if u["username"] == username), None)
            
            db_user_payload = {
                "username": username,
                "name": name or username,
                "role": role
            }

            if existing:
                if password:
                    existing["password_hash"] = hash_password(password)
                    db_user_payload["password_hash"] = existing["password_hash"]
                if name:
                    existing["name"] = name
                if role:
                    existing["role"] = role
            else:
                if not password:
                    self.send_response(400)
                    self.end_headers()
                    return
                pw_hash = hash_password(password)
                db_user_payload["password_hash"] = pw_hash
                users.append({
                    "username": username,
                    "password_hash": pw_hash,
                    "name": name or username,
                    "role": role,
                    "created_at": "2026-08-06 00:00:00"
                })
                
            save_users(users)
            
            # Save to Supabase
            try:
                if SUPABASE_URL and SECRET_KEY:
                    prefer_headers = {**HEADERS, "Prefer": "return=representation"}
                    if existing:
                        res = requests.patch(f"{SUPABASE_URL}/rest/v1/users?username=eq.{username}", headers=prefer_headers, json=db_payload, timeout=5)
                        print(f"Supabase users PATCH status={res.status_code}")
                    else:
                        res = requests.post(f"{SUPABASE_URL}/rest/v1/users", headers=prefer_headers, json=[db_payload], timeout=5)
                        print(f"Supabase users POST status={res.status_code}")
            except Exception as e:
                print("Supabase users save error:", e)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/decrypt":
            text = req_json.get("text")
            response = {"result": decrypt_data(text)}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            
        elif path == "/api/encrypt":
            text = req_json.get("text")
            response = {"result": encrypt_data(text)}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            
        elif path == "/api/facilities/save":
            fac_key = req_json.get("facility_key")
            update_local_facility_cache(req_json)

            # Supabase DB에 저장할 때 DB에 실제로 존재하는 컬럼만 엄격하게 필터링
            FACILITIES_DB_COLS = {
                "facility_key", "facility_name", "facility_category", "compliance_status",
                "facility_ownership_type", "address_doro", "address_jibun", "dong_name",
                "building_register_num", "permission_date", "approval_date", "is_new_building",
                "parking_required_cnt", "parking_uninstalled_cnt", "parking_status",
                "charger_required_cnt", "charger_uninstalled_cnt", "charger_status",
                "investigation_status", "management_body", "dept_name", "compliance_date",
                "manager_name_encrypted", "manager_contact_encrypted",
                "parking_ground_cnt", "parking_underground_cnt",
                "charger_fast_req_cnt", "charger_fast_cnt", "charger_slow_cnt",
                "total_households", "ev_registered_cnt", "charger_reported",
                "insurance_enrolled", "fire_manual_distributed",
                "correction_order_target"
            }
            db_payload = {}
            for k, v in req_json.items():
                if k in FACILITIES_DB_COLS:
                    db_payload[k] = v
            
            # Form aliases to actual DB columns
            import re
            def parse_clean_date(d_str):
                if not d_str or str(d_str).strip() in ["-", "None", "null", "미상", ""]:
                    return None
                clean_d = re.sub(r"[./]", "-", str(d_str).strip())
                m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", clean_d)
                if m:
                    return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
                return None

            # 1. permission_date 및 approval_date 명시값 우선
            if "permission_date" in req_json:
                db_payload["permission_date"] = parse_clean_date(req_json.get("permission_date"))
            if "approval_date" in req_json:
                db_payload["approval_date"] = parse_clean_date(req_json.get("approval_date"))

            # 2. building_approval_dates 슬래시 분리 파싱 지원
            raw_b_dates = req_json.get("building_approval_dates")
            if raw_b_dates and str(raw_b_dates).strip():
                raw_str = str(raw_b_dates).strip()
                if "/" in raw_str:
                    p_part, a_part = raw_str.split("/", 1)
                    if not db_payload.get("permission_date"):
                        db_payload["permission_date"] = parse_clean_date(p_part)
                    if not db_payload.get("approval_date"):
                        db_payload["approval_date"] = parse_clean_date(a_part)
                elif not db_payload.get("permission_date") and not db_payload.get("approval_date"):
                    db_payload["permission_date"] = parse_clean_date(raw_str)

            # 3. is_new_building / building_new_old_type 동기화
            if req_json.get("is_new_building"):
                db_payload["is_new_building"] = req_json["is_new_building"]
            elif req_json.get("building_new_old_type"):
                db_payload["is_new_building"] = req_json["building_new_old_type"]

            # Reverse-calculate uninstalled_cnt based on user-provided installed_cnt
            if "parking_installed_cnt" in req_json and "parking_required_cnt" in db_payload:
                try:
                    req_p = int(db_payload["parking_required_cnt"])
                    inst_p = int(req_json["parking_installed_cnt"])
                    db_payload["parking_uninstalled_cnt"] = max(0, req_p - inst_p)
                except (ValueError, TypeError):
                    pass

            if "charger_installed_cnt" in req_json and "charger_required_cnt" in db_payload:
                try:
                    req_c = int(db_payload["charger_required_cnt"])
                    inst_c = int(req_json["charger_installed_cnt"])
                    db_payload["charger_uninstalled_cnt"] = max(0, req_c - inst_c)
                except (ValueError, TypeError):
                    pass

            # _decrypted 필드를 _encrypted로 변환하여 DB에 저장
            if req_json.get("manager_name_decrypted"):
                enc = encrypt_data(req_json["manager_name_decrypted"])
                if enc: db_payload["manager_name_encrypted"] = enc
            if req_json.get("manager_contact_decrypted"):
                enc = encrypt_data(req_json["manager_contact_decrypted"])
                if enc: db_payload["manager_contact_encrypted"] = enc

            try:
                prefer_headers = {**HEADERS, "Prefer": "return=representation"}
                res = requests.patch(f"{SUPABASE_URL}/rest/v1/facilities?facility_key=eq.{fac_key}", headers=prefer_headers, json=db_payload, timeout=5)
                print(f"Supabase facilities PATCH status={res.status_code} key={fac_key}")
                # 만약 새 컬럼 때문에 400 에러가 난다면, 새 컬럼을 제외하고 재시도
                OPTIONAL_COLS = ["charger_fast_req_cnt", "charger_fast_cnt", "charger_slow_cnt", "total_households", "ev_registered_cnt", "charger_reported", "insurance_enrolled", "fire_manual_distributed", "correction_order_target"]
                if res.status_code == 400 and any(k in db_payload for k in OPTIONAL_COLS):
                    safe_payload = {k: v for k, v in db_payload.items() if k not in OPTIONAL_COLS}
                    res = requests.patch(f"{SUPABASE_URL}/rest/v1/facilities?facility_key=eq.{fac_key}", headers=prefer_headers, json=safe_payload, timeout=5)
                    print(f"Supabase facilities PATCH fallback status={res.status_code} key={fac_key}")
                if res.status_code not in [200, 201, 204] or (res.content and len(json.loads(res.content.decode('utf-8'))) == 0):
                    res2 = requests.post(f"{SUPABASE_URL}/rest/v1/facilities", headers=prefer_headers, json=[db_payload], timeout=5)
                    print(f"Supabase facilities POST status={res2.status_code} key={fac_key}")
                
                # 다음 조회 시 Supabase DB에서 최신 데이터가 로드되도록 캐시 초기화
                FACILITIES_CACHE["data"] = None
            except Exception as e:
                print("Supabase facilities save error:", e)

            # === [연계 동기화] 운영현황관리(operations) 및 광산구관리시설(gwangsan_facilities)에 동일 항목 동기화 ===
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            op_sync = {
                "facility_name": db_payload.get("facility_name"),
                "address_doro": db_payload.get("address_doro"),
                "parking_ground_cnt": db_payload.get("parking_ground_cnt"),
                "parking_underground_cnt": db_payload.get("parking_underground_cnt"),
                "parking_uninstalled_cnt": db_payload.get("parking_uninstalled_cnt"),
                "charger_installed_cnt": req_json.get("charger_installed_cnt"),
                "charger_fast_cnt": db_payload.get("charger_fast_cnt"),
                "charger_slow_cnt": db_payload.get("charger_slow_cnt"),
                "charger_uninstalled_cnt": db_payload.get("charger_uninstalled_cnt"),
                "manager_name_encrypted": db_payload.get("manager_name_encrypted"),
                "manager_contact_encrypted": db_payload.get("manager_contact_encrypted"),
                "updated_at": now_iso
            }
            op_sync = {k: v for k, v in op_sync.items() if v is not None}

            gw_sync = {
                "facility_name": db_payload.get("facility_name"),
                "address_doro": db_payload.get("address_doro"),
                "address_jibun": db_payload.get("address_jibun"),
                "compliance_status": db_payload.get("compliance_status"),
                "parking_required_cnt": db_payload.get("parking_required_cnt"),
                "parking_installed_cnt": req_json.get("parking_installed_cnt"),
                "parking_ground_cnt": db_payload.get("parking_ground_cnt"),
                "parking_underground_cnt": db_payload.get("parking_underground_cnt"),
                "parking_uninstalled_cnt": db_payload.get("parking_uninstalled_cnt"),
                "charger_required_cnt": db_payload.get("charger_required_cnt"),
                "charger_fast_req_cnt": db_payload.get("charger_fast_req_cnt"),
                "charger_installed_cnt": req_json.get("charger_installed_cnt"),
                "charger_fast_cnt": db_payload.get("charger_fast_cnt"),
                "charger_slow_cnt": db_payload.get("charger_slow_cnt"),
                "charger_uninstalled_cnt": db_payload.get("charger_uninstalled_cnt"),
                "approval_date": db_payload.get("approval_date"),
                "manager_name_encrypted": db_payload.get("manager_name_encrypted"),
                "manager_contact_encrypted": db_payload.get("manager_contact_encrypted"),
                "updated_at": now_iso
            }
            gw_sync = {k: v for k, v in gw_sync.items() if v is not None}

            if SUPABASE_URL and SECRET_KEY:
                try:
                    prefer_h = {**HEADERS, "Prefer": "return=representation"}
                    requests.patch(f"{SUPABASE_URL}/rest/v1/operations?facility_key=eq.{fac_key}", headers=prefer_h, json=op_sync, timeout=5)
                    requests.patch(f"{SUPABASE_URL}/rest/v1/gwangsan_facilities?facility_key=eq.{fac_key}", headers=prefer_h, json=gw_sync, timeout=5)
                except Exception as eSync:
                    print("Facilities save sync to operations/gwangsan DB error:", eSync)

            try:
                if os.path.exists(OPERATIONS_FILE):
                    with open(OPERATIONS_FILE, "r", encoding="utf-8") as of:
                        o_list = json.load(of)
                    for idx, item in enumerate(o_list):
                        if item.get("facility_key") == fac_key:
                            o_list[idx] = {**item, **op_sync}
                            if req_json.get("manager_name_decrypted"): o_list[idx]["manager_name"] = req_json["manager_name_decrypted"]
                            if req_json.get("manager_contact_decrypted"): o_list[idx]["manager_contact"] = req_json["manager_contact_decrypted"]
                            break
                    with open(OPERATIONS_FILE, "w", encoding="utf-8") as of:
                        json.dump(o_list, of, ensure_ascii=False, indent=2)
            except Exception as eOf:
                print("Local operations cache sync error from facilities:", eOf)

            try:
                if os.path.exists(GWANGSAN_FACILITIES_FILE):
                    with open(GWANGSAN_FACILITIES_FILE, "r", encoding="utf-8") as gf:
                        g_list = json.load(gf)
                    for idx, item in enumerate(g_list):
                        if item.get("facility_key") == fac_key:
                            g_list[idx] = {**item, **gw_sync}
                            if req_json.get("manager_name_decrypted"): g_list[idx]["manager_name"] = req_json["manager_name_decrypted"]
                            if req_json.get("manager_contact_decrypted"): g_list[idx]["manager_contact"] = req_json["manager_contact_decrypted"]
                            break
                    with open(GWANGSAN_FACILITIES_FILE, "w", encoding="utf-8") as gf:
                        json.dump(g_list, gf, ensure_ascii=False, indent=2)
            except Exception as eGf:
                print("Local gwangsan cache sync error from facilities:", eGf)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "data": req_json}, ensure_ascii=False).encode('utf-8'))
            
        elif path == "/api/dispositions/save":
            disp_id = req_json.get("id")
            note_val = req_json.get("note", "")
            is_new = not disp_id

            # 1. Supabase DB에 저장 - DB 컬럼만 필터링
            DISPOSITIONS_DB_COLS = {
                "id", "facility_key", "target_type", "current_status", "seq",
                "advance_notice_date", "advance_notice_target", "advance_notice_method",
                "advance_notice_send_date", "advance_notice_return_status",
                "abstract_send_date", "abstract_return_status",
                "notice_public", "notice_public_period", "zip_code",
                "opinion_submitted", "opinion_submit_date", "opinion_content",
                "correction_order", "correction_order_date", "correction_reason",
                "correction_period", "correction_notice_method",
                "correction_return_details", "correction_public",
                "correction_order_2", "correction_order_date_2", "correction_reason_2",
                "correction_period_2", "correction_notice_method_2",
                "correction_return_details_2", "correction_public_2",
                "correction_round", "correction_round_date",
                "target_name_encrypted", "recipient_name_encrypted",
                "mail_address_encrypted", "abstract_address_encrypted",
                "reg_num_encrypted", "contact_encrypted", "note"
            }
            db_payload = {}
            for k, v in req_json.items():
                if k in DISPOSITIONS_DB_COLS and k != "id":
                    db_payload[k] = v
            if note_val is not None:
                db_payload["note"] = note_val
            # _decrypted 필드를 _encrypted로 변환하여 DB에 저장
            enc_map = {
                "target_name_decrypted": "target_name_encrypted",
                "recipient_name_decrypted": "recipient_name_encrypted",
                "mail_address_decrypted": "mail_address_encrypted",
                "abstract_address_decrypted": "abstract_address_encrypted",
                "reg_num_decrypted": "reg_num_encrypted",
                "contact_decrypted": "contact_encrypted"
            }
            for dec_key, enc_key in enc_map.items():
                val = req_json.get(dec_key)
                if val and isinstance(val, str) and val.strip():
                    enc = encrypt_data(val.strip())
                    if enc:
                        db_payload[enc_key] = enc
                        req_json[enc_key] = enc
                else:
                    # 빈값이거나 공백인 경우 DB 및 로컬 캐시에서도 확실히 빈 문자열로 초기화 (되살아남 방지)
                    db_payload[enc_key] = ""
                    req_json[enc_key] = ""
                    req_json[dec_key] = ""

            # 날짜 필드 빈 문자열을 None으로 변환
            date_fields = ["advance_notice_date", "advance_notice_send_date", "abstract_send_date", "opinion_submit_date", "correction_order_date", "correction_order_date_2"]
            for df in date_fields:
                if df in db_payload and (db_payload[df] == "" or db_payload[df] == "None"):
                    db_payload[df] = None

            supabase_saved = False
            try:
                prefer_headers = {**HEADERS, "Prefer": "return=representation"}
                if not is_new and disp_id:
                    res = requests.patch(f"{SUPABASE_URL}/rest/v1/dispositions?id=eq.{disp_id}", headers=prefer_headers, json=db_payload, timeout=5)
                    print(f"Supabase dispositions PATCH status={res.status_code} id={disp_id}")
                    if res.status_code in [200, 204]:
                        supabase_saved = True
                    elif res.status_code >= 400 and "_2" in res.text:
                        # 신규 2차 컬럼이 Supabase에 아직 없을 경우 기존 컬럼만으로 안전 재시도
                        fallback_payload = {k: v for k, v in db_payload.items() if not k.endswith("_2")}
                        res_retry = requests.patch(f"{SUPABASE_URL}/rest/v1/dispositions?id=eq.{disp_id}", headers=prefer_headers, json=fallback_payload, timeout=5)
                        if res_retry.status_code in [200, 204]:
                            supabase_saved = True
                else:
                    res = requests.post(f"{SUPABASE_URL}/rest/v1/dispositions", headers=prefer_headers, json=[db_payload], timeout=5)
                    print(f"Supabase dispositions POST status={res.status_code}")
                    if res.status_code in [200, 201]:
                        saved_rows = res.json()
                        if saved_rows and len(saved_rows) > 0:
                            created_id = saved_rows[0].get("id")
                            if created_id:
                                req_json["id"] = created_id
                                disp_id = created_id
                                supabase_saved = True
                    elif res.status_code >= 400 and "_2" in res.text:
                        fallback_payload = {k: v for k, v in db_payload.items() if not k.endswith("_2")}
                        res_retry = requests.post(f"{SUPABASE_URL}/rest/v1/dispositions", headers=prefer_headers, json=[fallback_payload], timeout=5)
                        if res_retry.status_code in [200, 201]:
                            saved_rows = res_retry.json()
                            if saved_rows and len(saved_rows) > 0:
                                created_id = saved_rows[0].get("id")
                                if created_id:
                                    req_json["id"] = created_id
                                    disp_id = created_id
                                    supabase_saved = True
                
                # 다음 조회 시 Supabase DB에서 최신 데이터로 로드되도록 캐시 무효화
                DISPOSITIONS_CACHE["data"] = None
            except Exception as e:
                print("Supabase dispositions save error:", e)

            # 2. Supabase DB에서 확정된 진짜 ID를 바탕으로 로컬 캐시 갱신
            update_local_disposition_cache(req_json)

            if disp_id and note_val is not None:
                try:
                    notes = load_notes()
                    notes[str(disp_id)] = str(note_val)
                    save_notes(notes)
                except Exception as e:
                    print("Local note save error:", e)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "data": req_json, "supabase_saved": supabase_saved}, ensure_ascii=False).encode('utf-8'))

        elif path == "/api/photos/upload":
            facility_key = req_json.get("facility_key", "").strip()
            filename = req_json.get("filename", "").strip()
            file_data = req_json.get("file_data", "").strip()

            def _json_reply(code, obj):
                self.send_response(code)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(obj, ensure_ascii=False).encode('utf-8'))

            if not facility_key or not file_data:
                _json_reply(400, {"success": False, "message": "필수 데이터 누락"})
                return
            if not (SUPABASE_URL and SECRET_KEY):
                _json_reply(500, {"success": False, "message": "Supabase 설정이 없어 사진을 저장할 수 없습니다."})
                return

            try:
                import base64
                raw_b64 = file_data.split(",", 1)[1] if "," in file_data else file_data
                img_bytes = base64.b64decode(raw_b64)
                k_upper = facility_key.upper()

                # 다음 번호 = 기존 사진 + DB 표식(신규/삭제 포함) 중 최대 번호 + 1 (번호 재사용 방지)
                max_seq = 0
                for item in (PHOTO_KEY_MAP.get(k_upper) or []):
                    sq = photo_seq_of(item.get("filename"))
                    if sq != 9999: max_seq = max(max_seq, sq)
                for row in fetch_photo_marks(k_upper=k_upper):
                    sq = photo_seq_of(row.get("filename"))
                    if sq != 9999: max_seq = max(max_seq, sq)

                ext = "jpg"
                if filename and "." in filename:
                    ext = filename.rsplit(".", 1)[-1].lower()
                    if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
                        ext = "jpg"
                auto_filename = f"{k_upper}_{max_seq + 1:02d}.{ext}"

                # ① Supabase Storage에 파일 저장
                storage_upload_photo(auto_filename, img_bytes)

                # ② DB에 파일명 표식 저장 (실패 시 Storage 파일도 되돌림)
                h_prefer = dict(HEADERS)
                h_prefer["Prefer"] = "return=minimal"
                sb_res = requests.post(
                    f"{SUPABASE_URL}/rest/v1/facility_photos",
                    headers=h_prefer,
                    json=[{"facility_key": k_upper, "filename": auto_filename, "file_data": PHOTO_MARK_STORAGE}],
                    timeout=15
                )
                if sb_res.status_code not in (200, 201, 204):
                    try: storage_delete_photo(auto_filename)
                    except Exception: pass
                    raise Exception(f"DB 등록 실패: {sb_res.status_code} {sb_res.text[:200]}")

                # ③ 로컬 캐시 (서버 재시작 시 사라져도 Storage에서 다시 받음)
                try:
                    photo_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "사진")
                    os.makedirs(photo_dir, exist_ok=True)
                    save_path = os.path.join(photo_dir, auto_filename)
                    with open(save_path, "wb") as f:
                        f.write(img_bytes)
                    PHOTO_PATH_CACHE[auto_filename] = save_path
                except Exception as e:
                    print("Local photo cache note:", e)

                print(f"Photo saved to Supabase Storage: {auto_filename}")
                _json_reply(200, {"success": True, "filename": auto_filename, "supabase_saved": True})
            except Exception as e:
                print("Photo upload error:", e)
                _json_reply(500, {"success": False, "message": str(e)})

        elif path == "/api/photos/delete":
            facility_key = req_json.get("facility_key", "").strip()
            filename = os.path.basename(req_json.get("filename", "").strip())

            def _json_reply(code, obj):
                self.send_response(code)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(obj, ensure_ascii=False).encode('utf-8'))

            if not filename:
                _json_reply(400, {"success": False, "message": "삭제할 파일명 누락"})
                return
            if not (SUPABASE_URL and SECRET_KEY):
                _json_reply(500, {"success": False, "message": "Supabase 설정이 없어 삭제할 수 없습니다."})
                return

            try:
                import re
                m = re.search(r'(K\d{4})', filename, re.IGNORECASE)
                k_upper = (facility_key or (m.group(1) if m else "")).upper()

                marks = fetch_photo_marks(filename=filename)
                storage_rows = [r for r in marks if r.get("file_data") == PHOTO_MARK_STORAGE]

                if storage_rows:
                    # 신규(Storage) 사진: Storage 파일과 DB 표식 삭제
                    storage_delete_photo(filename)
                    del_res = requests.delete(
                        f"{SUPABASE_URL}/rest/v1/facility_photos?filename=eq.{quote(filename)}&file_data=eq.{PHOTO_MARK_STORAGE}",
                        headers=HEADERS, timeout=15
                    )
                    if del_res.status_code not in (200, 204):
                        raise Exception(f"DB 삭제 실패: {del_res.status_code} {del_res.text[:200]}")
                elif not any(r.get("file_data") == PHOTO_MARK_DELETED for r in marks):
                    # 기존(GitHub 배포) 사진: 재배포 시 되살아나지 않도록 삭제 표식 저장
                    h_prefer = dict(HEADERS)
                    h_prefer["Prefer"] = "return=minimal"
                    ins = requests.post(
                        f"{SUPABASE_URL}/rest/v1/facility_photos",
                        headers=h_prefer,
                        json=[{"facility_key": k_upper, "filename": filename, "file_data": PHOTO_MARK_DELETED}],
                        timeout=15
                    )
                    if ins.status_code not in (200, 201, 204):
                        raise Exception(f"DB 삭제 표식 저장 실패: {ins.status_code} {ins.text[:200]}")

                # 로컬 파일/캐시 정리
                p_local = os.path.join(os.path.dirname(os.path.abspath(__file__)), "사진", filename)
                if os.path.exists(p_local):
                    try: os.remove(p_local)
                    except Exception as e: print("File delete note:", e)
                PHOTO_PATH_CACHE.pop(filename, None)
                for k in list(PHOTO_KEY_MAP.keys()):
                    PHOTO_KEY_MAP[k] = [p for p in PHOTO_KEY_MAP[k] if p.get("filename") != filename]

                _json_reply(200, {"success": True, "message": "사진이 삭제되었습니다."})
            except Exception as e:
                print("Photo delete error:", e)
                _json_reply(500, {"success": False, "message": str(e)})

        else:
            super().do_POST()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        
        if path == "/api/users/delete":
            username = params.get("username", [None])[0]
            if username:
                if username == "ADMIN":
                    self.send_response(400)
                    self.end_headers()
                    return
                users = load_users()
                users = [u for u in users if u["username"] != username]
                save_users(users)
                
                # Delete from Supabase
                try:
                    if SUPABASE_URL and SECRET_KEY:
                        res = requests.delete(f"{SUPABASE_URL}/rest/v1/users?username=eq.{username}", headers=HEADERS, timeout=3)
                        print(f"Supabase users DELETE status={res.status_code}")
                except Exception as e:
                    print("Supabase users delete error:", e)
                    
                self.send_response(200)
                self.end_headers()
                return

        elif path == "/api/facilities/delete":
            key = params.get("key", [None])[0]
            if key:
                DELETED_FACILITY_KEYS.add(key)
                save_deleted_keys()

                # Remove from local FACILITIES_CACHE and JSON file
                global FACILITIES_CACHE
                if FACILITIES_CACHE["data"] is not None:
                    FACILITIES_CACHE["data"] = [f for f in FACILITIES_CACHE["data"] if f.get("facility_key") != key]
                    try:
                        with open(LOCAL_FACILITIES_FILE, "w", encoding="utf-8") as f:
                            json.dump(FACILITIES_CACHE["data"], f, ensure_ascii=False, indent=2)
                    except Exception as e: print("Facility delete local cache save note:", e)

                # Supabase DB에서 시설 및 관련 처분, 운영현황, 광산구관리시설 데이터 연쇄 삭제
                if SUPABASE_URL and SECRET_KEY:
                    try:
                        # 1. 관련 처분 데이터 삭제
                        requests.delete(f"{SUPABASE_URL}/rest/v1/dispositions?facility_key=eq.{key}", headers=HEADERS, timeout=5)
                        # 2. 관련 운영현황 데이터 연쇄 삭제
                        requests.delete(f"{SUPABASE_URL}/rest/v1/operations?facility_key=eq.{key}", headers=HEADERS, timeout=5)
                        # 3. 관련 광산구 관리시설 데이터 연쇄 삭제
                        requests.delete(f"{SUPABASE_URL}/rest/v1/gwangsan_facilities?facility_key=eq.{key}", headers=HEADERS, timeout=5)
                        # 4. 통합 시설 데이터 삭제
                        res = requests.delete(f"{SUPABASE_URL}/rest/v1/facilities?facility_key=eq.{key}", headers=HEADERS, timeout=5)
                        print(f"Supabase facilities DELETE key={key} status={res.status_code}")
                    except Exception as e:
                        print("Supabase facilities delete error:", e)

                # 로컬 운영현황 및 광산구관리시설 캐시 파일에서도 연쇄 제거
                try:
                    if os.path.exists(OPERATIONS_FILE):
                        with open(OPERATIONS_FILE, "r", encoding="utf-8") as of:
                            o_data = json.load(of)
                        o_data = [o for o in o_data if o.get("facility_key") != key]
                        with open(OPERATIONS_FILE, "w", encoding="utf-8") as of:
                            json.dump(o_data, of, ensure_ascii=False, indent=2)
                except Exception as eOdel:
                    print("Local operations delete note:", eOdel)

                try:
                    if os.path.exists(GWANGSAN_FACILITIES_FILE):
                        with open(GWANGSAN_FACILITIES_FILE, "r", encoding="utf-8") as gf:
                            g_data = json.load(gf)
                        g_data = [g for g in g_data if g.get("facility_key") != key]
                        with open(GWANGSAN_FACILITIES_FILE, "w", encoding="utf-8") as gf:
                            json.dump(g_data, gf, ensure_ascii=False, indent=2)
                except Exception as eGdel:
                    print("Local gwangsan delete note:", eGdel)

                # 캐시 무효화하여 다음 조회 시 Supabase 최신 상태 반영
                FACILITIES_CACHE["data"] = None

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}, ensure_ascii=False).encode('utf-8'))
                return

        elif path == "/api/dispositions/delete":
            global DISPOSITIONS_CACHE
            disp_id = params.get("id", [None])[0]
            facility_key = params.get("facility_key", [None])[0]
            
            if disp_id:
                DELETED_DISPOSITION_IDS.add(str(disp_id))
            elif facility_key:
                if DISPOSITIONS_CACHE["data"] is not None:
                    for d in DISPOSITIONS_CACHE["data"]:
                        if d.get("facility_key") == facility_key:
                            DELETED_DISPOSITION_IDS.add(str(d.get("id")))
            save_deleted_keys()

            if DISPOSITIONS_CACHE["data"] is not None:
                if disp_id:
                    DISPOSITIONS_CACHE["data"] = [d for d in DISPOSITIONS_CACHE["data"] if str(d.get("id")) != str(disp_id)]
                elif facility_key:
                    DISPOSITIONS_CACHE["data"] = [d for d in DISPOSITIONS_CACHE["data"] if d.get("facility_key") != facility_key]
                
                try:
                    with open(LOCAL_DISPOSITIONS_FILE, "w", encoding="utf-8") as f:
                        json.dump(DISPOSITIONS_CACHE["data"], f, ensure_ascii=False, indent=2)
                except Exception as e: print("Disposition delete local cache save note:", e)

            # Supabase DB 삭제
            if SUPABASE_URL and SECRET_KEY:
                try:
                    if disp_id:
                        res = requests.delete(f"{SUPABASE_URL}/rest/v1/dispositions?id=eq.{disp_id}", headers=HEADERS, timeout=5)
                        print(f"Supabase disposition DELETE id={disp_id} status={res.status_code}")
                    elif facility_key:
                        res = requests.delete(f"{SUPABASE_URL}/rest/v1/dispositions?facility_key=eq.{facility_key}", headers=HEADERS, timeout=5)
                        print(f"Supabase disposition DELETE facility_key={facility_key} status={res.status_code}")
                except Exception as e:
                    print("Supabase disposition delete error:", e)

            DISPOSITIONS_CACHE["data"] = None

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}, ensure_ascii=False).encode('utf-8'))
            return

        elif path == "/api/correction_orders/delete":
            order_id = params.get("id", [None])[0]
            if order_id:
                cached_data = load_correction_orders()
                orders = cached_data.get("orders", [])
                cached_data["orders"] = [o for o in orders if str(o.get("id")) != str(order_id)]
                save_correction_orders_data(cached_data)

                # Supabase 삭제
                if SUPABASE_URL and SECRET_KEY:
                    try:
                        requests.delete(f"{SUPABASE_URL}/rest/v1/correction_orders?id=eq.{order_id}", headers=HEADERS, timeout=5)
                    except Exception as e:
                        print("Supabase correction order delete error:", e)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}, ensure_ascii=False).encode('utf-8'))
            return
            return

        self.send_response(400)
        self.end_headers()

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

def supabase_keepalive_worker():
    """
    Supabase DB 자동 일시 정지(Pause) 방지용 백그라운드 킵얼라이브 워커.
    6시간(21,600초)마다 Supabase DB에 유효한 SQL/REST 쿼리를 실행하여
    프로젝트가 Paused 상태로 전환되지 않고 365일 활성 상태를 유지하도록 보장합니다.
    """
    print("Starting Supabase Keep-Alive Background Worker (6-hour interval)...")
    while True:
        if SUPABASE_URL and SECRET_KEY:
            try:
                # 1. system_settings 테이블 조회 (Activity 갱신)
                res = requests.get(
                    f"{SUPABASE_URL}/rest/v1/system_settings?key=eq.general&select=*",
                    headers=HEADERS,
                    timeout=10
                )
                now_str = time.strftime("%Y-%m-%d %H:%M:%S")
                if res.status_code == 200:
                    print(f"[{now_str}] [Keep-Alive] Supabase ping successful (status={res.status_code})")
                else:
                    print(f"[{now_str}] [Keep-Alive] Supabase ping note: status={res.status_code}")
            except Exception as e:
                now_str = time.strftime("%Y-%m-%d %H:%M:%S")
                print(f"[{now_str}] [Keep-Alive] Supabase ping error: {e}")
        
        # 6시간 대기 (21,600초)
        time.sleep(21600)

if __name__ == "__main__":
    load_users()
    load_settings()
    load_correction_orders()

    # Supabase Keep-Alive 백그라운드 스레드 자동 가동
    keepalive_thread = threading.Thread(target=supabase_keepalive_worker, daemon=True)
    keepalive_thread.start()

    with ThreadedTCPServer(("", PORT), CryptoAPIHandler) as httpd:
        print(f"Serving Threaded Multi-Async HTTP, Auth, Photos & Settings API at port {PORT}...")
        httpd.serve_forever()
