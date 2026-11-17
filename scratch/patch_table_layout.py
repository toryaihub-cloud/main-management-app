import os
import sys

def patch_styles():
    with open('styles.css', 'r', encoding='utf-8') as f:
        text = f.read()

    is_crlf = '\r\n' in text
    text_lf = text.replace('\r\n', '\n')

    target = """.detail-info-table {
  width: 100%;
  border-collapse: separate;"""

    replace = """.detail-info-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: separate;"""

    if target in text_lf:
        text_lf = text_lf.replace(target, replace, 1)
        print("Updated styles.css with table-layout: fixed")
    else:
        print("Target not found in styles.css")
        sys.exit(1)

    if is_crlf:
        final_text = text_lf.replace('\n', '\r\n')
    else:
        final_text = text_lf

    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(final_text)
    print("styles.css saved successfully.")

def patch_index_html():
    with open('index.html', 'r', encoding='utf-8') as f:
        text = f.read()

    is_crlf = '\r\n' in text
    text_lf = text.replace('\r\n', '\n')

    # Replace Card 3 table structure
    target = """                <table class="detail-info-table" style="margin-bottom:0.35rem;">
                  <thead>
                    <tr>
                      <th style="width:16%;">구분</th>
                      <th style="width:28%;">설치 / 의무</th>
                      <th style="width:38%;">세부 설치 내역</th>
                      <th style="width:18%;">미설치</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th><i class="fa-solid fa-square-parking" style="color:var(--primary);"></i> 주차</th>
                      <td style="text-align:center;"><span id="detail-parking-slash-info">0면 / 0면</span></td>
                      <td style="text-align:center;">지상/지하: <span id="detail-parking-ground-underground">0면 / 0면</span></td>
                      <td style="text-align:center; color:var(--danger); font-weight:600;"><span id="detail-parking-uninstalled">0</span>면</td>
                    </tr>
                    <tr>
                      <th><i class="fa-solid fa-bolt" style="color:#EAB308;"></i> 충전</th>
                      <td style="text-align:center;"><span id="detail-charger-slash-info">0기 / 0기</span></td>
                      <td style="text-align:left; padding:0.4rem 0.6rem; line-height:1.45; font-size:0.8rem;">
                        <div>완속/급속: <span id="detail-slow-fast-installed" style="color:var(--primary); font-weight:600;">0기 / 0기</span> <span style="color:#64748B; font-size:0.75rem;">(급속미이행: <span id="detail-fast-uninstalled" style="color:var(--danger); font-weight:600;">0기</span>)</span></div>
                        <div>지상/지하: <span id="detail-charger-ground-underground" style="font-weight:600; color:#0F172A;">0기 / 0기</span></div>
                        <div style="color:#475569; word-break:break-all;">설치장소: <span id="detail-charger-location" style="font-weight:500; color:#334155;">-</span></div>
                      </td>
                      <td style="text-align:center; color:var(--danger); font-weight:600;"><span id="detail-charger-uninstalled">0</span>기</td>
                    </tr>
                  </tbody>
                </table>"""

    replace = """                <table class="detail-info-table" style="margin-bottom:0.35rem; table-layout:fixed; width:100%;">
                  <colgroup>
                    <col style="width: 14%;">
                    <col style="width: 25%;">
                    <col style="width: 47%;">
                    <col style="width: 14%;">
                  </colgroup>
                  <thead>
                    <tr>
                      <th>구분</th>
                      <th>설치 / 의무</th>
                      <th>세부 설치 내역</th>
                      <th>미설치</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th><i class="fa-solid fa-square-parking" style="color:var(--primary);"></i> 주차</th>
                      <td style="text-align:center;"><span id="detail-parking-slash-info">0면 / 0면</span></td>
                      <td style="text-align:center;">지상/지하: <span id="detail-parking-ground-underground">0면 / 0면</span></td>
                      <td style="text-align:center; color:var(--danger); font-weight:600;"><span id="detail-parking-uninstalled">0</span>면</td>
                    </tr>
                    <tr>
                      <th><i class="fa-solid fa-bolt" style="color:#EAB308;"></i> 충전</th>
                      <td style="text-align:center;"><span id="detail-charger-slash-info">0기 / 0기</span></td>
                      <td style="text-align:left; padding:0.3rem 0.5rem; line-height:1.4; font-size:0.78rem; word-break:break-all; overflow-wrap:anywhere; white-space:normal;">
                        <div>완속/급속: <span id="detail-slow-fast-installed" style="color:var(--primary); font-weight:600;">0기 / 0기</span> <span style="color:#64748B; font-size:0.74rem;">(급속미이행: <span id="detail-fast-uninstalled" style="color:var(--danger); font-weight:600;">0기</span>)</span></div>
                        <div>지상/지하: <span id="detail-charger-ground-underground" style="font-weight:600; color:#0F172A;">0기 / 0기</span></div>
                        <div style="color:#475569; word-break:break-all; overflow-wrap:anywhere; white-space:normal; font-size:0.74rem; margin-top:2px;">설치장소: <span id="detail-charger-location" style="font-weight:500; color:#334155; word-break:break-all; overflow-wrap:anywhere;">-</span></div>
                      </td>
                      <td style="text-align:center; color:var(--danger); font-weight:600;"><span id="detail-charger-uninstalled">0</span>기</td>
                    </tr>
                  </tbody>
                </table>"""

    if target in text_lf:
        text_lf = text_lf.replace(target, replace, 1)
        print("Updated Card 3 table in index.html")
    else:
        print("Target Card 3 table not found in index.html")
        sys.exit(1)

    # Also bump css version query in index.html if needed
    target_css = '<link rel="stylesheet" href="styles.css'
    idx_css = text_lf.find(target_css)
    if idx_css != -1:
        end_quote = text_lf.find('"', idx_css + len(target_css))
        old_link = text_lf[idx_css:end_quote+1]
        new_link = '<link rel="stylesheet" href="styles.css?v=20261117_fix_table_layout"'
        text_lf = text_lf.replace(old_link, new_link, 1)
        print(f"Updated styles.css cache buster: {new_link}")

    if is_crlf:
        final_text = text_lf.replace('\n', '\r\n')
    else:
        final_text = text_lf

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(final_text)
    print("index.html saved successfully.")

if __name__ == '__main__':
    patch_styles()
    patch_index_html()
