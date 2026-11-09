import os
import sys

def patch_app_js():
    with open('app.js', 'r', encoding='utf-8') as f:
        text = f.read()

    is_crlf = '\r\n' in text
    text_lf = text.replace('\r\n', '\n')

    # 1. loadData cache version check
    target1 = """// 2. Data Loading & Settings
async function loadData() {
  // 1. Instant Render from Local Cache if available for 0.0001s response"""
    
    replace1 = """// 2. Data Loading & Settings
const APP_DATA_VERSION = "20261109_v3";
async function loadData() {
  try {
    const curVer = localStorage.getItem("app_cache_version");
    if (curVer !== APP_DATA_VERSION) {
      localStorage.removeItem("cached_facilities");
      localStorage.removeItem("cached_operations");
      localStorage.removeItem("cached_gwangsan_facilities");
      localStorage.setItem("app_cache_version", APP_DATA_VERSION);
    }
  } catch(e) {}

  // 1. Instant Render from Local Cache if available for 0.0001s response"""

    # 2. fetchFacilities building_approval_dates & building_new_old_type
    target2 = """            ...f,
            building_approval_dates: f.approval_date || f.building_approval_dates || "",
            building_new_old_type: f.is_new_building || f.building_new_old_type || "신축","""

    replace2 = """            ...f,
            building_approval_dates: (f.permission_date || f.approval_date)
              ? `${f.permission_date || '-'} / ${f.approval_date || '-'}`
              : (f.building_approval_dates || ""),
            building_new_old_type: f.is_new_building || f.building_new_old_type || "신축","""

    # 3. openFacilityModal initialDates
    target3 = """      let initialDates = item.building_approval_dates || "";
      if (!initialDates && (item.permission_date || item.approval_date)) {
        initialDates = `${item.permission_date || "-"} / ${item.approval_date || "-"}`;
      }
      document.getElementById("fac-dates").value = initialDates;
      document.getElementById("fac-new-old").value = item.is_new_building || item.building_new_old_type || "신축";"""

    replace3 = """      let initialDates = "";
      if (item.permission_date || item.approval_date) {
        initialDates = `${item.permission_date || "-"} / ${item.approval_date || "-"}`;
      } else if (item.building_approval_dates) {
        initialDates = item.building_approval_dates;
      }
      document.getElementById("fac-dates").value = initialDates;
      document.getElementById("fac-new-old").value = item.is_new_building || item.building_new_old_type || "신축";"""

    # 4. openFacilityModal new registration else block
    target4 = """    document.getElementById("modal-facility-title").innerText = "신규 시설 등록";
    document.getElementById("fac-key").readOnly = false;
    document.getElementById("fac-total-households").value = "";"""

    replace4 = """    document.getElementById("modal-facility-title").innerText = "신규 시설 등록";
    document.getElementById("fac-key").readOnly = false;
    document.getElementById("fac-dates").value = "";
    document.getElementById("fac-new-old").value = "신축";
    document.getElementById("fac-total-households").value = "";"""

    # 5. openFacilityDetailModal detail-new-old fallback
    target5 = """safeSetText("detail-new-old", facility.is_new_building || facility.building_new_old_type);"""
    replace5 = """safeSetText("detail-new-old", facility.is_new_building || facility.building_new_old_type || '-');"""

    targets = [target1, target2, target3, target4, target5]
    replaces = [replace1, replace2, replace3, replace4, replace5]

    for i, (t, r) in enumerate(zip(targets, replaces)):
        if t in text_lf:
            text_lf = text_lf.replace(t, r, 1)
            print(f"Applied patch {i+1}")
        else:
            if i == 0 and "const APP_DATA_VERSION" in text_lf:
                print("Patch 1 already applied")
                continue
            print(f"Failed to find target {i+1}")
            sys.exit(1)

    if is_crlf:
        final_text = text_lf.replace('\n', '\r\n')
    else:
        final_text = text_lf

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(final_text)
    print("app.js updated successfully.")

def patch_index_html():
    with open('index.html', 'r', encoding='utf-8') as f:
        text = f.read()

    is_crlf = '\r\n' in text
    text_lf = text.replace('\r\n', '\n')

    target = '<script src="app.js?v=20260909_batch_tab_and_disp_target"></script>'
    replace = '<script src="app.js?v=20261109_1130_fix_facility_dates"></script>'

    if target in text_lf:
        text_lf = text_lf.replace(target, replace, 1)
        print("Updated script tag in index.html")
    else:
        print("Target script tag not found in index.html")
        sys.exit(1)

    if is_crlf:
        final_text = text_lf.replace('\n', '\r\n')
    else:
        final_text = text_lf

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(final_text)
    print("index.html updated successfully.")

if __name__ == '__main__':
    patch_app_js()
    patch_index_html()
