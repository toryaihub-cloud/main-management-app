# -*- coding: utf-8 -*-
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app_js_path = os.path.join(BASE_DIR, 'app.js')

with open(app_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. updateModalDetailCounts 에 충전 지상/지하 및 설치장소 바인딩 추가
target_counts = """  const fastUnElem = document.getElementById("detail-fast-uninstalled");
  if (fastUnElem) {
    fastUnElem.innerText = `${uninstalledFast}기`;
    fastUnElem.style.color = uninstalledFast > 0 ? 'var(--danger)' : 'var(--text-main)';
  }

  renderModalDetailDonutChart(facility);"""

replacement_counts = """  const fastUnElem = document.getElementById("detail-fast-uninstalled");
  if (fastUnElem) {
    fastUnElem.innerText = `${uninstalledFast}기`;
    fastUnElem.style.color = uninstalledFast > 0 ? 'var(--danger)' : 'var(--text-main)';
  }

  const chargerGroundUnderElem = document.getElementById("detail-charger-ground-underground");
  if (chargerGroundUnderElem) {
    const cGround = facility.charger_ground_cnt !== undefined && facility.charger_ground_cnt !== null ? facility.charger_ground_cnt : 0;
    const cUnderground = facility.charger_underground_cnt !== undefined && facility.charger_underground_cnt !== null ? facility.charger_underground_cnt : 0;
    chargerGroundUnderElem.innerText = `${cGround}기 / ${cUnderground}기`;
  }

  const chargerLocElem = document.getElementById("detail-charger-location");
  if (chargerLocElem) {
    const loc = facility.charger_location || (facility.extra_info && facility.extra_info.charger_location) || '-';
    chargerLocElem.innerText = loc;
  }

  renderModalDetailDonutChart(facility);"""

# 2. openFacilityModal 에 충전 지상/지하 및 설치장소 바인딩 추가
target_open_edit = """      document.getElementById("fac-fast-cnt").value = item.charger_fast_cnt || 0;
      document.getElementById("fac-management-body").value = item.management_body || "";"""

replacement_open_edit = """      document.getElementById("fac-fast-cnt").value = item.charger_fast_cnt || 0;
      document.getElementById("fac-charger-ground").value = item.charger_ground_cnt || 0;
      document.getElementById("fac-charger-underground").value = item.charger_underground_cnt || 0;
      document.getElementById("fac-charger-location").value = item.charger_location || (item.extra_info && item.extra_info.charger_location) || "";
      document.getElementById("fac-management-body").value = item.management_body || "";"""

target_open_new = """    document.getElementById("fac-fire-manual-distributed").value = "";
  }
  document.getElementById("modal-facility").classList.add("active");"""

replacement_open_new = """    document.getElementById("fac-fire-manual-distributed").value = "";
    document.getElementById("fac-charger-ground").value = 0;
    document.getElementById("fac-charger-underground").value = 0;
    document.getElementById("fac-charger-location").value = "";
  }
  document.getElementById("modal-facility").classList.add("active");"""

# 3. saveFacility 에 payload 및 directPayload 항목 추가
target_save_payload = """    charger_fast_req_cnt: parseInt(document.getElementById("fac-fast-req").value) || 0,
    charger_slow_cnt: parseInt(document.getElementById("fac-slow-cnt").value) || 0,
    charger_fast_cnt: parseInt(document.getElementById("fac-fast-cnt").value) || 0,
    management_body: document.getElementById("fac-management-body").value.trim(),"""

replacement_save_payload = """    charger_fast_req_cnt: parseInt(document.getElementById("fac-fast-req").value) || 0,
    charger_slow_cnt: parseInt(document.getElementById("fac-slow-cnt").value) || 0,
    charger_fast_cnt: parseInt(document.getElementById("fac-fast-cnt").value) || 0,
    charger_ground_cnt: parseInt(document.getElementById("fac-charger-ground").value) || 0,
    charger_underground_cnt: parseInt(document.getElementById("fac-charger-underground").value) || 0,
    charger_location: (document.getElementById("fac-charger-location").value || "").trim(),
    management_body: document.getElementById("fac-management-body").value.trim(),"""

target_save_direct = """      charger_fast_req_cnt: payload.charger_fast_req_cnt,
      charger_slow_cnt: payload.charger_slow_cnt,
      charger_fast_cnt: payload.charger_fast_cnt,
      management_body: payload.management_body,"""

replacement_save_direct = """      charger_fast_req_cnt: payload.charger_fast_req_cnt,
      charger_slow_cnt: payload.charger_slow_cnt,
      charger_fast_cnt: payload.charger_fast_cnt,
      extra_info: {
        charger_ground_cnt: payload.charger_ground_cnt,
        charger_underground_cnt: payload.charger_underground_cnt,
        charger_location: payload.charger_location
      },
      management_body: payload.management_body,"""

# 줄바꿈 정규화 적용 치환 함수
def replace_chunk(src, target, repl):
    target_norm = target.replace("\r\n", "\n")
    src_norm = src.replace("\r\n", "\n")
    if target_norm not in src_norm:
        print("치환 대상 누락:", target[:40])
        return src
    if target in src:
        return src.replace(target, repl, 1)
    target_crlf = target_norm.replace("\n", "\r\n")
    repl_crlf = repl.replace("\r\n", "\n").replace("\n", "\r\n")
    return src.replace(target_crlf, repl_crlf, 1)

content = replace_chunk(content, target_counts, replacement_counts)
content = replace_chunk(content, target_open_edit, replacement_open_edit)
content = replace_chunk(content, target_open_new, replacement_open_new)
content = replace_chunk(content, target_save_payload, replacement_save_payload)
content = replace_chunk(content, target_save_direct, replacement_save_direct)

with open(app_js_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("app.js 업데이트 완료!")
