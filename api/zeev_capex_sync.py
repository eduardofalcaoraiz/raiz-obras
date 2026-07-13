import importlib
import json
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler
from typing import Any


def _json(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "authorization, content-type, x-cron-secret, x-zeev-token")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("content-length") or 0)
    if not length:
        return {}
    raw = handler.rfile.read(length).decode("utf-8", errors="replace")
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {}
    return data if isinstance(data, dict) else {}


def _query(handler: BaseHTTPRequestHandler) -> dict[str, str]:
    parsed = urllib.parse.urlparse(handler.path)
    params = urllib.parse.parse_qs(parsed.query)
    return {key: values[-1] for key, values in params.items() if values}


def _as_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "sim", "yes", "y"}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        _json(self, 200, {"ok": True})

    def do_GET(self) -> None:
        self._run()

    def do_POST(self) -> None:
        self._run()

    def _run(self) -> None:
        expected = os.environ.get("CRON_SECRET") or os.environ.get("ZEEV_SYNC_SECRET") or ""
        auth = self.headers.get("authorization") or ""
        sent_secret = self.headers.get("x-cron-secret") or ""
        zeev_token = self.headers.get("x-zeev-token") or os.environ.get("ZEEV_TOKEN") or ""

        if expected:
            authorized = auth == f"Bearer {expected}" or sent_secret == expected
            sync_secret = expected
        else:
            authorized = bool(sent_secret) and auth == f"Bearer {sent_secret}" and len(sent_secret) >= 16
            sync_secret = sent_secret

        if not authorized:
            _json(self, 401, {"ok": False, "error": "Nao autorizado."})
            return
        if not sync_secret:
            _json(self, 500, {"ok": False, "error": "Segredo de sincronizacao ausente."})
            return

        payload = {**_query(self), **_read_json(self)}
        mode = str(payload.get("mode") or payload.get("workflowMode") or payload.get("syncMode") or "incremental")
        if mode not in {"reconcile-registered", "reconcile", "dedupe-registered"} and not zeev_token:
            _json(self, 500, {"ok": False, "error": "Token Zeev ausente na chamada segura."})
            return
        flow_ids = str(payload.get("flowIds") or payload.get("flow_ids") or "299,275,102,300")
        max_pages = str(payload.get("maxPages") or payload.get("max_pages") or ("999" if mode == "retro" else "2"))
        page_size = str(payload.get("recordsPerPage") or payload.get("records_per_page") or "30")

        os.environ["ZEEV_TOKEN"] = zeev_token
        os.environ["ZEEV_SYNC_SECRET"] = sync_secret
        os.environ["ZEEV_BASE_URL"] = str(payload.get("baseUrl") or "https://raizeducacao.zeev.it")
        os.environ["SUPABASE_URL"] = str(payload.get("supabaseUrl") or "https://hjccxfznojjosvanwztv.supabase.co")
        os.environ["ZEEV_FLOW_IDS"] = flow_ids
        os.environ["ZEEV_SYNC_MODE"] = mode
        os.environ["ZEEV_MAX_PAGES"] = max_pages
        os.environ["ZEEV_RECORDS_PER_PAGE"] = page_size
        os.environ["ZEEV_BUSINESS_TIMEZONE"] = str(payload.get("businessTimezone") or payload.get("business_timezone") or "America/Sao_Paulo")
        os.environ["ZEEV_DEEP_SCAN"] = "1" if _as_bool(payload.get("deepScan") or payload.get("deep_scan"), False) else os.environ.get("ZEEV_DEEP_SCAN", "0")
        os.environ["ZEEV_NOTIFY"] = "true" if _as_bool(payload.get("notify"), mode != "retro") else "false"
        if payload.get("start"):
            os.environ["ZEEV_SYNC_START"] = str(payload["start"])
        else:
            os.environ.pop("ZEEV_SYNC_START", None)
        if payload.get("end"):
            os.environ["ZEEV_SYNC_END"] = str(payload["end"])
        else:
            os.environ.pop("ZEEV_SYNC_END", None)
        ticket_ids = payload.get("ticketIds") or payload.get("ticket_ids") or payload.get("instanceIds") or payload.get("instance_ids") or ""
        if isinstance(ticket_ids, (list, tuple)):
            os.environ["ZEEV_TICKET_IDS"] = ",".join(str(x) for x in ticket_ids)
        elif ticket_ids:
            os.environ["ZEEV_TICKET_IDS"] = str(ticket_ids)
        else:
            os.environ.pop("ZEEV_TICKET_IDS", None)

        try:
            sys.path.insert(0, os.getcwd())
            mod = importlib.import_module("scripts.zeev_capex_sync")
            mod = importlib.reload(mod)
            if mode in {"reconcile-registered", "reconcile", "dedupe-registered"}:
                result = mod.reconcile_registered()
                _json(self, 200, result)
                return
            if mode in {"retro", "deep", "deep-retro"}:
                start = os.environ.get("ZEEV_SYNC_START", "2026-04-01T00:00:00-03:00")
                end = os.environ.get("ZEEV_SYNC_END", "2026-07-01T23:59:59-03:00")
            else:
                start, end = mod.default_window()
            flows = [int(x) for x in flow_ids.split(",") if x.strip()]
            ids = mod.parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS", ""))
            extra_ids = mod.parse_ticket_ids(payload.get("extraTicketIds") or payload.get("extra_ticket_ids") or "")
            deep_mode = mode in {"deep", "deep-retro", "deep-incremental"} or os.environ.get("ZEEV_DEEP_SCAN", "0") == "1"
            if ids:
                tickets = mod.sync_ids(ids)
            else:
                if deep_mode:
                    merged = {t["zeev_instance_id"]: t for t in mod.deep_sync(start, end, max_pages=int(max_pages), page_size=int(page_size))}
                else:
                    merged = {t["zeev_instance_id"]: t for t in mod.sync(start, end, flows, max_pages=int(max_pages), page_size=int(page_size))}
                for ticket in mod.sync_ids(extra_ids):
                    merged[ticket["zeev_instance_id"]] = ticket
                tickets = sorted(merged.values(), key=lambda x: x["zeev_instance_id"], reverse=True)
            ingest = mod.ingest(tickets, notify=_as_bool(os.environ.get("ZEEV_NOTIFY")))
            _json(
                self,
                200,
                {
                    "ok": True,
                    "mode": "ticketIds" if ids else mode,
                    "start": start,
                    "end": end,
                    "tickets": len(tickets),
                    "ticketIds": [t.get("zeev_instance_id") for t in tickets[:50]],
                    "ingest": ingest,
                },
            )
        except Exception as exc:
            _json(self, 500, {"ok": False, "error": str(exc)[:1800]})
