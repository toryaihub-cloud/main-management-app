import os
import sys

def patch():
    with open('app.js', 'r', encoding='utf-8') as f:
        text = f.read()

    is_crlf = '\r\n' in text
    text_lf = text.replace('\r\n', '\n')

    # 1. Update APP_DATA_VERSION
    target1 = 'const APP_DATA_VERSION = "20261109_v4";'
    replace1 = 'const APP_DATA_VERSION = "20261117_v5";'

    # 2. In fetchFacilities, ensure extra_info is safely parsed if string
    target2 = """          const extra = f.extra_info || {};
          return {
            ...f,
            charger_ground_cnt: (f.charger_ground_cnt !== undefined && f.charger_ground_cnt !== null) ? f.charger_ground_cnt : (extra.charger_ground_cnt !== undefined ? extra.charger_ground_cnt : 0),
            charger_underground_cnt: (f.charger_underground_cnt !== undefined && f.charger_underground_cnt !== null) ? f.charger_underground_cnt : (extra.charger_underground_cnt !== undefined ? extra.charger_underground_cnt : 0),
            charger_location: f.charger_location || extra.charger_location || "","""

    replace2 = """          let extra = f.extra_info || {};
          if (typeof extra === 'string') {
            try { extra = JSON.parse(extra); } catch(e) { extra = {}; }
          }
          return {
            ...f,
            charger_ground_cnt: (f.charger_ground_cnt !== undefined && f.charger_ground_cnt !== null) ? f.charger_ground_cnt : (extra.charger_ground_cnt !== undefined ? extra.charger_ground_cnt : 0),
            charger_underground_cnt: (f.charger_underground_cnt !== undefined && f.charger_underground_cnt !== null) ? f.charger_underground_cnt : (extra.charger_underground_cnt !== undefined ? extra.charger_underground_cnt : 0),
            charger_location: f.charger_location || extra.charger_location || "","""

    # 3. In updateModalDetailCounts, ensure extra_info is safely parsed if string
    target3 = """  const chargerGroundUnderElem = document.getElementById("detail-charger-ground-underground");
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

    replace3 = """  const chargerGroundUnderElem = document.getElementById("detail-charger-ground-underground");
  if (chargerGroundUnderElem) {
    let extra = facility.extra_info || {};
    if (typeof extra === 'string') {
      try { extra = JSON.parse(extra); } catch(e) { extra = {}; }
    }
    const cGround = (facility.charger_ground_cnt !== undefined && facility.charger_ground_cnt !== null && facility.charger_ground_cnt !== '')
      ? facility.charger_ground_cnt
      : ((extra.charger_ground_cnt !== undefined && extra.charger_ground_cnt !== null && extra.charger_ground_cnt !== '') ? extra.charger_ground_cnt : 0);
    const cUnderground = (facility.charger_underground_cnt !== undefined && facility.charger_underground_cnt !== null && facility.charger_underground_cnt !== '')
      ? facility.charger_underground_cnt
      : ((extra.charger_underground_cnt !== undefined && extra.charger_underground_cnt !== null && extra.charger_underground_cnt !== '') ? extra.charger_underground_cnt : 0);
    chargerGroundUnderElem.innerText = `${cGround}기 / ${cUnderground}기`;
  }"""

    targets = [target1, target2, target3]
    replaces = [replace1, replace2, replace3]

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

    # Update index.html script tag
    with open('index.html', 'r', encoding='utf-8') as f:
        h_text = f.read()

    h_is_crlf = '\r\n' in h_text
    h_text_lf = h_text.replace('\r\n', '\n')

    target_h = '<script src="app.js?v=20261109_1145_fix_charger_ground_underground"></script>'
    replace_h = '<script src="app.js?v=20261117_fix_charger_ground_underground_safe"></script>'

    if target_h in h_text_lf:
        h_text_lf = h_text_lf.replace(target_h, replace_h, 1)
        print("Updated script tag in index.html")
    else:
        print("Target script tag not found in index.html")
        sys.exit(1)

    if h_is_crlf:
        h_final = h_text_lf.replace('\n', '\r\n')
    else:
        h_final = h_text_lf

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(h_final)
    print("index.html updated successfully.")

if __name__ == '__main__':
    patch()
