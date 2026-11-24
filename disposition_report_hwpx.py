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
import io
import math
import re
import zipfile
from hwpx import HwpxDocument
try:
    from hwpx.objects.results import CellMargins
except Exception:  # pragma: no cover
    CellMargins = None

HEAD_PURPLE = "#EBDEF1"
HEAD_GRAY = "#D9D9D9"
# 한 페이지(A4)에 모두 들어가도록 글자 크기와 여백을 줄임
TITLE_SIZE = 12
BODY_SIZE = 8
SMALL_SIZE = 7.5
MM = 283.465  # 1mm = 283.465 HWPUNIT
PAGE_MARGINS = dict(left=int(15 * MM), right=int(15 * MM), top=int(10 * MM), bottom=int(10 * MM),
                    header=int(5 * MM), footer=int(5 * MM), gutter=0)
LINE_SPACING_PERCENT = 130


def _cell_margins(lr, tb):
    if CellMargins is None:
        return None
    try:
        return CellMargins(left=lr, right=lr, top=tb, bottom=tb)
    except Exception:
        return None


# 칸 안쪽 여백(HWPUNIT): 위 두 표는 보통, 미이행 시설 목록은 넉넉하게(1페이지를 거의 채우도록)
TOP_TABLE_MARGIN = (200, 140)     # 좌우 0.7mm, 위아래 0.5mm
LIST_TABLE_MARGIN = (285, 310)    # 좌우 1.0mm, 위아래 1.1mm
LIST_SIZE = 8


def _add_table(doc, rows, cols, margin=TOP_TABLE_MARGIN):
    margins = _cell_margins(*margin)
    try:
        return doc.add_table(rows, cols, in_margins=margins) if margins else doc.add_table(rows, cols)
    except Exception:
        return doc.add_table(rows, cols)


def _compact_line_spacing(data):
    """모든 문단 줄간격(160%)을 줄여 표 높이를 줄임"""
    src = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as dst:
        for info in src.infolist():
            body = src.read(info.filename)
            if info.filename == "Contents/header.xml":
                txt = body.decode("utf-8")
                txt = re.sub(r'(<hh:lineSpacing type="PERCENT" value=")(\d+)(")',
                             lambda m: f"{m.group(1)}{min(int(m.group(2)), LINE_SPACING_PERCENT)}{m.group(3)}", txt)
                body = txt.encode("utf-8")
            dst.writestr(info, body, compress_type=info.compress_type)
    return out.getvalue()


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
    try:
        doc.sections[0].properties.set_page_margins(**PAGE_MARGINS)
    except Exception:
        pass

    # 제목: [공공시설 (타기관)], 공동주택, 공중이용시설 : 66개소 ('26. 11. 18.기준)
    p = doc.add_paragraph("")
    # 글꼴: 아래 '① 미이행 시설 통계' 제목과 동일(굵게, 같은 크기)
    p.add_run(f"{scope} : ", bold=True, size=TITLE_SIZE)
    p.add_run(f"{summary.get('total', 0)}개소", bold=True, size=TITLE_SIZE)
    if base_date:
        p.add_run(f" ({base_date}기준)", size=9)

    p = doc.add_paragraph("")
    p.add_run("o 시정명령 및 이행현황", bold=True, size=TITLE_SIZE)

    # ── 표1: 시정명령 및 이행현황 (총계 + 차수별 계/이행/미이행 + 비고)
    n_cols = 3 + 3 * len(rounds) + 1
    t1 = _add_table(doc, 3, n_cols)
    try:
        t1.set_column_widths([1.0] * (n_cols - 1) + [1.3])
    except Exception:
        pass
    _set_cell(t1, 0, 0, "총    계", bold=True, size=BODY_SIZE)
    for i, r in enumerate(rounds):
        label = r.get("label", "")
        if r.get("in_progress"):
            label += "\n(진행중)"
        _set_cell(t1, 0, 3 + i * 3, label, bold=True, size=BODY_SIZE)
    _set_cell(t1, 0, n_cols - 1, "비고", bold=True, size=BODY_SIZE)
    # 계/이행/미이행: 작은 글씨로 한 줄(가로) 표시
    for g in range(len(rounds) + 1):
        _set_cell(t1, 1, g * 3, "계", size=SMALL_SIZE)
        _set_cell(t1, 1, g * 3 + 1, "이행", size=SMALL_SIZE)
        _set_cell(t1, 1, g * 3 + 2, "미이행", size=SMALL_SIZE)
    _set_cell(t1, 2, 0, _num(summary.get("total")), size=BODY_SIZE)
    _set_cell(t1, 2, 1, _num(summary.get("done")), size=BODY_SIZE)
    _set_cell(t1, 2, 2, _num(summary.get("todo")), size=BODY_SIZE)
    for i, r in enumerate(rounds):
        _set_cell(t1, 2, 3 + i * 3, _num(r.get("total")), size=BODY_SIZE)
        _set_cell(t1, 2, 4 + i * 3, _num(r.get("done")), size=BODY_SIZE)
        _set_cell(t1, 2, 5 + i * 3, _num(r.get("todo")), size=BODY_SIZE)
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

    p = doc.add_paragraph("")
    p.add_run(" ", size=6)
    p = doc.add_paragraph("")
    p.add_run("① 미이행 시설 통계", bold=True, size=TITLE_SIZE)

    # ── 표2: 미이행 시설 통계
    n2 = 1 + len(rounds) + 1
    t2 = _add_table(doc, 2, n2)
    _set_cell(t2, 0, 0, "계", bold=True)
    _set_cell(t2, 1, 0, _num(summary.get("todo")))
    for i, r in enumerate(rounds):
        _set_cell(t2, 0, 1 + i, r.get("short", ""), bold=True)
        _set_cell(t2, 1, 1 + i, _num(r.get("todo")))
    _set_cell(t2, 0, n2 - 1, "비고", bold=True)
    _set_cell(t2, 0, 0, "계", bold=True)
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

    p = doc.add_paragraph("")
    p.add_run(" ", size=6)
    p = doc.add_paragraph("")
    p.add_run("② 미이행 시설 목록", bold=True, size=TITLE_SIZE)

    # ── 표3: 미이행 시설 목록 (2단: 연번/시설명/진행상황 × 2)
    half = max(1, math.ceil(len(items) / 2))
    t3 = _add_table(doc, half + 1, 6, LIST_TABLE_MARGIN)
    try:
        t3.set_column_widths([0.6, 3.3, 1.9, 0.6, 3.3, 1.9])
    except Exception:
        pass
    for base in (0, 3):
        _set_cell(t3, 0, base, "연번", bold=True)
        _set_cell(t3, 0, base + 1, "시설명", bold=True)
        _set_cell(t3, 0, base + 2, "진행상황", bold=True)
    for idx, it in enumerate(items):
        row = 1 + (idx % half)
        base = 0 if idx < half else 3
        _set_cell(t3, row, base, str(it.get("no", idx + 1)), size=LIST_SIZE)
        _set_cell(t3, row, base + 1, it.get("name", ""), size=LIST_SIZE)
        _set_cell(t3, row, base + 2, it.get("progress", ""), size=LIST_SIZE)
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

    return _compact_line_spacing(doc.to_bytes())
