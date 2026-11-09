import os
import sys

def patch_app_js():
    with open('app.js', 'r', encoding='utf-8') as f:
        text = f.read()

    is_crlf = '\r\n' in text
    text_lf = text.replace('\r\n', '\n')

    # 1. Update APP_DATA_VERSION
    target1 = 'const APP_DATA_VERSION = "20261109_v3";'
    replace1 = 'const APP_DATA_VERSION = "20261109_v4";'

    # 2. Update fetchFacilities mapping
    target2 = """          return {
            ...f,
            building_approval_dates: (f.permission_date || f.approval_date)
              ? `${f.permission_date || '-'} / ${f.approval_date || '-'}`
              : (f.building_approval_dates || ""),
            building_new_old_type: f.is_new_building || f.building_new_old_type || "신축",
            manager_name_decrypted: decMgrName || (f.manager_name_encrypted && !f.manager_name_encrypted.startsWith("gAAAAA") ? f.manager_name_encrypted : (f.manager_name || "")),
            manager_contact_decrypted: decMgrContact || (f.manager_contact_encrypted && !f.manager_contact_encrypted.startsWith("gAAAAA") ? f.manager_contact_encrypted : (f.manager_contact || ""))
          };"""

    replace2 = """          const extra = f.extra_info || {};
          return {
            ...f,
            charger_ground_cnt: (f.charger_ground_cnt !== undefined && f.charger_ground_cnt !== null) ? f.charger_ground_cnt : (extra.charger_ground_cnt !== undefined ? extra.charger_ground_cnt : 0),
            charger_underground_cnt: (f.charger_underground_cnt !== undefined && f.charger_underground_cnt !== null) ? f.charger_underground_cnt : (extra.charger_underground_cnt !== undefined ? extra.charger_underground_cnt : 0),
            charger_location: f.charger_location || extra.charger_location || "",
            building_approval_dates: (f.permission_date || f.approval_date)
              ? `${f.permission_date || '-'} / ${f.approval_date || '-'}`
              : (f.building_approval_dates || ""),
            building_new_old_type: f.is_new_building || f.building_new_old_type || "신축",
            manager_name_decrypted: decMgrName || (f.manager_name_encrypted && !f.manager_name_encrypted.startsWith("gAAAAA") ? f.manager_name_encrypted : (f.manager_name || "")),
            manager_contact_decrypted: decMgrContact || (f.manager_contact_encrypted && !f.manager_contact_encrypted.startsWith("gAAAAA") ? f.manager_contact_encrypted : (f.manager_contact || ""))
          };"""

    # 3. Update updateModalDetailCounts
    target3 = """  const chargerGroundUnderElem = document.getElementById("detail-charger-ground-underground");
  if (chargerGroundUnderElem) {
    const cGround = facility.charger_ground_cnt !== undefined && facility.charger_ground_cnt !== null ? facility.charger_ground_cnt : 0;
    const cUnderground = facility.charger_underground_cnt !== undefined && facility.charger_underground_cnt !== null ? facility.charger_underground_cnt : 0;
    chargerGroundUnderElem.innerText = `${cGround}기 / ${cUnderground}기`;
  }"""

    replace3 = """  const chargerGroundUnderElem = document.getElementById("detail-charger-ground-underground");
  if (chargerGroundUnderElem) {
    const extra = facility.extra_info || {};
    const cGround = (facility.charger_ground_cnt !== undefined && facility.charger_ground_cnt !== null && facility.charger_ground_cnt !== '')
      ? facility.charger_ground_cnt
      : ((extra.charger_ground_cnt !== undefined && extra.charger_ground_cnt !== null && extra.charger_ground_cnt !== '') ? extra.charger_ground_cnt : 0);
    const cUnderground = (facility.charger_underground_cnt !== undefined && facility.charger_underground_cnt !== null && facility.charger_underground_cnt !== '')
      ? facility.charger_underground_cnt
      : ((extra.charger_underground_cnt !== undefined && extra.charger_underground_cnt !== null && extra.charger_underground_cnt !== '') ? extra.charger_underground_cnt : 0);
    chargerGroundUnderElem.innerText = `${cGround}기 / ${cUnderground}기`;
  }"""

    # 4. Update openFacilityModal for charger edit form binding
    target4 = """      document.getElementById("fac-charger-ground").value = item.charger_ground_cnt || 0;
      document.getElementById("fac-charger-underground").value = item.charger_underground_cnt || 0;
      document.getElementById("fac-charger-location").value = item.charger_location || (item.extra_info && item.extra_info.charger_location) || "";"""

    replace4 = """      const editExtra = item.extra_info || {};
      document.getElementById("fac-charger-ground").value = (item.charger_ground_cnt !== undefined && item.charger_ground_cnt !== null) ? item.charger_ground_cnt : (editExtra.charger_ground_cnt ?? 0);
      document.getElementById("fac-charger-underground").value = (item.charger_underground_cnt !== undefined && item.charger_underground_cnt !== null) ? item.charger_underground_cnt : (editExtra.charger_underground_cnt ?? 0);
      document.getElementById("fac-charger-location").value = item.charger_location || editExtra.charger_location || "";"""

    targets = [target1, target2, target3, target4]
    replaces = [replace1, replace2, replace3, replace4]

    for i, (t, r) in enumerate(zip(targets, replaces)):
        if t in text_lf:
            text_lf = text_lf.replace(t, r, 1)
            print(f"Applied patch {i+1}")
        else:
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

    target = '<script src="app.js?v=20261109_1130_fix_facility_dates"></script>'
    replace = '<script src="app.js?v=20261109_1145_fix_charger_ground_underground"></script>'

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
