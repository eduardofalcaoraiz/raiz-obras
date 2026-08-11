from __future__ import annotations

import argparse
import json
import re
from datetime import datetime

from reportlab.lib.colors import HexColor

import generate_cubo_capex_1pct_report as report


OUTPUT_DIR = report.PROJECT_ROOT / "output" / "pdf" / "capex_2026_marcas_20260811"
DATA_DIR = report.PROJECT_ROOT / "outputs" / "capex_2026_brand_reports_20260811"
CUTOFF = datetime.strptime("2026-08-11", "%Y-%m-%d").date()


BRANDS = {
    "AMERICANO": {
        "name": "Colégio Americano",
        "logo": "LOGO DO AMERICANO.png",
        "primary": "#0868B8",
        "header": "#0868B8",
        "logo_adapt_to_header": True,
        "cover_logo_width_mm": 74,
        "cover_logo_max_height_mm": 24,
        "detail_logo_width_mm": 48,
        "detail_logo_max_height_mm": 16,
        "accent": "#19A982",
        "pale": "#D2E3F2",
    },
    "APOGEU": {
        "name": "Apogeu Global School",
        "logo": "LOGO DO APOGEU GLOBAL SCHOOL.png",
        "primary": "#0848B8",
        "header": "#0848B8",
        "logo_adapt_to_header": True,
        "cover_logo_width_mm": 74,
        "cover_logo_max_height_mm": 24,
        "detail_logo_width_mm": 48,
        "detail_logo_max_height_mm": 16,
        "accent": "#F3B52B",
        "pale": "#D2DEF2",
    },
    "CUBO": {
        "name": "Cubo Global School",
        "logo": "LOGO DO CUBO GLOBAL SCHOOL.png",
        "primary": "#4D2A91",
        "header": "#352064",
        "accent": "#00B8B5",
        "pale": "#F0ECF8",
    },
    "GLOBAL TREE": {
        "name": "Global Tree",
        "logo": "LOGO DA GLOBAL TREE.png",
        "primary": "#5E8739",
        "header": "#29462F",
        "accent": "#88B858",
        "pale": "#E9F2E0",
    },
    "LEONARDO DA VINCI": {
        "name": "Leonardo da Vinci",
        "logo": "LOGO DO LEONARDO DA VINCI.png",
        "primary": "#C95408",
        "header": "#592A14",
        "accent": "#F39A2E",
        "pale": "#FAE3D2",
    },
    "MATRIZ": {
        "name": "Matriz Educação",
        "logo": "LOGO DO MATRIZ EDUCAÇÃO.png",
        "primary": "#2268B7",
        "header": "#F1FAFC",
        "header_text": "#2268B7",
        "header_meta": "#357A8C",
        "cover_logo_width_mm": 74,
        "cover_logo_max_height_mm": 25,
        "detail_logo_width_mm": 48,
        "detail_logo_max_height_mm": 16,
        "accent": "#27D99A",
        "pale": "#E3F8F1",
    },
    "QI": {
        "name": "Colégio QI",
        "logo": "LOGO DO QI.png",
        "primary": "#F4152A",
        "header": "#FFF7F8",
        "header_text": "#D41126",
        "header_meta": "#A91424",
        "cover_logo_width_mm": 72,
        "cover_logo_max_height_mm": 23,
        "detail_logo_width_mm": 47,
        "detail_logo_max_height_mm": 15,
        "accent": "#F4152A",
        "pale": "#FDE8EB",
    },
    "SÁ PEREIRA": {
        "name": "Sá Pereira",
        "logo": "LOGO DO SÁ PEREIRA.png",
        "primary": "#0878C8",
        "header": "#F5FAFE",
        "header_text": "#0878C8",
        "header_meta": "#356A98",
        "cover_logo_width_mm": 74,
        "cover_logo_max_height_mm": 24,
        "detail_logo_width_mm": 48,
        "detail_logo_max_height_mm": 16,
        "accent": "#F7BF3F",
        "pale": "#E7F3FC",
    },
    "SAP": {
        "name": "SAP",
        "logo": "LOGO DO SAP.png",
        "primary": "#205995",
        "header": "#FFF9F6",
        "header_text": "#171717",
        "header_meta": "#5F5F5F",
        "cover_logo_width_mm": 74,
        "cover_logo_max_height_mm": 24,
        "detail_logo_width_mm": 48,
        "detail_logo_max_height_mm": 16,
        "accent": "#F15A3A",
        "pale": "#FBE8E1",
    },
    "SARAH DAWSEY": {
        "name": "Sarah Dawsey",
        "logo": "LOGO DO SARAH DAWSEY.png",
        "primary": "#1D477A",
        "header": "#EAF6FC",
        "header_text": "#1D477A",
        "header_meta": "#315F83",
        "cover_logo_width_mm": 72,
        "cover_logo_max_height_mm": 24,
        "detail_logo_width_mm": 47,
        "detail_logo_max_height_mm": 16,
        "accent": "#C7A900",
        "pale": "#D9EFFA",
    },
    "UNIÃO": {
        "name": "Colégio União",
        "logo": "LOGO DO UNIÃO.png",
        "primary": "#B72E35",
        "header": "#5B2228",
        "accent": "#23679A",
        "pale": "#F5DBDB",
    },
    "UNIFICADO": {
        "name": "Colégio Unificado",
        "logo": "LOGO DO UNIFICADO.png",
        "primary": "#582878",
        "header": "#F1F1F2",
        "header_text": "#582878",
        "header_meta": "#626262",
        "cover_logo_width_mm": 74,
        "cover_logo_max_height_mm": 24,
        "detail_logo_width_mm": 48,
        "detail_logo_max_height_mm": 16,
        "accent": "#626262",
        "pale": "#E8E5EB",
    },
}


def safe_name(value: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "-", value).strip()


def configure(config: dict[str, object], units: list[str]) -> None:
    primary = HexColor(str(config["primary"]))
    accent = HexColor(str(config["accent"]))
    pale = HexColor(str(config["pale"]))
    report.BRAND_NAME = str(config["name"])
    report.LOGO_PATH = report.PROJECT_ROOT / str(config["logo"])
    report.UNITS = units
    report.PURPLE = primary
    report.PURPLE_DARK = HexColor(str(config["header"]))
    report.PURPLE_PALE = pale
    report.TEAL = accent
    report.TEAL_DARK = primary
    report.TEAL_PALE = pale
    report.HEADER_TEXT = HexColor(str(config.get("header_text", "#FFFFFF")))
    report.HEADER_META = HexColor(str(config.get("header_meta", "#E7E3F0")))
    report.COVER_LOGO_WIDTH_MM = float(config.get("cover_logo_width_mm", 60))
    report.COVER_LOGO_MAX_HEIGHT_MM = float(config.get("cover_logo_max_height_mm", 22))
    report.DETAIL_LOGO_WIDTH_MM = float(config.get("detail_logo_width_mm", 40))
    report.DETAIL_LOGO_MAX_HEIGHT_MM = float(config.get("detail_logo_max_height_mm", 15))
    report.LOGO_ADAPT_TO_HEADER = bool(config.get("logo_adapt_to_header", False))
    report.LOGO_HEADER_COLOR = str(config["header"])
    report.LOGO_MIN_CONTRAST = float(config.get("logo_min_contrast", 3.0))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate CAPEX 2026 brand reports")
    parser.add_argument(
        "--brands",
        nargs="+",
        choices=tuple(BRANDS),
        help="Generate only the selected brand keys and preserve all other PDFs.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    selected = set(args.brands or BRANDS)
    token = report.DEFAULT_TOKEN_FILE.read_text(encoding="utf-8").strip()
    balances = report.sql_query(
        token,
        """
        select id, ano, unidade, marca, valor
        from public.capex_saldos
        where ano=2026
        order by marca, unidade;
        """,
    )
    brands_found: dict[str, list[str]] = {}
    for row in balances:
        brands_found.setdefault(str(row["marca"]), []).append(str(row["unidade"]))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = DATA_DIR / "manifest.json"
    existing_manifest = []
    if manifest_path.exists():
        existing_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest_by_brand = {str(item["brand"]): item for item in existing_manifest}
    for brand_key, config in BRANDS.items():
        if brand_key not in selected:
            continue
        units = sorted(set(brands_found.get(brand_key, [])))
        if not units:
            raise RuntimeError(f"No CAPEX 2026 units found for brand {brand_key}")
        configure(config, units)
        brand_balances, items = report.fetch_source_data(token)
        payload = report.report_payload(brand_balances, items, CUTOFF)
        filename = safe_name(f"CAPEX 2026 - {config['name']} - 11-08-2026.pdf")
        output = OUTPUT_DIR / filename
        data_output = DATA_DIR / filename.replace(".pdf", ".json")
        data_output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        report.generate_pdf(payload, output)
        item = {
            "brand": config["name"],
            "pdf": str(output),
            "data": str(data_output),
            "units": len(units),
            "totals": payload["totals"],
        }
        manifest_by_brand[str(config["name"])] = item
        print(json.dumps(item, ensure_ascii=False))

    manifest = [manifest_by_brand[str(config["name"])] for config in BRANDS.values()]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"manifest": str(manifest_path), "reports": len(manifest)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
