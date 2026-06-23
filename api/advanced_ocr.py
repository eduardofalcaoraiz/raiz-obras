import base64
import io
import json
import os
import re
import traceback
from http.server import BaseHTTPRequestHandler
from typing import Any


_RAPID_ENGINE = None
_TOKEN_SHA256 = "ebca3c48b62ba9919e77f191eff3d8ede5cedb42d3221a28e2545e01ad40ee8d"


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "authorization, x-advanced-ocr-token, content-type")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _authorized(headers: Any) -> bool:
    import hashlib

    token = os.environ.get("ADVANCED_OCR_TOKEN", "").strip()
    auth = headers.get("authorization", "") or headers.get("Authorization", "")
    explicit = headers.get("x-advanced-ocr-token", "") or headers.get("X-Advanced-Ocr-Token", "")
    provided = explicit.strip()
    if not provided and auth.lower().startswith("bearer "):
        provided = auth[7:].strip()
    if not provided:
        return False
    if token:
        return provided == token
    return hashlib.sha256(provided.encode("utf-8")).hexdigest() == _TOKEN_SHA256


def _decode_base64(value: str) -> bytes:
    raw = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    return base64.b64decode(raw, validate=False)


def _max_pages() -> int:
    try:
        return max(1, min(12, int(os.environ.get("ADVANCED_OCR_MAX_PAGES", "8"))))
    except Exception:
        return 8


def _pdf_zoom() -> float:
    try:
        return max(2.0, min(5.0, float(os.environ.get("ADVANCED_OCR_PDF_ZOOM", "3.2"))))
    except Exception:
        return 3.2


def _score_text(text: str) -> int:
    normalized = re.sub(r"\s+", " ", text or "").lower()
    score = len(normalized)
    for pattern in (
        "nota fiscal",
        "nfs-e",
        "danfe",
        "numero da nota",
        "valor total",
        "valor da nota",
        "cpf/cnpj",
        "prestador",
        "tomador",
        "emitente",
        "destinatario",
        "chave de acesso",
        "vencimento",
    ):
        if pattern in normalized:
            score += 240
    return score


def _load_pages(payload: bytes, media_type: str, file_name: str) -> tuple[list[Any], list[dict[str, Any]]]:
    from PIL import Image

    lower_type = (media_type or "").lower()
    lower_name = (file_name or "").lower()
    if "pdf" not in lower_type and not lower_name.endswith(".pdf"):
        return [Image.open(io.BytesIO(payload)).convert("RGB")], []

    import fitz

    doc = fitz.open(stream=payload, filetype="pdf")
    pages: list[Any] = []
    embedded: list[dict[str, Any]] = []
    matrix = fitz.Matrix(_pdf_zoom(), _pdf_zoom())
    for index, page in enumerate(doc[: _max_pages()]):
        native_text = (page.get_text("text") or "").strip()
        if len(native_text) >= 20:
            embedded.append({"page": index + 1, "engine": "pymupdf-text", "text": native_text})
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        image = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        pages.append(image)
    doc.close()
    return pages, embedded


def _variants(image: Any) -> list[tuple[str, Any]]:
    from PIL import ImageEnhance, ImageFilter, ImageOps

    variants = [("original", image)]
    if os.environ.get("ADVANCED_OCR_VARIANTS", "2") != "1":
        gray = ImageOps.grayscale(image)
        tuned = ImageOps.autocontrast(gray)
        tuned = ImageEnhance.Contrast(tuned).enhance(1.45)
        tuned = ImageEnhance.Sharpness(tuned).enhance(1.25)
        variants.append(("contrast", tuned.convert("RGB").filter(ImageFilter.SHARPEN)))
    return variants


def _rapid_engine() -> Any:
    global _RAPID_ENGINE
    if _RAPID_ENGINE is None:
        from rapidocr_onnxruntime import RapidOCR

        _RAPID_ENGINE = RapidOCR()
    return _RAPID_ENGINE


def _rapidocr_pages(pages: list[Any]) -> list[dict[str, Any]]:
    import numpy as np

    engine = _rapid_engine()
    out: list[dict[str, Any]] = []
    for index, image in enumerate(pages):
        best_text = ""
        best_variant = "original"
        best_score = -1
        for variant_name, variant_img in _variants(image):
            result, _elapsed = engine(np.array(variant_img))
            lines: list[str] = []
            for item in result or []:
                if isinstance(item, (list, tuple)) and len(item) >= 2 and item[1]:
                    lines.append(str(item[1]))
            text = "\n".join(lines).strip()
            score = _score_text(text)
            if score > best_score:
                best_text = text
                best_variant = variant_name
                best_score = score
        out.append({"page": index + 1, "engine": f"rapidocr:{best_variant}", "text": best_text})
    return out


def ocr_document(req: dict[str, Any]) -> dict[str, Any]:
    image_base64 = str(req.get("imageBase64") or "")
    if not image_base64:
        raise ValueError("imageBase64 ausente")
    media_type = str(req.get("mediaType") or "application/pdf")
    file_name = str(req.get("fileName") or req.get("filename") or "documento")
    payload = _decode_base64(image_base64)
    images, embedded_pages = _load_pages(payload, media_type, file_name)
    ocr_pages = _rapidocr_pages(images)
    pages = embedded_pages + [p for p in ocr_pages if (p.get("text") or "").strip()]
    text = "\n\n".join(p.get("text", "") for p in pages if p.get("text")).strip()
    if not text:
        return {"ok": False, "error": "RapidOCR nao retornou texto util", "pages": []}
    return {
        "ok": True,
        "engine": "pymupdf-text+rapidocr" if embedded_pages else "rapidocr",
        "text": text,
        "pages": pages,
        "meta": {
            "fileName": file_name,
            "mediaType": media_type,
            "pageCount": len(images),
            "embeddedTextPages": len(embedded_pages),
            "ocrTextPages": len(ocr_pages),
        },
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        _json_response(self, 200, {"ok": True})

    def do_GET(self) -> None:
        _json_response(
            self,
            200,
            {
                "ok": True,
                "service": "raiz-obras-advanced-ocr",
                "auth": True,
            },
        )

    def do_POST(self) -> None:
        try:
            if not _authorized(self.headers):
                _json_response(self, 401, {"ok": False, "error": "token invalido"})
                return

            length = int(self.headers.get("content-length") or "0")
            body_limit = int(os.environ.get("ADVANCED_OCR_MAX_BODY_BYTES", "4800000"))
            if length <= 0:
                _json_response(self, 400, {"ok": False, "error": "corpo vazio"})
                return
            if length > body_limit:
                _json_response(self, 413, {"ok": False, "error": "arquivo acima do limite desta etapa OCR"})
                return

            raw = self.rfile.read(length)
            req = json.loads(raw.decode("utf-8"))
            _json_response(self, 200, ocr_document(req))
        except Exception as exc:
            payload = {"ok": False, "error": str(exc) or exc.__class__.__name__}
            if os.environ.get("ADVANCED_OCR_DEBUG") == "1":
                payload["trace"] = traceback.format_exc()[-1800:]
            _json_response(self, 500, payload)
