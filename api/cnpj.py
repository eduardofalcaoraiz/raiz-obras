import json
import re
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler
from typing import Any


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "content-type")
    handler.send_header("Cache-Control", "public, max-age=86400")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _digits(value: Any) -> str:
    return re.sub(r"\D+", "", str(value or ""))


def _fetch_json(url: str, timeout: float = 12.0) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "RaizObraViva/1.0 (+https://raiz-obras.vercel.app)",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    data = json.loads(raw)
    return data if isinstance(data, dict) else {}


def _first_phone(*values: Any) -> str:
    for value in values:
        if value:
            return str(value).strip()
    return ""


def _normalize(data: dict[str, Any], source: str) -> dict[str, Any]:
    est = data.get("estabelecimento") or {}
    empresa = data.get("empresa") or {}
    company = data.get("company") or {}
    address = data.get("address") or {}
    main_activity = data.get("atividade_principal") or data.get("mainActivity") or company.get("mainActivity") or {}
    phones = data.get("phones") if isinstance(data.get("phones"), list) else []
    emails = data.get("emails") if isinstance(data.get("emails"), list) else []
    phone_obj = phones[0] if phones else {}
    email_obj = emails[0] if emails else {}
    cidade = est.get("cidade") or data.get("cidade") or {}
    estado = est.get("estado") or data.get("estado") or {}

    endereco_partes = [
        data.get("logradouro") or est.get("logradouro") or address.get("street"),
        data.get("numero") or est.get("numero") or address.get("number"),
        data.get("complemento") or est.get("complemento") or address.get("details"),
        data.get("bairro") or est.get("bairro") or address.get("district"),
    ]
    endereco = ", ".join(str(v).strip() for v in endereco_partes if v)

    nome = (
        data.get("razao_social")
        or empresa.get("razao_social")
        or company.get("name")
        or data.get("nome_fantasia")
        or est.get("nome_fantasia")
        or data.get("alias")
        or ""
    )
    fantasia = data.get("nome_fantasia") or est.get("nome_fantasia") or data.get("alias") or ""
    email = (data.get("email") or est.get("email") or email_obj.get("address") or "").lower()
    telefone = _first_phone(
        data.get("telefone1"),
        data.get("ddd_telefone_1"),
        est.get("telefone1"),
        " ".join(str(v) for v in (phone_obj.get("area") or phone_obj.get("ddd"), phone_obj.get("number")) if v),
    )

    return {
        "razao_social": str(nome).strip(),
        "nome_fantasia": str(fantasia).strip(),
        "email": email,
        "telefone1": telefone,
        "logradouro": endereco,
        "numero": "",
        "complemento": "",
        "bairro": "",
        "municipio": data.get("municipio") or cidade.get("nome") or address.get("city") or "",
        "uf": data.get("uf") or estado.get("sigla") or address.get("state") or "",
        "cnae_fiscal_descricao": data.get("cnae_fiscal_descricao") or main_activity.get("descricao") or main_activity.get("text") or "",
        "porte": (data.get("porte") or {}).get("descricao") if isinstance(data.get("porte"), dict) else data.get("porte") or (empresa.get("porte") or {}).get("descricao") if isinstance(empresa.get("porte"), dict) else company.get("size", {}).get("text") if isinstance(company.get("size"), dict) else "",
        "data_abertura": data.get("data_abertura") or est.get("data_inicio_atividade") or data.get("founded") or "",
        "descricao_situacao_cadastral": data.get("descricao_situacao_cadastral") or est.get("situacao_cadastral") or (data.get("status") or {}).get("text") if isinstance(data.get("status"), dict) else "",
        "_cnpjSource": source,
    }


def query_cnpj(cnpj: str) -> dict[str, Any]:
    raw = _digits(cnpj)
    if len(raw) != 14:
        return {"ok": False, "error": "CNPJ invalido"}

    providers = [
        ("BrasilAPI", f"https://brasilapi.com.br/api/cnpj/v1/{raw}"),
        ("Open CNPJA", f"https://open.cnpja.com/office/{raw}"),
        ("CNPJ.ws", f"https://publica.cnpj.ws/cnpj/{raw}"),
    ]
    attempts: list[dict[str, Any]] = []
    for name, url in providers:
        try:
            data = _fetch_json(url)
            normalized = _normalize(data, name)
            if normalized.get("razao_social"):
                return {
                    "ok": True,
                    "source": name,
                    "data": normalized,
                    "raw": data,
                    "attempts": attempts + [{"source": name, "ok": True}],
                }
            attempts.append({"source": name, "ok": False, "error": "sem razao social"})
        except urllib.error.HTTPError as exc:
            attempts.append({"source": name, "ok": False, "error": f"HTTP {exc.code}"})
        except Exception as exc:
            attempts.append({"source": name, "ok": False, "error": str(exc)[:180]})

    return {"ok": False, "error": "CNPJ nao encontrado nas fontes publicas", "attempts": attempts}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        _json_response(self, 200, {"ok": True})

    def do_GET(self) -> None:
        try:
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            cnpj = (query.get("cnpj") or [""])[0]
            payload = query_cnpj(cnpj)
            _json_response(self, 200 if payload.get("ok") else 404, payload)
        except Exception as exc:
            _json_response(self, 500, {"ok": False, "error": str(exc) or exc.__class__.__name__})
