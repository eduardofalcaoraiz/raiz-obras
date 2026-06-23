import base64
import io
import os
import tempfile
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel


app = FastAPI(title="Raiz Obras Advanced OCR", version="1.0.0")


class OcrRequest(BaseModel):
    imageBase64: str
    mediaType: str = "application/pdf"
    fileName: str = "documento"
    language: str = "por"
    expectedDocument: str | None = None


def _check_auth(authorization: str | None) -> None:
    token = os.environ.get("ADVANCED_OCR_TOKEN", "").strip()
    if not token:
        return
    if authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="invalid token")


def _decode_base64(value: str) -> bytes:
    raw = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    return base64.b64decode(raw)


def _pages_from_request(req: OcrRequest) -> list[Any]:
    payload = _decode_base64(req.imageBase64)
    if "pdf" not in req.mediaType.lower() and not req.fileName.lower().endswith(".pdf"):
        from PIL import Image

        return [Image.open(io.BytesIO(payload)).convert("RGB")]

    import fitz
    from PIL import Image

    pages: list[Any] = []
    doc = fitz.open(stream=payload, filetype="pdf")
    zoom = float(os.environ.get("ADVANCED_OCR_PDF_ZOOM", "3.0"))
    matrix = fitz.Matrix(zoom, zoom)
    max_pages = int(os.environ.get("ADVANCED_OCR_MAX_PAGES", "8"))
    for page in doc[:max_pages]:
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        pages.append(img)
    return pages


def _page_dict(index: int, text: str, engine: str) -> dict[str, Any]:
    return {"page": index + 1, "text": text.strip(), "engine": engine}


def _ocr_with_paddle(pages: list[Any], lang: str) -> list[dict[str, Any]]:
    try:
        import numpy as np
        from paddleocr import PaddleOCR
    except Exception as exc:
        raise RuntimeError(f"paddle unavailable: {exc}") from exc

    paddle_lang = os.environ.get("PADDLE_OCR_LANG", "pt" if lang.startswith("por") else "en")
    ocr = PaddleOCR(use_angle_cls=True, lang=paddle_lang)
    out: list[dict[str, Any]] = []
    for idx, image in enumerate(pages):
        result = ocr.ocr(np.array(image), cls=True)
        lines: list[str] = []
        for block in result or []:
            for item in block or []:
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    text = item[1][0] if isinstance(item[1], (list, tuple)) else item[1]
                    if text:
                        lines.append(str(text))
        out.append(_page_dict(idx, "\n".join(lines), "paddleocr"))
    return out


def _ocr_with_surya(pages: list[Any], lang: str) -> list[dict[str, Any]]:
    try:
        from surya.detection import DetectionPredictor
        from surya.foundation import FoundationPredictor
        from surya.recognition import RecognitionPredictor
    except Exception as exc:
        raise RuntimeError(f"surya unavailable: {exc}") from exc

    languages = [["pt", "en"] if lang.startswith("por") else ["en"] for _ in pages]
    foundation = FoundationPredictor()
    recognition = RecognitionPredictor(foundation)
    detection = DetectionPredictor()
    predictions = recognition(pages, languages, detection)

    out: list[dict[str, Any]] = []
    for idx, pred in enumerate(predictions):
        lines: list[str] = []
        for line in getattr(pred, "text_lines", []) or []:
            text = getattr(line, "text", "")
            if text:
                lines.append(str(text))
        out.append(_page_dict(idx, "\n".join(lines), "surya"))
    return out


def _ocr_with_tesseract(pages: list[Any], lang: str) -> list[dict[str, Any]]:
    try:
        import pytesseract
    except Exception as exc:
        raise RuntimeError(f"tesseract unavailable: {exc}") from exc

    tess_lang = os.environ.get("TESSERACT_LANG", "por+eng" if lang.startswith("por") else "eng")
    out: list[dict[str, Any]] = []
    for idx, image in enumerate(pages):
        text = pytesseract.image_to_string(image, lang=tess_lang, config="--psm 6")
        out.append(_page_dict(idx, text, "tesseract"))
    return out


def _choose_pages(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    useful = [p for p in results if len((p.get("text") or "").strip()) >= 20]
    return useful or results


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True}


@app.post("/ocr")
def ocr(req: OcrRequest, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _check_auth(authorization)
    pages = _pages_from_request(req)
    backend_order = [
        b.strip().lower()
        for b in os.environ.get("ADVANCED_OCR_BACKENDS", "surya,paddle,tesseract").split(",")
        if b.strip()
    ]
    errors: list[str] = []

    for backend in backend_order:
        try:
            if backend == "surya":
                result = _choose_pages(_ocr_with_surya(pages, req.language))
            elif backend == "paddle":
                result = _choose_pages(_ocr_with_paddle(pages, req.language))
            elif backend == "tesseract":
                result = _choose_pages(_ocr_with_tesseract(pages, req.language))
            else:
                errors.append(f"{backend}: backend desconhecido")
                continue
            text = "\n\n".join(p.get("text", "") for p in result).strip()
            if text:
                return {"ok": True, "engine": backend, "text": text, "pages": result}
            errors.append(f"{backend}: sem texto util")
        except Exception as exc:
            errors.append(f"{backend}: {exc}")

    return {"ok": False, "error": " | ".join(errors) or "nenhum OCR disponivel", "pages": []}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
