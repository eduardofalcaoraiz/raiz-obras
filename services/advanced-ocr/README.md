# Raiz Obras Advanced OCR

Optional OCR microservice for the `read-invoice` cascade.

The Supabase Edge Function can call this service when the secret
`ADVANCED_OCR_URL` is configured. The service receives a PDF/image as base64
and returns extracted text. It is designed for open-source engines that cannot
run inside Supabase Edge, especially RapidOCR, Surya and PaddleOCR.

## Endpoint

`POST /ocr`

```json
{
  "imageBase64": "base64-or-data-url",
  "mediaType": "application/pdf",
  "fileName": "nota.pdf",
  "language": "por",
  "expectedDocument": "brazilian-fiscal-document"
}
```

Response:

```json
{
  "ok": true,
  "engine": "surya",
  "text": "...",
  "pages": [{ "page": 1, "text": "...", "engine": "surya" }]
}
```

## Environment

- `ADVANCED_OCR_TOKEN`: optional bearer token.
- `ADVANCED_OCR_BACKENDS`: backend order. Default: `rapidocr,surya,paddle,tesseract`.
- `ADVANCED_OCR_PDF_ZOOM`: PDF render zoom. Default: `3.0`.
- `ADVANCED_OCR_MAX_PAGES`: maximum pages per request. Default: `8`.
- `PADDLE_OCR_LANG`: Paddle language, default `pt`.
- `TESSERACT_LANG`: Tesseract language, default `por+eng`.

## Local run

Install one or more backend requirement files:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-base.txt
pip install -r requirements-rapidocr.txt
pip install -r requirements-surya.txt
pip install -r requirements-paddle.txt
```

Run:

```powershell
$env:ADVANCED_OCR_TOKEN="choose-a-long-secret"
uvicorn app:app --host 0.0.0.0 --port 8080
```

For production, host this service somewhere that Supabase can reach by HTTPS,
then set Supabase secrets:

```powershell
.\supabase_cli\supabase.exe secrets set ADVANCED_OCR_URL="https://your-service.example.com/ocr" ADVANCED_OCR_TOKEN="choose-a-long-secret" --project-ref hjccxfznojjosvanwztv
```

Then redeploy:

```powershell
.\supabase_cli\supabase.exe functions deploy read-invoice --project-ref hjccxfznojjosvanwztv --no-verify-jwt
```

## Notes

This service does not decide invoice fields. It only extracts text. The existing
Raiz Obras parser and evidence checks still decide number, CNPJ, totals, dates,
installments, and items.
