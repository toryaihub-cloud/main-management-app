# -*- coding: utf-8 -*-
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
index_path = os.path.join(BASE_DIR, 'index.html')

with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 상세 팝업 충전 세부 설치 내역 확장
old_detail_td = """                      <td style="text-align:center; line-height:1.35;">
                        완속/급속: <span id="detail-slow-fast-installed" style="color:var(--primary); font-weight:600;">0기 / 0기</span><br>
                        <span style="color:#64748B;">급속미이행: <span id="detail-fast-uninstalled" style="color:var(--danger); font-weight:600;">0기</span></span>
                      </td>"""

new_detail_td = """                      <td style="text-align:left; padding:0.4rem 0.6rem; line-height:1.45; font-size:0.8rem;">
                        <div>완속/급속: <span id="detail-slow-fast-installed" style="color:var(--primary); font-weight:600;">0기 / 0기</span> <span style="color:#64748B; font-size:0.75rem;">(급속미이행: <span id="detail-fast-uninstalled" style="color:var(--danger); font-weight:600;">0기</span>)</span></div>
                        <div>지상/지하: <span id="detail-charger-ground-underground" style="font-weight:600; color:#0F172A;">0기 / 0기</span></div>
                        <div style="color:#475569; word-break:break-all;">설치장소: <span id="detail-charger-location" style="font-weight:500; color:#334155;">-</span></div>
                      </td>"""

# CRLF / LF 호환
if old_detail_td.replace("\r\n", "\n") in content.replace("\r\n", "\n"):
    # 일치하는 부분 찾아서 교체
    if old_detail_td in content:
        content = content.replace(old_detail_td, new_detail_td, 1)
    else:
        old_crlf = old_detail_td.replace("\n", "\r\n")
        new_crlf = new_detail_td.replace("\n", "\r\n")
        content = content.replace(old_crlf, new_crlf, 1)
    print("1. 상세 팝업 충전 세부 설치 내역 치환 완료")
else:
    print("경고: old_detail_td 미발견")

# 2. 수정 모달 충전기 지상/지하 기수 및 설치장소 폼 추가
old_modal_fast = """              <div class="form-group">
                <label class="form-label">설치 급속 충전기수</label>
                <input type="number" id="fac-fast-cnt" class="input-box" value="0">
              </div>"""

new_modal_fast = """              <div class="form-group">
                <label class="form-label">설치 급속 충전기수</label>
                <input type="number" id="fac-fast-cnt" class="input-box" value="0">
              </div>
              <div class="form-group">
                <label class="form-label">충전 지상 설치기수</label>
                <input type="number" id="fac-charger-ground" class="input-box" value="0">
              </div>
              <div class="form-group">
                <label class="form-label">충전 지하 설치기수</label>
                <input type="number" id="fac-charger-underground" class="input-box" value="0">
              </div>
              <div class="form-group full">
                <label class="form-label">충전기 설치장소</label>
                <input type="text" id="fac-charger-location" class="input-box" placeholder="예: 지상1층 주차장, 지하1층 B08">
              </div>"""

if old_modal_fast.replace("\r\n", "\n") in content.replace("\r\n", "\n"):
    if old_modal_fast in content:
        content = content.replace(old_modal_fast, new_modal_fast, 1)
    else:
        old_crlf = old_modal_fast.replace("\n", "\r\n")
        new_crlf = new_modal_fast.replace("\n", "\r\n")
        content = content.replace(old_crlf, new_crlf, 1)
    print("2. 수정 모달 충전기 지상/지하/장소 폼 추가 완료")
else:
    print("경고: old_modal_fast 미발견")

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("index.html 업데이트 완료!")
