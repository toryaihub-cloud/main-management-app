# -*- coding: utf-8 -*-
"""
행정처분내역 리포트(시정명령 및 이행현황) → 한글(HWPX) 파일 생성

입력(report): 프론트엔드 '행정처분내역 리포트' 화면과 동일한 데이터
{
  "scope": "[공공시설 (타기관)], 공동주택, 공중이용시설",
  "base_date": "'26. 11. 24.",
  "summary": {"total": 66, "done": 3, "todo": 63},
  "rounds": [{"label": "1차 시정명령", "short": "시정명령(1차)", "in_progress": false,
              "total": 21, "done": 2, "todo": 19}, ...],
  "list": [{"no": 1, "name": "광주시립정신병원", "progress": "시정명령(2차)"}, ...]
}
"""
import math
from hwpx import HwpxDocument

HEAD_PURPLE = "#EBDEF1"
HEAD_GRAY = "#D9D9D9"
TITLE_SIZE = 15
BODY_SIZE = 10


def _align(para, align):
    try:
        para.alignment = align
    except Exception:
        pass


def _set_cell(table, row, col, text="", *, bold=False, size=BODY_SIZE, align="CENTER", color=None):
    cell = table.cell(row, col)
    cell.text = ""
    paras = list(cell.paragraphs)
    para = paras[0] if paras else cell.add_paragraph("")
    _align(para, align)
    try:
        cell.vertical_alignment = "CENTER"
    except Exception:
        pass
    lines = str(text if text is not None else "").split("\n")
    for i, line in enumerate(lines):
        if i > 0:
            para = cell.add_paragraph("")
            _align(para, align)
        if line:
            para.add_run(line, bold=bold, size=size, color=color)


def _num(v):
    return "-" if not v else str(v)


def build_disposition_report_hwpx(report):
    rounds = report.get("rounds") or []
    summary = report.get("summary") or {}
    items = report.get("list") or []
    scope = report.get("scope") or "[공공시설 (타기관)], 공동주택, 공중이용시설"
    base_date = report.get("base_date") or ""

    doc = HwpxDocument.new()

    # 제목: [공공시설 (타기관)], 공동주택, 공중이용시설 : 66개소 ('26. 11. 18.기준)
    p = doc.add_paragraph("")
    # 글꼴: 아래 '① 미이행 시설 통계' 제목과 동일(굵게, 같은 크기)
    p.add_run(f"{scope} : ", bold=True, size=TITLE_SIZE)
    p.add_run(f"{summary.get('total', 0)}개소", bold=True, size=TITLE_SIZE)
    if base_date:
        p.add_run(f" ({base_date}기준)", size=11)

    p = doc.add_paragraph("")
    p.add_run("o 시정명령 및 이행현황", bold=True, size=TITLE_SIZE)

    # ── 표1: 시정명령 및 이행현황 (총계 + 차수별 계/이행/미이행 + 비고)
    n_cols = 3 + 3 * len(rounds) + 1
    t1 = doc.add_table(3, n_cols)
    try:
        t1.set_column_widths([1.0] * (n_cols - 1) + [1.6])
    except Exception:
        pass
    _set_cell(t1, 0, 0, "총    계", bold=True)
    for i, r in enumerate(rounds):
        label = r.get("label", "")
        if r.get("in_progress"):
            label += "\n(진행중)"
        _set_cell(t1, 0, 3 + i * 3, label, bold=True)
    _set_cell(t1, 0, n_cols - 1, "비고", bold=True)
    for g in range(len(rounds) + 1):
        _set_cell(t1, 1, g * 3, "계", size=9)
        _set_cell(t1, 1, g * 3 + 1, "이행", size=9)
        _set_cell(t1, 1, g * 3 + 2, "미이행", size=9)
    _set_cell(t1, 2, 0, _num(summary.get("total")), size=9)
    _set_cell(t1, 2, 1, _num(summary.get("done")), size=9)
    _set_cell(t1, 2, 2, _num(summary.get("todo")), size=9)
    for i, r in enumerate(rounds):
        _set_cell(t1, 2, 3 + i * 3, _num(r.get("total")), size=9)
        _set_cell(t1, 2, 4 + i * 3, _num(r.get("done")), size=9)
        _set_cell(t1, 2, 5 + i * 3, _num(r.get("todo")), size=9)
    for g in range(len(rounds) + 1):
        t1.merge_cells(0, g * 3, 0, g * 3 + 2)
    # 비고: 첫 줄(보라색 머리글)에만 표시, 아래 두 줄은 합쳐서 빈칸으로 마무리
    _set_cell(t1, 1, n_cols - 1, "")
    _set_cell(t1, 2, n_cols - 1, "")
    t1.merge_cells(1, n_cols - 1, 2, n_cols - 1)
    try:
        t1.set_borders(line_type="SOLID", border_width_mm=0.12, color="#000000", inner=True)
    except Exception:
        pass
    for g in range(len(rounds) + 1):
        try:
            t1.set_cell_shading(0, g * 3, HEAD_PURPLE)
        except Exception:
            pass
    try:
        t1.set_cell_shading(0, n_cols - 1, HEAD_PURPLE)
    except Exception:
        pass

    doc.add_paragraph("")
    p = doc.add_paragraph("")
    p.add_run("① 미이행 시설 통계", bold=True, size=TITLE_SIZE)

    # ── 표2: 미이행 시설 통계
    n2 = 1 + len(rounds) + 1
    t2 = doc.add_table(2, n2)
    _set_cell(t2, 0, 0, "계", bold=True)
    _set_cell(t2, 1, 0, _num(summary.get("todo")))
    for i, r in enumerate(rounds):
        _set_cell(t2, 0, 1 + i, r.get("short", ""), bold=True)
        _set_cell(t2, 1, 1 + i, _num(r.get("todo")))
    _set_cell(t2, 0, n2 - 1, "비고", bold=True)
    _set_cell(t2, 1, n2 - 1, "")
    try:
        t2.set_borders(line_type="SOLID", border_width_mm=0.12, color="#000000", inner=True)
    except Exception:
        pass
    for c in range(n2):
        try:
            t2.set_cell_shading(0, c, HEAD_GRAY)
        except Exception:
            pass

    doc.add_paragraph("")
    p = doc.add_paragraph("")
    p.add_run("② 미이행 시설 목록", bold=True, size=TITLE_SIZE)

    # ── 표3: 미이행 시설 목록 (2단: 연번/시설명/진행상황 × 2)
    half = max(1, math.ceil(len(items) / 2))
    t3 = doc.add_table(half + 1, 6)
    try:
        t3.set_column_widths([0.9, 3.0, 2.3, 0.9, 3.0, 2.3])
    except Exception:
        pass
    for base in (0, 3):
        _set_cell(t3, 0, base, "연번", bold=True)
        _set_cell(t3, 0, base + 1, "시설명", bold=True)
        _set_cell(t3, 0, base + 2, "진행상황", bold=True)
    for idx, it in enumerate(items):
        row = 1 + (idx % half)
        base = 0 if idx < half else 3
        _set_cell(t3, row, base, str(it.get("no", idx + 1)), size=9)
        _set_cell(t3, row, base + 1, it.get("name", ""), size=9)
        _set_cell(t3, row, base + 2, it.get("progress", ""), size=9)
    try:
        t3.repeat_header = True
    except Exception:
        pass
    try:
        t3.set_borders(line_type="SOLID", border_width_mm=0.12, color="#000000", inner=True)
    except Exception:
        pass
    for c in range(6):
        try:
            t3.set_cell_shading(0, c, HEAD_GRAY)
        except Exception:
            pass

    return doc.to_bytes()
