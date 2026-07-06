import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler
from typing import Any


SUPABASE_URL = "https://hjccxfznojjosvanwztv.supabase.co"
SUPABASE_ANON = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqY2N4Znpub2pqb3N2YW53enR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NzQ0MzUsImV4cCI6MjA5NTQ1MDQzNX0."
    "sdOyn4CdxhSAb_6G6TdUwd5Yv3diQEuTbNoay7uHko8"
)


def _json(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "authorization, content-type")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _query(handler: BaseHTTPRequestHandler) -> dict[str, str]:
    parsed = urllib.parse.urlparse(handler.path)
    params = urllib.parse.parse_qs(parsed.query)
    return {key: values[-1] for key, values in params.items() if values}


def _auth_user(handler: BaseHTTPRequestHandler) -> bool:
    auth = handler.headers.get("authorization") or handler.headers.get("Authorization") or ""
    token = auth.replace("Bearer ", "", 1).strip()
    if not token or token == SUPABASE_ANON:
        return False
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "apikey": SUPABASE_ANON,
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "RaizObraViva/1.0 (+https://raiz-obras.vercel.app)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace") or "{}")
        return bool(data.get("id"))
    except Exception:
        return False


def _safe_zeev_url(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"}:
        return False
    allowed = (
        host == "raizeducacao.zeev.it"
        or host.endswith(".zeev.it")
        or "zeev" in host
    )
    return allowed


def _filename_from_headers(headers: Any, fallback: str) -> str:
    disp = headers.get("content-disposition") or headers.get("Content-Disposition") or ""
    match = re.search(r"filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?", disp, re.I)
    name = urllib.parse.unquote((match.group(1) or match.group(2)) if match else "") if match else ""
    name = name or fallback or "documento-fiscal.pdf"
    return re.sub(r"[^A-Za-z0-9._ -]+", "_", name).strip() or "documento-fiscal.pdf"


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        _json(self, 200, {"ok": True})

    def do_GET(self) -> None:
        if not _auth_user(self):
            _json(self, 401, {"ok": False, "error": "Sessao invalida ou ausente."})
            return

        token = os.environ.get("ZEEV_TOKEN", "").strip()
        if not token:
            _json(self, 500, {"ok": False, "error": "ZEEV_TOKEN ausente no servidor."})
            return

        url = _query(self).get("url", "").strip()
        if not url or not _safe_zeev_url(url):
            _json(self, 400, {"ok": False, "error": "URL Zeev invalida."})
            return

        try:
            req = urllib.request.Request(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "*/*",
                    "User-Agent": "RaizObraViva/1.0 (+https://raiz-obras.vercel.app)",
                },
            )
            with urllib.request.urlopen(req, timeout=45) as resp:
                content = resp.read()
                content_type = resp.headers.get("content-type") or "application/octet-stream"
                filename = _filename_from_headers(resp.headers, urllib.parse.urlparse(url).path.rsplit("/", 1)[-1])

            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except urllib.error.HTTPError as exc:
            text = exc.read().decode("utf-8", errors="replace")
            _json(self, exc.code if exc.code in (400, 401, 403, 404) else 502, {"ok": False, "error": text[:500] or f"HTTP {exc.code}"})
        except Exception as exc:
            _json(self, 502, {"ok": False, "error": str(exc)[:500]})
