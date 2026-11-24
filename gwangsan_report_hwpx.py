# -*- coding: utf-8 -*-
"""
광산구 공공시설 전용주차구역 및 충전시설 설치 이행 현황 리포트 → 한글(HWPX) 파일 생성

입력(report): 프론트엔드 '광산구관리시설 리포트' 화면과 동일한 데이터
{
  "title": "광산구 공공시설 전용주차구역 및 충전시설 설치 이행 현황",
  "non_compliant": 12,
  "summary": {"dept_count": 6, "facility_count": 31, "non_compliant": 12, "completed": 18, "exempt": 1},
  "groups": [
    {"dept": "시민경제과", "dept_note": "", "rows": [
      {"name": "...", "status": "완료|미이행|면제",
       "p_fix": "-", "p_inst": "10", "p_req": "10",
       "c_fix": "-", "c_inst": "4(4/0)", "c_req": "4(2)",
       "plan": "..."}
    ]}
  ]
}
"""
import io
from hwpx import HwpxDocument

COLOR_RED = "#FF0000"
COLOR_BLUE = "#0000FF"
COLOR_PURPLE = "#9D5CBB"

# 열: 관리부서 | 시설명 | 진행사항 | 주차(보완/설치/의무) | 충전(보완/설치/의무) | 부서 조치계획
COL_WEIGHTS = [13.0, 36.96, 16.58, 10.26, 8.26, 7.26, 10.59, 14.09, 14.09, 36.54]


def plan_segments(text):
    """부서 조치계획 문구 색 구분 (원본 한글 문서 표기 방식)
    - 본예산/예산 관련: 보라, 괄호 안 미선정·검토·현장조사 등: 빨강, 나머지: 파랑"""
    import re
    if not text:
        return []
    segs = []
    for line in str(text).replace("\r", "").split("\n"):
        parts = re.split(r"(\([^)]*\)|‘\d{2}\.\s*본예산[^(\n]*(?:\([^)]*\))?|'\d{2}\.\s*본예산[^(\n]*(?:\([^)]*\))?|본예산[^(\n]*)", line)
        line_segs = []
        for p in parts:
            if not p:
                continue
            if "본예산" in p or "예산" in p:
                line_segs.append((p, COLOR_PURPLE))
            elif p.startswith("(") and any(w in p for w in ("미선정", "검토", "현장조사", "불가", "협소", "예정")):
                line_segs.append((p, COLOR_RED))
            else:
                line_segs.append((p, COLOR_BLUE))
        segs.append(line_segs)
    return segs


def _set_cell(table, row, col, text="", *, bold=False, color=None, align="CENTER", size=10, segments=None):
    cell = table.cell(row, col)
    cell.text = ""
    paras = list(cell.paragraphs)
    para = paras[0] if paras else cell.add_paragraph("")
    try:
        para.alignment = align
    except Exception:
        pass
    try:
        cell.vertical_alignment = "CENTER"
    except Exception:
        pass
    if segments:
        first = True
        for line_segs in segments:
            if not first:
                para = cell.add_paragraph("")
                try:
                    para.alignment = align
                except Exception:
                    pass
            first = False
            for seg_text, seg_color in line_segs:
                para.add_run(seg_text, bold=True, color=seg_color, size=size)
        return
    lines = str(text if text is not None else "").split("\n")
    for i, line in enumerate(lines):
        if i > 0:
            para = cell.add_paragraph("")
            try:
                para.alignment = align
            except Exception:
                pass
        if line:
            para.add_run(line, bold=bold, color=color, size=size)


def build_report_hwpx(report):
    groups = report.get("groups") or []
    summary = report.get("summary") or {}
    title = report.get("title") or "광산구 공공시설 전용주차구역 및 충전시설 설치 이행 현황"
    non_comp = summary.get("non_compliant", report.get("non_compliant", 0))

    doc = HwpxDocument.new()

    # 제목: □ 광산구 공공시설 ... 이행 현황[미이행: N개소]
    p = doc.add_paragraph("")
    p.add_run("□ ", bold=True, size=13)
    p.add_run(title, bold=True, size=13)
    p.add_run(f"[미이행: {non_comp}개소]", bold=True, size=11)
    if report.get("base_date"):
        p2 = doc.add_paragraph("")
        try:
            p2.alignment = "RIGHT"
        except Exception:
            pass
        p2.add_run(f"({report['base_date']} 기준)", size=9)
    doc.add_paragraph("")

    total_rows = sum(len(g.get("rows") or []) for g in groups)
    n_rows = 2 + total_rows
    table = doc.add_table(n_rows, 10)
    try:
        table.set_column_widths(COL_WEIGHTS)
    except Exception:
        pass
    try:
        table.repeat_header = True
    except Exception:
        pass

    # 머리글 1행
    _set_cell(table, 0, 0, "관리부서", bold=True)
    _set_cell(table, 0, 1, "시설명", bold=True)
    _set_cell(table, 0, 2, "진행사항", bold=True)
    _set_cell(table, 0, 3, "전용주차구역", bold=True)
    _set_cell(table, 0, 6, "충전시설", bold=True)
    _set_cell(table, 0, 9, "부서 조치계획", bold=True)
    # 머리글 2행
    _set_cell(table, 1, 0, f"{summary.get('dept_count', len(groups))}개", bold=True)
    _set_cell(table, 1, 1, f"{summary.get('facility_count', total_rows)}개", bold=True)
    cell = table.cell(1, 2)
    cell.text = ""
    para = list(cell.paragraphs)[0]
    try:
        para.alignment = "CENTER"
    except Exception:
        pass
    para.add_run(f"미이행({non_comp})", bold=True, color=COLOR_RED, size=10)
    p2 = cell.add_paragraph("")
    try:
        p2.alignment = "CENTER"
    except Exception:
        pass
    p2.add_run(f"완료({summary.get('completed', 0)})/면제({summary.get('exempt', 0)})", bold=True, size=9)
    _set_cell(table, 1, 3, "보완\n사항", bold=True, size=9)
    _set_cell(table, 1, 4, "설치\n현황", bold=True, size=9)
    _set_cell(table, 1, 5, "의무", bold=True, size=9)
    _set_cell(table, 1, 6, "보완\n사항", bold=True, size=9)
    _set_cell(table, 1, 7, "설치현황\n(급/완)", bold=True, size=9)
    _set_cell(table, 1, 8, "의무\n(급속)", bold=True, size=9)

    r = 2
    dept_spans = []
    for g in groups:
        rows = g.get("rows") or []
        if not rows:
            continue
        start = r
        for row in rows:
            status = row.get("status", "")
            p_fix = row.get("p_fix", "") or ""
            c_fix = row.get("c_fix", "") or ""
            _set_cell(table, r, 1, row.get("name", ""), size=9)
            _set_cell(table, r, 2, status, bold=(status == "미이행"),
                      color=COLOR_RED if status == "미이행" else None, size=9)
            # 보완사항: 좁은 칸이므로 작은 글씨 + 항목별 줄바꿈 (급속1 / 완속1)
            _set_cell(table, r, 3, p_fix.replace(" ", "\n"), bold=(p_fix not in ("", "-")),
                      color=COLOR_RED if p_fix not in ("", "-", "면제") else None, size=8)
            _set_cell(table, r, 4, row.get("p_inst", ""), size=9)
            _set_cell(table, r, 5, row.get("p_req", ""), size=9)
            _set_cell(table, r, 6, c_fix.replace(" ", "\n"), bold=(c_fix not in ("", "-")),
                      color=COLOR_RED if c_fix not in ("", "-", "면제") else None, size=8)
            _set_cell(table, r, 7, row.get("c_inst", ""), size=9)
            _set_cell(table, r, 8, row.get("c_req", ""), size=9)
            # 부서 조치계획: 작은 글씨, 칸 너비에서 자동 줄바꿈
            _set_cell(table, r, 9, "", align="LEFT", size=8, segments=plan_segments(row.get("plan", "")))
            r += 1
        dept_spans.append((start, r - 1, g.get("dept", ""), g.get("dept_note", "")))

    # 관리부서 셀 (부서별 세로 병합)
    for start, end, dept, note in dept_spans:
        # 원본 양식처럼 '시민\n경제과' 형태로 두 줄 표기
        label = dept[:-3] + "\n" + dept[-3:] if len(dept) >= 5 else dept
        if start != end:
            table.merge_cells(start, 0, end, 0)
        cell = table.cell(start, 0)
        cell.text = ""
        para = list(cell.paragraphs)[0]
        try:
            para.alignment = "CENTER"
        except Exception:
            pass
        try:
            cell.vertical_alignment = "CENTER"
        except Exception:
            pass
        lines = label.split("\n")
        para.add_run(lines[0], size=10)
        for ln in lines[1:]:
            pp = cell.add_paragraph("")
            try:
                pp.alignment = "CENTER"
            except Exception:
                pass
            pp.add_run(ln, size=10)
        if note:
            pp = cell.add_paragraph("")
            try:
                pp.alignment = "CENTER"
            except Exception:
                pass
            pp.add_run(note, bold=True, color=COLOR_BLUE, size=9)

    # 머리글 병합 (값 입력 후 병합)
    table.merge_cells(0, 3, 0, 5)
    table.merge_cells(0, 6, 0, 8)
    table.merge_cells(0, 9, 1, 9)

    try:
        table.set_borders(line_type="SOLID", border_width_mm=0.12, color="#000000", inner=True)
    except Exception:
        pass

    buf = io.BytesIO()
    data = doc.to_bytes() if hasattr(doc, "to_bytes") else None
    if data is None:
        doc.save(buf)
        data = buf.getvalue()
    return data
