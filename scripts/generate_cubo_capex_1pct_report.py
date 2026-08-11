from __future__ import annotations

import argparse
import json
import re
import time
import urllib.request
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageFilter, ImageOps
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


PROJECT_REF = "hjccxfznojjosvanwztv"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TOKEN_FILE = PROJECT_ROOT.parents[1] / ".supabase_token"
DEFAULT_OUTPUT = PROJECT_ROOT / "output" / "pdf" / "capex_2026_cubo_global_school_modelo_revisado_20260811.pdf"
DEFAULT_DATA_OUTPUT = PROJECT_ROOT / "outputs" / "capex_1pct_cubo_model_20260811" / "report_data.json"
LOGO_PATH = PROJECT_ROOT / "LOGO DO CUBO GLOBAL SCHOOL.png"
BRAND_NAME = "Cubo Global School"

UNITS = [
    "Cubo Global School Barra Golf",
    "Cubo Global School Botafogo",
    "Cubo Global School Marapendi",
    "Cubo Kids",
]

# Validacao manual dada pelo usuario durante a conciliacao do CAPEX 2026.
MANUAL_VALUE_OVERRIDES = {
    "176641": (Decimal("29971.00"), "Valor final validado manualmente"),
}

MM = 72 / 25.4
PAGE_W, PAGE_H = A4

TEAL = HexColor("#00B8B5")
TEAL_DARK = HexColor("#007E7B")
TEAL_PALE = HexColor("#E7F7F6")
PURPLE = HexColor("#4D2A91")
PURPLE_DARK = HexColor("#352064")
PURPLE_PALE = HexColor("#F0ECF8")
INK = HexColor("#242831")
MUTED = HexColor("#6D737A")
SOFT = HexColor("#93989D")
PAPER = HexColor("#F6F8F8")
LINE = HexColor("#DDE2E3")
CORAL = HexColor("#C94D47")
CORAL_PALE = HexColor("#FBECEB")
GREEN = HexColor("#278067")
GREEN_PALE = HexColor("#E9F5F0")
GRAY_CARD = HexColor("#EEF1F1")
HEADER_TEXT = white
HEADER_META = HexColor("#E7E3F0")
COVER_LOGO_WIDTH_MM = 60
COVER_LOGO_MAX_HEIGHT_MM = 22
DETAIL_LOGO_WIDTH_MM = 40
DETAIL_LOGO_MAX_HEIGHT_MM = 15
LOGO_CONTRAST_OUTLINE = False
LOGO_LIGHTEN_ON_DARK = False
LOGO_LIGHTEN_STRENGTH = 0.52
_LOGO_CACHE: dict[str, ImageReader] = {}


def dec(value: Any) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    return Decimal(str(value))


def money(value: Any) -> str:
    amount = dec(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    raw = f"{amount:,.2f}"
    return "R$ " + raw.replace(",", "X").replace(".", ",").replace("X", ".")


def repair_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    for _ in range(2):
        if not any(marker in text for marker in ("Ã", "Â", "â", "ð")):
            break
        try:
            repaired = text.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            break
        if repaired == text:
            break
        text = repaired
    return re.sub(r"\s+", " ", text).strip()


def sql_query(token: str, query: str) -> list[dict[str, Any]]:
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    payload = json.dumps({"query": query}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Obras-Real-Estate-Report/1.0",
        },
    )
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            last_error = exc
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("Supabase query failed") from last_error


def extract_compra_tr(row: dict[str, Any]) -> str:
    dados = row.get("ticket_raiz_dados") or {}
    link = dados.get("compraVinculada") or dados.get("compra_vinculada") or dados.get("compra")
    if isinstance(link, dict):
        return re.sub(r"\D", "", str(link.get("tr") or link.get("zeev_id") or ""))
    if isinstance(link, str):
        match = re.search(r"\d{4,}", link)
        return match.group(0) if match else ""
    return ""


def extract_finance_links(row: dict[str, Any]) -> list[dict[str, Any]]:
    dados = row.get("ticket_raiz_dados") or {}
    raw = dados.get("financeirosVinculados") or dados.get("financeiros_vinculados") or dados.get("trsFinanceiros") or []
    if isinstance(raw, dict):
        raw = [raw]
    links = []
    for entry in raw if isinstance(raw, list) else []:
        if isinstance(entry, dict):
            tr = re.sub(r"\D", "", str(entry.get("tr") or entry.get("zeev_id") or ""))
            if tr:
                links.append({"tr": tr, "valor": entry.get("valor"), "status": entry.get("status")})
        else:
            match = re.search(r"\d{4,}", str(entry))
            if match:
                links.append({"tr": match.group(0)})
    return links


@dataclass
class LedgerGroup:
    unit: str
    root: dict[str, Any]
    financials: list[dict[str, Any]] = field(default_factory=list)
    external_links: list[dict[str, Any]] = field(default_factory=list)
    counted_value: Decimal = Decimal("0")
    basis: str = ""
    warning: str = ""

    @property
    def tr(self) -> str:
        return str(self.root.get("referencia") or self.root.get("ticket_raiz_instance_id") or "Sem TR")


def fetch_source_data(token: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    unit_sql = ",".join("'" + name.replace("'", "''") + "'" for name in UNITS)
    balances = sql_query(
        token,
        f"""
        select id, ano, unidade, marca, valor
        from public.capex_saldos
        where ano=2026 and unidade in ({unit_sql})
        order by unidade;
        """,
    )
    items = sql_query(
        token,
        f"""
        select c.id, c.ano, c.unidade, c.marca, c.pedido, c.referencia,
               c.setor, c.situacao, c.orcamento, c.aprovado, c.realizado,
               c.observacoes, c.ticket_raiz_url, c.ticket_raiz_instance_id,
               c.origem, c.ticket_raiz_dados, c.created_at, c.updated_at,
               z.flow_name, z.requester_name, z.requester_email, z.etapa_atual,
               z.valor_final as zeev_valor_final, z.start_date_time,
               z.end_date_time, z.last_finished_task_date_time,
               z.ticket_link as zeev_ticket_link
        from public.capex_itens c
        left join lateral (
          select z.*
          from public.capex_zeev_solicitacoes z
          where z.zeev_instance_id=c.ticket_raiz_instance_id
          order by z.updated_at desc nulls last, z.id desc
          limit 1
        ) z on true
        where c.ano=2026 and c.unidade in ({unit_sql})
        order by c.unidade, c.ticket_raiz_instance_id nulls last, c.id;
        """,
    )
    return balances, items


def resolved(row: dict[str, Any]) -> bool:
    return bool(row.get("realizado")) or repair_text(row.get("situacao")).casefold() == "resolvido"


def active_finance_link(link: dict[str, Any]) -> bool:
    status = repair_text(link.get("status") or link.get("situacao")).casefold()
    return not any(term in status for term in ("cancelad", "rejeitad", "excluid"))


def build_groups(items: list[dict[str, Any]]) -> dict[str, list[LedgerGroup]]:
    per_unit: dict[str, list[dict[str, Any]]] = {unit: [] for unit in UNITS}
    for row in items:
        if row.get("unidade") in per_unit:
            row["referencia"] = str(row.get("referencia") or row.get("ticket_raiz_instance_id") or "")
            row["pedido"] = repair_text(row.get("pedido")) or "Descrição não informada"
            row["compra_tr"] = extract_compra_tr(row)
            row["finance_links"] = extract_finance_links(row)
            per_unit[row["unidade"]].append(row)

    result: dict[str, list[LedgerGroup]] = {unit: [] for unit in UNITS}
    for unit, rows in per_unit.items():
        by_tr = {row["referencia"]: row for row in rows if row["referencia"]}
        active_rows = [row for row in rows if resolved(row)]
        child_map: dict[str, list[dict[str, Any]]] = {}
        for row in active_rows:
            parent_tr = row.get("compra_tr") or ""
            if parent_tr:
                child_map.setdefault(parent_tr, []).append(row)

        consumed: set[int] = set()
        for row in active_rows:
            if row["id"] in consumed:
                continue
            parent_tr = row.get("compra_tr") or ""
            if parent_tr and parent_tr in by_tr and resolved(by_tr[parent_tr]):
                continue

            financials = list(child_map.get(row["referencia"], []))
            for child in financials:
                consumed.add(child["id"])

            group = LedgerGroup(unit=unit, root=row, financials=financials)
            explicit_links = {link["tr"]: link for link in row.get("finance_links", [])}
            known_financials = {child["referencia"] for child in financials}
            group.external_links = [link for tr, link in explicit_links.items() if tr not in known_financials]

            # A linked financial TR can be classified in another unit. In that
            # case the financial record remains the value source of truth, so
            # this purchase/facilities parent must not be counted again here.
            external_active_links = [
                link for tr, link in explicit_links.items()
                if tr not in known_financials and active_finance_link(link)
            ]
            if external_active_links and not financials and not parent_tr:
                consumed.add(row["id"])
                continue

            rateio = (row.get("ticket_raiz_dados") or {}).get("rateio") or {}
            manual = MANUAL_VALUE_OVERRIDES.get(row["referencia"])
            if manual:
                group.counted_value, group.basis = manual
                financial_total = sum((dec(child.get("orcamento")) for child in financials), Decimal("0"))
                if financials and financial_total != group.counted_value:
                    group.warning = f"Financeiros registrados somam {money(financial_total)}; mantido o valor final validado."
            elif rateio.get("ativo"):
                group.counted_value = dec(rateio.get("valor") or row.get("orcamento"))
                group.basis = "Cota do rateio consolidado"
            elif financials:
                group.counted_value = sum((dec(child.get("orcamento")) for child in financials), Decimal("0"))
                group.basis = "Soma dos TRs financeiros vinculados"
                root_value = dec(row.get("orcamento"))
                if root_value != group.counted_value:
                    group.warning = f"TR raiz: {money(root_value)}; financeiros: {money(group.counted_value)}."
            else:
                group.counted_value = dec(row.get("orcamento"))
                group.basis = "Valor final do TR"
                if parent_tr:
                    group.external_links.append({"tr": parent_tr, "tipo": "compra"})

            consumed.add(row["id"])
            result[unit].append(group)

        result[unit].sort(key=lambda group: int(group.tr) if group.tr.isdigit() else 10**12)
    return result


def report_payload(balances: list[dict[str, Any]], items: list[dict[str, Any]], cutoff: date) -> dict[str, Any]:
    groups_by_unit = build_groups(items)
    balance_map = {row["unidade"]: dec(row["valor"]) for row in balances}
    units_payload = []
    for unit in UNITS:
        original = balance_map.get(unit, Decimal("0"))
        available = (original / Decimal("1.5")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        groups = groups_by_unit[unit]
        spent = sum((group.counted_value for group in groups), Decimal("0"))
        remaining = available - spent
        raw_active = [row for row in items if row.get("unidade") == unit and resolved(row)]
        entries = []
        for group in groups:
            root = group.root
            dados = root.get("ticket_raiz_dados") or {}
            rateio = dados.get("rateio") or {}
            requester = repair_text(
                ((dados.get("solicitante") or {}).get("nome") if isinstance(dados.get("solicitante"), dict) else "")
                or root.get("requester_name")
                or (dados.get("campos") or {}).get("nomeSolicitante")
                or (dados.get("campos") or {}).get("nomeCompleto")
            )
            resolved_at = root.get("last_finished_task_date_time") or root.get("end_date_time") or root.get("updated_at")
            financials = [
                {
                    "tr": child["referencia"],
                    "value": str(dec(child.get("orcamento"))),
                    "description": repair_text(child.get("pedido")),
                    "status": repair_text(child.get("situacao")),
                }
                for child in group.financials
            ]
            external = []
            for link in group.external_links:
                external.append(
                    {
                        "tr": str(link.get("tr") or ""),
                        "value": str(dec(link.get("valor"))) if link.get("valor") not in (None, "") else None,
                        "type": link.get("tipo") or "vinculo",
                    }
                )
            entries.append(
                {
                    "root_tr": group.tr,
                    "description": repair_text(root.get("pedido")),
                    "counted_value": str(group.counted_value),
                    "root_value": str(dec(root.get("orcamento"))),
                    "basis": group.basis,
                    "warning": group.warning,
                    "requester": requester,
                    "resolved_at": resolved_at,
                    "flow": repair_text(root.get("flow_name")),
                    "rateio": rateio,
                    "financials": financials,
                    "external_links": external,
                }
            )
        units_payload.append(
            {
                "name": unit,
                "original_1_5_percent": str(original),
                "available_1_percent": str(available),
                "spent": str(spent),
                "remaining": str(remaining),
                "usage_percent": float((spent / available * 100) if available else 0),
                "ledger_count": len(entries),
                "raw_resolved_count": len(raw_active),
                "entries": entries,
            }
        )
    return {
        "brand": BRAND_NAME,
        "cycle": 2026,
        "cutoff": cutoff.isoformat(),
        "methodology": {
            "available": "Valor disponibilizado adotado para este relatório executivo.",
            "spent": "Somente registros resolvidos/realizados no CAPEX 2026; TRs financeiros vinculados são consolidados para evitar duplicidade.",
            "manual_overrides": {key: str(value[0]) for key, value in MANUAL_VALUE_OVERRIDES.items()},
        },
        "units": units_payload,
        "totals": {
            "available": str(sum((dec(unit["available_1_percent"]) for unit in units_payload), Decimal("0"))),
            "spent": str(sum((dec(unit["spent"]) for unit in units_payload), Decimal("0"))),
            "remaining": str(sum((dec(unit["remaining"]) for unit in units_payload), Decimal("0"))),
            "ledger_count": sum(unit["ledger_count"] for unit in units_payload),
            "raw_resolved_count": sum(unit["raw_resolved_count"] for unit in units_payload),
        },
    }


def register_fonts() -> None:
    regular = Path("C:/Windows/Fonts/arial.ttf")
    bold = Path("C:/Windows/Fonts/arialbd.ttf")
    pdfmetrics.registerFont(TTFont("CuboSans", str(regular)))
    pdfmetrics.registerFont(TTFont("CuboSans-Bold", str(bold)))


def text_width(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap_lines(text: str, font: str, size: float, max_width: float, max_lines: int | None = None) -> list[str]:
    words = repair_text(text).split()
    if not words:
        return [""]
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if text_width(candidate, font, size) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        if max_lines and len(lines) >= max_lines:
            break
    if current and (not max_lines or len(lines) < max_lines):
        lines.append(current)
    if max_lines and len(lines) == max_lines:
        full = " ".join(words)
        if " ".join(lines) != full:
            last = lines[-1]
            while last and text_width(last + "...", font, size) > max_width:
                last = last[:-1]
            lines[-1] = last.rstrip() + "..."
    return lines


def draw_text_lines(c: canvas.Canvas, lines: list[str], x: float, y: float, font: str, size: float, color: Color, leading: float) -> float:
    c.setFont(font, size)
    c.setFillColor(color)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_right(c: canvas.Canvas, text: str, x: float, y: float, font: str, size: float, color: Color) -> None:
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawRightString(x, y, text)


def round_rect(c: canvas.Canvas, x: float, y: float, w: float, h: float, radius: float, fill: Color, stroke: Color | None = None, line_width: float = 0.7) -> None:
    c.setFillColor(fill)
    if stroke is None:
        c.setStrokeColor(fill)
    else:
        c.setStrokeColor(stroke)
    c.setLineWidth(line_width)
    c.roundRect(x, y, w, h, radius, stroke=1 if stroke else 0, fill=1)


def draw_progress(c: canvas.Canvas, x: float, y: float, w: float, value: float, color: Color) -> None:
    round_rect(c, x, y, w, 4.2, 2.1, GRAY_CARD)
    fill_w = min(w, max(0, w * value / 100))
    if fill_w:
        round_rect(c, x, y, fill_w, 4.2, 2.1, color)


def cropped_logo() -> ImageReader:
    cache_key = (
        f"{LOGO_PATH.resolve()}|outline={LOGO_CONTRAST_OUTLINE}"
        f"|lighten={LOGO_LIGHTEN_ON_DARK}:{LOGO_LIGHTEN_STRENGTH}"
    )
    cached = _LOGO_CACHE.get(cache_key)
    if cached is not None:
        return cached

    source = Image.open(LOGO_PATH).convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.getbbox()
    if bbox == (0, 0, source.width, source.height):
        rgb = source.convert("RGB")
        white_background = Image.new("RGB", rgb.size, "white")
        bbox = ImageChops.difference(rgb, white_background).getbbox()
    if bbox:
        pad = max(2, int(min(source.size) * 0.015))
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(source.width, bbox[2] + pad)
        bottom = min(source.height, bbox[3] + pad)
        source = source.crop((left, top, right, bottom))

    source.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
    if LOGO_LIGHTEN_ON_DARK:
        alpha = source.getchannel("A")
        lightened = Image.blend(
            source.convert("RGB"),
            Image.new("RGB", source.size, "white"),
            LOGO_LIGHTEN_STRENGTH,
        ).convert("RGBA")
        lightened.putalpha(alpha)
        source = lightened
    if LOGO_CONTRAST_OUTLINE:
        radius = max(3, min(15, int(min(source.size) * 0.008)))
        padding = radius * 3
        source = ImageOps.expand(source, border=padding, fill=(0, 0, 0, 0))
        alpha = source.getchannel("A")
        expanded = alpha.filter(ImageFilter.MaxFilter(radius * 2 + 1))
        outline_alpha = ImageChops.subtract(expanded, alpha).filter(ImageFilter.GaussianBlur(1.0))
        outline_alpha = outline_alpha.point(lambda value: int(value * 0.88))
        outline = Image.new("RGBA", source.size, (255, 255, 255, 0))
        outline.putalpha(outline_alpha)
        source = Image.alpha_composite(outline, source)

    image = ImageReader(source)
    _LOGO_CACHE[cache_key] = image
    return image


def draw_logo(c: canvas.Canvas, x: float, y: float, width: float, max_height: float | None = None) -> None:
    image = cropped_logo()
    aspect = image.getSize()[1] / image.getSize()[0]
    height = width * aspect
    if max_height is not None and height > max_height:
        height = max_height
        width = height / aspect
    c.drawImage(image, x, y, width=width, height=height, mask="auto", preserveAspectRatio=True)


def draw_footer(c: canvas.Canvas, page_number: int, cutoff_label: str) -> None:
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(14 * MM, 12 * MM, PAGE_W - 14 * MM, 12 * MM)
    c.setFont("CuboSans", 7.2)
    c.setFillColor(MUTED)
    c.drawString(14 * MM, 7.5 * MM, f"Obras e Real Estate | Base atualizada em {cutoff_label}")
    c.drawRightString(PAGE_W - 14 * MM, 7.5 * MM, f"Página {page_number}")


def draw_metric(c: canvas.Canvas, x: float, y: float, label: str, value: str, color: Color, width: float) -> None:
    c.setFont("CuboSans", 7.1)
    c.setFillColor(MUTED)
    c.drawString(x, y, label.upper())
    size = 13.5
    while size > 9 and text_width(value, "CuboSans-Bold", size) > width:
        size -= 0.5
    c.setFont("CuboSans-Bold", size)
    c.setFillColor(color)
    c.drawString(x, y - 15, value)


def draw_cover_unit_card(
    c: canvas.Canvas,
    unit: dict[str, Any],
    x: float,
    y: float,
    width: float,
    height: float,
    accent: Color,
    density: str,
) -> None:
    remaining = dec(unit["remaining"])
    usage = float(unit["usage_percent"])
    bar_color = CORAL if usage > 100 else accent
    round_rect(c, x, y, width, height, 4 * MM, white, LINE)
    strip_h = 5 * MM if density == "full" else (3 * MM if density == "compact" else 2.2 * MM)
    c.setFillColor(accent)
    c.roundRect(x, y + height - strip_h, width, strip_h, 3.5 * MM, stroke=0, fill=1)
    c.rect(x, y + height - strip_h, width, strip_h / 2, stroke=0, fill=1)

    if density == "full":
        title_lines = wrap_lines(unit["name"], "CuboSans-Bold", 11.2, width - 12 * MM, 2)
        draw_text_lines(c, title_lines, x + 6 * MM, y + height - 12 * MM, "CuboSans-Bold", 11.2, INK, 11.8)
        count_text = f"{unit['ledger_count']} lancamento" + ("s" if unit["ledger_count"] != 1 else "")
        count_w = text_width(count_text, "CuboSans-Bold", 6.7) + 5 * MM
        round_rect(c, x + width - count_w - 6 * MM, y + height - 25.5 * MM, count_w, 5.5 * MM, 2.7 * MM, GRAY_CARD)
        c.setFont("CuboSans-Bold", 6.7)
        c.setFillColor(MUTED)
        c.drawCentredString(x + width - count_w / 2 - 6 * MM, y + height - 23.7 * MM, count_text)

        half = (width - 14 * MM) / 2
        draw_metric(c, x + 6 * MM, y + height - 30 * MM, "CAPEX disponibilizado", money(unit["available_1_percent"]), PURPLE, half - 2 * MM)
        draw_metric(c, x + 8 * MM + half, y + height - 30 * MM, "Gasto consolidado", money(unit["spent"]), TEAL_DARK, half - 2 * MM)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(x + 6 * MM, y + 23 * MM, x + width - 6 * MM, y + 23 * MM)
        c.setFont("CuboSans", 7.1)
        c.setFillColor(MUTED)
        c.drawString(x + 6 * MM, y + 18.5 * MM, "SALDO DISPONIVEL")
        c.setFont("CuboSans-Bold", 15)
        c.setFillColor(CORAL if remaining < 0 else GREEN)
        c.drawString(x + 6 * MM, y + 12.3 * MM, money(remaining))
        draw_progress(c, x + 6 * MM, y + 6.8 * MM, width - 12 * MM, usage, bar_color)
        c.setFont("CuboSans-Bold", 7.2)
        c.setFillColor(bar_color)
        c.drawString(x + 6 * MM, y + 2.6 * MM, f"{usage:.1f}% utilizado".replace(".", ","))
        c.setFont("CuboSans", 6.8)
        c.setFillColor(SOFT)
        c.drawRightString(x + width - 6 * MM, y + 2.6 * MM, "gasto / disponibilizado")
        return

    title_size = 8.8 if density == "compact" else 7.4
    title_lines = wrap_lines(unit["name"], "CuboSans-Bold", title_size, width - 10 * MM, 2 if density == "compact" else 1)
    draw_text_lines(
        c,
        title_lines,
        x + 5 * MM,
        y + height - (7.5 * MM if density == "compact" else 5.7 * MM),
        "CuboSans-Bold",
        title_size,
        INK,
        title_size + 1.2,
    )
    metric_top = y + (20.5 * MM if density == "compact" else 11.8 * MM)
    labels = ("DISPONIBILIZADO", "GASTO", "SALDO") if density == "compact" else ("DISP.", "GASTO", "SALDO")
    values = (money(unit["available_1_percent"]), money(unit["spent"]), money(remaining))
    colors = (PURPLE, TEAL_DARK, CORAL if remaining < 0 else GREEN)
    column_w = (width - 10 * MM) / 3
    for index, (label, value, color) in enumerate(zip(labels, values, colors)):
        metric_x = x + 5 * MM + column_w * index
        c.setFont("CuboSans-Bold", 5.2 if density == "compact" else 4.7)
        c.setFillColor(MUTED)
        c.drawString(metric_x, metric_top, label)
        value_size = 9.2 if density == "compact" else 7.2
        while value_size > 6 and text_width(value, "CuboSans-Bold", value_size) > column_w - 2 * MM:
            value_size -= 0.3
        c.setFont("CuboSans-Bold", value_size)
        c.setFillColor(color)
        c.drawString(metric_x, metric_top - (5 * MM if density == "compact" else 3.8 * MM), value)
    if density == "compact":
        draw_progress(c, x + 5 * MM, y + 5.2 * MM, width - 10 * MM, usage, bar_color)
        c.setFont("CuboSans-Bold", 6)
        c.setFillColor(bar_color)
        c.drawString(x + 5 * MM, y + 1.8 * MM, f"{usage:.1f}% utilizado".replace(".", ","))


def draw_cover(c: canvas.Canvas, payload: dict[str, Any], cutoff_label: str, page_number: int) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(PURPLE_DARK)
    c.rect(0, PAGE_H - 58 * MM, PAGE_W, 58 * MM, stroke=0, fill=1)
    c.setFillColor(TEAL)
    c.rect(0, PAGE_H - 58 * MM, 8 * MM, 58 * MM, stroke=0, fill=1)
    c.rect(8 * MM, PAGE_H - 58 * MM, PAGE_W - 8 * MM, 1.2 * MM, stroke=0, fill=1)

    draw_logo(
        c,
        16 * MM,
        PAGE_H - 30 * MM,
        COVER_LOGO_WIDTH_MM * MM,
        COVER_LOGO_MAX_HEIGHT_MM * MM,
    )

    c.setFont("CuboSans-Bold", 27)
    c.setFillColor(HEADER_TEXT)
    title_x = 16 * MM
    title_y = PAGE_H - 47 * MM
    c.drawString(title_x, title_y, "CAPEX")
    year_x = title_x + text_width("CAPEX", "CuboSans-Bold", 27) + 4 * MM
    c.setFillColor(TEAL)
    c.drawString(year_x, title_y, "2026")

    date_right = PAGE_W - 16 * MM
    date_y = PAGE_H - 54 * MM
    date_label = "DATA DE CORTE:"
    date_period = "04/01/2026 ATÉ 11/08/2026"
    date_gap = 1.4 * MM
    date_start = date_right - text_width(date_label, "CuboSans-Bold", 6) - date_gap - text_width(date_period, "CuboSans", 6.4)
    c.setFont("CuboSans-Bold", 6)
    c.setFillColor(TEAL)
    c.drawString(date_start, date_y, date_label)
    c.setFont("CuboSans", 6.4)
    c.setFillColor(HEADER_META)
    c.drawString(date_start + text_width(date_label, "CuboSans-Bold", 6) + date_gap, date_y, date_period)

    totals = payload["totals"]
    summary_y = PAGE_H - 81 * MM
    round_rect(c, 14 * MM, summary_y, PAGE_W - 28 * MM, 18 * MM, 4 * MM, white, LINE)
    metric_width = (PAGE_W - 40 * MM) / 3
    draw_metric(c, 20 * MM, summary_y + 11.7 * MM, "Disponibilizado", money(totals["available"]), PURPLE, metric_width)
    draw_metric(c, 20 * MM + metric_width, summary_y + 11.7 * MM, "Gasto consolidado", money(totals["spent"]), TEAL_DARK, metric_width)
    total_remaining = dec(totals["remaining"])
    draw_metric(c, 20 * MM + metric_width * 2, summary_y + 11.7 * MM, "Saldo", money(total_remaining), CORAL if total_remaining < 0 else GREEN, metric_width)

    c.setFont("CuboSans-Bold", 10)
    c.setFillColor(INK)
    c.drawString(14 * MM, PAGE_H - 91 * MM, "Visão por unidade")
    c.setFont("CuboSans", 7.5)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - 14 * MM, PAGE_H - 91 * MM, f"{totals['ledger_count']} lançamentos consolidados")

    card_w = (PAGE_W - 34 * MM) / 2
    card_h = 61 * MM
    card_xs = [14 * MM, 20 * MM + card_w]
    card_ys = [PAGE_H - 158 * MM, PAGE_H - 224 * MM]
    accent_colors = [TEAL, PURPLE, PURPLE, TEAL]
    for index, unit in enumerate(payload["units"]):
        x = card_xs[index % 2]
        y = card_ys[index // 2]
        accent = accent_colors[index]
        remaining = dec(unit["remaining"])
        usage = float(unit["usage_percent"])
        bar_color = CORAL if usage > 100 else accent
        round_rect(c, x, y, card_w, card_h, 4 * MM, white, LINE)
        c.setFillColor(accent)
        c.roundRect(x, y + card_h - 5 * MM, card_w, 5 * MM, 4 * MM, stroke=0, fill=1)
        c.rect(x, y + card_h - 5 * MM, card_w, 2.5 * MM, stroke=0, fill=1)

        title_lines = wrap_lines(unit["name"], "CuboSans-Bold", 11.2, card_w - 12 * MM, 2)
        draw_text_lines(c, title_lines, x + 6 * MM, y + card_h - 12 * MM, "CuboSans-Bold", 11.2, INK, 11.8)
        count_text = f"{unit['ledger_count']} lançamento" + ("s" if unit["ledger_count"] != 1 else "")
        count_w = text_width(count_text, "CuboSans-Bold", 6.7) + 5 * MM
        round_rect(c, x + card_w - count_w - 6 * MM, y + card_h - 25.5 * MM, count_w, 5.5 * MM, 2.7 * MM, GRAY_CARD)
        c.setFont("CuboSans-Bold", 6.7)
        c.setFillColor(MUTED)
        c.drawCentredString(x + card_w - count_w / 2 - 6 * MM, y + card_h - 23.7 * MM, count_text)

        half = (card_w - 14 * MM) / 2
        draw_metric(c, x + 6 * MM, y + card_h - 30 * MM, "CAPEX disponibilizado", money(unit["available_1_percent"]), PURPLE, half - 2 * MM)
        draw_metric(c, x + 8 * MM + half, y + card_h - 30 * MM, "Gasto consolidado", money(unit["spent"]), TEAL_DARK, half - 2 * MM)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(x + 6 * MM, y + 23 * MM, x + card_w - 6 * MM, y + 23 * MM)
        c.setFont("CuboSans", 7.1)
        c.setFillColor(MUTED)
        c.drawString(x + 6 * MM, y + 18.5 * MM, "SALDO DISPONÍVEL")
        c.setFont("CuboSans-Bold", 15)
        c.setFillColor(CORAL if remaining < 0 else GREEN)
        c.drawString(x + 6 * MM, y + 12.3 * MM, money(remaining))

        draw_progress(c, x + 6 * MM, y + 6.8 * MM, card_w - 12 * MM, usage, bar_color)
        c.setFont("CuboSans-Bold", 7.2)
        c.setFillColor(bar_color)
        c.drawString(x + 6 * MM, y + 2.6 * MM, f"{usage:.1f}% utilizado".replace(".", ","))
        c.setFont("CuboSans", 6.8)
        c.setFillColor(SOFT)
        c.drawRightString(x + card_w - 6 * MM, y + 2.6 * MM, "gasto / disponibilizado")

    note_y = 18 * MM
    round_rect(c, 14 * MM, note_y, PAGE_W - 28 * MM, 20 * MM, 3 * MM, PURPLE_PALE)
    c.setFont("CuboSans-Bold", 7.4)
    c.setFillColor(PURPLE)
    c.drawString(19 * MM, note_y + 13.2 * MM, "CRITÉRIO DO MODELO")
    note = (
        "O gasto considera somente registros resolvidos/realizados. TRs financeiros vinculados são consolidados com o pedido principal, "
        "evitando somar compra e pagamento duas vezes."
    )
    note_lines = wrap_lines(note, "CuboSans", 7.3, PAGE_W - 40 * MM, 2)
    draw_text_lines(c, note_lines, 19 * MM, note_y + 8.3 * MM, "CuboSans", 7.3, INK, 9)
    draw_footer(c, page_number, cutoff_label)


def draw_cover_dynamic(c: canvas.Canvas, payload: dict[str, Any], cutoff_label: str, page_number: int) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(PURPLE_DARK)
    c.rect(0, PAGE_H - 58 * MM, PAGE_W, 58 * MM, stroke=0, fill=1)
    c.setFillColor(TEAL)
    c.rect(0, PAGE_H - 58 * MM, 8 * MM, 58 * MM, stroke=0, fill=1)
    c.rect(8 * MM, PAGE_H - 58 * MM, PAGE_W - 8 * MM, 1.2 * MM, stroke=0, fill=1)
    draw_logo(
        c,
        16 * MM,
        PAGE_H - 30 * MM,
        COVER_LOGO_WIDTH_MM * MM,
        COVER_LOGO_MAX_HEIGHT_MM * MM,
    )

    c.setFont("CuboSans-Bold", 27)
    c.setFillColor(HEADER_TEXT)
    title_x = 16 * MM
    title_y = PAGE_H - 47 * MM
    c.drawString(title_x, title_y, "CAPEX")
    year_x = title_x + text_width("CAPEX", "CuboSans-Bold", 27) + 4 * MM
    c.setFillColor(TEAL)
    c.drawString(year_x, title_y, "2026")

    date_right = PAGE_W - 16 * MM
    date_y = PAGE_H - 54 * MM
    date_label = "DATA DE CORTE:"
    date_period = "04/01/2026 ATE 11/08/2026"
    date_gap = 1.4 * MM
    date_start = date_right - text_width(date_label, "CuboSans-Bold", 6) - date_gap - text_width(date_period, "CuboSans", 6.4)
    c.setFont("CuboSans-Bold", 6)
    c.setFillColor(TEAL)
    c.drawString(date_start, date_y, date_label)
    c.setFont("CuboSans", 6.4)
    c.setFillColor(HEADER_META)
    c.drawString(date_start + text_width(date_label, "CuboSans-Bold", 6) + date_gap, date_y, date_period)

    totals = payload["totals"]
    summary_y = PAGE_H - 81 * MM
    round_rect(c, 14 * MM, summary_y, PAGE_W - 28 * MM, 18 * MM, 4 * MM, white, LINE)
    metric_width = (PAGE_W - 40 * MM) / 3
    draw_metric(c, 20 * MM, summary_y + 11.7 * MM, "Disponibilizado", money(totals["available"]), PURPLE, metric_width)
    draw_metric(c, 20 * MM + metric_width, summary_y + 11.7 * MM, "Gasto consolidado", money(totals["spent"]), TEAL_DARK, metric_width)
    total_remaining = dec(totals["remaining"])
    draw_metric(c, 20 * MM + metric_width * 2, summary_y + 11.7 * MM, "Saldo", money(total_remaining), CORAL if total_remaining < 0 else GREEN, metric_width)

    c.setFont("CuboSans-Bold", 10)
    c.setFillColor(INK)
    c.drawString(14 * MM, PAGE_H - 91 * MM, "Visao por unidade")
    c.setFont("CuboSans", 7.5)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - 14 * MM, PAGE_H - 91 * MM, f"{totals['ledger_count']} lancamentos consolidados")

    card_w = (PAGE_W - 34 * MM) / 2
    card_xs = [14 * MM, 20 * MM + card_w]
    row_count = max(1, (len(payload["units"]) + 1) // 2)
    if row_count <= 2:
        card_h = 61 * MM
        gap = 5 * MM
        density = "full"
    else:
        gap = 4.5 * MM
        card_h = (152 * MM - gap * (row_count - 1)) / row_count
        density = "compact" if row_count == 3 else "dense"
    cards_top = PAGE_H - 97 * MM
    accent_colors = [TEAL, PURPLE]
    for index, unit in enumerate(payload["units"]):
        x = card_xs[index % 2]
        row = index // 2
        y = cards_top - card_h - row * (card_h + gap)
        draw_cover_unit_card(c, unit, x, y, card_w, card_h, accent_colors[index % 2], density)

    note_y = 18 * MM
    round_rect(c, 14 * MM, note_y, PAGE_W - 28 * MM, 20 * MM, 3 * MM, PURPLE_PALE)
    c.setFont("CuboSans-Bold", 7.4)
    c.setFillColor(PURPLE)
    c.drawString(19 * MM, note_y + 13.2 * MM, "CRITERIO DO MODELO")
    note = (
        "O gasto considera somente registros resolvidos/realizados. TRs financeiros vinculados sao consolidados com o pedido principal, "
        "evitando somar compra e pagamento duas vezes."
    )
    note_lines = wrap_lines(note, "CuboSans", 7.3, PAGE_W - 40 * MM, 2)
    draw_text_lines(c, note_lines, 19 * MM, note_y + 8.3 * MM, "CuboSans", 7.3, INK, 9)
    draw_footer(c, page_number, cutoff_label)


def entry_height(entry: dict[str, Any], body_width: float) -> float:
    description_lines = wrap_lines(entry["description"], "CuboSans", 7.8, body_width - 12 * MM, 4)
    links = len(entry.get("financials", [])) + len(entry.get("external_links", []))
    warning = bool(entry.get("warning"))
    return 34 * MM + max(0, len(description_lines) - 1) * 3.2 * MM + (10 * MM if links else 0) + (8 * MM if warning else 0)


def draw_unit_header(c: canvas.Canvas, unit: dict[str, Any], page_number: int, cutoff_label: str, continuation: bool) -> float:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(PURPLE_DARK)
    c.rect(0, PAGE_H - 31 * MM, PAGE_W, 31 * MM, stroke=0, fill=1)
    c.setFillColor(TEAL)
    c.rect(0, PAGE_H - 31 * MM, 5 * MM, 31 * MM, stroke=0, fill=1)
    draw_logo(
        c,
        12 * MM,
        PAGE_H - 18.5 * MM,
        DETAIL_LOGO_WIDTH_MM * MM,
        DETAIL_LOGO_MAX_HEIGHT_MM * MM,
    )
    c.setFont("CuboSans-Bold", 14)
    c.setFillColor(HEADER_TEXT)
    title = unit["name"] + (" | continuação" if continuation else "")
    title_lines = wrap_lines(title, "CuboSans-Bold", 14, 122 * MM, 2)
    draw_text_lines(c, title_lines, 72 * MM, PAGE_H - 14 * MM, "CuboSans-Bold", 14, HEADER_TEXT, 15)
    c.setFont("CuboSans", 7.4)
    c.setFillColor(HEADER_META)
    c.drawString(72 * MM, PAGE_H - 24 * MM, "Composição auditável do valor gasto | CAPEX 2026")

    y = PAGE_H - 45 * MM
    round_rect(c, 14 * MM, y, PAGE_W - 28 * MM, 17 * MM, 3 * MM, white, LINE)
    third = (PAGE_W - 40 * MM) / 3
    draw_metric(c, 20 * MM, y + 11.2 * MM, "Disponibilizado", money(unit["available_1_percent"]), PURPLE, third)
    draw_metric(c, 20 * MM + third, y + 11.2 * MM, "Gasto", money(unit["spent"]), TEAL_DARK, third)
    remaining = dec(unit["remaining"])
    draw_metric(c, 20 * MM + third * 2, y + 11.2 * MM, "Saldo", money(remaining), CORAL if remaining < 0 else GREEN, third)
    draw_footer(c, page_number, cutoff_label)
    return y - 9 * MM


def draw_link_pills(c: canvas.Canvas, links: list[tuple[str, str]], x: float, y: float, max_width: float) -> float:
    cursor_x = x
    for label, value in links:
        text = label + (f" | {value}" if value else "")
        pill_w = text_width(text, "CuboSans-Bold", 6.7) + 6 * MM
        if cursor_x + pill_w > x + max_width:
            y -= 7 * MM
            cursor_x = x
        fill = TEAL_PALE if label.startswith("Financeiro") else PURPLE_PALE
        color = TEAL_DARK if label.startswith("Financeiro") else PURPLE
        round_rect(c, cursor_x, y - 4.5 * MM, pill_w, 5.5 * MM, 2.7 * MM, fill)
        c.setFont("CuboSans-Bold", 6.7)
        c.setFillColor(color)
        c.drawString(cursor_x + 3 * MM, y - 2.6 * MM, text)
        cursor_x += pill_w + 2 * MM
    return y - 6 * MM


def draw_entry(c: canvas.Canvas, entry: dict[str, Any], x: float, top_y: float, width: float) -> float:
    height = entry_height(entry, width)
    y = top_y - height
    round_rect(c, x, y, width, height, 3 * MM, white, LINE)
    c.setFillColor(TEAL)
    c.roundRect(x, y, 2.2 * MM, height, 1.1 * MM, stroke=0, fill=1)

    pill_text = f"TR {entry['root_tr']}"
    pill_w = text_width(pill_text, "CuboSans-Bold", 7.2) + 6 * MM
    round_rect(c, x + 6 * MM, top_y - 9 * MM, pill_w, 6 * MM, 3 * MM, PURPLE_PALE)
    c.setFont("CuboSans-Bold", 7.2)
    c.setFillColor(PURPLE)
    c.drawString(x + 9 * MM, top_y - 7.1 * MM, pill_text)

    draw_right(c, money(entry["counted_value"]), x + width - 6 * MM, top_y - 6.6 * MM, "CuboSans-Bold", 11.5, TEAL_DARK)
    draw_right(c, entry["basis"], x + width - 6 * MM, top_y - 11.2 * MM, "CuboSans", 6.4, MUTED)

    c.setStrokeColor(LINE)
    c.setLineWidth(0.55)
    c.line(x + 6 * MM, top_y - 13.5 * MM, x + width - 6 * MM, top_y - 13.5 * MM)
    c.setFont("CuboSans-Bold", 6.1)
    c.setFillColor(MUTED)
    c.drawString(x + 6 * MM, top_y - 18 * MM, "INFORMAÇÕES REFERENTES À SOLICITAÇÃO")

    desc_y = top_y - 22 * MM
    desc_lines = wrap_lines(entry["description"], "CuboSans", 7.8, width - 12 * MM, 4)
    desc_y = draw_text_lines(c, desc_lines, x + 6 * MM, desc_y, "CuboSans", 7.8, INK, 9.1)
    requester = repair_text(entry.get("requester")) or "Não informado"
    date_label = "Não informada"
    if entry.get("resolved_at"):
        try:
            dt = datetime.fromisoformat(str(entry["resolved_at"]).replace("Z", "+00:00"))
            date_label = dt.strftime("%d/%m/%Y")
        except ValueError:
            date_label = repair_text(entry["resolved_at"])

    meta_y = desc_y - 1.2 * MM
    meta_split = x + 112 * MM
    c.setFont("CuboSans-Bold", 5.9)
    c.setFillColor(SOFT)
    c.drawString(x + 6 * MM, meta_y, "SOLICITANTE")
    c.drawString(meta_split, meta_y, "CONCLUSÃO / ATUALIZAÇÃO")
    c.setFont("CuboSans", 6.8)
    c.setFillColor(MUTED)
    requester_line = wrap_lines(requester, "CuboSans", 6.8, 100 * MM, 1)[0]
    c.drawString(x + 6 * MM, meta_y - 3.5 * MM, requester_line)
    c.drawString(meta_split, meta_y - 3.5 * MM, date_label)
    desc_y = meta_y - 7.2 * MM

    links: list[tuple[str, str]] = []
    for child in entry.get("financials", []):
        links.append((f"Financeiro TR {child['tr']}", money(child["value"])))
    for link in entry.get("external_links", []):
        kind = "Compra" if link.get("type") == "compra" else "Vínculo"
        links.append((f"{kind} TR {link['tr']}", money(link["value"]) if link.get("value") else ""))
    if links:
        c.setFont("CuboSans-Bold", 5.9)
        c.setFillColor(SOFT)
        c.drawString(x + 6 * MM, desc_y, "VÍNCULOS DO LANÇAMENTO")
        desc_y = draw_link_pills(c, links, x + 6 * MM, desc_y - 3 * MM, width - 12 * MM)

    if entry.get("warning"):
        round_rect(c, x + 6 * MM, y + 4 * MM, width - 12 * MM, 6 * MM, 2 * MM, CORAL_PALE)
        c.setFont("CuboSans-Bold", 6.4)
        c.setFillColor(CORAL)
        warning = wrap_lines(entry["warning"], "CuboSans-Bold", 6.4, width - 18 * MM, 1)[0]
        c.drawString(x + 9 * MM, y + 6.1 * MM, warning)
    return y - 4 * MM


def generate_pdf(payload: dict[str, Any], output: Path) -> None:
    register_fonts()
    output.parent.mkdir(parents=True, exist_ok=True)
    cutoff = datetime.strptime(payload["cutoff"], "%Y-%m-%d").strftime("%d/%m/%Y")
    c = canvas.Canvas(str(output), pagesize=A4, pageCompression=1)
    c.setTitle(f"CAPEX 2026 | {payload['brand']}")
    c.setAuthor("Obras e Real Estate | Raiz Educação")
    c.setSubject("Memória de cálculo dos TRs resolvidos")

    page_number = 1
    draw_cover_dynamic(c, payload, cutoff, page_number)
    c.showPage()

    for unit in payload["units"]:
        entries = unit["entries"]
        if not entries:
            page_number += 1
            y = draw_unit_header(c, unit, page_number, cutoff, False)
            round_rect(c, 14 * MM, y - 28 * MM, PAGE_W - 28 * MM, 25 * MM, 3 * MM, TEAL_PALE)
            c.setFont("CuboSans-Bold", 11)
            c.setFillColor(TEAL_DARK)
            c.drawString(20 * MM, y - 13 * MM, "Nenhum gasto resolvido no ciclo até a data de corte.")
            c.setFont("CuboSans", 7.5)
            c.setFillColor(MUTED)
            c.drawString(20 * MM, y - 19 * MM, "Os registros cancelados ou ainda não realizados não compõem o valor gasto deste relatório.")
            c.showPage()
            continue

        body_width = PAGE_W - 28 * MM
        available_height = (PAGE_H - 54 * MM) - 18 * MM
        page_groups: list[list[dict[str, Any]]] = [[]]
        used_height = 0.0
        for entry in entries:
            needed = entry_height(entry, body_width) + 4 * MM
            if page_groups[-1] and used_height + needed > available_height:
                page_groups.append([])
                used_height = 0.0
            page_groups[-1].append(entry)
            used_height += needed

        if len(page_groups) > 1:
            if len(page_groups[-1]) == 1 and len(page_groups[-2]) > 2:
                page_groups[-1].insert(0, page_groups[-2].pop())
            while len(page_groups[-1]) < 3 and len(page_groups[-2]) > 4:
                page_groups[-1].insert(0, page_groups[-2].pop())

        for group_index, page_entries in enumerate(page_groups):
            page_number += 1
            y = draw_unit_header(c, unit, page_number, cutoff, group_index > 0)
            for entry in page_entries:
                y = draw_entry(c, entry, 14 * MM, y, body_width)
            c.showPage()

    c.save()


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera o modelo de relatório CAPEX 1% da marca Cubo Global School.")
    parser.add_argument("--token-file", type=Path, default=DEFAULT_TOKEN_FILE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--data-output", type=Path, default=DEFAULT_DATA_OUTPUT)
    parser.add_argument("--cutoff", default="2026-08-11")
    args = parser.parse_args()

    token = args.token_file.read_text(encoding="utf-8").strip()
    balances, items = fetch_source_data(token)
    payload = report_payload(balances, items, datetime.strptime(args.cutoff, "%Y-%m-%d").date())
    args.data_output.parent.mkdir(parents=True, exist_ok=True)
    args.data_output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    generate_pdf(payload, args.output)
    print(json.dumps({"pdf": str(args.output), "data": str(args.data_output), "totals": payload["totals"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
