"""Authenticated, fixed-destination proxy for Consulta DANFE's public API."""
import json
import re
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler
from api.zeev_file_proxy import SUPABASE_URL, SUPABASE_ANON


def valid_key(key):
    if not re.fullmatch(r"\d{44}", key) or key[20:22] != "55":
        return False
    total = sum(int(n) * (2 + i % 8) for i, n in enumerate(reversed(key[:43])))
    remainder = total % 11
    return int(key[-1]) == (0 if remainder < 2 else 11 - remainder)


def read_json(url, headers, data=None, timeout=8):
    req = urllib.request.Request(url, headers=headers, data=data)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        body = response.read(3500001)
    if len(body) > 3500000:
        raise ValueError("Resposta acima do limite")
    return json.loads(body)


def authorized_payment(auth, payment_id, obra_id):
    if not auth.startswith("Bearer ") or auth[7:] == SUPABASE_ANON:
        return False
    headers = {"apikey": SUPABASE_ANON, "Authorization": auth}
    try:
        user = read_json(SUPABASE_URL + "/auth/v1/user", headers)
        uid = user.get("id", "")
        if not re.fullmatch(r"[0-9a-fA-F-]{36}", uid):
            return False
        profile = read_json(SUPABASE_URL + f"/rest/v1/user_profiles?id=eq.{uid}&select=aprovado", headers)
        if not profile or not profile[0].get("aprovado"):
            return False
        rows = read_json(SUPABASE_URL + f"/rest/v1/pagamentos?id=eq.{payment_id}&obra_id=eq.{obra_id}&select=id&limit=1", headers)
        return bool(rows)
    except (ValueError, OSError, urllib.error.HTTPError):
        return False


class handler(BaseHTTPRequestHandler):
    def respond(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 4096:
                self.respond(400, {"error": "Corpo invalido"})
                return
            data = json.loads(self.rfile.read(length))
            key = str(data.get("chave", ""))
            payment_id, obra_id = int(data.get("payment_id", 0)), int(data.get("obra_id", 0))
            if not valid_key(key) or payment_id <= 0 or obra_id <= 0:
                self.respond(400, {"error": "Chave ou pagamento invalido"})
                return
            if not authorized_payment(self.headers.get("Authorization", ""), payment_id, obra_id):
                self.respond(403, {"error": "Sem acesso ao pagamento"})
                return
            result = read_json(
                "https://consultadanfe.com/api/v1/consulta",
                {"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "RaizObras/1.0"},
                json.dumps({"chave": key, "format": "json"}).encode(), timeout=18,
            )
            if result.get("status") != "ok" or result.get("chave") != key:
                self.respond(502, {"error": "Resposta divergente do provedor"})
                return
            self.respond(200, {k: result[k] for k in ("status", "chave", "xml_base64", "pdf_base64") if k in result})
        except urllib.error.HTTPError as exc:
            self.respond(429 if exc.code == 429 else 502, {"error": "Consulta indisponivel", "provider_status": exc.code})
        except (ValueError, TypeError, AttributeError):
            self.respond(400, {"error": "Dados invalidos"})
        except Exception:
            self.respond(502, {"error": "Nao foi possivel consultar o documento fiscal"})
