import json
import base64
import html as html_lib
import mimetypes
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


ZEEV_BASE_URL = os.environ.get("ZEEV_BASE_URL", "https://raizeducacao.zeev.it").rstrip("/")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hjccxfznojjosvanwztv.supabase.co").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ZEEV_TOKEN = urllib.parse.unquote(os.environ.get("ZEEV_TOKEN", "").strip().removeprefix("Bearer "))
ZEEV_EXTRA_TOKENS = ""
ZEEV_SYNC_SECRET = os.environ.get("ZEEV_SYNC_SECRET", "")
AUTOMATION_PAUSED = os.environ.get("ZEEV_AUTOMATION_PAUSED", "").strip().lower() in {"1", "true", "sim", "yes", "on"}
TOTAL_SCAN_LOCK = os.environ.get("ZEEV_TOTAL_SCAN_LOCK", "").strip().lower() in {"1", "true", "sim", "yes", "on"}


def parse_flow_ids_env(value):
    ids = []
    for x in str(value or "").split(","):
        try:
            n = int(x.strip())
        except (TypeError, ValueError):
            continue
        if n:
            ids.append(n)
    return ids


FLOW_IDS = parse_flow_ids_env(os.environ.get("ZEEV_FLOW_IDS", "299,275,263,220,110,102,300,365,152,151"))
FINANCE_FLOW_IDS = {299, 275, 263, 220, 152, 151, 110}
PURCHASE_FLOW_IDS = {102, 300, 365}
BUSINESS_TIMEZONE = os.environ.get("ZEEV_BUSINESS_TIMEZONE", "America/Sao_Paulo")


def business_tz():
    try:
        return ZoneInfo(BUSINESS_TIMEZONE)
    except Exception:
        if BUSINESS_TIMEZONE == "America/Sao_Paulo":
            return timezone(timedelta(hours=-3), BUSINESS_TIMEZONE)
        return timezone.utc


def text_quality_penalty(text):
    value = str(text or "")
    penalty = value.count("\ufffd") * 12
    penalty += len(re.findall(r"(?:Ã.|Â.|â[€œ€�˜™“”‘’\-]|ï¼)", value)) * 4
    return penalty


def charset_from_content_type(content_type):
    match = re.search(r"charset\s*=\s*['\"]?([^;'\"]+)", str(content_type or ""), re.I)
    if not match:
        return ""
    charset = match.group(1).strip().lower()
    aliases = {
        "latin1": "iso-8859-1",
        "latin-1": "iso-8859-1",
        "cp1252": "windows-1252",
        "win-1252": "windows-1252",
    }
    return aliases.get(charset, charset)


def decode_http_text(raw, content_type=""):
    if isinstance(raw, str):
        return raw
    body = raw or b""
    declared = charset_from_content_type(content_type)
    candidates = []
    for charset in [declared, "utf-8", "windows-1252", "iso-8859-1"]:
        if charset and charset not in candidates:
            candidates.append(charset)
    best = ""
    best_score = 10**9
    for charset in candidates:
        try:
            text = body.decode(charset, errors="replace")
        except LookupError:
            continue
        score = text_quality_penalty(text)
        if declared and charset == declared:
            score -= 1
        if score < best_score:
            best = text
            best_score = score
    return best if best or not body else body.decode("utf-8", errors="replace")

# A descricao de uma solicitacao financeira vem exclusivamente deste campo do
# formulario Zeev. Descricao fiscal, item e natureza orcamentaria nao sao
# substitutos validos para o titulo do registro.
FINANCE_REQUEST_DESCRIPTION_FIELDS = [
    "informacoesReferentesASolicitacao",
    "informacoesReferentesSolicitacao",
    "informacoesReferenteASolicitacao",
    "informacaoReferenteASolicitacao",
    "informacaoReferenteSolicitacao",
    "informacoesDaSolicitacao",
    "informacoesSolicitacao",
    "informacaoSolicitacao",
    "Informacoes referentes a solicitacao",
    "Informacao referente a solicitacao",
    "Informa\u00e7\u00f5es referentes \u00e0 solicita\u00e7\u00e3o",
    "Informa\u00e7\u00f5es referentes a solicita\u00e7\u00e3o",
    "Informacoes referentes \u00e0 solicita\u00e7\u00e3o",
]
FINANCE_DESCRIPTION_FIELDS = FINANCE_REQUEST_DESCRIPTION_FIELDS

PURCHASE_SERVICE_DESCRIPTION_FIELDS = [
    "descricaoMensagemZeev",
    "descricaoDoServico",
    "descricaoServico",
    "descricaoServicoSolicitado",
    "descricaoServicoCompra",
    "descricao do servico",
    "Descri\u00e7\u00e3o",
    "Descricao",
    "Desc do Servi\u00e7o",
    "Desc do Servico",
    "Descri\u00e7\u00e3o do Servi\u00e7o",
    "Descricao do Servico",
]

PURCHASE_JUSTIFICATION_FIELDS = [
    "JUSTIFICATIVA DO PEDIDO",
    "Justificativa do Pedido",
    "justificativaDoPedido",
    "justificativa do pedido",
    "justificativaPedido",
    "justificativa pedido",
    "justificativaPedidoCompra",
    "justificativaPedidoCompras",
    "justificativaDoPedidoCompra",
    "justificativa do pedido de compra",
    "justificativaDaCompra",
    "justificativa da compra",
    "justificativaDaSolicitacao",
    "justificativa da solicitacao",
    "justificativaSolicitacao",
    "motivoDoPedido",
    "motivo do pedido",
]

PURCHASE_ITEM_DESCRIPTION_FIELDS = [
    "item",
    "itens",
    "produto",
    "produtos",
    "material",
    "materiais",
    "nomeItem",
    "nomeDoItem",
    "nome do item",
    "descricaoItem",
    "descricao do item",
    "itemCotacao",
    "item para cotacao",
    "listaParaCotacao",
    "lista de itens para cotacao",
    "lista para cotacao",
    "Lista para cota\u00e7\u00e3o",
    "Item / Medicamento",
    "Item",
]

DEFAULT_CAPEX_FIELDS = {
    299: ["investimentoCAPEX", "É um investimento (CAPEX)?", "E um investimento (CAPEX)?", "CAPEX"],
    275: ["investimentoCAPEX", "É um investimento (CAPEX)?", "E um investimento (CAPEX)?", "CAPEX"],
    263: ["investimentoCAPEX", "É um investimento (CAPEX)?", "E um investimento (CAPEX)?", "CAPEX"],
    220: ["investimentoCAPEX", "É um investimento (CAPEX)?", "E um investimento (CAPEX)?", "CAPEX"],
    152: ["investimentoCAPEX", "É um investimento (CAPEX)?", "E um investimento (CAPEX)?", "CAPEX"],
    151: ["investimentoCAPEX", "É um investimento (CAPEX)?", "E um investimento (CAPEX)?", "CAPEX"],
    110: ["investimentoCAPEX", "É um investimento (CAPEX)?", "E um investimento (CAPEX)?", "CAPEX"],
    102: ["cAPEX", "CAPEX", "Investimento CAPEX"],
    300: ["cAPEX", "CAPEX", "Investimento CAPEX"],
    365: ["cAPEX", "CAPEX", "Investimento CAPEX"],
}

CAPEX_FIELD_CANDIDATES = [
    "investimentoCAPEX", "cAPEX", "CAPEX", "Capex", "capex",
    "Investimento CAPEX", "Investimento Capex",
    "É um investimento (CAPEX)?", "E um investimento (CAPEX)?",
    "É um investimento CAPEX?", "E um investimento CAPEX?",
    "É CAPEX?", "E CAPEX?", "É investimento?", "E investimento?",
]

PAYMENT_TOTAL_FIELDS = [
    "valorTotalDoPagamento", "valor total do pagamento", "Valor total do pagamento", "Valor total do pagamento *",
    "valorTotalDoPagamento01", "valorTotalPagamento", "valor total pagamento",
    "totalPagamento", "total do pagamento", "totalAPagar", "total a pagar",
    "valorPagamento", "valor do pagamento", "valor pagamento", "valorAPagar",
    "valor a pagar",
]

NEXT_PAYMENT_VALUE_FIELDS = [
    "valorDoProximoPagamento", "valor do proximo pagamento",
    "valor do pr\u00f3ximo pagamento", "Valor do pr\u00f3ximo pagamento",
]

INSTALLMENT_COUNT_FIELDS = [
    "qtdParcelas", "quantidadeDeParcelas", "quantidade de parcelas",
    "n\u00famero de parcelas", "numero de parcelas",
]

VALUE_TOTAL_FIELDS = [
    *PAYMENT_TOTAL_FIELDS,
    "valorFinal", "valor final", "valor final da compra", "valor final do pedido",
    "valorTotal", "valor total", "valor total da compra", "valor total do pedido",
    "valor total da solicitacao", "valor total da solicitação", "valorDaCompra",
    "valor da compra", "valorCompra", "valor compra", "valorPedido", "valor do pedido",
    "valorAprovado", "valor aprovado", "valorSolicitado", "valor solicitado",
    "valorOrcado", "valor orcado", "valor orçado", "valorEstimado", "valor estimado",
    "orcamento", "orçamento", "precoFinal", "preço final", "preco final",
    "precoTotal", "preço total", "preco total", "total", "valor",
    "valorPagamento", "valor do pagamento", "valor pagamento", "valorAPagar",
    "valor a pagar", "valorNotaFiscal", "valor da nota fiscal", "valor da nota",
    "valor do documento", "valor do capex", "valor capex", "preco negociado",
    "preço negociado", "valor negociado", "valor contratado", "valor da proposta",
    "valorTitulo", "valor do titulo", "valor do título", "valorDocumento",
    "valor do documento", "valorLancamento", "valor lancamento", "valor do lançamento",
    "valorBruto", "valor bruto",
    "Total dos itens", "Total dos itens *", "Total do pag.",
]

INSTALLMENT_VALUE_FIELDS = [
    "Total das parcelas", "Total das parcelas *",
    "valorParcela", "valor da parcela",
]

ITEM_TOTAL_FIELDS = [
    "valorTotalItem", "valor total item", "valor total do item", "valor total",
    "precoTotal", "preço total", "preco total", "total item", "total do item",
    "valorProduto", "valor do produto", "valorServico", "valor do servico",
    "valor do serviço",
]

ITEM_UNIT_FIELDS = [
    "precoUnitario", "preço unitário", "preco unitario", "valorUnitario",
    "valor unitário", "valor unitario", "valor unit", "valor un",
]

ITEM_DESC_FIELDS = [
    "item", "itens", "produto", "produtos", "material", "materiais", "servico",
    "serviços", "servico", "servicos", "descricaoProduto", "descricao do produto",
    "descricaoServico", "descrição do serviço", "descricao do servico",
    "descricaoItem", "descricao do item", "descrição", "descricao", "detalhamento",
    *PURCHASE_ITEM_DESCRIPTION_FIELDS,
]

ITEM_QTY_FIELDS = ["quantidade", "quantidade solicitada", "quantidadeSolicitada", "qtd", "qtde"]
ITEM_UNIT_MEASURE_FIELDS = ["unidadeMedida", "unidade medida", "unidade", "un"]
FISCAL_NUMBER_FIELDS = [
    "numeroDaNF",
    "notaFiscal",
    "numeroNF",
    "numeroNotaFiscal",
    "numero da nota fiscal",
    "numero da nf",
    "numero da nfs",
    "numero da nfs-e",
    "numeroFatura",
    "numero da fatura",
    "numeroRecibo",
    "numero do recibo",
]
GENERIC_FISCAL_NUMBER_FIELDS = [
    "N\u00famero",
    "Numero",
    "N\u00famero *",
    "Numero *",
    "N\u00ba",
    "N\u00b0",
    "N\u00ba *",
    "N\u00b0 *",
]
ISSUE_DATE_FIELDS = ["dataEmissao", "data de emissao", "data de emiss\u00e3o", "Data de emiss\u00e3o", "Data de emiss\u00e3o *"]
DESTINATION_UNIT_FIELDS = [
    "Unidade / Filial", "Unidade / Filial *", "Unidade / Filial de destino",
    "Unidade / Filial de destino *", "Filial/unidade de destino",
    "Filial/unidade de destino *", "Filial Solic.", "Filial Dest.",
]
COMPANY_FIELDS = [
    "Coligada", "Coligada *", "Coligada de destino", "Coligada de destino *",
    "Col. Solic.", "Col. Dest.",
]

DOCUMENT_FIELDS = [
    "anexo", "anexos", "arquivo", "arquivos", "Arquivo", "Arquivos",
    "anexarNotaFiscal", "anexarBoletoAVista", "anexarBoletoParcelado",
    "arquivoNF", "arquivo NF", "arquivoNf", "arquivoNFS", "arquivoNFSe", "arquivoNFe",
    "notaFiscal", "NotaFiscal", "nota fiscal", "notaFiscalArquivo", "notaFiscalServico",
    "notaFiscalServicos", "notaFiscalDeServico", "notaFiscalDeServicos", "notaFiscalPagamento",
    "notaFiscalAnexo", "arquivoNotaFiscal", "anexoNotaFiscal", "anexoNF", "anexoNf",
    "anexoNFS", "anexoNFSe", "nF", "nf", "nfs", "nfse", "nfe", "nfsE",
    "documento", "Documento", "documentos", "Documentos", "documentoFiscal",
    "DocumentoFiscal", "documento fiscal", "documentoNF", "documentoNf", "documentoNFS",
    "documentoNFSe", "documentoNFe", "documentoNotaFiscal", "documentoPagamento",
    "arquivoDocumento", "anexoDocumento", "danfe", "DANFE", "xml", "XML", "pdf", "PDF",
    "comprovante", "Comprovante", "comprovantePagamento", "comprovante pagamento",
    "comprovanteAnexo", "arquivoComprovante", "documentoComprovante",
    "boleto", "Boleto", "pix", "Pix", "recibo", "Recibo", "fatura", "Fatura",
]

PURCHASE_FIELDS = [
    "cAPEX", "centroDeCusto", "centroCusto", "item", "itens", "produto", "produtos",
    "material", "materiais", "servico", "servicos", "descricao", "descricaoSolicitacao",
    "descricaoCompra", "descricaoProduto", "descricaoServico", "detalhamento", "justificativa",
    *PURCHASE_JUSTIFICATION_FIELDS,
    "observacao", "observacoes", "quantidade", "quantidadeSolicitada", "qtd", "unidadeMedida",
    "valorTotalDoPagamento", "valorTotalDoPagamento01", "valorTotalPagamento", "valor", "valorTotal", "valorFinal", "valorCompra", "valorDaCompra", "valorSolicitado",
    "valorPedido", "valorAprovado", "valorOrcado", "valorEstimado", "orcamento", "preco",
    "precoUnitario", "precoTotal", "precoFinal", "valorUnitario", "valorTotalItem",
    "fornecedor", "nomeFornecedor", "razaoSocial", "cgc", "cnpjFornecedor", "cnpjCpfDoFornecedor", "cnpjDoFornecedor", "fornecedorEscolhido",
    "condicaoPagamento", "formaPagamento", "formaDePagamento", "dataPagamento", "previsaoPagamento",
    "dataEntrega", "prazoEntrega", "unidade", "unidadeEscolar", "escola", "filial", "marca",
    "localEntrega", "solicitante", "setor", "departamento", "categoria", "categoriaCompra",
    "tipoCompra", "numeroTR", "ticket", "tr", "notaFiscal", "numeroNF", "numeroNotaFiscal",
    "valorNotaFiscal", "numeroDaNF", "serieDaNF", "chaveAcesso", "chaveDeAcesso", "Informe a chave de acesso", *DOCUMENT_FIELDS,
    *PURCHASE_SERVICE_DESCRIPTION_FIELDS, *PURCHASE_ITEM_DESCRIPTION_FIELDS,
    *DESTINATION_UNIT_FIELDS, *COMPANY_FIELDS,
]

FINANCE_FIELDS = [
    "investimentoCAPEX", "valorTotalDoPagamento", "valorTotalDoPagamento01", "valorTotalPagamento", "valor", "valorTotal", "valorSolicitado", "valorPagamento",
    "valorAPagar", "valorAprovado", "precoUnitario", "dataPagamento", "previsaoPagamento", "dataVencimento", "dataDeVencimento",
    "Data de vencimento", "Data de vencimento *", "Data de vencimento extra\u00edda", *ISSUE_DATE_FIELDS,
    "formaPagamento", "formaDePagamento", "Forma de pagamento", "Forma de pagamento *",
    "Condi\u00e7\u00e3o de pagamento", "Condi\u00e7\u00e3o de pagamento *",
    "condicaoPagamento", "favorecido", "beneficiario", "fornecedor", "Fornecedor", "Fornecedor *",
    "nomeFornecedor", "razaoSocial", "cnpj", "cgc", "cnpjFornecedor", "centroDeCusto", "codigoDoCentroDeCusto", "centroCusto",
    "Centro de Custo", "Centro de Custo *", "unidade", "unidadeEscolar", "escola", "filial", "marca", "descricao",
    "Descri\u00e7\u00e3o da Nota Fiscal", "Descri\u00e7\u00e3o da Nota Fiscal *",
    "descricaoSolicitacao", "solicitacao", "pedido", "objeto", "resumo", "justificativa",
    "observacao", "observacoes", "categoria", "categoriaFinanceira", "setor", "departamento",
    "numeroTR", "ticket", "tr", "notaFiscal", "numeroNF", "numeroDaNF", "serieDaNF", "numeroNotaFiscal", *FISCAL_NUMBER_FIELDS,
    *GENERIC_FISCAL_NUMBER_FIELDS,
    "valorNotaFiscal", "chaveAcesso", "chaveDeAcesso", "Informe a chave de acesso", *DOCUMENT_FIELDS,
    *FINANCE_DESCRIPTION_FIELDS,
    *DESTINATION_UNIT_FIELDS, *COMPANY_FIELDS,
]


def norm(value):
    import unicodedata

    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return "".join(ch.lower() if ch.isalnum() else " " for ch in text).strip()


def norm_key(value):
    return "".join(ch for ch in norm(value) if ch.isalnum())


def field_name_candidates(field):
    for key in ("name", "label", "title", "caption"):
        value = field.get(key)
        if value:
            yield str(value)


def field_display_name(field):
    return next(field_name_candidates(field), "")


def field_matches(field, names):
    wanted_norm = {norm(n) for n in names}
    wanted_key = {norm_key(n) for n in names}
    for candidate in field_name_candidates(field):
        n = norm(candidate)
        k = norm_key(candidate)
        if n in wanted_norm or k in wanted_key:
            return True
    return False


def unique_fields(*groups):
    out = []
    seen = set()
    for group in groups:
        for name in group or []:
            key = norm_key(name)
            if key and key not in seen:
                seen.add(key)
                out.append(name)
    return out


def env_list(value):
    return [x.strip() for x in re.split(r"[\n,;|]+", str(value or "")) if x.strip()]


BAD_ZEEV_TOKENS = set()


def zeev_tokens():
    return [ZEEV_TOKEN] if ZEEV_TOKEN else []


def zeev_auth_attempts(token):
    token = str(token or "").strip()
    if not token:
        return [("none", {})]
    return [
        ("authorization-bearer", {"Authorization": f"Bearer {token}"}),
    ]


def has_zeev_token():
    return bool(zeev_tokens())


def doc_rescue_checked_before():
    return (
        os.environ.get("ZEEV_DOC_RESCUE_CHECKED_BEFORE")
        or os.environ.get("ZEEV_CHECKED_BEFORE")
        or os.environ.get("ZEEV_SCAN_STARTED_AT")
        or ""
    ).strip()


def add_doc_rescue_marker(payload):
    checked_before = doc_rescue_checked_before()
    if checked_before:
        payload["checkedBefore"] = checked_before
    return payload


def form_fields_present(data):
    if isinstance(data, dict):
        return bool(data.get("formFields"))
    if isinstance(data, list):
        return any(isinstance(row, dict) and bool(row.get("formFields")) for row in data)
    return False


def zeev_fields_requested(url, payload):
    if "formFieldNames" in str(url):
        return True
    if isinstance(payload, dict):
        fields = payload.get("formFieldNames")
        return fields is not None and fields != []
    return False


def merge_zeev_rows_by_id(rows):
    merged = {}
    anon = 0
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        key = str(row.get("id") or row.get("instanceId") or f"row-{anon}")
        anon += 1
        if key not in merged:
            merged[key] = row
            continue
        prev = merged[key]
        merged[key] = {**prev, **row, "formFields": merge_zeev_fields(prev.get("formFields") or [], row.get("formFields") or [])}
    return list(merged.values())


def parse_money(value):
    if isinstance(value, (int, float)):
        return float(value)
    s = "".join(ch for ch in str(value or "") if ch.isdigit() or ch in ",.-")
    if not s:
        return 0.0
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def request_json(method, url, headers=None, payload=None, timeout=60, retries=3):
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    merged = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "ObrasRealEstate/1.0 (+https://raiz-obras.vercel.app)",
        **(headers or {}),
    }
    is_zeev = str(url).startswith(ZEEV_BASE_URL) and (bool(zeev_tokens()) or bool(merged.get("Authorization")))
    is_supabase = str(url).startswith(SUPABASE_URL)
    requested_fields = is_zeev and zeev_fields_requested(url, payload)
    merge_token_rows = is_zeev and requested_fields and str(url).rstrip("/").endswith("/api/2/instances/report")
    token_candidates = [t for t in zeev_tokens() if t and t not in BAD_ZEEV_TOKENS] if is_zeev else [None]
    if is_zeev and not token_candidates and merged.get("Authorization"):
        token_candidates = [""]
    if is_zeev and not token_candidates:
        raise RuntimeError("ZEEV_TOKEN e obrigatorio.")

    last_error = None
    attempts = max(1, int(retries) if str(retries).strip() else 1)
    if is_supabase:
        attempts = max(attempts, max(3, min(int(os.environ.get("ZEEV_SUPABASE_CALL_RETRIES", "6") or "6"), 10)))
    collected_rows = []
    collected_rows_success = False
    fallback_data = None
    fallback_set = False
    for token_index, token in enumerate(token_candidates):
        auth_attempts = zeev_auth_attempts(token) if is_zeev else [("none", {})]
        for auth_label, auth_headers in auth_attempts:
            current_headers = dict(merged)
            current_headers.update(auth_headers)
            for attempt in range(attempts):
                retry_delay = None
                req = urllib.request.Request(url, data=body, method=method, headers=current_headers)
                try:
                    with urllib.request.urlopen(req, timeout=timeout) as resp:
                        raw = resp.read()
                        text = decode_http_text(raw, resp.headers.get("Content-Type", ""))
                        data = json.loads(text) if text.strip() else {}
                        if merge_token_rows:
                            collected_rows_success = True
                            collected_rows.extend(data if isinstance(data, list) else [data])
                            last_error = None
                            break
                        if requested_fields and not form_fields_present(data) and token_index < len(token_candidates) - 1:
                            if not fallback_set:
                                fallback_data = data
                                fallback_set = True
                            last_error = None
                            break
                        return data
                except urllib.error.HTTPError as exc:
                    raw = exc.read()
                    text = decode_http_text(raw, exc.headers.get("Content-Type", ""))
                    suffix = f" [{auth_label}]" if is_zeev else ""
                    last_error = RuntimeError(f"{method} {url}{suffix} -> HTTP {exc.code}: {text}")
                    if is_zeev and exc.code in (401, 403):
                        break
                    if exc.code in (520, 522, 524):
                        retry_delay = 60
                    if is_supabase and is_transient_http_error(f"HTTP {exc.code}: {text}"):
                        retry_delay = min(20 + attempt * 10, 75)
                    if exc.code not in (429, 500, 502, 503, 504, 520, 522, 524, 546):
                        raise last_error
                except Exception as exc:
                    last_error = exc
                    if is_supabase and is_transient_http_error(str(exc)):
                        retry_delay = min(20 + attempt * 10, 75)
                if attempt < attempts - 1:
                    time.sleep(retry_delay or (2 + attempt * 3))
    if merge_token_rows and (collected_rows_success or collected_rows):
        return merge_zeev_rows_by_id(collected_rows)
    if fallback_set:
        return fallback_data
    if isinstance(last_error, BaseException):
        raise last_error
    raise RuntimeError(f"{method} {url} falhou sem resposta detalhada.")


def supabase_rest(path, method="GET", payload=None, timeout=60, prefer="return=minimal"):
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY e obrigatorio para gravar direto no Supabase.")
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    url = f"{SUPABASE_URL}/rest/v1{path}"
    return request_json(method, url, headers=headers, payload=payload, timeout=timeout, retries=3)


def supabase_rest_all(path, page_size=1000, timeout=90):
    rows = []
    offset = 0
    page_size = max(1, min(int(page_size or 1000), 1000))
    while True:
        sep = "&" if "?" in path else "?"
        page = supabase_rest(f"{path}{sep}limit={page_size}&offset={offset}", timeout=timeout, prefer="")
        page_rows = page if isinstance(page, list) else []
        rows.extend(page_rows)
        if len(page_rows) < page_size:
            break
        offset += page_size
    return rows


FLOW_DESIGN_FORM_CACHE = {}
FLOW_DESIGN_RELEVANT_CACHE = {}
FLOW_DESIGN_FISCAL_NUMBER_CACHE = {}
FLOW_DESIGN_FINANCE_DESCRIPTION_CACHE = {}


def looks_like_relevant_design_field(field):
    hay = " ".join(
        str(field.get(k) or "")
        for k in ("name", "label", "title", "caption", "typeName", "validationName", "groupName")
    )
    key = norm_key(hay)
    if not key:
        return False
    return bool(re.search(
        r"(capex|documento|document|arquivo|anexo|nota|notafiscal|nfse|nfe|danfe|xml|pdf|"
        r"boleto|comprovante|recibo|fatura|download|file|upload|valor|pagamento|parcela|"
        r"fornecedor|favorecido|beneficiario|razaosocial|cnpj|cpf|cgc|chavedeacesso|"
        r"numero|nro|numerodanf|numeronf|serie|dataemissao|vencimento|previsao|centrodecusto|"
        r"codigodocentrodecusto|coligada|unidade|filial|solicitante|email|informacoes|"
        r"justificativa|descricao|servico|item|produto|material|quantidade|frete)",
        key,
    ))


def walk_json_objects(value):
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from walk_json_objects(nested)
    elif isinstance(value, list):
        for item in value:
            yield from walk_json_objects(item)


def flow_design_form_fields(flow_id):
    flow = int(flow_id or 0)
    if not flow or not has_zeev_token():
        return []
    if flow in FLOW_DESIGN_FORM_CACHE:
        return FLOW_DESIGN_FORM_CACHE[flow]
    try:
        data = request_json(
            "GET",
            f"{ZEEV_BASE_URL}/api/2/flows/{flow}/design/form",
            headers={"Authorization": f"Bearer {ZEEV_TOKEN}"},
            timeout=120,
            retries=2,
        )
        fields = []
        seen = set()
        for obj in walk_json_objects(data):
            if not isinstance(obj, dict):
                continue
            name = str(obj.get("name") or "").strip()
            label = str(obj.get("label") or obj.get("title") or obj.get("caption") or "").strip()
            if not name and not label:
                continue
            key = "|".join([name, label, str(obj.get("rowOrder") or ""), str(obj.get("columnOrder") or "")])
            if key in seen:
                continue
            seen.add(key)
            fields.append(obj)
    except Exception as exc:
        print(json.dumps({"flowDesignError": flow, "error": str(exc)[:300]}, ensure_ascii=False), file=sys.stderr)
        fields = []
    FLOW_DESIGN_FORM_CACHE[flow] = fields
    return fields


def flow_design_relevant_fields(flow_id):
    flow = int(flow_id or 0)
    if not flow or not has_zeev_token():
        return []
    if flow in FLOW_DESIGN_RELEVANT_CACHE:
        return FLOW_DESIGN_RELEVANT_CACHE[flow]
    names = []
    for obj in flow_design_form_fields(flow):
        if not looks_like_relevant_design_field(obj):
            continue
        name = str(obj.get("name") or "").strip()
        label = str(obj.get("label") or "").strip()
        if name:
            names.append(name)
        # Labels are kept only as fallback; technical names are the primary filters.
        if label and not name:
            names.append(label)
    result = unique_fields(names)
    FLOW_DESIGN_RELEVANT_CACHE[flow] = result
    return result


def finance_request_description_fields(flow_id=0):
    flow = int(flow_id or 0)
    if not flow:
        return FINANCE_REQUEST_DESCRIPTION_FIELDS
    if flow in FLOW_DESIGN_FINANCE_DESCRIPTION_CACHE:
        return FLOW_DESIGN_FINANCE_DESCRIPTION_CACHE[flow]
    target_keys = {norm_key(name) for name in FINANCE_REQUEST_DESCRIPTION_FIELDS}
    discovered = []
    for obj in flow_design_form_fields(flow):
        name = str(obj.get("name") or "").strip()
        display_values = [
            str(obj.get(key) or "").strip()
            for key in ("label", "title", "caption", "displayName")
        ]
        identity_values = [name, *display_values]
        if not any(
            norm_key(re.sub(r"\s*\*$", "", value).strip()) in target_keys
            for value in identity_values
            if value
        ):
            continue
        if name:
            discovered.append(name)
        discovered.extend(value for value in display_values if value)
    result = unique_fields(discovered, FINANCE_REQUEST_DESCRIPTION_FIELDS)
    FLOW_DESIGN_FINANCE_DESCRIPTION_CACHE[flow] = result
    return result


def flow_design_fiscal_number_fields(flow_id):
    flow = int(flow_id or 0)
    if not flow or not has_zeev_token():
        return []
    if flow in FLOW_DESIGN_FISCAL_NUMBER_CACHE:
        return FLOW_DESIGN_FISCAL_NUMBER_CACHE[flow]
    names = []
    for obj in flow_design_form_fields(flow):
        name = str(obj.get("name") or "").strip()
        label = str(obj.get("label") or obj.get("title") or obj.get("caption") or "").strip()
        group = str(obj.get("groupName") or obj.get("integrationName") or obj.get("typeName") or "").strip()
        if not name and not label:
            continue
        name_key = norm_key(name)
        label_key = norm_key(label)
        context_key = norm_key(" ".join([name, label, group]))
        looks_fiscal = bool(re.search(r"(nota|notafiscal|nfse|nfe|nf|fatura|recibo|documento|danfe)", context_key))
        looks_number = (
            label_key in {"numero", "n", "nro", "num"}
            or name_key in {"numero", "nro", "num", "numerodocumento", "numeronotafiscal", "numeronf", "numerofatura", "numerorecibo"}
            or ("numero" in name_key and looks_fiscal)
        )
        if looks_number or (looks_fiscal and "numero" in context_key):
            if name:
                names.append(name)
            elif label:
                names.append(label)
    result = unique_fields(names)
    FLOW_DESIGN_FISCAL_NUMBER_CACHE[flow] = result
    return result


def is_transient_http_error(message):
    text = str(message or "")
    return any(token in text for token in [
        "HTTP 429", "HTTP 500", "HTTP 502", "HTTP 503", "HTTP 504",
        "HTTP 520", "HTTP 522", "HTTP 524", "HTTP 546",
        "unknown_origin_error", "Cloudflare", "WORKER_RESOURCE_LIMIT",
        "PGRST002", "schema cache", "Connection timed out", "Web server is down",
    ])


def supabase_automation_mode(mode):
    key = norm_key(mode)
    return key in {
        "incremental", "deepincremental", "retro", "deepretro", "deep",
        "rescuedocs", "rescuedocsloop", "docrescueloop", "backfilldocs",
        "docsbackfill", "backfill", "refreshpaymentstatuses", "refreshpayments",
        "paymentstatuses", "docrescueaudit", "rescuedocsaudit", "auditdocs",
    }


def allow_transient_success():
    return os.environ.get("ZEEV_ALLOW_TRANSIENT_SUCCESS", "").strip().lower() in {"1", "true", "sim", "yes", "on"}


def supabase_healthcheck(timeout=12):
    if not ZEEV_SYNC_SECRET:
        return {"ok": False, "reason": "ZEEV_SYNC_SECRET ausente"}
    url = f"{SUPABASE_URL}/functions/v1/zeev-capex-sync"
    # This preflight guards Supabase availability only. Zeev health is checked
    # by the worker's authenticated reads; probing it here made a slow Zeev
    # response incorrectly pause an otherwise healthy persistence cycle.
    body = json.dumps({"mode": "health", "skipZeev": True}, ensure_ascii=False).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {ZEEV_SYNC_SECRET}",
        "x-cron-secret": ZEEV_SYNC_SECRET,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "ObrasRealEstate/healthcheck",
    }
    try:
        req = urllib.request.Request(url, data=body, method="POST", headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            data = json.loads(raw) if raw else {}
            return {"ok": bool(data.get("ok")), "status": int(resp.status), **({} if isinstance(data, list) else data)}
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        return {"ok": False, "status": exc.code, "error": text[:500], "transient": is_transient_http_error(f"HTTP {exc.code}: {text}")}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:500], "transient": is_transient_http_error(str(exc))}


def maybe_skip_for_supabase_health(mode):
    if AUTOMATION_PAUSED and supabase_automation_mode(mode):
        return {"ok": True, "mode": mode, "skipped": True, "reason": "ZEEV_AUTOMATION_PAUSED"}
    key = norm_key(mode)
    total_scan_allowed = {"rescuedocs", "rescuedocsloop", "docrescueloop", "backfilldocs", "docsbackfill", "backfill", "docrescueaudit", "rescuedocsaudit", "auditdocs"}
    if TOTAL_SCAN_LOCK and supabase_automation_mode(mode) and key not in total_scan_allowed:
        try:
            payload = {
                "mode": "doc-rescue-audit",
                "staleHours": int(os.environ.get("ZEEV_BACKFILL_STALE_HOURS", os.environ.get("ZEEV_DOC_RESCUE_STALE_HOURS", "8"))),
                "sampleLimit": 1,
            }
            audit = request_json(
                "POST",
                f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
                headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
                payload=payload,
                timeout=120,
                retries=2,
            )
            queue_total = int(((audit or {}).get("queue") or {}).get("total") or 0)
            if queue_total > 0:
                return {"ok": True, "mode": mode, "skipped": True, "reason": "varredura_total_controlada_em_andamento", "queueTotal": queue_total}
        except Exception as exc:
            return {"ok": True, "mode": mode, "skipped": True, "reason": "auditoria_da_varredura_total_indisponivel", "error": str(exc)[:500]}
    if os.environ.get("ZEEV_SKIP_SUPABASE_PREFLIGHT", "").strip().lower() in {"1", "true", "sim", "yes"}:
        return None
    if not supabase_automation_mode(mode):
        return None
    health = supabase_healthcheck()
    if health.get("ok"):
        return None
    reason = "zeev_token_or_api_unhealthy" if isinstance(health.get("zeev"), dict) and not health.get("zeev", {}).get("ok") else "supabase_rest_unhealthy"
    return {"ok": True, "mode": mode, "skipped": True, "reason": reason, "health": health}


def capex_fields(flow_id=None):
    names = list(CAPEX_FIELD_CANDIDATES)
    for extra in DEFAULT_CAPEX_FIELDS.get(int(flow_id or 0), []):
        if norm_key(extra) not in {norm_key(x) for x in names}:
            names.append(extra)
    return names


def flow_text(row):
    flow = row.get("flow") or {}
    raw = row.get("raw_instance") if isinstance(row.get("raw_instance"), dict) else {}
    raw_flow = raw.get("flow") if isinstance(raw.get("flow"), dict) else {}
    return " ".join(str(x or "") for x in [
        flow.get("name"),
        raw_flow.get("name"),
        row.get("flowName"),
        row.get("flow_name"),
        row.get("requestName"),
        row.get("request_name"),
        raw.get("flowName"),
        raw.get("requestName"),
        (row.get("service") or {}).get("name"),
    ])


def is_finance_row(row):
    flow = row.get("flow") or {}
    raw = row.get("raw_instance") if isinstance(row.get("raw_instance"), dict) else {}
    raw_flow = raw.get("flow") if isinstance(raw.get("flow"), dict) else {}
    flow_id = int(flow.get("id") or row.get("flowId") or row.get("flow_id") or raw_flow.get("id") or raw.get("flowId") or 0)
    return flow_id in FINANCE_FLOW_IDS or "financeir" in norm(flow_text(row))


def is_purchase_row(row):
    flow = row.get("flow") or {}
    raw = row.get("raw_instance") if isinstance(row.get("raw_instance"), dict) else {}
    raw_flow = raw.get("flow") if isinstance(raw.get("flow"), dict) else {}
    flow_id = int(flow.get("id") or row.get("flowId") or row.get("flow_id") or raw_flow.get("id") or raw.get("flowId") or 0)
    txt = norm(flow_text(row))
    return flow_id in PURCHASE_FLOW_IDS or "compra" in txt or "solicitacao de compras" in txt


def is_target_flow_row(row):
    return is_finance_row(row) or is_purchase_row(row)


def is_yes(value):
    return norm(value) in {"sim", "s", "yes", "true", "1"}


def field_value(fields, names):
    for field in fields or []:
        if field_matches(field, names) and str(field.get("value") or "").strip():
            return str(field.get("value")).strip()
    return ""


def field_value_by_priority(fields, names):
    for name in names:
        for field in fields or []:
            if field_matches(field, [name]) and str(field.get("value") or "").strip():
                return str(field.get("value")).strip()
    return ""


def field_value_with_source_by_priority(fields, names):
    for name in names:
        for field in fields or []:
            if field_matches(field, [name]) and str(field.get("value") or "").strip():
                return str(field.get("value")).strip(), field_display_name(field) or name
    return "", ""


def clean_fiscal_document_number(value):
    raw = str(value or "").strip()
    if not raw:
        return ""
    lowered = raw.lower()
    if re.search(r"\.(pdf|xml|docx?|xlsx?|xls|csv|png|jpe?g)\b", lowered) or "/" in raw or "\\" in raw or "http" in lowered:
        return ""
    if re.search(r"\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b", raw):
        return ""
    digits = re.sub(r"\D+", "", raw)
    if not digits:
        return ""
    if len(digits) == 44:
        return str(int(digits[25:34]))
    if len(digits) > 14:
        return ""
    return digits.lstrip("0") or "0"


def fiscal_year_prefixed_number(value):
    digits = re.sub(r"\D+", "", str(value or ""))
    if not re.match(r"^20\d{2}\d{1,9}$", digits):
        return ""
    suffix = digits[4:].lstrip("0")
    return suffix or "0"


def explicit_fiscal_field(field):
    hay = norm_key(" ".join(field_name_candidates(field)))
    return bool(re.search(r"(numerodanf|numeronf|numeronotafiscal|numerofatura|numerorecibo|notafiscal|nota|nf)", hay))


def clean_fiscal_document_number_for_field(field, value):
    number = clean_fiscal_document_number(value)
    if not number:
        return ""
    # Legacy Zeev finance flows stored NF numbers as YYYY + document number
    # in explicit fiscal fields such as numeroDaNF. Do not apply this to
    # generic "Numero" fields, because those can also be dates or unrelated ids.
    if explicit_fiscal_field(field):
        prefixed = fiscal_year_prefixed_number(value)
        if prefixed:
            return prefixed
    return number


def looks_like_compact_date_number(digits):
    text = str(digits or "")
    if len(text) != 8 or not text.startswith(("19", "20")):
        return False
    try:
        month = int(text[4:6])
        day = int(text[6:8])
    except ValueError:
        return False
    return 1 <= month <= 12 and 1 <= day <= 31


def fiscal_number_from_attachment_text(raw):
    text = urllib.parse.unquote(str(raw or ""))
    if not text:
        return "", ""
    parsed = urllib.parse.urlparse(text)
    candidates = [text]
    if parsed.path:
        candidates.append(os.path.basename(parsed.path))
    for candidate in candidates:
        label = urllib.parse.unquote(str(candidate or ""))
        if not label:
            continue
        labels = [label, re.sub(r"(?i)(?:^|[_-])20(?=[A-Za-z])", " ", label).replace("_20", " ")]
        patterns = [
            ("NF-e", r"(?i)(?:^|[^a-z0-9])(?:danfe|nf(?:s[\s_.-]*e|se|e)?)(?:[^0-9]{0,30})(?<!\d)(\d{1,9})(?!\d)"),
            ("NF-e", r"(?i)(?:^|[^a-z0-9])boleto[^0-9a-z]{0,20}da[^0-9a-z]{0,20}nf(?:[^0-9]{0,30})(?<!\d)(\d{1,9})(?!\d)"),
            ("FATURA", r"(?i)(?:^|[^a-z0-9])fatura(?:[^0-9]{0,45})(?<!\d)(\d{1,9})(?!\d)"),
            ("RECIBO", r"(?i)(?:^|[^a-z0-9])recibo(?:[^0-9]{0,45})(?<!\d)(\d{1,9})(?!\d)"),
        ]
        for candidate_label in labels:
            for doc_type, pattern in patterns:
                match = re.search(pattern, candidate_label)
                if not match:
                    continue
                number = clean_fiscal_document_number(match.group(1))
                if not number or looks_like_compact_date_number(number):
                    continue
                return doc_type, number
    return "", ""


def fiscal_number_from_attachment_fields(fields):
    for field in fields or []:
        if not field_matches(field, DOCUMENT_FIELDS + ["anexarNotaFiscal", "anexarBoletoAVista", "anexarBoletoParcelado"]):
            continue
        for key in ("openUrl", "url", "downloadUrl", "value"):
            doc_type, number = fiscal_number_from_attachment_text(field.get(key))
            if number:
                return doc_type, number
    return "", ""


def same_row_has_context(fields, row):
    same = [field for field in fields or [] if int(field.get("row") or 1) == int(row or 1)]
    if not same:
        same = fields or []
    return any(
        field_matches(field, ISSUE_DATE_FIELDS + DOCUMENT_FIELDS + ["Outros gastos", "Tipo de documento", "Tipo do documento"])
        for field in same
    )


def fiscal_document_number(fields, financeiro=False):
    for name in FISCAL_NUMBER_FIELDS:
        for field in fields or []:
            if not field_matches(field, [name]):
                continue
            value = str(field.get("value") or "").strip()
            if not value:
                continue
            cleaned = clean_fiscal_document_number_for_field(field, value)
            if cleaned:
                return cleaned
    if not financeiro:
        return ""

    candidates = []
    has_global_context = any(
        field_matches(field, ISSUE_DATE_FIELDS + DOCUMENT_FIELDS + ["Outros gastos", "Tipo de documento", "Tipo do documento"])
        for field in fields or []
    )
    for field in fields or []:
        if not field_matches(field, GENERIC_FISCAL_NUMBER_FIELDS):
            continue
        value = str(field.get("value") or "").strip()
        number = clean_fiscal_document_number(value)
        if not number:
            continue
        score = 100
        if same_row_has_context(fields, field.get("row") or 1):
            score += 30
        if has_global_context:
            score += 10
        if str(field.get("source") or "").lower() == "reportlink":
            score += 5
        candidates.append({
            "number": number,
            "score": score,
            "name": field_display_name(field),
            "row": int(field.get("row") or 1),
        })
    if not candidates:
        return ""
    candidates.sort(key=lambda item: (-item["score"], item["row"], item["name"]))
    return candidates[0]["number"]


def field_money_values(fields, names):
    values = []
    for field in fields or []:
        value = str(field.get("value") or "").strip()
        if not value or not field_matches(field, names):
            continue
        amount = parse_money(value)
        if amount:
            values.append({
                "amount": amount,
                "row": int(field.get("row") or 1),
                "name": next(field_name_candidates(field), ""),
            })
    return values


def best_money_from_fields(fields, names):
    values = field_money_values(fields, names)
    if not values:
        return 0.0
    return max(v["amount"] for v in values)


def money_by_priority(fields, names):
    for name in names:
        values = field_money_values(fields, [name])
        if values:
            return max(v["amount"] for v in values)
    return 0.0


def has_capex(fields, flow_id):
    for field in fields or []:
        if (field_matches(field, capex_fields(flow_id)) or any("capex" in norm_key(c) for c in field_name_candidates(field))) and is_yes(field.get("value")):
            return field
    return None


ZEEV_FINISHED_TASK_PAGE_LIMIT = 30


def finished_task_page_size(page_size):
    return min(max(int(page_size or ZEEV_FINISHED_TASK_PAGE_LIMIT), 1), ZEEV_FINISHED_TASK_PAGE_LIMIT)


def report_page(flow_id, page, start, end, page_size=30, fields=None, timeout=120):
    page_size = finished_task_page_size(page_size)
    payload = {
        "flowId": flow_id,
        "startDateIntervalBegin": start,
        "startDateIntervalEnd": end,
        "recordsPerPage": page_size,
        "pageNumber": page,
        "useCache": False,
        "formFieldNames": fields if fields is not None else capex_fields(flow_id),
        "showPendingInstanceTasks": True,
        "showFinishedInstanceTasks": True,
        "showPendingAssignees": True,
        "allowOpenUrlsForFilesInForm": True,
    }
    data = request_json(
        "POST",
        f"{ZEEV_BASE_URL}/api/2/instances/report",
        headers={"Authorization": f"Bearer {ZEEV_TOKEN}"},
        payload=payload,
        timeout=timeout,
    )
    return data if isinstance(data, list) else [data]


def report_page_last_task(flow_id, page, start, end, page_size=30, fields=None, timeout=120):
    page_size = finished_task_page_size(page_size)
    payload = {
        "flowId": flow_id,
        "lastTaskEndDateIntervalBegin": start,
        "lastTaskEndDateIntervalEnd": end,
        "recordsPerPage": page_size,
        "pageNumber": page,
        "useCache": False,
        "formFieldNames": fields if fields is not None else capex_fields(flow_id),
        "showPendingInstanceTasks": True,
        "showFinishedInstanceTasks": True,
        "showPendingAssignees": True,
        "allowOpenUrlsForFilesInForm": True,
    }
    data = request_json(
        "POST",
        f"{ZEEV_BASE_URL}/api/2/instances/report",
        headers={"Authorization": f"Bearer {ZEEV_TOKEN}"},
        payload=payload,
        timeout=timeout,
    )
    return data if isinstance(data, list) else [data]


def report_page_all(page, start, end, page_size=30, fields=None):
    page_size = finished_task_page_size(page_size)
    payload = {
        "startDateIntervalBegin": start,
        "startDateIntervalEnd": end,
        "recordsPerPage": page_size,
        "pageNumber": page,
        "useCache": False,
        "simulation": False,
        "formFieldNames": fields if fields is not None else capex_fields(None),
        "showPendingInstanceTasks": True,
        "showFinishedInstanceTasks": True,
        "showPendingAssignees": True,
        "allowOpenUrlsForFilesInForm": True,
    }
    data = request_json(
        "POST",
        f"{ZEEV_BASE_URL}/api/2/instances/report",
        headers={"Authorization": f"Bearer {ZEEV_TOKEN}"},
        payload=payload,
        timeout=120,
    )
    return data if isinstance(data, list) else [data]


def report_instance_get(instance_id, fields=None, timeout=90, retries=3, use_cache=False):
    params = [
        ("instanceId", int(instance_id)),
        ("recordsPerPage", 10),
        ("pageNumber", 1),
        ("useCache", "true" if use_cache else "false"),
        ("simulation", "false"),
        ("showPendingInstanceTasks", "true"),
        ("showFinishedInstanceTasks", "true"),
        ("showPendingAssignees", "true"),
        ("allowOpenUrlsForFilesInForm", "true"),
    ]
    for field in fields or []:
        params.append(("formFieldNames", field))
    url = f"{ZEEV_BASE_URL}/api/2/instances/report?" + urllib.parse.urlencode(params)
    data = request_json(
        "GET",
        url,
        headers={"Authorization": f"Bearer {ZEEV_TOKEN}"},
        timeout=timeout,
        retries=retries,
    )
    return data if isinstance(data, list) else [data]


def report_instance(instance_id, flow_id=0, fields=None, page_size=10, timeout=90, retries=3):
    payload = {
        "instanceId": int(instance_id),
        "recordsPerPage": min(max(int(page_size or 10), 1), 100),
        "pageNumber": 1,
        "useCache": False,
        "simulation": False,
        "showPendingInstanceTasks": True,
        "showFinishedInstanceTasks": True,
        "showPendingAssignees": True,
        "allowOpenUrlsForFilesInForm": True,
    }
    if flow_id:
        payload["flowId"] = int(flow_id)
    if fields is not None:
        payload["formFieldNames"] = fields
    data = request_json(
        "POST",
        f"{ZEEV_BASE_URL}/api/2/instances/report",
        headers={"Authorization": f"Bearer {ZEEV_TOKEN}"},
        payload=payload,
        timeout=timeout,
        retries=retries,
    )
    return data if isinstance(data, list) else [data]


def merge_zeev_fields(*groups):
    out = []
    seen = set()
    for group in groups:
        for field in group or []:
            if not isinstance(field, dict):
                continue
            key = "|".join(str(x or "") for x in [
                field_display_name(field),
                field.get("row") or 1,
                field.get("id") or "",
                field.get("openUrl") or field.get("url") or field.get("downloadUrl") or "",
            ])
            if key in seen:
                continue
            seen.add(key)
            out.append(field)
    return out


def instance_fields(instance_id, fields, timeout=90, retries=3):
    latest = {}
    found = []
    errors = []

    def direct_instance(use_cache=False, allow_open_urls=True):
        params = [("showPendingInstanceTasks", "true"), ("showFinishedInstanceTasks", "true"),
                  ("showPendingAssignees", "true"), ("useCache", "true" if use_cache else "false")]
        if allow_open_urls:
            params.append(("allowOpenUrlsForFilesInForm", "true"))
        for field in fields or []:
            params.append(("formFieldNames", field))
        url = f"{ZEEV_BASE_URL}/api/2/instances/{instance_id}?" + urllib.parse.urlencode(params)
        return request_json("GET", url, headers={"Authorization": f"Bearer {ZEEV_TOKEN}"}, timeout=timeout, retries=retries)

    attempts = [
        ("GET /api/2/instances useCache=false", lambda: [direct_instance(False, True)]),
        ("GET /api/2/instances useCache=true", lambda: [direct_instance(True, True)]),
        ("POST /api/2/instances/report instanceId", lambda: report_instance(instance_id, 0, fields=fields if fields else None, timeout=timeout, retries=retries)),
        ("GET /api/2/instances/report instanceId useCache=false", lambda: report_instance_get(instance_id, fields=fields if fields else None, timeout=timeout, retries=retries, use_cache=False)),
        ("GET /api/2/instances/report instanceId useCache=true", lambda: report_instance_get(instance_id, fields=fields if fields else None, timeout=timeout, retries=retries, use_cache=True)),
    ]
    for label, fetch_rows in attempts:
        try:
            rows = fetch_rows()
            target = next((row for row in rows if int(row.get("id") or row.get("instanceId") or 0) == int(instance_id)), (rows[0] if rows else {}))
            if not target:
                continue
            latest = target or latest
            found = merge_zeev_fields(found, target.get("formFields") or [])
            has_requested_fields = bool(found) if not fields else any(field_matches(field, fields) for field in found)
            if has_requested_fields:
                break
            errors.append(f"{label}: resposta sem os formFields solicitados")
        except Exception as exc:
            errors.append(f"{label}: {str(exc)[:450]}")
    requested_fields_missing = bool(fields) and not any(field_matches(field, fields) for field in found)
    if requested_fields_missing:
        fallback_errors = []
        try:
            latest_all, found_all = instance_fields(instance_id, [], timeout=timeout, retries=max(1, retries - 1))
            latest = latest_all or latest
            found = merge_zeev_fields(found, found_all)
        except Exception as exc:
            fallback_errors.append(f"fallback sem formFieldNames: {str(exc)[:300]}")
        requested_fields_missing = not any(field_matches(field, fields) for field in found)
        if len(fields) > 1 and requested_fields_missing:
            for field_name in unique_fields(fields):
                try:
                    latest_one, found_one = instance_fields(instance_id, [field_name], timeout=timeout, retries=max(1, retries - 1))
                    latest = latest_one or latest
                    found = merge_zeev_fields(found, found_one)
                    if any(field_matches(field, fields) for field in found):
                        break
                except Exception as exc:
                    fallback_errors.append(f"{field_name}: {str(exc)[:220]}")
        if found or latest:
            return latest, found
        errors.extend(fallback_errors)
    if not latest and errors:
        raise RuntimeError(" | ".join(errors))
    return latest, found


def instance_messages(instance_id):
    url = f"{ZEEV_BASE_URL}/api/2/messages/instance/{instance_id}?useCache=false"
    data = request_json("GET", url, headers={"Authorization": f"Bearer {ZEEV_TOKEN}"}, timeout=90)
    return data if isinstance(data, list) else []


def clean_zeev_message_body(value):
    text = str(value or "")
    if not text.strip():
        return ""
    text = re.sub(r"(?i)<\s*br\s*/?\s*>", "\n", text)
    text = re.sub(r"(?i)</\s*(p|div|li|tr|h[1-6])\s*>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_lib.unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def strip_html_to_lines(raw_html):
    text = str(raw_html or "")
    text = re.sub(r"(?is)<\s*script.*?<\s*/\s*script\s*>", " ", text)
    text = re.sub(r"(?is)<\s*style.*?<\s*/\s*style\s*>", " ", text)
    text = re.sub(r"(?i)<\s*br\s*/?\s*>", "\n", text)
    text = re.sub(r"(?i)</\s*(p|div|tr|li|section|article|h[1-6]|label|td|th)\s*>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_lib.unescape(text).replace("\r", "\n")
    return [re.sub(r"\s+", " ", line).strip() for line in text.split("\n") if re.sub(r"\s+", " ", line).strip()]


def split_report_line(line):
    clean = re.sub(r"\s+", " ", str(line or "")).strip()
    if len(clean) < 3:
        return None
    explicit = re.match(r"^(.{2,90}?)(?:\s*[:：]\s+|\s{2,}| \* +)(.{1,6000})$", clean)
    if explicit:
        return {"label": re.sub(r"\s*\*$", "", explicit.group(1)).strip(), "value": explicit.group(2).strip()}
    known_labels = [
        "Valor total do pagamento",
        "Informações referentes à solicitação",
        "Informacoes referentes a solicitacao",
        "Justificativa do pedido",
        "Descrição do serviço",
        "Descricao do servico",
        "Lista para cotação",
        "Lista para cotacao",
        "Documento",
        "CAPEX",
        "É um investimento (CAPEX)?",
        "E um investimento (CAPEX)?",
        "Centro de custo",
        "CNPJ",
    ]
    clean_norm = norm(clean)
    for label in known_labels:
        if not clean_norm.startswith(norm(label)):
            continue
        rest = clean[min(len(label), len(clean)):].lstrip(" :*.-").strip()
        if rest:
            return {"label": label, "value": rest}
    return None


REPORT_ADJACENT_FIELD_LABELS = [
    "Valor total do pagamento",
    "Informa\u00e7\u00f5es referentes \u00e0 solicita\u00e7\u00e3o",
    "Informacoes referentes a solicitacao",
    "Justificativa do pedido",
    "Descri\u00e7\u00e3o do servi\u00e7o",
    "Descricao do servico",
    "Lista para cota\u00e7\u00e3o",
    "Lista para cotacao",
    "Documento",
    "CAPEX",
    "\u00c9 um investimento (CAPEX)?",
    "E um investimento (CAPEX)?",
    "Centro de custo",
    "CNPJ",
]


def report_fields_from_html(raw_html):
    fields = []
    seen = set()
    lines = strip_html_to_lines(raw_html)
    index = 0
    while index < len(lines):
        line = lines[index]
        pair = split_report_line(line)
        if not pair:
            clean_label = re.sub(r"\s*\*$", "", line).strip()
            matched_label = next(
                (label for label in REPORT_ADJACENT_FIELD_LABELS if norm(label) == norm(clean_label)),
                "",
            )
            if matched_label and index + 1 < len(lines):
                next_line = lines[index + 1].strip()
                next_is_label = any(
                    norm(re.sub(r"\s*\*$", "", next_line).strip()) == norm(label)
                    for label in REPORT_ADJACENT_FIELD_LABELS
                )
                if next_line and not next_is_label:
                    pair = {"label": matched_label, "value": next_line}
                    index += 1
        if not pair:
            index += 1
            continue
        label = re.sub(r"\s+", " ", pair["label"]).strip()
        value = re.sub(r"\s+", " ", pair["value"]).strip()
        if not label or not value or value == "*" or len(label) > 120:
            index += 1
            continue
        key = f"{norm_key(label)}|{value}"
        if key in seen:
            index += 1
            continue
        seen.add(key)
        fields.append({"name": label, "label": label, "value": value, "row": 1, "source": "reportLink"})
        index += 1
    return fields


def fetch_report_link_fields(report_link):
    link = str(report_link or "").strip()
    if not link or not has_zeev_token():
        return [], {}
    url = link if link.startswith("http") else f"{ZEEV_BASE_URL.rstrip('/')}/{'/' if not link.startswith('/') else ''}{link}"
    status, ctype, text = fetch_text_for_source(url)
    meta = {"status": status, "contentType": ctype, "length": len(text)}
    if status < 200 or status >= 300:
        raise RuntimeError(f"reportLink HTTP {status}: {text[:240]}")
    return report_fields_from_html(text), meta


def generic_purchase_text(value):
    text = clean_item_description(value)
    n = norm(text)
    if not n:
        return False
    if len(text) <= 90 and re.search(r"\bservico(s)?\b", n):
        return True
    return bool(re.match(r"^(servico|servicos|material|materiais|produto|produtos|item|itens)( de| para|$)", n))


def best_message_description(messages, service_desc="", item_text=""):
    bodies = []
    for msg in messages or []:
        body = clean_zeev_message_body((msg or {}).get("body"))
        if len(body) < 80:
            continue
        n = norm(body)
        if n.startswith(("cancelado", "ajustado", "ok", "aprovado", "reprovado")):
            continue
        bodies.append(body)
    if not bodies:
        return ""

    service_norm = norm(service_desc)
    if service_norm:
        needle = service_norm[: min(70, len(service_norm))]
        for body in bodies:
            if needle and needle in norm(body):
                return body

    cues = ("solicita", "necess", "escopo", "servico", "servicos", "instalacao", "fornecimento", "compra", "adequacao")
    cued = [body for body in bodies if any(cue in norm(body) for cue in cues)]
    if cued:
        return max(cued, key=len)

    if generic_purchase_text(item_text):
        return max(bodies, key=len)
    return ""


def enrich_instance(row):
    flow_id = int((row.get("flow") or {}).get("id") or row.get("flowId") or 0)
    financeiro = is_finance_row(row)
    design_fields = flow_design_relevant_fields(flow_id)
    all_fields = {}
    errors = []
    latest = row
    base_fields = row.get("formFields") or []
    for field in base_fields:
        display = field_display_name(field)
        if not display:
            continue
        key = f"{display}|{field.get('row') or 1}"
        all_fields[key] = field
    if not row.get("__allFieldsLoaded"):
        try:
            detail, found = instance_fields(
                row["id"],
                [],
                timeout=env_int("ZEEV_ENRICH_REQUEST_TIMEOUT_SECONDS", 35, 8, 90),
                retries=env_int("ZEEV_ENRICH_REQUEST_RETRIES", 1, 1, 3),
            )
            latest = detail or latest
            for field in found:
                display = field_display_name(field)
                if not display:
                    continue
                key = f"{display}|{field.get('row') or 1}"
                all_fields[key] = field
        except Exception as exc:
            errors.append({"field": "__all__", "error": str(exc)[:300]})

    current_fields = list(all_fields.values())
    missing_design_fields = [
        name for name in design_fields
        if not any(field_matches(field, [name]) for field in current_fields)
    ]
    priority_alias_fields = []
    missing_alias_fields = []
    finance_description_fields = finance_request_description_fields(flow_id) if financeiro else []
    if financeiro and not field_value_by_priority(current_fields, finance_description_fields):
        priority_alias_fields.extend(finance_description_fields)
    if not has_capex(current_fields, flow_id):
        missing_alias_fields.extend(capex_fields(flow_id))
    if not field_value(current_fields, VALUE_TOTAL_FIELDS):
        missing_alias_fields.extend(VALUE_TOTAL_FIELDS)
        if financeiro:
            missing_alias_fields.extend(NEXT_PAYMENT_VALUE_FIELDS)
            missing_alias_fields.extend(INSTALLMENT_COUNT_FIELDS)
    if financeiro:
        if not field_value(current_fields, unique_fields(FISCAL_NUMBER_FIELDS, GENERIC_FISCAL_NUMBER_FIELDS)):
            missing_alias_fields.extend(unique_fields(FISCAL_NUMBER_FIELDS, GENERIC_FISCAL_NUMBER_FIELDS))
    else:
        has_service_description = bool(field_value(current_fields, PURCHASE_SERVICE_DESCRIPTION_FIELDS))
        has_item_description = bool(field_value(current_fields, PURCHASE_ITEM_DESCRIPTION_FIELDS))
        if not has_service_description and not has_item_description:
            missing_alias_fields.extend(PURCHASE_SERVICE_DESCRIPTION_FIELDS)
            missing_alias_fields.extend(unique_fields(
                PURCHASE_ITEM_DESCRIPTION_FIELDS,
                ITEM_DESC_FIELDS,
                ITEM_QTY_FIELDS,
                ITEM_UNIT_MEASURE_FIELDS,
                ITEM_UNIT_FIELDS,
                ITEM_TOTAL_FIELDS,
            ))
    supplier_fields = ["fornecedor", "nomeFornecedor", "razaoSocial", "favorecido", "beneficiario", "fornecedorEscolhido"]
    if not field_value(current_fields, supplier_fields):
        missing_alias_fields.extend(supplier_fields)
    payment_date_fields = ["dataPagamento", "previsaoPagamento", "dataDeVencimento", "dataVencimento"]
    if financeiro and not field_value(current_fields, payment_date_fields):
        missing_alias_fields.extend(payment_date_fields)
    if not field_value(current_fields, DESTINATION_UNIT_FIELDS):
        missing_alias_fields.extend(DESTINATION_UNIT_FIELDS)
    if not field_value(current_fields, COMPANY_FIELDS):
        missing_alias_fields.extend(COMPANY_FIELDS)
    if not field_value(current_fields, DOCUMENT_FIELDS):
        missing_alias_fields.extend(env_list(os.environ.get("ZEEV_EXTRA_DOCUMENT_FIELDS", "")))
        missing_alias_fields.extend(DOCUMENT_FIELDS)
    max_filtered_fields = env_int("ZEEV_ENRICH_MAX_FILTER_FIELDS", 64, 8, 160)
    fields = unique_fields(priority_alias_fields, missing_design_fields, missing_alias_fields)[:max_filtered_fields]
    single_fallback_remaining = env_int("ZEEV_ENRICH_SINGLE_FIELD_FALLBACK_LIMIT", 4, 0, 16)
    request_timeout = env_int("ZEEV_ENRICH_REQUEST_TIMEOUT_SECONDS", 35, 8, 90)
    request_retries = env_int("ZEEV_ENRICH_REQUEST_RETRIES", 1, 1, 3)
    for i in range(0, len(fields), 8):
        chunk = fields[i:i + 8]
        try:
            detail, found = instance_fields(row["id"], chunk, timeout=request_timeout, retries=request_retries)
            latest = detail or latest
            for field in found:
                display = field_display_name(field)
                if not display:
                    continue
                key = f"{display}|{field.get('row') or 1}"
                all_fields[key] = field
        except Exception as exc:
            if len(chunk) == 1:
                errors.append({"field": chunk[0], "error": str(exc)[:300]})
                continue
            errors.append({"field": ",".join(chunk), "error": str(exc)[:300]})
            for field_name in chunk[:single_fallback_remaining]:
                try:
                    detail, found = instance_fields(row["id"], [field_name], timeout=request_timeout, retries=request_retries)
                    latest = detail or latest
                    for field in found:
                        display = field_display_name(field)
                        if not display:
                            continue
                        key = f"{display}|{field.get('row') or 1}"
                        all_fields[key] = field
                except Exception as single_exc:
                    errors.append({"field": field_name, "error": str(single_exc)[:300]})
                finally:
                    single_fallback_remaining = max(0, single_fallback_remaining - 1)
    report_link = (latest or {}).get("reportLink") or (latest or {}).get("reportUrl") or row.get("reportLink") or row.get("reportUrl") or ""
    if report_link:
        try:
            report_fields, report_meta = fetch_report_link_fields(report_link)
            for field in report_fields:
                display = field_display_name(field)
                if not display:
                    continue
                key = f"{display}|{field.get('row') or 1}"
                all_fields[key] = field
            latest["__reportLinkExtraction"] = {
                "fields": len(report_fields),
                "length": report_meta.get("length", 0),
                "contentType": report_meta.get("contentType", ""),
            }
        except Exception as exc:
            errors.append({"field": "__reportLink__", "error": str(exc)[:300]})
    if not financeiro:
        current_fields = list(all_fields.values())
        service_desc = field_value_by_priority(current_fields, [x for x in PURCHASE_SERVICE_DESCRIPTION_FIELDS if x != "descricaoMensagemZeev"])
        item_text = field_value_by_priority(current_fields, ITEM_DESC_FIELDS)
        if looks_truncated_zeev_text(service_desc) or generic_purchase_text(item_text):
            try:
                messages = instance_messages(row["id"])
                latest["__messages"] = messages
                message_desc = best_message_description(messages, service_desc=service_desc, item_text=item_text)
                if message_desc:
                    all_fields["descricaoMensagemZeev|1"] = {
                        "name": "descricaoMensagemZeev",
                        "value": message_desc,
                        "row": 1,
                        "source": "messages",
                    }
            except Exception as exc:
                errors.append({"field": "__messages__", "error": str(exc)[:300]})
    latest["formFields"] = list(all_fields.values())
    latest["__enrichmentErrors"] = errors
    return latest


def current_task(tasks):
    for task in tasks or []:
        if task.get("active"):
            return task
    return (tasks or [None])[0] or {}


def task_label(task):
    return str(((task.get("task") or {}).get("name")) or task.get("alias") or task.get("result") or "").strip()


def ticket_result_kind(row):
    result = norm(row.get("flowResult") or "")
    if any(term in result for term in ["cancelado", "cancelada"]):
        return "cancelado"
    if any(term in result for term in ["rejeitado", "rejeitada", "reprovado", "reprovada"]):
        return "rejeitado"
    if any(term in result for term in ["concluido", "concluida", "concluido", "aprovado", "aprovada", "finalizado", "finalizada"]):
        return "concluido"
    return ""


def delivery_ready(row):
    result_kind = ticket_result_kind(row)
    if result_kind in ("cancelado", "rejeitado"):
        return False
    if row.get("active") is False or row.get("endDateTime"):
        return True
    task = current_task(row.get("instanceTasks") or [])
    hay = norm(" ".join(str(x or "") for x in [((task.get("task") or {}).get("name")), task.get("alias"), task.get("result")]))
    return any(term in hay for term in ["conferir entrega", "comunicar entrega", "receber entrega", "conferencia de entrega"])


def suggested_capex_status(row, ready):
    result_kind = ticket_result_kind(row)
    if result_kind in ("cancelado", "rejeitado"):
        return "Cancelado", False
    if ready:
        return "Resolvido", True
    return "Em Andamento", False


def extract_items(fields):
    rows = {}
    for field in fields or []:
        value = str(field.get("value") or "").strip()
        if not value:
            continue
        row = int(field.get("row") or 1)
        item = rows.setdefault(row, {"row": row})
        if field_matches(field, ITEM_DESC_FIELDS):
            item["descricao"] = value
        elif field_matches(field, ITEM_QTY_FIELDS):
            item["quantidade"] = parse_money(value)
        elif field_matches(field, ITEM_UNIT_MEASURE_FIELDS):
            item["unidade"] = value
        elif field_matches(field, ITEM_UNIT_FIELDS):
            item["valor_unitario"] = parse_money(value)
        elif field_matches(field, ITEM_TOTAL_FIELDS):
            item["valor_total"] = parse_money(value)
    out = []
    for item in rows.values():
        if item.get("valor_unitario") and item.get("quantidade") and not item.get("valor_total"):
            item["valor_total"] = round(float(item["valor_unitario"]) * float(item["quantidade"]), 2)
        if any(k in item for k in ("descricao", "quantidade", "valor_total", "valor_unitario")):
            out.append(item)
    return out


def item_total_sum(items):
    total = 0.0
    for item in items or []:
        if item.get("valor_total"):
            total += float(item.get("valor_total") or 0)
        elif item.get("valor_unitario") and item.get("quantidade"):
            total += float(item.get("valor_unitario") or 0) * float(item.get("quantidade") or 0)
    return round(total, 2) if total else 0.0


def pick_ticket_value(fields, items, financeiro=False):
    explicit = money_by_priority(fields, PAYMENT_TOTAL_FIELDS)
    if explicit:
        return explicit
    if financeiro:
        installment_count = money_by_priority(fields, INSTALLMENT_COUNT_FIELDS)
        if installment_count == 1:
            next_payment = money_by_priority(fields, NEXT_PAYMENT_VALUE_FIELDS)
            if next_payment:
                return next_payment
    items_total = item_total_sum(items)
    if items_total:
        return items_total
    return best_money_from_fields(fields, VALUE_TOTAL_FIELDS + ITEM_TOTAL_FIELDS)


def parse_ticket_ids(value):
    if value in (None, ""):
        return []
    if isinstance(value, (list, tuple, set)):
        raw = value
    else:
        raw = str(value).replace(";", ",").split(",")
    out = []
    seen = set()
    for item in raw:
        try:
            n = int(str(item).strip())
        except (TypeError, ValueError):
            continue
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


def env_int(name, default=0, minimum=0, maximum=None):
    try:
        value = int(str(os.environ.get(name, default)).strip() or default)
    except (TypeError, ValueError):
        value = default
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def chunked(values, size):
    size = max(1, int(size or 1))
    for start in range(0, len(values), size):
        yield values[start:start + size]


def known_ticket_refresh_ids(limit):
    try:
        n = max(0, min(int(limit or 0), 60))
    except (TypeError, ValueError):
        n = 0
    if not n or not ZEEV_SYNC_SECRET:
        return []
    try:
        data = request_json(
            "POST",
            f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
            headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
            payload={
                "mode": "known-ticket-refresh-ids",
                "limit": n,
                "flowIds": ",".join(str(x) for x in FLOW_IDS),
            },
            timeout=45,
            retries=1,
        )
        return parse_ticket_ids((data or {}).get("ticketIds") or [])
    except Exception as exc:
        print(json.dumps({"progress": "known-ticket-refresh-ids-error", "error": str(exc)[:500]}, ensure_ascii=False), file=sys.stderr)
        return []


def ticket_id_from_value(value):
    found = parse_ticket_ids([re.sub(r"\D+", "", str(value or ""))])
    return found[0] if found else 0


def max_known_platform_ticket_id():
    max_id = 0
    specs = (
        ("/capex_zeev_solicitacoes?select=zeev_instance_id&order=zeev_instance_id.desc&limit=1", "zeev_instance_id"),
        ("/capex_itens?select=ticket_raiz_instance_id&ticket_raiz_instance_id=not.is.null&order=ticket_raiz_instance_id.desc&limit=1", "ticket_raiz_instance_id"),
        ("/pagamentos?select=ticket_raiz&ticket_raiz=not.is.null&order=ticket_raiz.desc&limit=1", "ticket_raiz"),
    )
    for path, key in specs:
        try:
            rows = supabase_rest(path, timeout=30, prefer="")
        except Exception as exc:
            print(json.dumps({"progress": "id-sweep-platform-max-error", "path": path.split("?")[0], "error": str(exc)[:300]}, ensure_ascii=False), file=sys.stderr)
            continue
        for row in rows if isinstance(rows, list) else []:
            max_id = max(max_id, ticket_id_from_value(row.get(key)))
    return max_id


def latest_report_ticket_id():
    try:
        start, end = default_window()
        rows = report_page_all(1, start, end, page_size=25, fields=capex_fields(None))
    except Exception as exc:
        print(json.dumps({"progress": "id-sweep-report-head-error", "error": str(exc)[:500]}, ensure_ascii=False), file=sys.stderr)
        return 0
    ids = [ticket_id_from_value((row or {}).get("id")) for row in rows or []]
    return max(ids or [0])


def platform_existing_ticket_ids(instance_ids):
    ids = parse_ticket_ids(instance_ids)
    found = set()
    for chunk in chunked(ids, 80):
        joined = ",".join(str(x) for x in chunk)
        # A record only counts as synchronized after it exists in the Zeev mirror.
        # Spreadsheet references and payment links must still be probed/enriched.
        checks = (
            (f"/capex_zeev_solicitacoes?select=zeev_instance_id&zeev_instance_id=in.({joined})", ("zeev_instance_id",)),
        )
        for path, keys in checks:
            try:
                rows = supabase_rest(path, timeout=45, prefer="")
            except Exception as exc:
                print(json.dumps({"progress": "id-sweep-existing-error", "path": path.split("?")[0], "error": str(exc)[:350]}, ensure_ascii=False), file=sys.stderr)
                continue
            for row in rows if isinstance(rows, list) else []:
                for key in keys:
                    value = ticket_id_from_value(row.get(key))
                    if value:
                        found.add(value)
    return found


def load_id_sweep_state(state_id="zeev-capex-id-sweep"):
    try:
        safe_id = urllib.parse.quote(str(state_id or "zeev-capex-id-sweep"), safe="")
        rows = supabase_rest(f"/zeev_sync_state?id=eq.{safe_id}&select=*", timeout=30, prefer="")
    except Exception as exc:
        print(json.dumps({"progress": "id-sweep-state-read-error", "stateId": state_id, "error": str(exc)[:300]}, ensure_ascii=False), file=sys.stderr)
        return {}
    if isinstance(rows, list) and rows:
        return rows[0] or {}
    return {}


def save_id_sweep_state(cursor, scanned, found, imported, error="", state_id="zeev-capex-id-sweep"):
    payload = {
        "id": str(state_id or "zeev-capex-id-sweep"),
        "last_success_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "last_start_date": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "last_end_date": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "last_error": str(error or "")[:1000] or None,
        "last_run_found": int(cursor or 0),
        "last_run_new": int(found or 0),
        "last_run_updated": int(scanned or 0),
        "running": False,
    }
    try:
        supabase_rest("/zeev_sync_state?on_conflict=id", method="POST", payload=payload, timeout=45, prefer="resolution=merge-duplicates,return=minimal")
    except Exception as exc:
        print(json.dumps({"progress": "id-sweep-state-write-error", "stateId": state_id, "error": str(exc)[:300]}, ensure_ascii=False), file=sys.stderr)


def id_sweep_candidates(limit=None):
    hard_limit = env_int("ZEEV_ID_SWEEP_HARD_LIMIT", 300, 25, 2000)
    limit = max(0, min(int(limit or env_int("ZEEV_ID_SWEEP_LIMIT", 120, 0, hard_limit)), hard_limit))
    if not limit:
        return [], {"limit": 0, "reason": "disabled"}

    explicit_start = env_int("ZEEV_ID_SWEEP_START_ID", 0, 0)
    if explicit_start:
        stop = max(0, explicit_start - limit)
        return list(range(explicit_start, stop, -1)), {
            "limit": limit,
            "manualStart": explicit_start,
            "nextCursor": stop,
            "strategy": "manual-window",
        }

    head_limit = min(env_int("ZEEV_ID_SWEEP_HEAD_LIMIT", 12, 0, 200), limit)
    max_lookback = env_int("ZEEV_ID_SWEEP_MAX_LOOKBACK", 3000, 100, 200000)
    latest = max(
        env_int("ZEEV_ID_SWEEP_LATEST_ID", 0, 0),
        latest_report_ticket_id(),
        max_known_platform_ticket_id(),
    )
    if not latest:
        return [], {"limit": limit, "reason": "no-head-id"}

    state = load_id_sweep_state()
    cursor = ticket_id_from_value(state.get("last_run_found")) or (latest - head_limit)
    lower_bound = max(1, latest - max_lookback)
    if cursor >= latest or cursor < lower_bound:
        cursor = latest - head_limit

    ids = []
    seen = set()
    for tr in range(latest, max(latest - head_limit, 0), -1):
        if tr not in seen:
            ids.append(tr)
            seen.add(tr)

    backlog_limit = max(0, limit - len(ids))
    backlog_start = max(lower_bound, cursor)
    backlog_stop = max(lower_bound - 1, backlog_start - backlog_limit)
    for tr in range(backlog_start, backlog_stop, -1):
        if tr not in seen:
            ids.append(tr)
            seen.add(tr)

    next_cursor = backlog_stop
    if next_cursor <= lower_bound:
        next_cursor = latest - head_limit

    return ids[:limit], {
        "limit": limit,
        "latest": latest,
        "head": head_limit,
        "lowerBound": lower_bound,
        "cursor": cursor,
        "nextCursor": next_cursor,
        "strategy": "head-plus-backlog",
    }


def probe_capex_ticket_id(instance_id):
    timeout = env_int("ZEEV_ID_SWEEP_PROBE_TIMEOUT_SECONDS", 10, 4, 45)
    retries = env_int("ZEEV_ID_SWEEP_PROBE_RETRIES", 1, 1, 2)
    try:
        latest, fields = instance_fields(instance_id, capex_fields(None), timeout=timeout, retries=retries)
        flow_id = int((latest.get("flow") or {}).get("id") or latest.get("flowId") or latest.get("flow_id") or 0)
        capex = has_capex(fields, flow_id)
        if not capex:
            report_link = latest.get("reportLink") or latest.get("reportUrl") or ""
            if report_link:
                try:
                    report_fields, _ = fetch_report_link_fields(report_link)
                    fields = merge_zeev_fields(fields, report_fields)
                    capex = has_capex(fields, flow_id)
                except Exception:
                    pass
        return {
            "tr": int(instance_id),
            "ok": True,
            "isCapex": bool(capex),
            "field": field_display_name(capex) if capex else "",
            "value": str((capex or {}).get("value") or ""),
            "flowId": flow_id,
        }
    except Exception as exc:
        return {"tr": int(instance_id), "ok": False, "isCapex": False, "error": str(exc)[:350]}


def probe_capex_ticket_ids(instance_ids):
    ids = parse_ticket_ids(instance_ids)
    if not ids:
        return []
    workers = env_int("ZEEV_ID_SWEEP_PROBE_CONCURRENCY", 6, 1, 12)
    if workers <= 1 or len(ids) <= 1:
        return [probe_capex_ticket_id(tr) for tr in ids]
    out = []
    with ThreadPoolExecutor(max_workers=min(workers, len(ids))) as executor:
        futures = {executor.submit(probe_capex_ticket_id, tr): tr for tr in ids}
        for future in as_completed(futures):
            out.append(future.result())
    order = {tr: index for index, tr in enumerate(ids)}
    return sorted(out, key=lambda item: order.get(item.get("tr"), 999999))


def collect_sweep_candidate_tickets(ids, meta, update_state=True, state_id="zeev-capex-id-sweep", mode_label="id-sweep",
                                   batch_env="ZEEV_ID_SWEEP_BATCH", pause_env="ZEEV_ID_SWEEP_PAUSE_SECONDS",
                                   runtime_env="ZEEV_ID_SWEEP_MAX_RUNTIME_SECONDS"):
    if not ids:
        return {"ok": True, "mode": mode_label, "scanned": 0, "skippedExisting": 0, "tickets": [], **meta}

    existing = platform_existing_ticket_ids(ids)
    tickets = []
    scanned = 0
    probed = 0
    errors = []
    cursor_after = meta.get("nextCursor")
    partial = False
    batch_size = env_int(batch_env, 24, 1, 80)
    pause = float(os.environ.get(pause_env, "0.35") or "0")
    max_runtime = env_int(runtime_env, 180, 30, 1800)
    started_at = time.monotonic()
    for index, candidate_chunk in enumerate(chunked(ids, batch_size), start=1):
        if time.monotonic() - started_at >= max_runtime:
            partial = True
            break
        cursor_after = max(0, min(candidate_chunk) - 1) if candidate_chunk else cursor_after
        chunk = [tr for tr in candidate_chunk if tr not in existing]
        if not chunk:
            print(json.dumps({
                "progress": f"{mode_label}-batch",
                "batch": index,
                "candidates": len(candidate_chunk),
                "skippedExisting": len(candidate_chunk),
                "probed": 0,
                "capexCandidates": 0,
                "found": 0,
                "ticketIds": [],
            }, ensure_ascii=False), flush=True)
            continue

        probes = probe_capex_ticket_ids(chunk)
        probed += len(probes)
        scanned += len(chunk)
        capex_ids = [item["tr"] for item in probes if item.get("isCapex")]
        errors.extend([item for item in probes if not item.get("ok")][: max(0, 20 - len(errors))])
        found = sync_ids(capex_ids, allow_non_capex=False, reason="Varredura token por ID CAPEX", rescue_docs=False) if capex_ids else []
        tickets.extend(found)
        print(json.dumps({
            "progress": f"{mode_label}-batch",
            "batch": index,
            "candidates": len(candidate_chunk),
            "skippedExisting": len(candidate_chunk) - len(chunk),
            "probed": len(probes),
            "capexCandidates": len(capex_ids),
            "found": len(found),
            "ticketIds": [t.get("zeev_instance_id") for t in found],
        }, ensure_ascii=False), flush=True)
        if pause and index * batch_size < len(ids):
            time.sleep(pause)

    if update_state and cursor_after:
        save_id_sweep_state(cursor_after, scanned, len(tickets), 0, state_id=state_id)

    out = {
        "ok": True,
        "mode": mode_label,
        "scanned": scanned,
        "probed": probed,
        "candidateIds": len(ids),
        "skippedExisting": len(existing),
        "found": len(tickets),
        "ticketIds": [t.get("zeev_instance_id") for t in tickets],
        "partial": partial,
        "errors": errors[:20],
        **meta,
    }
    out["nextCursor"] = cursor_after
    out["tickets"] = tickets
    return out


def collect_id_sweep_tickets(limit=None, update_state=True):
    ids, meta = id_sweep_candidates(limit)
    return collect_sweep_candidate_tickets(ids, meta, update_state=update_state, state_id="zeev-capex-id-sweep", mode_label="id-sweep")


def correction_sweep_candidates(limit=None):
    hard_limit = env_int("ZEEV_CORRECTION_SWEEP_HARD_LIMIT", 120, 10, 1000)
    limit = max(0, min(int(limit or env_int("ZEEV_CORRECTION_SWEEP_LIMIT", 0, 0, hard_limit)), hard_limit))
    if not limit:
        return [], {"limit": 0, "reason": "disabled", "strategy": "old-capex-correction-rotating-window"}

    latest = max(
        env_int("ZEEV_CORRECTION_SWEEP_LATEST_ID", 0, 0),
        latest_report_ticket_id(),
        max_known_platform_ticket_id(),
    )
    if not latest:
        return [], {"limit": limit, "reason": "no-head-id", "strategy": "old-capex-correction-rotating-window"}

    max_lookback = env_int("ZEEV_CORRECTION_SWEEP_MAX_LOOKBACK", 200000, 1000, 300000)
    configured_min = env_int("ZEEV_CORRECTION_SWEEP_MIN_ID", 0, 0)
    lower_bound = configured_min or max(1, latest - max_lookback)
    lower_bound = max(1, min(lower_bound, latest))

    state_id = "zeev-capex-correction-sweep"
    state = load_id_sweep_state(state_id)
    cursor = ticket_id_from_value(state.get("last_run_found")) or latest
    if cursor > latest or cursor < lower_bound:
        cursor = latest

    stop = max(lower_bound - 1, cursor - limit)
    ids = list(range(cursor, stop, -1))
    next_cursor = stop
    if next_cursor <= lower_bound:
        next_cursor = latest

    return ids, {
        "limit": limit,
        "latest": latest,
        "lowerBound": lower_bound,
        "cursor": cursor,
        "nextCursor": next_cursor,
        "stateId": state_id,
        "strategy": "old-capex-correction-rotating-window",
    }


def collect_correction_sweep_tickets(limit=None, update_state=True):
    ids, meta = correction_sweep_candidates(limit)
    return collect_sweep_candidate_tickets(
        ids,
        meta,
        update_state=update_state,
        state_id="zeev-capex-correction-sweep",
        mode_label="correction-sweep",
        batch_env="ZEEV_CORRECTION_SWEEP_BATCH",
        pause_env="ZEEV_CORRECTION_SWEEP_PAUSE_SECONDS",
        runtime_env="ZEEV_CORRECTION_SWEEP_MAX_RUNTIME_SECONDS",
    )


def id_sweep_capex():
    limit = env_int("ZEEV_ID_SWEEP_LIMIT", env_int("ZEEV_BACKFILL_LIMIT", 120, 0), 0, 5000)
    sweep = collect_id_sweep_tickets(limit=limit, update_state=True)
    tickets = sweep.pop("tickets", [])
    result = ingest(tickets, notify=os.environ.get("ZEEV_NOTIFY", "false").lower() == "true", backfill_limit=0)
    sweep["imported"] = len(tickets)
    sweep["ingest"] = result
    return sweep


def correction_sweep_capex():
    limit = env_int("ZEEV_CORRECTION_SWEEP_LIMIT", env_int("ZEEV_BACKFILL_LIMIT", 120, 0), 0, 5000)
    sweep = collect_correction_sweep_tickets(limit=limit, update_state=True)
    tickets = sweep.pop("tickets", [])
    result = ingest(tickets, notify=os.environ.get("ZEEV_NOTIFY", "false").lower() == "true", backfill_limit=0)
    sweep["imported"] = len(tickets)
    sweep["ingest"] = result
    return sweep


def fields_object(fields):
    out = {}
    for field in fields or []:
        name = str(field.get("name") or "")
        value = field.get("value")
        if not name or value in (None, ""):
            continue
        if name in out:
            if not isinstance(out[name], list):
                out[name] = [out[name]]
            out[name].append(value)
        else:
            out[name] = value
    return out


def clean_unit(value):
    return re.sub(r"^\s*\d+(?:[.\-]\d+)*\s*-\s*", "", str(value or "")).strip()


def clean_item_description(value):
    text = str(value or "").strip()
    text = re.sub(r"^\s*\d+(?:[.\-]\d+)*\s*-\s*", "", text)
    return re.sub(r"\s+", " ", text).strip(" -;")


def format_qty(value):
    try:
        qty = float(value or 0)
    except (TypeError, ValueError):
        return ""
    if not qty:
        return ""
    if qty.is_integer():
        return str(int(qty))
    return f"{qty:g}".replace(".", ",")


def item_summary(items):
    parts = []
    for item in items or []:
        desc = clean_item_description(item.get("descricao"))
        if not desc:
            continue
        qty = format_qty(item.get("quantidade"))
        unit = str(item.get("unidade") or "").strip()
        prefix = " ".join(x for x in [qty, unit] if x).strip()
        parts.append(f"{prefix} - {desc}" if prefix else desc)
    return "; ".join(parts)


def clean_summary_text(value):
    text = html_lib.unescape(str(value or ""))
    text = re.sub(r"(?i)<\s*br\s*/?\s*>", "\n", text)
    text = re.sub(r"(?i)</\s*(p|div|li|tr|h[1-6])\s*>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text.strip()


def description_score(value):
    text = clean_summary_text(value)
    if not text:
        return 0
    words = len([x for x in re.split(r"\s+", text) if x])
    punct = len(re.findall(r"[.;:]", text))
    penalty = 90 if generic_purchase_text(text) else 0
    return len(text) + words * 3 + punct * 12 - penalty


def best_description(*values):
    options = [clean_summary_text(v) for v in values if clean_summary_text(v)]
    if not options:
        return ""
    return sorted(options, key=description_score, reverse=True)[0]


def clean_financial_document_reference(value):
    name = filename_from_download_path(value, "")
    if not name:
        return ""
    try:
        from urllib.parse import unquote
        name = unquote(name)
    except Exception:
        pass
    name = re.sub(r"\.(pdf|xml|png|jpe?g|webp|tiff?|xlsx?|docx?|zip)$", "", name, flags=re.I)
    name = re.sub(r"_\d{17,}$", "", name)
    return re.sub(r"\s+", " ", re.sub(r"[_-]+", " ", name)).strip()


def finance_fallback_description(fields):
    item = clean_item_description(field_value_by_priority(fields, ["item"]))
    supplier = re.sub(
        r"^\s*\d+\s*-\s*",
        "",
        field_value_by_priority(fields, ["fornecedor", "favorecido", "beneficiario", "nomeFornecedor", "razaoSocial"]),
    ).strip()
    fiscal_number = fiscal_document_number(fields, financeiro=True)
    fiscal_type = field_value_by_priority(fields, ["tipoDoPagamento", "tipoDocumento", "tipoDeDocumento"])
    document_reference = clean_financial_document_reference(field_value_by_priority(fields, DOCUMENT_FIELDS))
    parts = []
    if item:
        parts.append(f"Item: {item}")
    if supplier:
        parts.append(f"Fornecedor: {supplier}")
    if fiscal_number:
        parts.append(f"{fiscal_type or 'Documento fiscal'}: {fiscal_number}")
    elif document_reference:
        parts.append(f"Documento: {document_reference}")
    return " | ".join(parts)


def split_summary_parts(text):
    clean = clean_summary_text(text)
    if not clean:
        return []
    parts = re.split(r"\n|[\u2022\u00b7]|(?:^|\s)\d+[.)]\s+|;\s+", clean)
    out = []
    for part in parts:
        part = re.sub(r"^\s*[-\u2013\u2014]\s*", "", part)
        part = re.sub(r"\s+", " ", part).strip()
        if len(part) > 2:
            out.append(part)
    return out


def trim_card_summary(text, _limit=None):
    return clean_summary_text(text)


def deterministic_card_summary(text, items=None, compra=False):
    clean = clean_summary_text(text)
    if not clean:
        return ""
    return clean


def allow_core_summary_keys():
    return os.environ.get("ZEEV_SUMMARY_ALLOW_GEMINI_GROQ", "0") == "1" or os.environ.get("ZEEV_SUMMARY_USE_CORE_KEYS", "0") == "1"


def summarize_with_gemini(text):
    if os.environ.get("ZEEV_AI_SUMMARY_ENABLED", "1") == "0":
        return ""
    if not allow_core_summary_keys():
        return ""
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        return ""
    model = os.environ.get("GEMINI_SUMMARY_MODEL") or "gemini-2.5-flash-lite"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(model, safe='')}:generateContent"
    source = clean_summary_text(text)
    prompt = (
        "Resuma em portugues, em ate 2 frases curtas, apenas com dados existentes no texto. "
        "Nao invente fornecedor, valor, unidade, data ou item. Preserve nomes importantes.\n\n"
        f"Texto do Ticket Raiz:\n{source}"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 120},
    }
    data = request_json("POST", url, headers={"x-goog-api-key": key}, payload=payload, timeout=35, retries=1)
    parts = (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
    summary = clean_summary_text(" ".join(str(p.get("text") or "") for p in parts))
    return trim_card_summary(summary, 300) if summary else ""


def summarize_with_groq(text):
    if os.environ.get("ZEEV_AI_SUMMARY_ENABLED", "1") == "0":
        return ""
    if not allow_core_summary_keys():
        return ""
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return ""
    model = os.environ.get("GROQ_SUMMARY_MODEL") or "llama-3.1-8b-instant"
    source = clean_summary_text(text)
    payload = {
        "model": model,
        "temperature": 0,
        "max_tokens": 120,
        "messages": [
            {"role": "system", "content": "Resuma tickets em portugues sem inventar nenhum dado."},
            {"role": "user", "content": "Resuma em ate 2 frases curtas, preservando nomes e itens importantes:\n\n" + source},
        ],
    }
    data = request_json(
        "POST",
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        payload=payload,
        timeout=35,
        retries=1,
    )
    summary = clean_summary_text((((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or "")
    return trim_card_summary(summary, 300) if summary else ""


def summarize_with_cloudflare(text):
    if os.environ.get("ZEEV_AI_SUMMARY_ENABLED", "1") == "0":
        return ""
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    token = os.environ.get("CLOUDFLARE_API_TOKEN") or os.environ.get("CF_API_TOKEN")
    if not account_id or not token:
        return ""
    model = os.environ.get("CLOUDFLARE_SUMMARY_MODEL") or "@cf/meta/llama-3.1-8b-instruct-fast"
    source = clean_summary_text(text)
    payload = {
        "messages": [
            {"role": "system", "content": "Resuma tickets em portugues sem inventar nenhum dado."},
            {"role": "user", "content": "Resuma em ate 2 frases curtas, preservando nomes e itens importantes:\n\n" + source},
        ]
    }
    url = f"https://api.cloudflare.com/client/v4/accounts/{urllib.parse.quote(account_id, safe='')}/ai/run/{urllib.parse.quote(model, safe='@/')}"
    data = request_json(
        "POST",
        url,
        headers={"Authorization": f"Bearer {token}"},
        payload=payload,
        timeout=35,
        retries=1,
    )
    result = data.get("result") if isinstance(data, dict) else {}
    summary = ""
    if isinstance(result, dict):
        summary = result.get("response") or result.get("text") or result.get("generated_text") or ""
    elif isinstance(result, str):
        summary = result
    summary = clean_summary_text(summary)
    return trim_card_summary(summary, 300) if summary else ""


def summarize_with_mistral(text):
    if os.environ.get("ZEEV_AI_SUMMARY_ENABLED", "1") == "0":
        return ""
    key = os.environ.get("MISTRAL_API_KEY")
    if not key:
        return ""
    model = os.environ.get("MISTRAL_SUMMARY_MODEL") or "mistral-small-latest"
    source = clean_summary_text(text)
    payload = {
        "model": model,
        "temperature": 0,
        "max_tokens": 120,
        "messages": [
            {"role": "system", "content": "Resuma tickets em portugues sem inventar nenhum dado."},
            {"role": "user", "content": "Resuma em ate 2 frases curtas, preservando nomes e itens importantes:\n\n" + source},
        ],
    }
    data = request_json(
        "POST",
        "https://api.mistral.ai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        payload=payload,
        timeout=35,
        retries=1,
    )
    summary = clean_summary_text((((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or "")
    return trim_card_summary(summary, 300) if summary else ""


def summarize_with_huggingface(text):
    if os.environ.get("ZEEV_AI_SUMMARY_ENABLED", "1") == "0":
        return ""
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_API_KEY")
    if not token:
        return ""
    model = os.environ.get("HF_SUMMARY_MODEL") or "meta-llama/Llama-3.1-8B-Instruct"
    source = clean_summary_text(text)
    payload = {
        "model": model,
        "temperature": 0,
        "max_tokens": 120,
        "messages": [
            {"role": "system", "content": "Resuma tickets em portugues sem inventar nenhum dado."},
            {"role": "user", "content": "Resuma em ate 2 frases curtas, preservando nomes e itens importantes:\n\n" + source},
        ],
    }
    data = request_json(
        "POST",
        "https://router.huggingface.co/v1/chat/completions",
        headers={"Authorization": f"Bearer {token}"},
        payload=payload,
        timeout=35,
        retries=1,
    )
    summary = clean_summary_text((((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or "")
    summary = clean_summary_text(summary)
    return trim_card_summary(summary, 300) if summary else ""


def card_summary_cascade(text, items=None, compra=False):
    clean = clean_summary_text(text)
    if not clean:
        return "", ""
    deterministic = deterministic_card_summary(clean, items=items, compra=compra)
    for source, fn in (
        ("cloudflare", summarize_with_cloudflare),
        ("mistral", summarize_with_mistral),
        ("huggingface", summarize_with_huggingface),
        ("groq-reserva", summarize_with_groq),
        ("gemini-reserva", summarize_with_gemini),
    ):
        try:
            summary = fn(clean)
            if summary and description_score(summary) > 30 and len(summary) <= max(320, len(clean)):
                return summary, source
        except Exception as exc:
            print(json.dumps({"summaryProvider": source, "error": str(exc)[:250]}, ensure_ascii=False), file=sys.stderr)
    return deterministic, "texto-completo"


def ticket_description(fields, items, financeiro=False, compra=False, flow_id=0):
    if financeiro:
        return field_value_by_priority(fields, finance_request_description_fields(flow_id))
    if compra:
        justification = field_value_by_priority(fields, PURCHASE_JUSTIFICATION_FIELDS)
        service_desc = field_value_by_priority(fields, PURCHASE_SERVICE_DESCRIPTION_FIELDS)
        items_text = item_summary(items)
        if items_text and (not service_desc or generic_purchase_text(service_desc) or description_score(items_text) > description_score(service_desc) + 40):
            return items_text
        if justification and (not items_text or description_score(justification) > description_score(service_desc) + 35):
            return justification
        if service_desc:
            return service_desc
        return best_description(items_text, justification, service_desc)
    return ""


def looks_truncated_zeev_text(value):
    text = str(value or "").strip()
    if len(text) != 100:
        return False
    return not re.search(r"[.!?:;)\\]]$", text)


def build_ticket(row):
    flow = row.get("flow") or {}
    flow_id = int(flow.get("id") or row.get("flowId") or 0)
    fields = row.get("formFields") or []
    capex = has_capex(fields, flow_id)
    if not capex:
        return None
    tasks = row.get("instanceTasks") or []
    ready = delivery_ready(row)
    compra = is_purchase_row(row)
    financeiro = is_finance_row(row)
    itens = extract_items(fields)
    valor = pick_ticket_value(fields, itens, financeiro=financeiro)
    result_kind = ticket_result_kind(row)
    valor_final = valor if valor and result_kind not in ("cancelado", "rejeitado") and (ready or financeiro) else None
    valor_status = "final" if valor_final else ("em_aprovacao" if compra and valor else ("estimado" if valor else "nao_encontrado"))
    unidade = field_value(fields, ["unidadeEscolar", "unidade", "escola", "filial", "localEntrega"]) or clean_unit(field_value(fields, ["centroDeCusto", "centroCusto"]))
    pedido = ticket_description(fields, itens, financeiro=financeiro, compra=compra, flow_id=flow_id)
    service_desc = field_value_by_priority(fields, PURCHASE_SERVICE_DESCRIPTION_FIELDS) if compra else ""
    descricao_truncada = bool(compra and service_desc and service_desc == pedido and looks_truncated_zeev_text(pedido))
    atual = current_task(tasks)
    situacao, realizado = suggested_capex_status(row, ready)
    campos_extraidos = fields_object(fields)
    finance_description, finance_description_source = field_value_with_source_by_priority(fields, finance_request_description_fields(flow_id)) if financeiro else ("", "")
    resumo_card, resumo_source = card_summary_cascade(pedido, items=itens, compra=compra)
    if resumo_card:
        campos_extraidos["_resumo_card"] = resumo_card
        campos_extraidos["_resumo_card_source"] = resumo_source
        campos_extraidos["_pedido_completo_chars"] = len(clean_summary_text(pedido))
    if descricao_truncada:
        campos_extraidos["_descricao_status"] = "parcial"
        campos_extraidos["_descricao_origem"] = "descricaoDoServico"
        campos_extraidos["_descricao_alerta"] = "O Zeev retornou a descricao do servico limitada a 100 caracteres. Abra o Ticket Raiz para conferir o texto integral."
    if financeiro:
        campos_extraidos["_descricao_regra"] = "informacoes_referentes_solicitacao_v5"
        campos_extraidos["_descricao_revisada_em"] = datetime.now(timezone.utc).isoformat()
        campos_extraidos["_descricao_status"] = "completa" if finance_description else "nao_encontrada"
        campos_extraidos["_descricao_origem"] = finance_description_source or ""
        if not finance_description:
            campos_extraidos["_descricao_alerta"] = "O campo Informacoes referentes a solicitacao nao foi retornado pelo Zeev."
    enrichment_errors = list(row.get("__enrichmentErrors") or [])
    if descricao_truncada:
        enrichment_errors.append({
            "field": "descricaoDoServico",
            "warning": "Descricao do servico retornada pelo Zeev com 100 caracteres; texto provavelmente parcial.",
        })
    return {
        "zeev_instance_id": int(row["id"]),
        "zeev_uid": row.get("uid"),
        "flow_id": flow_id,
        "flow_name": flow.get("name") or row.get("flowName") or row.get("requestName"),
        "flow_version": flow.get("version") or row.get("flowVersion"),
        "request_name": row.get("requestName"),
        "ticket_link": row.get("reportLink"),
        "confirmation_code": row.get("confirmationCode"),
        "start_date_time": row.get("startDateTime"),
        "end_date_time": row.get("endDateTime"),
        "last_finished_task_date_time": row.get("lastFinishedTaskDateTime"),
        "active": row.get("active"),
        "flow_result": row.get("flowResult") or "",
        "capex_field_name": capex.get("name"),
        "capex_field_value": str(capex.get("value") or ""),
        "requester_name": ((row.get("requester") or {}).get("name")) or "",
        "requester_email": ((row.get("requester") or {}).get("email")) or "",
        "requester_username": ((row.get("requester") or {}).get("username")) or "",
        "requester_team": (((row.get("requester") or {}).get("team") or {}).get("name")) or "",
        "etapa_atual": task_label(atual),
        "passou_conferir_entrega": bool(ready),
        "pronto_valor_final": bool(compra and ready),
        "valor": valor or None,
        "valor_final": valor_final,
        "valor_status": valor_status,
        "unidade": unidade or None,
        "marca": field_value(fields, ["marca"]) or None,
        "pedido": pedido or None,
        "categoria_capex": field_value(fields, ["categoriaCompra", "categoria", "tipoCompra"]) or None,
        "fonte": "UNIDADE",
        "setor": "FINANCEIRO" if financeiro else "COMPRAS",
        "situacao_sugerida": situacao,
        "realizado_sugerido": realizado,
        "raw_fields": fields,
        "raw_instance": {},
        "raw_tasks": [],
        "itens_json": itens,
        "pagamento_json": {
            "forma": field_value_by_priority(fields, ["formaDePagamento", "formaPagamento", "condicaoPagamento"]) or None,
            "data_pagamento": field_value(fields, ["dataPagamento"]) or None,
            "previsao_pagamento": field_value_by_priority(fields, ["previsaoPagamento", "dataDeVencimento", "dataVencimento"]) or None,
            "data_entrega": field_value(fields, ["dataEntrega", "prazoEntrega"]) or None,
            "nota_fiscal": fiscal_document_number(fields, financeiro=financeiro) or None,
            "chave_acesso": field_value(fields, ["chaveAcesso"]) or None,
            "valor_total": valor or None,
        },
        "campos_extraidos": campos_extraidos,
        "enrichment_errors": enrichment_errors[:5],
    }


def generic_ticket_from_instance(row, reason=""):
    fields = row.get("formFields") or []
    tasks = row.get("instanceTasks") or []
    flow = row.get("flow") or {}
    flow_id = int(flow.get("id") or row.get("flowId") or 0)
    financeiro = is_finance_row(row)
    compra = is_purchase_row(row)
    itens = extract_items(fields)
    valor = pick_ticket_value(fields, itens, financeiro=financeiro)
    result_kind = ticket_result_kind(row)
    ready = delivery_ready(row)
    valor_final = valor if valor and result_kind not in ("cancelado", "rejeitado") and (ready or financeiro) else None
    pedido = ticket_description(fields, itens, financeiro=financeiro, compra=compra, flow_id=flow_id)
    if not pedido and not financeiro:
        pedido = row.get("requestName") or f"Ticket Raiz {row.get('id') or ''}"
    atual = current_task(tasks)
    situacao, realizado = suggested_capex_status(row, ready)
    campos_extraidos = fields_object(fields)
    campos_extraidos["_capex_forcado"] = True
    campos_extraidos["_capex_forcado_motivo"] = reason or "Inclusao manual solicitada pelo usuario."
    if financeiro:
        finance_description, finance_description_source = field_value_with_source_by_priority(
            fields,
            finance_request_description_fields(flow_id),
        )
        campos_extraidos["_descricao_regra"] = "informacoes_referentes_solicitacao_v5"
        campos_extraidos["_descricao_revisada_em"] = datetime.now(timezone.utc).isoformat()
        campos_extraidos["_descricao_status"] = "completa" if finance_description else "nao_encontrada"
        campos_extraidos["_descricao_origem"] = finance_description_source or ""
        if not finance_description:
            campos_extraidos["_descricao_alerta"] = "O campo Informacoes referentes a solicitacao nao foi retornado pelo Zeev."
    registered_capex = "registrado" in norm(reason) and "plataforma" in norm(reason)
    if registered_capex:
        campos_extraidos["_capex_registrado_preexistente"] = True
    resumo_card, resumo_source = card_summary_cascade(pedido, items=itens, compra=compra)
    if resumo_card:
        campos_extraidos["_resumo_card"] = resumo_card
        campos_extraidos["_resumo_card_source"] = resumo_source
        campos_extraidos["_pedido_completo_chars"] = len(clean_summary_text(pedido))
    return {
        "zeev_instance_id": int(row.get("id") or 0),
        "zeev_uid": row.get("uid"),
        "flow_id": flow_id or None,
        "flow_name": flow.get("name") or row.get("flowName") or row.get("requestName"),
        "flow_version": flow.get("version") or row.get("flowVersion"),
        "request_name": row.get("requestName"),
        "ticket_link": row.get("reportLink") or row.get("reportUrl"),
        "confirmation_code": row.get("confirmationCode"),
        "start_date_time": row.get("startDateTime"),
        "end_date_time": row.get("endDateTime"),
        "last_finished_task_date_time": row.get("lastFinishedTaskDateTime"),
        "active": row.get("active"),
        "flow_result": row.get("flowResult") or "",
        "capex_field_name": "registro_plataforma" if registered_capex else "manual_codex",
        "capex_field_value": "TR ja registrado como CAPEX" if registered_capex else "Sim - inclusao manual",
        "requester_name": ((row.get("requester") or {}).get("name")) or "",
        "requester_email": ((row.get("requester") or {}).get("email")) or "",
        "requester_username": ((row.get("requester") or {}).get("username")) or "",
        "requester_team": (((row.get("requester") or {}).get("team") or {}).get("name")) or "",
        "etapa_atual": task_label(atual),
        "passou_conferir_entrega": bool(ready),
        "pronto_valor_final": bool(compra and ready),
        "valor": valor or None,
        "valor_final": valor_final,
        "valor_status": "final" if valor_final else ("em_aprovacao" if compra and valor else ("estimado" if valor else "nao_encontrado")),
        "unidade": field_value(fields, ["unidadeEscolar", "unidade", "escola", "filial", "localEntrega"]) or clean_unit(field_value(fields, ["centroDeCusto", "centroCusto"])) or None,
        "marca": field_value(fields, ["marca"]) or None,
        "pedido": pedido or None,
        "categoria_capex": field_value(fields, ["categoriaCompra", "categoria", "tipoCompra"]) or None,
        "fonte": "UNIDADE",
        "setor": "FINANCEIRO" if financeiro else "COMPRAS",
        "situacao_sugerida": situacao,
        "realizado_sugerido": realizado,
        "raw_fields": fields,
        "raw_instance": {},
        "raw_tasks": [],
        "itens_json": itens,
        "pagamento_json": {
            "forma": field_value_by_priority(fields, ["formaDePagamento", "formaPagamento", "condicaoPagamento"]) or None,
            "data_pagamento": field_value(fields, ["dataPagamento"]) or None,
            "previsao_pagamento": field_value_by_priority(fields, ["previsaoPagamento", "dataDeVencimento", "dataVencimento"]) or None,
            "data_entrega": field_value(fields, ["dataEntrega", "prazoEntrega"]) or None,
            "nota_fiscal": fiscal_document_number(fields, financeiro=is_finance_row(row)) or None,
            "chave_acesso": field_value(fields, ["chaveAcesso"]) or None,
            "valor_total": valor or None,
        },
        "campos_extraidos": campos_extraidos,
        "enrichment_errors": list(row.get("__enrichmentErrors") or [])[:5],
    }


def sync(start, end, flows, max_pages, page_size):
    tickets = {}
    for flow_id in flows:
        print(json.dumps({"progress": "flow-start", "flowId": flow_id, "start": start, "end": end, "maxPages": max_pages}, ensure_ascii=False), flush=True)
        for page in range(1, max_pages + 1):
            rows = report_page(flow_id, page, start, end, page_size=page_size)
            print(json.dumps({"progress": "flow-page", "flowId": flow_id, "page": page, "rows": len(rows), "ticketsSoFar": len(tickets)}, ensure_ascii=False), flush=True)
            for row in rows:
                if not has_capex(row.get("formFields") or [], flow_id):
                    continue
                enriched = enrich_instance(row)
                ticket = build_ticket(enriched)
                if ticket:
                    ticket = attach_rescued_docs(ticket, enriched)
                    tickets[ticket["zeev_instance_id"]] = ticket
            if len(rows) < page_size:
                break
        print(json.dumps({"progress": "flow-end", "flowId": flow_id, "ticketsSoFar": len(tickets)}, ensure_ascii=False), flush=True)
    return sorted(tickets.values(), key=lambda x: x["zeev_instance_id"], reverse=True)


def sync_last_task_updates(start, end, flows, max_pages, page_size):
    tickets = {}
    errors = []
    max_pages = max(0, int(max_pages or 0))
    if max_pages <= 0:
        return {"tickets": [], "errors": [], "start": start, "end": end, "pages": 0}
    for flow_id in flows:
        print(json.dumps({"progress": "last-task-flow-start", "flowId": flow_id, "start": start, "end": end, "maxPages": max_pages}, ensure_ascii=False), flush=True)
        for page in range(1, max_pages + 1):
            try:
                rows = report_page_last_task(flow_id, page, start, end, page_size=page_size, timeout=90)
            except Exception as exc:
                errors.append({"flowId": flow_id, "page": page, "error": str(exc)[:500]})
                break
            print(json.dumps({"progress": "last-task-flow-page", "flowId": flow_id, "page": page, "rows": len(rows), "ticketsSoFar": len(tickets)}, ensure_ascii=False), flush=True)
            for row in rows:
                if not has_capex(row.get("formFields") or [], flow_id):
                    continue
                try:
                    enriched = enrich_instance(row)
                    ticket = build_ticket(enriched)
                    if ticket:
                        ticket = attach_rescued_docs(ticket, enriched)
                        tickets[ticket["zeev_instance_id"]] = ticket
                except Exception as exc:
                    errors.append({"flowId": flow_id, "tr": row.get("id"), "error": str(exc)[:500]})
            if len(rows) < page_size:
                break
        print(json.dumps({"progress": "last-task-flow-end", "flowId": flow_id, "ticketsSoFar": len(tickets)}, ensure_ascii=False), flush=True)
    return {
        "tickets": sorted(tickets.values(), key=lambda x: x["zeev_instance_id"], reverse=True),
        "errors": errors[:30],
        "start": start,
        "end": end,
        "pages": max_pages,
    }


def read_test():
    if not has_zeev_token():
        raise SystemExit("ZEEV_TOKEN e obrigatorio.")
    start = os.environ.get("ZEEV_SYNC_START") or "2026-01-01T00:00:00-03:00"
    end = os.environ.get("ZEEV_SYNC_END") or datetime.now(business_tz()).isoformat(timespec="seconds")
    max_pages = max(1, int(os.environ.get("ZEEV_MAX_PAGES", "1") or "1"))
    page_size = finished_task_page_size(int(os.environ.get("ZEEV_RECORDS_PER_PAGE", "30") or "30"))
    rows_total = 0
    samples = []
    flows_seen = {}
    errors = []
    for flow_id in FLOW_IDS:
        flow_rows = 0
        for page in range(1, max_pages + 1):
            try:
                rows = report_page(flow_id, page, start, end, page_size=page_size)
            except Exception as exc:
                errors.append({"flowId": flow_id, "page": page, "error": str(exc)[:500]})
                break
            rows_total += len(rows)
            flow_rows += len(rows)
            for row in rows:
                flow = row.get("flow") or {}
                row_flow_id = int(flow.get("id") or row.get("flowId") or flow_id or 0)
                fields = row.get("formFields") or []
                capex = has_capex(fields, row_flow_id)
                key = f"{row_flow_id}|{flow.get('name') or row.get('flowName') or row.get('requestName') or ''}|v{flow.get('version') or row.get('flowVersion') or ''}"
                flows_seen[key] = flows_seen.get(key, 0) + 1
                if len(samples) < 10:
                    task = current_task(row.get("instanceTasks") or [])
                    samples.append({
                        "id": row.get("id"),
                        "flowId": row_flow_id,
                        "flowName": flow.get("name") or row.get("flowName") or row.get("requestName") or "",
                        "flowVersion": flow.get("version") or row.get("flowVersion") or "",
                        "requestName": row.get("requestName") or "",
                        "startDateTime": row.get("startDateTime") or "",
                        "endDateTime": row.get("endDateTime") or "",
                        "active": row.get("active"),
                        "flowResult": row.get("flowResult") or "",
                        "currentTask": task_label(task),
                        "formFieldsCount": len(fields),
                        "capexField": field_display_name(capex) if capex else "",
                        "capexValue": str((capex or {}).get("value") or "")[:80],
                        "hasReportLink": bool(row.get("reportLink")),
                    })
            print(json.dumps({
                "progress": "read-test-page",
                "flowId": flow_id,
                "page": page,
                "rows": len(rows),
                "rowsInFlow": flow_rows,
                "rowsTotal": rows_total,
            }, ensure_ascii=False), flush=True)
            if len(rows) < page_size:
                break
    return {
        "ok": not errors,
        "mode": "read-test",
        "api": "Zeev /api/2/instances/report",
        "flowsRequested": FLOW_IDS,
        "start": start,
        "end": end,
        "maxPages": max_pages,
        "pageSize": page_size,
        "rowsTotal": rows_total,
        "flowsSeen": [
            {"flow": key, "rows": count}
            for key, count in sorted(flows_seen.items(), key=lambda kv: (-kv[1], kv[0]))
        ],
        "samples": samples,
        "errors": errors,
    }


def doc_value_meta(value):
    text = "" if value is None else str(value)
    urls = re.findall(r"https?://[^\s\"'<>),;]+", text)
    meta = {
        "valueType": type(value).__name__,
        "isList": isinstance(value, list),
        "isObject": isinstance(value, dict),
        "valueLength": len(text),
        "hasUrl": bool(urls),
        "urlCount": len(urls),
    }
    if isinstance(value, dict):
        meta["keys"] = sorted(str(k) for k in value.keys())[:30]
    elif isinstance(value, list):
        meta["items"] = len(value)
        if value and isinstance(value[0], dict):
            keys = set()
            for item in value[:5]:
                keys.update(str(k) for k in item.keys())
            meta["itemKeys"] = sorted(keys)[:30]
    if urls:
        meta["sampleUrls"] = urls[:3]
    return meta


def http_probe(url, method="GET", payload=None):
    timeout = max(5, min(int(os.environ.get("ZEEV_INSPECT_HTTP_TIMEOUT_SECONDS", "15")), 45))
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    base_headers = {
        "Accept": "application/json,text/html,*/*",
        "Content-Type": "application/json",
        "User-Agent": "ObrasRealEstate/1.0 (+https://raiz-obras.vercel.app)",
    }
    raw = b""
    status = 0
    ctype = ""
    for token in zeev_tokens() or [""]:
        headers = dict(base_headers)
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                raw = res.read()
                status = res.status
                ctype = res.headers.get("Content-Type", "")
                break
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            status = exc.code
            ctype = exc.headers.get("Content-Type", "")
            if status not in (401, 403):
                break
    text = raw.decode("utf-8", errors="replace")
    urls = re.findall(r"https?://[^\s\"'<>),;]+", text)
    hrefs = re.findall(r"""(?i)(?:href|src)=["']([^"']+)["']""", text)
    interesting = []
    for link in urls + hrefs:
        if re.search(r"(?i)(arquivo|anexo|document|doc|file|download|attachment|nota|danfe|pdf|xml|Documento)", link):
            interesting.append(link[:300])
    out = {
        "urlPath": urllib.parse.urlparse(url).path,
        "status": status,
        "contentType": ctype,
        "length": len(raw),
        "hasDocumento": "Documento" in text or "documento" in text.lower(),
        "hasDanfe": "danfe" in text.lower(),
        "hasPdf": ".pdf" in text.lower() or "application/pdf" in text.lower(),
        "urlCount": len(urls),
        "interestingLinks": interesting[:10],
    }
    if status >= 400:
        out["errorSnippet"] = redact_debug_text(re.sub(r"\s+", " ", text).strip())[:500]
    if "json" in ctype.lower() or text.strip().startswith(("{", "[")):
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                out["jsonKeys"] = sorted(str(k) for k in data.keys())[:50]
                out["jsonDocKeys"] = [k for k in out["jsonKeys"] if re.search(r"(?i)(arquivo|anexo|document|file|download|nota|pdf|xml)", k)]
            elif isinstance(data, list):
                out["jsonListLength"] = len(data)
                keys = set()
                for item in data[:5]:
                    if isinstance(item, dict):
                        keys.update(str(k) for k in item.keys())
                out["jsonItemKeys"] = sorted(keys)[:50]
        except Exception:
            out["jsonParseError"] = True
    return out


def redact_debug_text(value):
    text = str(value or "")
    text = re.sub(r"(?i)(token|access_token|authorization|bearer|apikey|api_key|key|secret)=([^&\s\"']+)", r"\1=***", text)
    text = re.sub(r"(?i)Bearer\s+[A-Za-z0-9._%+\-/=]+", "Bearer ***", text)
    return text


def source_matches(label, url, text, limit=12):
    patterns = [
        "Documento", "documento", "danfe", "download", "attachment", "attachments",
        "arquivo", "arquivos", "anexo", "anexos", "file", "files", "openUrl",
        "downloadUrl", "content", "base64", "/api/", "api/2", "visualizador",
        "formFields", "fieldValue", "138446",
    ]
    out = []
    compact = re.sub(r"\s+", " ", str(text or ""))
    for pattern in patterns:
        for match in re.finditer(re.escape(pattern), compact, flags=re.IGNORECASE):
            start = max(0, match.start() - 140)
            end = min(len(compact), match.end() + 220)
            snippet = redact_debug_text(compact[start:end])
            out.append({
                "label": label,
                "urlPath": urllib.parse.urlparse(url).path,
                "pattern": pattern,
                "snippet": snippet[:420],
            })
            if len(out) >= limit:
                return out
    return out


def fetch_text_for_source(url):
    timeout = max(5, min(int(os.environ.get("ZEEV_INSPECT_HTTP_TIMEOUT_SECONDS", "15")), 45))
    base_headers = {
        "Accept": "text/html,application/javascript,text/javascript,application/json,*/*",
        "User-Agent": "ObrasRealEstate/1.0 (+https://raiz-obras.vercel.app)",
    }
    last = (0, "", "")
    for token in zeev_tokens() or [""]:
        for _, auth_headers in zeev_auth_attempts(token):
            headers = dict(base_headers)
            headers.update(auth_headers)
            req = urllib.request.Request(url, headers=headers, method="GET")
            try:
                with urllib.request.urlopen(req, timeout=timeout) as res:
                    raw = res.read()
                    ctype = res.headers.get("Content-Type", "")
                    return res.status, ctype, decode_http_text(raw, ctype)
            except urllib.error.HTTPError as exc:
                raw = exc.read()
                ctype = exc.headers.get("Content-Type", "")
                last = (exc.code, ctype, decode_http_text(raw, ctype))
                if exc.code not in (401, 403):
                    return last
    return last


def inspect_report_source(report_link, instance_id):
    if not report_link:
        return {"ok": False, "reason": "sem reportLink"}
    base = ZEEV_BASE_URL
    root = report_link if report_link.startswith("http") else f"{base}{report_link}"
    out = {
        "ok": True,
        "reportPath": urllib.parse.urlparse(root).path,
        "reportQueryKeys": sorted(urllib.parse.parse_qs(urllib.parse.urlparse(root).query).keys()),
        "assets": [],
        "matches": [],
        "errors": [],
    }
    try:
        status, ctype, html = fetch_text_for_source(root)
        out["reportStatus"] = status
        out["reportContentType"] = ctype
        out["reportLength"] = len(html)
        title = re.search(r"(?is)<title[^>]*>(.*?)</title>", html)
        if title:
            out["title"] = redact_debug_text(re.sub(r"\s+", " ", title.group(1)).strip())[:160]
        body_text = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", " ", html)
        body_text = re.sub(r"(?is)<[^>]+>", " ", body_text)
        body_text = re.sub(r"\s+", " ", html_lib.unescape(body_text)).strip()
        out["bodySnippet"] = redact_debug_text(body_text[:500])
        out["matches"].extend(source_matches("report-html", root, html, limit=20))

        asset_urls = []
        for raw in re.findall(r"""(?is)<script[^>]+src=["']([^"']+)["']|<link[^>]+href=["']([^"']+)["']""", html):
            href = next((x for x in raw if x), "")
            if href:
                asset_urls.append(urllib.parse.urljoin(root, href))
        for raw in re.findall(r"""(?i)(?:href|src)=["']([^"']+)["']""", html):
            if re.search(r"(?i)(\.js|api|download|file|arquivo|anexo|document)", raw):
                asset_urls.append(urllib.parse.urljoin(root, raw))
        seen = set()
        asset_limit = max(0, min(int(os.environ.get("ZEEV_INSPECT_SOURCE_ASSET_LIMIT", "0")), 14))
        for asset in asset_urls:
            parsed = urllib.parse.urlparse(asset)
            key = parsed.scheme + "://" + parsed.netloc + parsed.path
            if key in seen:
                continue
            seen.add(key)
            if len(out["assets"]) >= asset_limit:
                break
            try:
                st, ct, text = fetch_text_for_source(asset)
                asset_info = {
                    "path": parsed.path,
                    "status": st,
                    "contentType": ct,
                    "length": len(text),
                }
                matches = source_matches("asset", asset, text, limit=8)
                if matches:
                    asset_info["matches"] = matches[:5]
                    out["matches"].extend(matches[:8])
                out["assets"].append(asset_info)
            except Exception as exc:
                out["errors"].append({"assetPath": parsed.path, "error": str(exc)[:300]})
        if len(out["matches"]) > 40:
            out["matches"] = out["matches"][:40]
    except Exception as exc:
        out["ok"] = False
        out["errors"].append({"stage": "report-source", "error": str(exc)[:500]})
    return out


def direct_doc_rescue_enabled():
    return os.environ.get("ZEEV_DIRECT_DOC_RESCUE_ENABLED", "1").lower() not in {"0", "false", "no", "nao"}


def direct_doc_rescue_file_limit():
    return max(0, min(int(os.environ.get("ZEEV_DIRECT_DOC_RESCUE_FILE_LIMIT", os.environ.get("ZEEV_BACKFILL_FILE_LIMIT", "12")) or "12"), 40))


def direct_doc_rescue_max_bytes():
    return max(64_000, min(int(os.environ.get("ZEEV_DIRECT_DOC_RESCUE_MAX_BYTES", "5500000") or "5500000"), 18_000_000))


def doc_like_text(value):
    return bool(re.search(r"(?i)(nota|nfse|nfe|danfe|xml|pdf|arquivo|anexo|documento|document|doc|fatura|recibo|boleto|comprovante|download|file|attachment)", str(value or "")))


def safe_doc_name(name, content_type=""):
    clean = re.sub(r"[^A-Za-z0-9._ -]+", "_", str(name or "").strip()).strip(" ._")
    if not clean:
        clean = "documento-fiscal"
    if not re.search(r"\.[A-Za-z0-9]{2,8}$", clean):
        ext = mimetypes.guess_extension(str(content_type or "").split(";")[0].strip()) or ""
        if not ext and "xml" in str(content_type).lower():
            ext = ".xml"
        if not ext and "pdf" in str(content_type).lower():
            ext = ".pdf"
        clean += ext or ".pdf"
    return clean[:140]


def content_disposition_filename(headers):
    cd = ""
    try:
        cd = headers.get("Content-Disposition", "") or headers.get("content-disposition", "")
    except Exception:
        cd = ""
    match = re.search(r"filename\*=UTF-8''([^;]+)", cd, re.I)
    if match:
        return urllib.parse.unquote(match.group(1)).strip('"')
    match = re.search(r'filename="?([^";]+)"?', cd, re.I)
    return urllib.parse.unquote(match.group(1)).strip('"') if match else ""


def normalize_doc_url(url):
    raw = str(url or "").strip().strip("'\"<>")
    raw = re.sub(r"[),.;]+$", "", raw)
    if not raw:
        return ""
    if raw.startswith("//"):
        raw = "https:" + raw
    if re.match(r"^(?:\.\./|\.\/|/)?Storage/", raw, re.I):
        raw = urllib.parse.urljoin(ZEEV_BASE_URL.rstrip("/") + "/2.0/", raw)
    if raw.startswith("/"):
        raw = ZEEV_BASE_URL + raw
    if not re.match(r"^https?://", raw, re.I) and re.match(r"^[^\s<>\"']+\.(pdf|xml|png|jpe?g|webp|tiff?|xlsx?|docx?|zip)(?:$|[?#])", raw, re.I):
        raw = urllib.parse.urljoin(ZEEV_BASE_URL.rstrip("/") + "/2.0/", raw)
    if not re.match(r"^https?://", raw, re.I):
        return ""
    drive = re.search(r"drive\.google\.com/file/d/([^/]+)", raw)
    if drive:
        return f"https://drive.google.com/uc?export=download&id={drive.group(1)}"
    parsed = urllib.parse.urlparse(raw)
    qs = urllib.parse.parse_qs(parsed.query)
    if parsed.netloc.endswith("drive.google.com") and parsed.path == "/open" and qs.get("id"):
        return f"https://drive.google.com/uc?export=download&id={qs['id'][0]}"
    return raw


def doc_url_with_token_param(url, key, token):
    parsed = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    if any(k == key for k, _ in qs):
        return url
    qs.append((key, token))
    return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(qs)))


def looks_like_download_path(value):
    text = str(value or "").strip()
    if not text:
        return False
    return bool(
        re.match(r"^https?://", text, re.I)
        or re.match(r"^(?:\.\./|\.\/|/)?Storage/", text, re.I)
        or re.search(r"/Storage/[^?#]+", text, re.I)
        or re.search(r"/api/2/files/", text, re.I)
        or re.match(r"^[^\s<>\"']+\.(pdf|xml|png|jpe?g|webp|tiff?|xlsx?|docx?|zip)(?:$|[?#])", text, re.I)
    )


def filename_from_download_path(value, fallback="documento-fiscal.pdf"):
    clean = str(value or "").split("?", 1)[0].split("#", 1)[0].replace("\\", "/")
    return clean.rstrip("/").split("/")[-1] or fallback


def doc_kind(name="", url="", source=""):
    source_hay = norm(str(source or ""))
    hay = norm(" ".join([str(name or ""), str(url or ""), str(source or "")]))
    if any(x in source_hay for x in ["comprovante", "comprovantedopagamento", "pix"]):
        return "COMPROVANTE"
    if "boleto" in source_hay:
        return "BOLETO"
    if "fatura" in source_hay:
        return "FATURA"
    if "recibo" in hay:
        return "RECIBO"
    if any(x in hay for x in ["comprovante", "pix", "pago", "liquidado", "liquidacao"]):
        return "COMPROVANTE"
    if "boleto" in hay:
        return "BOLETO"
    if "fatura" in hay:
        return "FATURA"
    if re.search(r"\d{44}", " ".join([str(name or ""), str(url or ""), str(source or "")])):
        return "NF"
    return "NF"


def push_doc_candidate(out, name="", url="", file_id="", base64_content="", content_type="", source=""):
    url = normalize_doc_url(url)
    file_id = str(file_id or "").strip()
    base64_content = str(base64_content or "").strip()
    if not (url or file_id or base64_content):
        return
    clean_name = safe_doc_name(name or "documento-fiscal.pdf", content_type)
    key = "|".join([url, file_id, base64_content[:48], clean_name, str(source or "")])
    if any(d.get("key") == key for d in out):
        return
    out.append({
        "key": key,
        "name": clean_name,
        "url": url,
        "fileId": file_id,
        "base64Content": base64_content,
        "type": str(content_type or ""),
        "source": str(source or ""),
        "kind": doc_kind(clean_name, url, source),
    })


def collect_doc_candidates_from_value(out, label, value, source, depth=0):
    if value is None or depth > 5:
        return
    if isinstance(value, list):
        for item in value:
            collect_doc_candidates_from_value(out, label, item, source, depth + 1)
        return
    if isinstance(value, dict):
        value_path = value.get("value") if looks_like_download_path(value.get("value")) else ""
        name = value.get("fileName") or value.get("filename") or value.get("originalName") or value.get("displayName") or value.get("title") or (filename_from_download_path(value_path, label) if value_path else "") or value.get("name") or label
        content_type = value.get("type") or value.get("mimeType") or value.get("contentType") or ""
        url = value.get("url") or value.get("openUrl") or value.get("downloadUrl") or value.get("href") or value.get("link") or value.get("fileUrl") or value.get("signedUrl") or value.get("contentUrl") or value_path or ""
        file_id = value.get("fileId") or value.get("fileID") or value.get("file_id") or value.get("arquivoId") or value.get("documentId") or value.get("attachmentId") or ""
        if not file_id and doc_like_text(" ".join([str(label), str(name), str(source)])):
            file_id = value.get("id") if re.match(r"^[A-Za-z0-9._-]{3,180}$", str(value.get("id") or "")) else ""
        base64_content = value.get("base64Content") or value.get("base64") or value.get("contentBase64") or value.get("fileBase64") or value.get("bytesBase64") or ""
        push_doc_candidate(out, name=name, url=url, file_id=file_id, base64_content=base64_content, content_type=content_type, source=source)
        for key, nested in value.items():
            if doc_like_text(key):
                collect_doc_candidates_from_value(out, name or key, nested, source, depth + 1)
        return
    text = str(value or "").strip()
    if not text:
        return
    for url in re.findall(r"https?://[^\s\"'<>),;]+", text):
        if doc_like_text(" ".join([label, url, source])):
            push_doc_candidate(out, name=label or "documento-fiscal.pdf", url=url, source=source)
    if looks_like_download_path(text):
        push_doc_candidate(out, name=filename_from_download_path(text, label or "documento-fiscal.pdf"), url=text, source=source)
    if re.match(r"^data:[^;]+;base64,", text, re.I) or (len(text) > 120 and re.match(r"^[A-Za-z0-9+/=\s]+$", text)):
        push_doc_candidate(out, name=label or "documento-fiscal.pdf", base64_content=text, source=source)


def zeev_file_id_urls(file_id):
    if not file_id:
        return []
    quoted = urllib.parse.quote(str(file_id), safe="")
    urls = []
    template = os.environ.get("ZEEV_FILE_DOWNLOAD_URL_TEMPLATE", "").strip()
    if template:
        urls.append(template.replace("{fileId}", quoted).replace("{id}", quoted))
    for path in [
        f"/api/2/files/{quoted}",
        f"/api/2/files/{quoted}/download",
        f"/api/2/files/download/{quoted}",
        f"/api/2/files/instance-task/{quoted}",
        f"/api/2/files/instance-task/{quoted}/download",
    ]:
        urls.append(f"{ZEEV_BASE_URL}{path}")
    return urls


def fetch_binary_for_rescue(url):
    clean = normalize_doc_url(url)
    if not clean:
        raise RuntimeError("URL vazia ou invalida.")
    max_bytes = direct_doc_rescue_max_bytes()
    parsed = urllib.parse.urlparse(clean)
    zeev_host = urllib.parse.urlparse(ZEEV_BASE_URL).netloc
    is_zeev_host = parsed.netloc == zeev_host or parsed.netloc.endswith(".zeev.it")
    signed_zeev_download = is_zeev_host and ("/document/download/" in parsed.path.lower() or "c=" in parsed.query.lower())
    token_list = zeev_tokens() if is_zeev_host else [""]
    token_limit = max(1, min(int(os.environ.get("ZEEV_FILE_TOKEN_ATTEMPT_LIMIT", "2") or "2"), len(token_list or [""])))
    last_error = None
    attempts = []
    if not is_zeev_host:
        attempts.append((clean, "none", ""))
    else:
        for token in (token_list or [""])[:token_limit]:
            attempts.append((clean, "bearer", token))
        if signed_zeev_download:
            attempts.insert(0, (clean, "none", ""))
    seen = set()
    for attempt_url, auth_mode, token in attempts:
        key = f"{auth_mode}|{attempt_url}"
        if key in seen:
            continue
        seen.add(key)
        headers = {
            "Accept": "application/pdf,application/xml,text/xml,image/*,application/octet-stream,application/json,text/html,*/*",
            "User-Agent": "ObrasRealEstate/1.0 (+https://raiz-obras.vercel.app)",
        }
        if token and auth_mode == "bearer":
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(attempt_url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=max(5, min(int(os.environ.get("ZEEV_DIRECT_DOC_TIMEOUT_SECONDS", "12")), 60))) as res:
                length = int(res.headers.get("Content-Length") or "0")
                if length and length > max_bytes:
                    raise RuntimeError(f"arquivo maior que limite direto ({length} bytes)")
                raw = res.read(max_bytes + 1)
                if len(raw) > max_bytes:
                    raise RuntimeError(f"arquivo maior que limite direto ({len(raw)} bytes)")
                return {
                    "url": clean,
                    "status": res.status,
                    "headers": res.headers,
                    "contentType": res.headers.get("Content-Type", ""),
                    "name": content_disposition_filename(res.headers),
                    "body": raw,
                }
        except urllib.error.HTTPError as exc:
            body = decode_http_text(exc.read(500), exc.headers.get("Content-Type", ""))
            last_error = RuntimeError(f"HTTP {exc.code}: {redact_debug_text(body)[:220]}")
            if exc.code not in (401, 403):
                break
        except Exception as exc:
            last_error = exc
    raise last_error or RuntimeError("falha sem detalhe ao baixar arquivo")


def downloaded_doc_from_response(candidate, response, depth=0):
    body = response["body"]
    ctype = str(response.get("contentType") or candidate.get("type") or "").lower()
    text_head = decode_http_text(body[:300], response.get("contentType") or "").strip()
    if ("json" in ctype or text_head.startswith(("{", "["))) and depth < 2:
        try:
            nested = []
            collect_doc_candidates_from_value(nested, candidate.get("name") or "documento-fiscal.pdf", json.loads(decode_http_text(body, response.get("contentType") or "")), "download-json", 0)
            for item in nested:
                found = download_doc_candidate(item, depth + 1)
                if found:
                    return found
        except Exception:
            pass
    if "html" in ctype or text_head.lower().startswith("<!doctype") or text_head.lower().startswith("<html"):
        html = decode_http_text(body, response.get("contentType") or "")
        nested = []
        if depth < 2:
            for link in re.findall(r"""(?i)(?:href|src)=["']([^"']+)["']""", html) + re.findall(r"https?://[^\s\"'<>),;]+", html):
                if doc_like_text(link):
                    push_doc_candidate(nested, candidate.get("name") or "documento-fiscal.pdf", urllib.parse.urljoin(response["url"], link), source="download-html")
            for item in nested[:6]:
                found = download_doc_candidate(item, depth + 1)
                if found:
                    return found
        raise RuntimeError("download retornou HTML sem arquivo direto")
    if len(body) < 80:
        raise RuntimeError("conteudo muito pequeno para arquivo")
    final_type = response.get("contentType") or candidate.get("type") or "application/octet-stream"
    final_name = safe_doc_name(response.get("name") or candidate.get("name") or "documento-fiscal.pdf", final_type)
    return {
        "name": final_name,
        "type": final_type,
        "base64Content": base64.b64encode(body).decode("ascii"),
        "source": candidate.get("source") or "github-direct",
        "url": candidate.get("url") or response.get("url") or "",
        "kind": candidate.get("kind") or doc_kind(final_name, candidate.get("url"), candidate.get("source")),
        "size": len(body),
    }


def download_doc_candidate(candidate, depth=0):
    if candidate.get("base64Content"):
        raw = str(candidate.get("base64Content") or "")
        approx = int(len(raw) * 0.75)
        if approx > direct_doc_rescue_max_bytes():
            raise RuntimeError(f"base64 maior que limite direto ({approx} bytes)")
        return {
            "name": safe_doc_name(candidate.get("name"), candidate.get("type")),
            "type": candidate.get("type") or "application/octet-stream",
            "base64Content": raw,
            "source": candidate.get("source") or "github-direct",
            "url": candidate.get("url") or "",
            "kind": candidate.get("kind") or doc_kind(candidate.get("name"), candidate.get("url"), candidate.get("source")),
            "size": approx,
        }
    urls = []
    if candidate.get("url"):
        urls.append(candidate.get("url"))
    if candidate.get("fileId"):
        urls.extend(zeev_file_id_urls(candidate.get("fileId")))
    errors = []
    url_limit = max(1, min(int(os.environ.get("ZEEV_FILE_URL_ATTEMPT_LIMIT", "4") or "4"), len(urls), 12))
    for url in urls[:url_limit]:
        try:
            response = fetch_binary_for_rescue(url)
            return downloaded_doc_from_response(candidate, response, depth)
        except Exception as exc:
            errors.append(str(exc)[:260])
    if errors:
        raise RuntimeError(" | ".join(errors)[:700])
    return None


def rescue_documents_for_row(row):
    if not direct_doc_rescue_enabled() or direct_doc_rescue_file_limit() <= 0:
        return [], {"enabled": False}
    instance_id = int(row.get("id") or 0)
    flow_id = int((row.get("flow") or {}).get("id") or row.get("flowId") or row.get("flow_id") or 0)
    report_probe = {"requested": False, "fields": 0}
    try:
        report_field_limit = max(8, min(int(os.environ.get("ZEEV_DOC_REPORT_FIELD_LIMIT", "40") or "40"), 80))
        requested_fields = unique_fields(
            pending_fiscal_repair_fields(flow_id),
            DOCUMENT_FIELDS,
            env_list(os.environ.get("ZEEV_EXTRA_DOCUMENT_FIELDS", "")),
        )[:report_field_limit]
        rows = report_instance(
            instance_id,
            flow_id,
            fields=requested_fields,
            timeout=env_int("ZEEV_DIRECT_DOC_TIMEOUT_SECONDS", 20, 8, 60),
            retries=1,
        )
        target = next(
            (item for item in rows if int(item.get("id") or item.get("instanceId") or 0) == instance_id),
            rows[0] if rows else {},
        )
        report_fields = target.get("formFields") or []
        row["formFields"] = merge_zeev_fields(row.get("formFields") or [], report_fields)
        report_probe = {
            "requested": True,
            "fields": len(report_fields),
            "openUrls": sum(1 for field in report_fields if field.get("openUrl") or field.get("downloadUrl") or field.get("url")),
        }
    except Exception as exc:
        report_probe = {"requested": True, "fields": 0, "error": str(exc)[:240]}
    candidates = []
    for field in row.get("formFields") or []:
        label = field_display_name(field)
        if doc_like_text(label) or doc_like_text(field):
            collect_doc_candidates_from_value(candidates, label or "documento-fiscal.pdf", field, label or "raw_fields", 0)
            collect_doc_candidates_from_value(candidates, label or "documento-fiscal.pdf", field.get("value"), label or "raw_fields", 0)
    try:
        messages = row.get("__messages") if isinstance(row.get("__messages"), list) else instance_messages(instance_id)
        if messages:
            row["__messages"] = messages
        for msg in messages or []:
            collect_doc_candidates_from_value(candidates, "comentario Zeev", msg, "messages", 0)
            collect_doc_candidates_from_value(candidates, "comentario Zeev", msg.get("body") or msg.get("text") or msg.get("message") or msg.get("comment"), "messages", 0)
    except Exception:
        pass
    report_link = str(row.get("reportLink") or row.get("reportUrl") or "").strip()
    if report_link:
        try:
            root = report_link if report_link.startswith("http") else f"{ZEEV_BASE_URL}{report_link}"
            _, _, html = fetch_text_for_source(root)
            for link in re.findall(r"""(?i)(?:href|src)=["']([^"']+)["']""", html) + re.findall(r"https?://[^\s\"'<>),;]+", html):
                if doc_like_text(link):
                    push_doc_candidate(candidates, "documento-fiscal.pdf", urllib.parse.urljoin(root, link), source="reportLink")
        except Exception:
            pass
    base = ZEEV_BASE_URL
    probe_urls = [
        f"{base}/api/2/instances/{instance_id}/files",
        f"{base}/api/2/instances/{instance_id}/attachments",
        f"{base}/api/2/instances/{instance_id}/documents",
        f"{base}/api/2/files/instance/{instance_id}",
        f"{base}/api/2/attachments/instance/{instance_id}",
        f"{base}/api/2/documents/instance/{instance_id}",
        f"{base}/api/2/instances/{instance_id}/form-fields/Documento",
    ]
    for url in probe_urls:
        try:
            status, ctype, text = fetch_text_for_source(url)
            if 200 <= status < 300 and ("json" in ctype.lower() or text.strip().startswith(("{", "["))):
                collect_doc_candidates_from_value(candidates, "documento-fiscal.pdf", json.loads(text), urllib.parse.urlparse(url).path, 0)
        except Exception:
            continue
    downloaded = []
    skipped = []
    for candidate in candidates:
        candidate_limit = max(direct_doc_rescue_file_limit(), min(int(os.environ.get("ZEEV_DOC_CANDIDATE_ATTEMPT_LIMIT", "60") or "60"), 120))
        if len(skipped) + len(downloaded) >= candidate_limit:
            break
        if len(downloaded) >= direct_doc_rescue_file_limit():
            break
        try:
            doc = download_doc_candidate(candidate)
            if doc and not any(d.get("base64Content") == doc.get("base64Content") for d in downloaded):
                downloaded.append(doc)
        except Exception as exc:
            if len(skipped) < 10:
                skipped.append({
                    "name": candidate.get("name") or "",
                    "source": candidate.get("source") or "",
                    "hasUrl": bool(candidate.get("url")),
                    "hasFileId": bool(candidate.get("fileId")),
                    "reason": str(exc)[:240],
                })
    debug = {
        "enabled": True,
        "candidates": len(candidates),
        "downloaded": len(downloaded),
        "reportProbe": report_probe,
        "skipped": skipped,
    }
    return downloaded, debug


def attach_rescued_docs(ticket, row):
    if not ticket or not isinstance(ticket, dict):
        return ticket
    docs, debug = rescue_documents_for_row(row)
    campos = ticket.get("campos_extraidos") if isinstance(ticket.get("campos_extraidos"), dict) else {}
    campos["_zeev_doc_rescue"] = {
        **{k: v for k, v in debug.items() if k != "skipped"},
        "downloadedDocsInMemory": len(docs),
    }
    if debug.get("skipped"):
        campos["_zeev_doc_rescue_skipped"] = debug.get("skipped")[:5]
    ticket["campos_extraidos"] = campos
    # Keep only the downloaded payloads needed by the Edge ingest. The Edge
    # reads them from raw_instance, stores the files, then removes this
    # temporary JSON so the base64 content never remains in Postgres.
    ticket.pop("__downloaded_docs", None)
    ticket["raw_instance"] = {"__downloaded_docs": docs}
    ticket["raw_tasks"] = []
    return ticket


def embedded_downloaded_docs(ticket):
    if not isinstance(ticket, dict):
        return []
    for value in (
        ticket.get("__downloaded_docs"),
        ticket.get("downloaded_docs"),
        ticket.get("zeev_downloaded_docs"),
    ):
        if isinstance(value, list):
            return value
    raw = ticket.get("raw_instance") if isinstance(ticket.get("raw_instance"), dict) else {}
    for key in ("__downloaded_docs", "downloadedDocs", "zeevDownloadedDocs", "directDownloadedDocs"):
        value = raw.get(key)
        if isinstance(value, list):
            return value
    return []


def inspect_docs():
    if not has_zeev_token():
        raise SystemExit("ZEEV_TOKEN e obrigatorio.")
    ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    if not ids:
        raise SystemExit("ZEEV_TICKET_IDS e obrigatorio para inspect-docs.")
    extra_fields = unique_fields(DOCUMENT_FIELDS, env_list(os.environ.get("ZEEV_EXTRA_DOCUMENT_FIELDS", "")))
    inspect_timeout = max(5, min(int(os.environ.get("ZEEV_INSPECT_TIMEOUT_SECONDS", "20")), 90))
    doc_field_limit = max(0, min(int(os.environ.get("ZEEV_INSPECT_DOC_FIELD_LIMIT", "8")), len(extra_fields)))
    report_field_limit = max(0, min(int(os.environ.get("ZEEV_INSPECT_REPORT_FIELD_LIMIT", "0")), 30))
    report_page_limit = max(1, min(int(os.environ.get("ZEEV_INSPECT_REPORT_PAGE_LIMIT", "2")), 15))
    probe_limit = max(0, min(int(os.environ.get("ZEEV_INSPECT_PROBE_LIMIT", "5")), 12))
    out = {"ok": True, "mode": "inspect-docs", "tickets": [], "errors": []}
    for instance_id in ids:
        entry = {"id": instance_id, "allFields": [], "requestedDocFields": [], "reportFieldTests": [], "tasks": [], "messages": {}, "errors": []}
        try:
            data, fields = instance_fields(instance_id, [], timeout=inspect_timeout, retries=1)
            report_link = str(data.get("reportLink") or data.get("reportUrl") or "").strip()
            flow = data.get("flow") or {}
            entry.update({
                "flowId": int(flow.get("id") or data.get("flowId") or 0),
                "flowName": flow.get("name") or data.get("flowName") or data.get("requestName") or "",
                "flowVersion": flow.get("version") or data.get("flowVersion") or "",
                "requestName": data.get("requestName") or "",
                "reportLink": bool(report_link),
                "fieldCountAll": len(fields or []),
                "taskCount": len(data.get("instanceTasks") or []),
            })
            entry["fiscalNumberFieldNames"] = flow_design_fiscal_number_fields(int(entry.get("flowId") or 0))[:40]
            design_limit = max(0, min(int(os.environ.get("ZEEV_INSPECT_FLOW_DESIGN_LIMIT", "80") or "80"), 200))
            if design_limit and entry.get("flowId"):
                entry["flowDesignFields"] = [
                    {
                        "name": str(obj.get("name") or "").strip(),
                        "label": str(obj.get("label") or obj.get("title") or obj.get("caption") or "").strip(),
                        "group": str(obj.get("groupName") or obj.get("integrationName") or obj.get("typeName") or "").strip(),
                        "type": str(obj.get("type") or obj.get("fieldType") or "").strip(),
                    }
                    for obj in flow_design_form_fields(int(entry.get("flowId") or 0))[:design_limit]
                ]
            for field in fields or []:
                name = field_display_name(field)
                value = field.get("value")
                n = norm_key(name)
                looks_doc = bool(re.search(r"(nota|nf|nfs|danfe|xml|pdf|arquivo|anexo|documento|comprovante|boleto|fatura|recibo|file|upload)", n))
                if looks_doc or len(entry["allFields"]) < 25:
                    item = {
                        "name": name,
                        "row": field.get("row") or 1,
                        "type": field.get("type") or field.get("fieldType") or "",
                        "keys": sorted(str(k) for k in field.keys())[:30],
                        "looksDoc": looks_doc,
                        **doc_value_meta(value),
                    }
                    entry["allFields"].append(item)
        except Exception as exc:
            entry["errors"].append({"stage": "all-fields", "error": str(exc)[:500]})

        doc_fields_to_query = extra_fields[:doc_field_limit]
        for i in range(0, len(doc_fields_to_query), 8):
            chunk = doc_fields_to_query[i:i + 8]
            try:
                _, found = instance_fields(instance_id, chunk, timeout=inspect_timeout, retries=1)
                for field in found or []:
                    name = field_display_name(field)
                    entry["requestedDocFields"].append({
                        "name": name,
                        "row": field.get("row") or 1,
                        "type": field.get("type") or field.get("fieldType") or "",
                        "keys": sorted(str(k) for k in field.keys())[:30],
                        **doc_value_meta(field.get("value")),
                    })
            except Exception as exc:
                entry["errors"].append({"stage": "doc-fields", "fields": chunk, "error": str(exc)[:500]})

        flow_for_report = int(entry.get("flowId") or (FLOW_IDS[0] if FLOW_IDS else 0) or 0)
        try:
            direct_tests = []
            direct_field_sets = [
                pending_fiscal_repair_fields(flow_for_report)[:30],
                ["Documento"],
                ["documento"],
                ["Documento", "documento", "danfe", "arquivo", "notaFiscal", "nota fiscal"],
                [],
            ]
            for field_set in direct_field_sets:
                rows = report_instance(instance_id, flow_for_report, fields=field_set if field_set else None, timeout=inspect_timeout, retries=1)
                target = next((row for row in rows if int(row.get("id") or 0) == int(instance_id)), (rows[0] if rows else {}))
                fields = target.get("formFields") or []
                direct_tests.append({
                    "requested": field_set or "__no_formFieldNames__",
                    "rows": len(rows or []),
                    "fieldCount": len(fields),
                    "fields": [
                        {
                            "name": field_display_name(field),
                            "row": field.get("row") or 1,
                            "type": field.get("type") or field.get("fieldType") or "",
                            "keys": sorted(str(k) for k in field.keys())[:30],
                            **doc_value_meta(field.get("value")),
                            "hasOpenUrl": bool(field.get("openUrl")),
                            "openUrlPath": urllib.parse.urlparse(str(field.get("openUrl") or "")).path[:180],
                        }
                        for field in fields[:12]
                    ],
                })
            entry["reportInstanceTests"] = direct_tests
        except Exception as exc:
            entry["errors"].append({"stage": "report-instance-tests", "error": str(exc)[:500]})

        if flow_for_report and report_field_limit:
            for field_name in unique_fields(["Documento", "documento"], extra_fields)[:report_field_limit]:
                try:
                    start = os.environ.get("ZEEV_SYNC_START") or "2025-01-01T00:00:00-03:00"
                    end = os.environ.get("ZEEV_SYNC_END") or datetime.now(business_tz()).isoformat(timespec="seconds")
                    found_rows = []
                    for page in range(1, report_page_limit + 1):
                        rows = report_page(flow_for_report, page, start, end, page_size=30, fields=[field_name])
                        for row in rows or []:
                            if int(row.get("id") or 0) == int(instance_id):
                                found_rows.append(row)
                        if found_rows or len(rows or []) < 30:
                            break
                    if found_rows:
                        fields = found_rows[0].get("formFields") or []
                        entry["reportFieldTests"].append({
                            "requested": field_name,
                            "fieldCount": len(fields),
                            "fields": [
                                {
                                    "name": field_display_name(field),
                                    "row": field.get("row") or 1,
                                    "type": field.get("type") or field.get("fieldType") or "",
                                    "keys": sorted(str(k) for k in field.keys())[:30],
                                    **doc_value_meta(field.get("value")),
                                }
                                for field in fields[:10]
                            ],
                        })
                    else:
                        entry["reportFieldTests"].append({"requested": field_name, "foundInReportWindow": False})
                except Exception as exc:
                    entry["errors"].append({"stage": "report-field", "field": field_name, "error": str(exc)[:500]})

        try:
            messages = instance_messages(instance_id)
            url_messages = []
            for msg in messages or []:
                body = clean_zeev_message_body((msg or {}).get("body"))
                urls = re.findall(r"https?://[^\s\"'<>),;]+", body)
                if urls:
                    url_messages.append({"keys": sorted(str(k) for k in msg.keys())[:20], "urlCount": len(urls), "sampleUrls": urls[:3]})
            entry["messages"] = {"count": len(messages or []), "withUrls": len(url_messages), "samples": url_messages[:5]}
        except Exception as exc:
            entry["errors"].append({"stage": "messages", "error": str(exc)[:500]})
        try:
            base = ZEEV_BASE_URL
            probe_urls = [
                f"{base}/api/2/flows/{flow_for_report}/design/form",
                f"{base}/api/2/flows/{flow_for_report}",
                f"{base}/api/2/instances/{instance_id}",
                f"{base}/api/2/instances/{instance_id}/files",
                f"{base}/api/2/instances/{instance_id}/attachments",
                f"{base}/api/2/instances/{instance_id}/documents",
                f"{base}/api/2/files/instance/{instance_id}",
                f"{base}/api/2/attachments/instance/{instance_id}",
                f"{base}/api/2/documents/instance/{instance_id}",
                f"{base}/api/2/instances/{instance_id}/form-fields/Documento",
            ]
            if report_link:
                probe_urls.insert(0, report_link if report_link.startswith("http") else f"{base}{report_link}")
            entry["endpointProbes"] = []
            for url in probe_urls[:probe_limit]:
                entry["endpointProbes"].append(http_probe(url))
        except Exception as exc:
            entry["errors"].append({"stage": "endpoint-probes", "error": str(exc)[:500]})
        try:
            entry["sourceInspection"] = inspect_report_source(report_link, instance_id)
        except Exception as exc:
            entry["errors"].append({"stage": "source-inspection", "error": str(exc)[:500]})
        out["tickets"].append(entry)
    out["ok"] = not any(t.get("errors") for t in out["tickets"]) and not out["errors"]
    return out


def fiscal_doc_type_from_fields(fields):
    text = " ".join(
        str(x or "")
        for field in fields or []
        for x in [field_display_name(field), field.get("value"), field.get("openUrl"), field.get("url")]
    )
    n = norm_key(text)
    if "fatura" in n:
        return "FATURA"
    if "recibo" in n:
        return "RECIBO"
    if "nfse" in n or "nfs" in n or "notafiscaldeservico" in n:
        return "NFS-e"
    if "nfe" in n or "danfe" in n or "notafiscal" in n:
        return "NF-e"
    return "NF/Fatura"


def neutral_fiscal_type(value):
    text = norm_key(value)
    return not text or text in {"semnota", "documento", "boleto"}


def suspicious_fiscal_number(value):
    digits = re.sub(r"\D+", "", str(value or ""))
    if not digits:
        return False
    if re.match(r"^20\d{6,}$", digits):
        return True
    return len(digits) > 13


def ticket_numbers_from_value(value):
    numbers = []
    seen = set()
    for raw in re.findall(r"(?<!\d)\d{4,7}(?!\d)", str(value or "")):
        number = int(raw.lstrip("0") or "0")
        if number and number not in seen:
            numbers.append(number)
            seen.add(number)
    return numbers


def fiscal_number_source(fields, number):
    wanted = str(number or "").strip()
    if not wanted:
        return {}
    for group in (FISCAL_NUMBER_FIELDS, GENERIC_FISCAL_NUMBER_FIELDS):
        for field in fields or []:
            if not field_matches(field, group):
                continue
            cleaned = (
                clean_fiscal_document_number_for_field(field, field.get("value"))
                if group == FISCAL_NUMBER_FIELDS
                else clean_fiscal_document_number(field.get("value"))
            )
            if cleaned == wanted:
                return {
                    "field": field_display_name(field),
                    "row": int(field.get("row") or 1),
                    "source": field.get("source") or "",
                }
    return {}


def fiscal_number_extract_fields():
    return unique_fields(
        FISCAL_NUMBER_FIELDS,
        GENERIC_FISCAL_NUMBER_FIELDS,
        ISSUE_DATE_FIELDS,
        DOCUMENT_FIELDS,
        ["Outros gastos", "Outros gastos *", "Tipo de documento", "Tipo do documento"],
    )


def extract_fiscal_numbers():
    if not has_zeev_token():
        raise SystemExit("ZEEV_TOKEN e obrigatorio.")
    ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    if not ids:
        raise SystemExit("ZEEV_TICKET_IDS e obrigatorio para extract-fiscal-numbers.")
    timeout = max(10, min(int(os.environ.get("ZEEV_FISCAL_NUMBER_TIMEOUT_SECONDS", "45") or "45"), 120))
    query_fields = fiscal_number_extract_fields()
    rows = []
    errors = []
    for instance_id in ids:
        entry = {
            "tr": instance_id,
            "numero": "",
            "tipo": "",
            "flowId": 0,
            "flowName": "",
            "sourceField": "",
            "source": "",
            "status": "nao_encontrado",
        }
        fields = []
        latest = {}
        try:
            latest, found = instance_fields(instance_id, query_fields, timeout=timeout, retries=2)
            fields = merge_zeev_fields(fields, found)
            flow = (latest or {}).get("flow") or {}
            entry["flowId"] = int(flow.get("id") or (latest or {}).get("flowId") or 0)
            entry["flowName"] = flow.get("name") or (latest or {}).get("flowName") or (latest or {}).get("requestName") or ""
            financeiro = is_finance_row(latest or {})
            number = fiscal_document_number(fields, financeiro=financeiro)
            if not number and entry["flowId"]:
                try:
                    flow_fields = unique_fields(query_fields, pending_fiscal_repair_fields(entry["flowId"]))
                    _, found_flow = instance_fields(instance_id, flow_fields, timeout=timeout, retries=1)
                    fields = merge_zeev_fields(fields, found_flow)
                    number = fiscal_document_number(fields, financeiro=financeiro)
                except Exception as exc:
                    errors.append({"tr": instance_id, "stage": "flow-design-fields", "error": str(exc)[:300]})
            if not number:
                try:
                    detail, found_all = instance_fields(instance_id, [], timeout=timeout, retries=1)
                    latest = detail or latest
                    fields = merge_zeev_fields(fields, found_all)
                    financeiro = financeiro or is_finance_row(latest or {})
                    number = fiscal_document_number(fields, financeiro=financeiro)
                except Exception as exc:
                    errors.append({"tr": instance_id, "stage": "all-fields", "error": str(exc)[:300]})
            if not number:
                report_link = str((latest or {}).get("reportLink") or (latest or {}).get("reportUrl") or "").strip()
                if report_link:
                    try:
                        report_fields, _ = fetch_report_link_fields(report_link)
                        fields = merge_zeev_fields(fields, report_fields)
                        number = fiscal_document_number(fields, financeiro=True)
                    except Exception as exc:
                        errors.append({"tr": instance_id, "stage": "report-link", "error": str(exc)[:300]})
            if number:
                source = fiscal_number_source(fields, number)
                entry.update({
                    "numero": number,
                    "tipo": fiscal_doc_type_from_fields(fields),
                    "sourceField": source.get("field") or "",
                    "source": source.get("source") or "",
                    "status": "encontrado",
                })
            else:
                entry["tipo"] = fiscal_doc_type_from_fields(fields) if fields else ""
        except Exception as exc:
            entry["status"] = "erro"
            entry["error"] = str(exc)[:500]
        rows.append(entry)
    return {
        "ok": not any(row.get("status") == "erro" for row in rows),
        "mode": "extract-fiscal-numbers",
        "requested": len(ids),
        "found": sum(1 for row in rows if row.get("numero")),
        "missing": sum(1 for row in rows if not row.get("numero")),
        "tickets": rows,
        "errors": errors[:30],
    }


def repair_payment_fiscal_fields():
    if not has_zeev_token():
        raise SystemExit("ZEEV_TOKEN e obrigatorio.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise SystemExit("SUPABASE_SERVICE_ROLE_KEY e obrigatorio.")
    ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    limit = max(1, min(int(os.environ.get("ZEEV_REPAIR_PAYMENT_LIMIT", os.environ.get("ZEEV_BACKFILL_LIMIT", "40")) or "40"), 300))
    scan_limit = max(limit, min(int(os.environ.get("ZEEV_REPAIR_PAYMENT_SCAN_LIMIT", str(limit * 12)) or str(limit * 12)), 3000))
    repair_values = os.environ.get("ZEEV_REPAIR_PAYMENT_VALUES", "0").strip().lower() in {"1", "true", "sim", "yes", "on"}
    select_cols = "id,obra_id,ticket_raiz,nf_num,nf_tipo,v"
    if ids:
        rows = supabase_rest(f"/pagamentos?select={select_cols}&ticket_raiz=in.({','.join(str(x) for x in ids)})&order=id.asc", timeout=90, prefer="")
    else:
        rows = supabase_rest(f"/pagamentos?select={select_cols}&ticket_raiz=not.is.null&order=id.asc&limit={scan_limit}", timeout=90, prefer="")
    target = []
    id_set = {str(x) for x in ids}
    skipped = []
    for row in rows or []:
        row_tickets = ticket_numbers_from_value(row.get("ticket_raiz"))
        if id_set:
            matched = [number for number in row_tickets if str(number) in id_set]
            if not matched:
                continue
            row["_repair_tr"] = matched[0]
        elif len(row_tickets) != 1:
            if len(skipped) < 20:
                skipped.append({
                    "pagamento_id": row.get("id"),
                    "ticket_raiz": str(row.get("ticket_raiz") or "")[:120],
                    "reason": "nenhum TR unico" if not row_tickets else "multiplos TRs no mesmo pagamento",
                })
            continue
        else:
            row["_repair_tr"] = row_tickets[0]
        if not row.get("_repair_tr"):
            continue
        current_num = str(row.get("nf_num") or "").strip()
        if ids or not current_num or suspicious_fiscal_number(current_num) or neutral_fiscal_type(row.get("nf_tipo")):
            target.append(row)
        if not ids and len(target) >= limit:
            break

    query_fields = unique_fields(
        PAYMENT_TOTAL_FIELDS,
        fiscal_number_extract_fields(),
        ["valorTotalDoPagamento01", "valorTotalDoPagamento", "anexarNotaFiscal"],
    )
    out = {
        "ok": True,
        "mode": "repair-payment-fiscal-fields",
        "requestedTickets": ids,
        "loadedPayments": len(rows or []),
        "scannedPayments": len(target),
        "skippedAmbiguous": skipped,
        "updatedPayments": 0,
        "unchanged": 0,
        "errors": [],
        "updated": [],
    }
    for row in target:
        tr = int(row.get("_repair_tr") or 0)
        try:
            latest, fields = instance_fields(tr, query_fields, timeout=60, retries=2)
            financeiro = is_finance_row(latest or {}) or True
            number = fiscal_document_number(fields, financeiro=financeiro)
            doc_type = fiscal_doc_type_from_fields(fields)
            items = extract_items(fields)
            value = pick_ticket_value(fields, items, financeiro=financeiro)
            patch = {}
            current_num = str(row.get("nf_num") or "").strip()
            current_type = str(row.get("nf_tipo") or "").strip()
            if number and number != current_num and (ids or not current_num or suspicious_fiscal_number(current_num) or neutral_fiscal_type(current_type)):
                patch["nf_num"] = number
            if number and doc_type and doc_type != current_type and (ids or neutral_fiscal_type(current_type)):
                patch["nf_tipo"] = doc_type
            if repair_values and value and abs(float(row.get("v") or 0) - float(value)) >= 0.01:
                patch["v"] = round(float(value), 2)
            if patch:
                supabase_rest(f"/pagamentos?id=eq.{int(row.get('id'))}", method="PATCH", payload=patch, timeout=90)
                out["updatedPayments"] += 1
                if len(out["updated"]) < 120:
                    out["updated"].append({
                        "tr": tr,
                        "pagamento_id": row.get("id"),
                        "obra_id": row.get("obra_id"),
                        "before": {"nf_num": current_num, "nf_tipo": current_type, "v": row.get("v")},
                        "after": patch,
                    })
            else:
                out["unchanged"] += 1
        except Exception as exc:
            out["errors"].append({"tr": tr, "pagamento_id": row.get("id"), "error": str(exc)[:500]})
    if out["errors"]:
        out["ok"] = False
        out["errors"] = out["errors"][:30]
    return out


def pending_fiscal_repair_fields(flow_id=0):
    return unique_fields(
        FISCAL_NUMBER_FIELDS,
        GENERIC_FISCAL_NUMBER_FIELDS,
        flow_design_fiscal_number_fields(flow_id),
        ISSUE_DATE_FIELDS,
        DOCUMENT_FIELDS,
        ["Outros gastos", "Outros gastos *", "Tipo de documento", "Tipo do documento"],
    )


def row_ticket_id(row):
    digits = re.sub(r"\D+", "", str(row.get("zeev_instance_id") or row.get("ticket_raiz") or ""))
    return int(digits or 0)


def row_stored_fields(row):
    fields = []
    for key in ("raw_fields", "rawFields"):
        if isinstance(row.get(key), list):
            fields = merge_zeev_fields(fields, row.get(key))
    raw = row.get("raw_instance") if isinstance(row.get("raw_instance"), dict) else {}
    if isinstance(raw.get("formFields"), list):
        fields = merge_zeev_fields(fields, raw.get("formFields"))
    for source_key in ("campos_extraidos", "pagamento_json"):
        data = row.get(source_key)
        if isinstance(data, dict):
            generated = [
                {"name": str(k), "label": str(k), "value": v, "row": 1, "source": source_key}
                for k, v in data.items()
                if str(k or "").strip() and v not in (None, "")
            ]
            fields = merge_zeev_fields(fields, generated)
    return fields


def pending_fiscal_number_from_fields(fields):
    nf_tipo = fiscal_doc_type_from_fields(fields)
    number = fiscal_document_number(fields, financeiro=True)
    if (not number) or suspicious_fiscal_number(number):
        attachment_tipo, attachment_number = fiscal_number_from_attachment_fields(fields)
        if attachment_number:
            nf_tipo = attachment_tipo or nf_tipo
            number = attachment_number
    if not number:
        return nf_tipo, ""
    if nf_tipo and ("NFS" in nf_tipo or re.match(r"^20\d{6,}$", str(number))):
        match = re.match(r"^20\d{2}0+(\d{1,9})$", re.sub(r"\D+", "", str(number)))
        if match:
            number = match.group(1).lstrip("0") or "0"
    return nf_tipo, str(number).strip()


def pending_fiscal_recently_checked(row, stale_hours):
    if stale_hours <= 0:
        return False
    campos = row.get("campos_extraidos") if isinstance(row.get("campos_extraidos"), dict) else {}
    value = str(campos.get("numero_documento_fiscal_revisado_em") or campos.get("numero_documento_fiscal_nao_encontrado_em") or "").strip()
    if not value:
        return False
    try:
        checked = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    now = datetime.now(timezone.utc)
    if checked.tzinfo is None:
        checked = checked.replace(tzinfo=timezone.utc)
    age = now - checked.astimezone(timezone.utc)
    return age.total_seconds() >= 0 and age < timedelta(hours=stale_hours)


def pending_fiscal_needs_repair(row, force=False, stale_hours=24):
    if force:
        return True
    pagamento = row.get("pagamento_json") if isinstance(row.get("pagamento_json"), dict) else {}
    current = str(pagamento.get("nota_fiscal") or "").strip()
    if current and not suspicious_fiscal_number(current):
        return False
    if pending_fiscal_recently_checked(row, stale_hours):
        return False
    return True


def patch_pending_fiscal_result(row, number="", nf_tipo="", source_fields=None, error=""):
    pagamento = row.get("pagamento_json") if isinstance(row.get("pagamento_json"), dict) else {}
    campos = row.get("campos_extraidos") if isinstance(row.get("campos_extraidos"), dict) else {}
    now = datetime.now(timezone.utc).isoformat()
    patch = {
        "pagamento_json": dict(pagamento),
        "campos_extraidos": {
            **dict(campos),
            "fonte_numero_documento_fiscal": "formulario_zeev",
            "numero_documento_fiscal_revisado_em": now,
        },
    }
    if number:
        patch["pagamento_json"]["nota_fiscal"] = str(number)
        if nf_tipo:
            patch["pagamento_json"]["tipo_documento_fiscal"] = nf_tipo
        patch["campos_extraidos"]["numero_documento_fiscal"] = str(number)
        patch["campos_extraidos"]["tipo_documento_fiscal"] = nf_tipo or ""
        patch["campos_extraidos"]["numero_documento_fiscal_atualizado_em"] = now
        patch["campos_extraidos"].pop("numero_documento_fiscal_nao_encontrado_em", None)
        patch["campos_extraidos"].pop("numero_documento_fiscal_erro_zeev", None)
    else:
        patch["campos_extraidos"]["numero_documento_fiscal_nao_encontrado_em"] = now
        if error:
            patch["campos_extraidos"]["numero_documento_fiscal_erro_zeev"] = str(error)[:500]
    if source_fields:
        raw_fields = merge_zeev_fields(row.get("raw_fields") or [], source_fields)
        if raw_fields:
            patch["raw_fields"] = raw_fields
    supabase_rest(f"/capex_zeev_solicitacoes?id=eq.{int(row.get('id'))}", method="PATCH", payload=patch, timeout=90)
    return patch


def repair_pending_fiscal_metadata():
    if os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_VIA_EDGE", "false").lower() == "true":
        if not ZEEV_SYNC_SECRET:
            raise SystemExit("ZEEV_SYNC_SECRET e obrigatorio.")
        payload = {
            "mode": "repair-pending-fiscal-metadata",
            "limit": max(1, int(os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_LIMIT", os.environ.get("ZEEV_BACKFILL_LIMIT", "120")) or "120")),
            "refresh": os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_REFRESH", "true").lower() != "false",
        }
        ticket_ids = os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or ""
        if ticket_ids:
            payload["ticketIds"] = ticket_ids
        if os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_FORCE", "false").lower() == "true":
            payload["force"] = True
        return request_json(
            "POST",
            f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
            headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
            payload=payload,
            timeout=240,
            retries=1,
        )
    cycles = max(1, min(int(os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_CYCLES", "1") or "1"), 20))
    limit = max(1, int(os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_LIMIT", os.environ.get("ZEEV_BACKFILL_LIMIT", "120")) or "120"))
    max_runtime_ms = max(15000, int(os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_MAX_RUNTIME_MS", "105000") or "105000"))
    deadline = time.monotonic() + (max_runtime_ms / 1000)
    stale_hours = max(0, int(os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_STALE_HOURS", "24") or "24"))
    refresh = os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_REFRESH", "true").lower() != "false"
    ticket_ids = os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or ""
    force = os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_FORCE", "false").lower() == "true"
    target_ids = parse_ticket_ids(ticket_ids)
    order = "asc" if os.environ.get("ZEEV_PENDING_FISCAL_REPAIR_ORDER", "").lower() in {"asc", "oldest", "antigos"} else "desc"
    order_sql = "start_date_time.asc.nullsfirst,id.asc" if order == "asc" else "start_date_time.desc.nullslast,id.desc"
    select = ",".join([
        "id", "zeev_instance_id", "flow_id", "flow_name", "request_name", "status", "ticket_link",
        "start_date_time", "pagamento_json", "campos_extraidos", "raw_fields", "raw_tasks", "raw_instance", "docs_json",
    ])
    if target_ids:
        rows = supabase_rest_all(
            f"/capex_zeev_solicitacoes?select={select}&zeev_instance_id=in.({','.join(map(str, target_ids))})&order={order_sql}",
            page_size=1000,
            timeout=90,
        )
    else:
        rows = supabase_rest_all(
            f"/capex_zeev_solicitacoes?select={select}&status=eq.pendente&order={order_sql}",
            page_size=1000,
            timeout=90,
        )
    candidates = [
        row for row in rows
        if row_ticket_id(row) and (not target_ids or row_ticket_id(row) in set(target_ids))
        and is_finance_row(row)
        and pending_fiscal_needs_repair(row, force=force, stale_hours=stale_hours)
    ]
    out = {
        "ok": True,
        "mode": "repair-pending-fiscal-metadata",
        "implementation": "python-direct-zeev",
        "scannedPending": len(rows),
        "financeCandidatesTotal": len(candidates),
        "cycles": [],
        "totals": {"processed": 0, "updatedPending": 0, "missingAfterRefresh": 0, "errors": 0},
    }
    base_fields = pending_fiscal_repair_fields()
    for cycle in range(1, cycles + 1):
        batch = candidates[(cycle - 1) * limit: cycle * limit]
        if not batch:
            break
        result = {"cycle": cycle, "processed": 0, "updatedPending": 0, "missingAfterRefresh": 0, "deadlineReached": False, "updated": [], "missing": [], "errors": []}
        for row in batch:
            if time.monotonic() >= deadline:
                result["deadlineReached"] = True
                break
            tr = row_ticket_id(row)
            try:
                stored_fields = row_stored_fields(row)
                nf_tipo, number = pending_fiscal_number_from_fields(stored_fields)
                fetched_fields = []
                fetch_error = ""
                if refresh and (not number or suspicious_fiscal_number(number)):
                    flow_id = int(row.get("flow_id") or 0)
                    fields = unique_fields(base_fields, pending_fiscal_repair_fields(flow_id))
                    try:
                        _, fetched_fields = instance_fields(tr, fields, timeout=25, retries=1)
                        nf_tipo, number = pending_fiscal_number_from_fields(merge_zeev_fields(stored_fields, fetched_fields))
                    except Exception as exc:
                        fetch_error = str(exc)[:500]
                result["processed"] += 1
                if number and not suspicious_fiscal_number(number):
                    before = (row.get("pagamento_json") or {}).get("nota_fiscal") if isinstance(row.get("pagamento_json"), dict) else ""
                    patch_pending_fiscal_result(row, number=number, nf_tipo=nf_tipo, source_fields=fetched_fields)
                    result["updatedPending"] += 1
                    if len(result["updated"]) < 120:
                        result["updated"].append({"tr": tr, "rowId": row.get("id"), "before": before or "", "after": {"nota_fiscal": number, "tipo_documento_fiscal": nf_tipo or ""}})
                else:
                    patch_pending_fiscal_result(row, source_fields=fetched_fields, error=fetch_error)
                    result["missingAfterRefresh"] += 1
                    if len(result["missing"]) < 80:
                        result["missing"].append({"tr": tr, "rowId": row.get("id"), "reason": "numero_fiscal_nao_encontrado_no_formulario_zeev", "error": fetch_error})
            except Exception as exc:
                result["errors"].append({"tr": tr, "rowId": row.get("id"), "error": str(exc)[:700]})
        if result["errors"]:
            out["ok"] = False
        out["cycles"].append(result)
        out["totals"]["processed"] += int(result.get("processed") or 0)
        out["totals"]["updatedPending"] += int(result.get("updatedPending") or 0)
        out["totals"]["missingAfterRefresh"] += int(result.get("missingAfterRefresh") or 0)
        out["totals"]["errors"] += len(result.get("errors") or [])
        if result.get("errors"):
            out["ok"] = False
        if ticket_ids:
            break
        if result.get("deadlineReached") or (int(result.get("processed") or 0) == 0) or len(batch) < limit:
            break
    return out


def repair_fiscal_metadata():
    out = {"ok": True, "mode": "repair-fiscal-metadata"}
    out["pending"] = repair_pending_fiscal_metadata()
    try:
        out["payments"] = repair_payment_fiscal_fields()
    except Exception as exc:
        out["ok"] = False
        out["paymentRepairError"] = str(exc)[:700]
    return out


def deep_sync(start, end, max_pages, page_size, notify=False, progressive_ingest=False, start_page=1):
    tickets = {}
    flow_counts = {}
    target_count = 0
    page_size = finished_task_page_size(page_size)
    start_page = max(1, int(start_page or 1))
    end_page = start_page + max_pages - 1
    enrich_workers = max(1, min(8, int(os.environ.get("ZEEV_ENRICH_CONCURRENCY", "1") or "1")))
    for page in range(start_page, end_page + 1):
        rows = report_page_all(page, start, end, page_size=page_size)
        page_tickets = {}
        for row in rows:
            flow = row.get("flow") or {}
            flow_id = int(flow.get("id") or row.get("flowId") or 0)
            flow_name = flow.get("name") or row.get("flowName") or row.get("requestName") or ""
            flow_version = flow.get("version") or row.get("flowVersion") or ""
            key = f"{flow_id}|{flow_name}|v{flow_version}"
            flow_counts[key] = flow_counts.get(key, 0) + 1
        candidates = [row for row in rows if is_target_flow_row(row) or has_capex(row.get("formFields") or [], int((row.get("flow") or {}).get("id") or row.get("flowId") or 0))]
        target_count += len(candidates)
        print(json.dumps({
            "progress": "deep-page",
            "page": page,
            "rows": len(rows),
            "candidateRows": len(candidates),
            "ticketsSoFar": len(tickets),
        }, ensure_ascii=False), flush=True)

        def build_candidate(row):
            enriched = enrich_instance(row)
            flow_id = int((enriched.get("flow") or {}).get("id") or enriched.get("flowId") or 0)
            if not is_target_flow_row(enriched) and not has_capex(enriched.get("formFields") or [], flow_id):
                return None
            ticket = build_ticket(enriched)
            return attach_rescued_docs(ticket, enriched) if ticket else None

        def record_ticket(ticket):
            if not ticket:
                return
            tickets[ticket["zeev_instance_id"]] = ticket
            page_tickets[ticket["zeev_instance_id"]] = ticket
            print(json.dumps({
                "capexFound": ticket["zeev_instance_id"],
                "flowId": ticket.get("flow_id"),
                "flowName": ticket.get("flow_name") or ticket.get("request_name"),
                "flowVersion": ticket.get("flow_version"),
                "setor": ticket.get("setor"),
                "valor": ticket.get("valor_final") or ticket.get("valor"),
            }, ensure_ascii=False), flush=True)

        if enrich_workers == 1 or len(candidates) < 2:
            for row in candidates:
                try:
                    record_ticket(build_candidate(row))
                except Exception as exc:
                    print(json.dumps({"candidateError": row.get("id"), "error": str(exc)[:500]}, ensure_ascii=False), file=sys.stderr)
        else:
            with ThreadPoolExecutor(max_workers=enrich_workers) as executor:
                futures = {executor.submit(build_candidate, row): row for row in candidates}
                for future in as_completed(futures):
                    row = futures[future]
                    try:
                        record_ticket(future.result())
                    except Exception as exc:
                        print(json.dumps({"candidateError": row.get("id"), "error": str(exc)[:500]}, ensure_ascii=False), file=sys.stderr)
        if progressive_ingest and page_tickets:
            page_saved = sorted(page_tickets.values(), key=lambda x: x["zeev_instance_id"], reverse=True)
            result = ingest(page_saved, notify=notify, partial=True)
            print(json.dumps({
                "progress": "deep-page-ingest",
                "page": page,
                "tickets": len(page_saved),
                "ticketIds": [t.get("zeev_instance_id") for t in page_saved],
                "ingest": result,
            }, ensure_ascii=False), flush=True)
        if len(rows) < page_size:
            break
    print(json.dumps({
        "progress": "deep-end",
        "startPage": start_page,
        "endPage": end_page,
        "targetRows": target_count,
        "tickets": len(tickets),
        "flows": [
            {"flow": key, "rows": count}
            for key, count in sorted(flow_counts.items(), key=lambda kv: (-kv[1], kv[0]))
        ],
    }, ensure_ascii=False), flush=True)
    return sorted(tickets.values(), key=lambda x: x["zeev_instance_id"], reverse=True)


def sync_ids(instance_ids, allow_non_capex=False, reason="", rescue_docs=True):
    ids = parse_ticket_ids(instance_ids)
    tickets = {}
    read_timeout = env_int("ZEEV_SYNC_IDS_TIMEOUT_SECONDS", 90, 8, 120)
    read_retries = env_int("ZEEV_SYNC_IDS_RETRIES", 3, 1, 3)

    def load_one(instance_id):
        try:
            base, base_fields = instance_fields(instance_id, [], timeout=read_timeout, retries=read_retries)
            row = base if isinstance(base, dict) and base else {"id": instance_id}
            row.setdefault("id", instance_id)
            row["formFields"] = merge_zeev_fields(row.get("formFields") or [], base_fields)
            row["__allFieldsLoaded"] = True
            enriched = enrich_instance(row)
            ticket = build_ticket(enriched)
            if not ticket and allow_non_capex:
                ticket = generic_ticket_from_instance(enriched, reason=reason)
            if ticket and rescue_docs:
                ticket = attach_rescued_docs(ticket, enriched)
            if ticket and not rescue_docs:
                campos = ticket.get("campos_extraidos") if isinstance(ticket.get("campos_extraidos"), dict) else {}
                campos["_zeev_doc_rescue"] = {"enabled": False, "reason": "force-pending-ticket usa leitura leve; anexos ficam para a varredura propria."}
                ticket["campos_extraidos"] = campos
            return ticket
        except Exception as exc:
            print(json.dumps({"ticketId": instance_id, "error": str(exc)[:500]}, ensure_ascii=False), file=sys.stderr)
        return None

    concurrency = max(1, min(int(os.environ.get("ZEEV_SYNC_IDS_CONCURRENCY", "6") or "6"), 10))
    if concurrency <= 1 or len(ids) <= 1:
        for instance_id in ids:
            ticket = load_one(instance_id)
            if ticket:
                tickets[ticket["zeev_instance_id"]] = ticket
    else:
        with ThreadPoolExecutor(max_workers=min(concurrency, len(ids))) as executor:
            futures = {executor.submit(load_one, instance_id): instance_id for instance_id in ids}
            for future in as_completed(futures):
                ticket = future.result()
                if ticket:
                    tickets[ticket["zeev_instance_id"]] = ticket
    return sorted(tickets.values(), key=lambda x: x["zeev_instance_id"], reverse=True)


def add_document_options(payload):
    extra_fields = os.environ.get("ZEEV_EXTRA_DOCUMENT_FIELDS", "").strip()
    if extra_fields:
        payload["extraDocumentFields"] = extra_fields
    file_template = os.environ.get("ZEEV_FILE_DOWNLOAD_URL_TEMPLATE", "").strip()
    if file_template:
        payload["fileDownloadUrlTemplate"] = file_template
    return payload


def ingest(
    tickets,
    notify=False,
    partial=False,
    backfill_limit=None,
    fanout_targets=None,
    skip_document_backfill=False,
):
    payload = {"mode": "ingest", "tickets": tickets, "notify": notify}
    add_document_options(payload)
    if skip_document_backfill:
        payload["skipDocumentBackfill"] = True
    if fanout_targets is not None:
        payload["fanoutTargets"] = bool(fanout_targets)
    configured_backfill_limit = backfill_limit
    if configured_backfill_limit is None:
        configured_backfill_limit = os.environ.get("ZEEV_INGEST_BACKFILL_LIMIT") or os.environ.get("ZEEV_BACKFILL_LIMIT")
    if configured_backfill_limit is not None and configured_backfill_limit != "" and not partial:
        try:
            payload["backfillLimit"] = max(0, int(configured_backfill_limit))
        except ValueError:
            pass
    if partial:
        payload["partial"] = True
        payload["final"] = False
    return request_json(
        "POST",
        f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
        headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
        payload=payload,
        timeout=120,
    )


def report_sync_error(error):
    if not ZEEV_SYNC_SECRET:
        return None
    payload = {"mode": "sync-error", "error": str(error)[:1500]}
    return request_json(
        "POST",
        f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
        headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
        payload=payload,
        timeout=60,
    )


def backfill_docs():
    total_limit = max(0, int(os.environ.get("ZEEV_BACKFILL_LIMIT", os.environ.get("ZEEV_MAX_PAGES", "30"))))
    base_batch = max(1, min(int(os.environ.get("ZEEV_BACKFILL_BATCH", "1")), 4))
    base_file_limit = max(1, min(int(os.environ.get("ZEEV_BACKFILL_FILE_LIMIT", "12")), 40))
    shared = {
        "mode": "backfill-docs",
        "refresh": os.environ.get("ZEEV_BACKFILL_REFRESH", "true").lower() != "false",
        "staleHours": int(os.environ.get("ZEEV_BACKFILL_STALE_HOURS", "8")),
        "includePending": os.environ.get("ZEEV_BACKFILL_PENDING", "true").lower() != "false",
        "includePayments": os.environ.get("ZEEV_BACKFILL_PAYMENTS", "true").lower() != "false",
        "includeCapex": os.environ.get("ZEEV_BACKFILL_CAPEX", "true").lower() != "false",
    }
    add_doc_rescue_marker(shared)
    add_document_options(shared)
    ticket_ids = os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or ""
    if ticket_ids:
        shared["ticketIds"] = ticket_ids
        base_batch = min(max(total_limit, 1), 4)
    out = {
        "ok": True,
        "mode": "backfill-docs",
        "requestedLimit": total_limit,
        "batchSize": base_batch,
        "fileLimit": base_file_limit,
        "processed": 0,
        "calls": 0,
        "scannedPending": 0,
        "scannedPayments": 0,
        "scannedCapex": 0,
        "updatedPending": 0,
        "updatedPayments": 0,
        "updatedCapex": 0,
        "filesAttached": 0,
        "paidUpdated": 0,
        "obraDoneEmails": [],
        "batches": [],
        "errors": [],
    }
    if total_limit <= 0:
        out["completed"] = True
        return out

    remaining = total_limit
    batch = min(base_batch, remaining)
    file_limit = base_file_limit
    while remaining > 0:
        payload = {**shared, "limit": min(batch, remaining), "fileLimit": file_limit}
        try:
            result = request_json(
                "POST",
                f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
                headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
                payload=payload,
                timeout=240,
                retries=1,
            )
        except Exception as exc:
            msg = str(exc)
            resource_limited = "WORKER_RESOURCE_LIMIT" in msg or "HTTP 546" in msg
            out["errors"].append({
                "batch": payload["limit"],
                "fileLimit": file_limit,
                "recoverable": resource_limited,
                "error": msg[:700],
            })
            if resource_limited and (batch > 1 or file_limit > 1):
                batch = max(1, batch // 2)
                file_limit = max(1, file_limit // 2)
                continue
            if resource_limited:
                out["ok"] = False
                out["partial"] = out["processed"] > 0
                break
            raise

        out["calls"] += 1
        scanned = int(result.get("scannedPending", 0) or 0) + int(result.get("scannedPayments", 0) or 0) + int(result.get("scannedCapex", 0) or 0)
        for key in ("scannedPending", "scannedPayments", "scannedCapex", "updatedPending", "updatedPayments", "updatedCapex", "filesAttached", "paidUpdated"):
            out[key] += int(result.get(key, 0) or 0)
        if result.get("errors"):
            out["errors"].extend(result.get("errors")[:10])
        if result.get("obraDoneEmails"):
            out["obraDoneEmails"].extend(result.get("obraDoneEmails")[:20])
        if result.get("debugDocs"):
            out.setdefault("debugDocs", [])
            out["debugDocs"].extend(result.get("debugDocs")[:12])
            if len(out["debugDocs"]) > 24:
                out["debugDocs"] = out["debugDocs"][:24]
        out["batches"].append({
            "limit": payload["limit"],
            "fileLimit": file_limit,
            "scanned": scanned,
            "updated": int(result.get("updatedPending", 0) or 0) + int(result.get("updatedPayments", 0) or 0) + int(result.get("updatedCapex", 0) or 0),
            "filesAttached": int(result.get("filesAttached", 0) or 0),
            "obraDoneEmails": len(result.get("obraDoneEmails") or []),
        })
        if scanned <= 0:
            out["completed"] = True
            break
        out["processed"] += scanned
        remaining = max(0, remaining - scanned)
        batch = min(base_batch, remaining) if remaining else 0
        file_limit = base_file_limit
        if remaining:
            time.sleep(float(os.environ.get("ZEEV_BACKFILL_PAUSE_SECONDS", "1")))

    if len(out["errors"]) > 25:
        out["errors"] = out["errors"][:25]
    if len(out["obraDoneEmails"]) > 80:
        out["obraDoneEmails"] = out["obraDoneEmails"][:80]
    out["completed"] = out.get("completed", False) or out["processed"] >= total_limit
    return out


def doc_rescue_candidates(limit=None):
    payload = {
        "mode": "doc-rescue-candidates",
        "limit": max(1, min(int(limit or os.environ.get("ZEEV_DOC_RESCUE_LIMIT", os.environ.get("ZEEV_BACKFILL_LIMIT", "24"))), 160)),
        "staleHours": int(os.environ.get("ZEEV_BACKFILL_STALE_HOURS", os.environ.get("ZEEV_DOC_RESCUE_STALE_HOURS", "8"))),
        # The generic audit sample is ordered by TR number and can starve the
        # financial queue with very old IDs. Use the source-aware priority scan.
        "forceEdgeCandidates": True,
        "includePending": os.environ.get("ZEEV_DOC_RESCUE_PENDING", "true").lower() != "false",
        "includePayments": os.environ.get("ZEEV_DOC_RESCUE_PAYMENTS", "true").lower() != "false",
        "includeCapex": os.environ.get("ZEEV_DOC_RESCUE_CAPEX", "true").lower() != "false",
    }
    ticket_ids = os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or ""
    if ticket_ids:
        payload["ticketIds"] = ticket_ids
    add_doc_rescue_marker(payload)
    return request_json(
        "POST",
        f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
        headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
        payload=payload,
        timeout=120,
    )


def doc_rescue_audit():
    payload = {
        "mode": "doc-rescue-audit",
        "staleHours": int(os.environ.get("ZEEV_BACKFILL_STALE_HOURS", os.environ.get("ZEEV_DOC_RESCUE_STALE_HOURS", "8"))),
        "sampleLimit": int(os.environ.get("ZEEV_DOC_RESCUE_AUDIT_SAMPLE", "120")),
    }
    add_doc_rescue_marker(payload)
    return request_json(
        "POST",
        f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
        headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
        payload=payload,
        timeout=240,
    )


def doc_rescue_fast_edge_enabled():
    return os.environ.get("ZEEV_DOC_RESCUE_FAST_EDGE", "1").strip().lower() not in {"0", "false", "nao", "no", "off"}


def backfill_docs_for_ticket_ids(ticket_ids, file_limit=None, timeout=None):
    parsed_ticket_ids = parse_ticket_ids(ticket_ids)
    edge_limit = int(os.environ.get("ZEEV_DOC_RESCUE_EDGE_LIMIT", "6") or "6")
    payload = {
        "mode": "backfill-docs",
        "ticketIds": ",".join(str(x) for x in parsed_ticket_ids),
        "limit": max(1, min(len(parsed_ticket_ids) or 1, edge_limit, 12)),
        "fileLimit": int(file_limit or os.environ.get("ZEEV_DIRECT_DOC_RESCUE_FILE_LIMIT", os.environ.get("ZEEV_BACKFILL_FILE_LIMIT", "12"))),
        "refresh": True,
        # This call already runs inside the GitHub worker in bounded chunks.
        # Prevent the Edge Function from delegating it back to GitHub recursively.
        "forceEdge": True,
        "staleHours": int(os.environ.get("ZEEV_BACKFILL_STALE_HOURS", os.environ.get("ZEEV_DOC_RESCUE_STALE_HOURS", "720"))),
        "includePending": os.environ.get("ZEEV_DOC_RESCUE_PENDING", "true").lower() != "false",
        "includePayments": os.environ.get("ZEEV_DOC_RESCUE_PAYMENTS", "true").lower() != "false",
        "includeCapex": os.environ.get("ZEEV_DOC_RESCUE_CAPEX", "true").lower() != "false",
        "fanoutTargets": True,
    }
    add_doc_rescue_marker(payload)
    add_document_options(payload)
    request_timeout = max(
        30,
        min(
            int(timeout or os.environ.get("ZEEV_DOC_RESCUE_EDGE_TIMEOUT_SECONDS", "120") or "120"),
            240,
        ),
    )
    return request_json(
        "POST",
        f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
        headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
        payload=payload,
        timeout=request_timeout,
        retries=1,
    )


def direct_docs_from_result(result):
    if not isinstance(result, dict):
        return {}
    backfill = result.get("backfill") if isinstance(result.get("backfill"), dict) else result
    if isinstance(backfill, dict) and isinstance(backfill.get("directDocs"), dict):
        return backfill.get("directDocs") or {}
    return backfill if isinstance(backfill, dict) else {}


def merge_direct_doc_results(primary, fallback):
    merged = dict(primary or {})
    fallback = fallback or {}
    for key in ["filesAttached", "checkedWithoutFiscal", "updatedPending", "updatedPayments", "updatedCapex", "paidUpdated"]:
        merged[key] = int(merged.get(key, 0) or 0) + int(fallback.get(key, 0) or 0)
    for key in ["attachedTickets", "checkedWithoutFiscalTickets", "errors", "debugDocs", "obraDoneEmails"]:
        values = []
        if isinstance(merged.get(key), list):
            values.extend(merged.get(key))
        if isinstance(fallback.get(key), list):
            values.extend(fallback.get(key))
        if values:
            merged[key] = values[:120]
    return merged


def merge_doc_backfill_results(edge_result, fallback_result):
    fallback_direct = direct_docs_from_result(fallback_result)
    if not fallback_direct:
        return edge_result
    if not isinstance(edge_result, dict):
        return {"directDocs": fallback_direct}
    merged = dict(edge_result)
    edge_direct = direct_docs_from_result(edge_result)
    merged["directDocs"] = merge_direct_doc_results(edge_direct, fallback_direct)
    if isinstance(fallback_result, dict):
        merged["pythonFallback"] = {
            "ingested": int(fallback_result.get("ingested", 0) or 0),
            "tickets": int(fallback_result.get("tickets", 0) or 0),
        }
    return merged


def doc_rescue_python_fallback_enabled():
    return os.environ.get("ZEEV_DOC_RESCUE_PY_FALLBACK_ENABLED", "1").strip().lower() not in {"0", "false", "nao", "no", "off"}


def rescue_block_report(result):
    if os.environ.get("ZEEV_RESCUE_BLOCK_EMAIL", "true").strip().lower() in {"0", "false", "nao", "no", "off"}:
        return {"ok": True, "skipped": True, "reason": "ZEEV_RESCUE_BLOCK_EMAIL desativado"}
    payload = {
        "mode": "rescue-docs-block-report",
        "result": result,
        "run": {
            "id": os.environ.get("GITHUB_RUN_ID", ""),
            "number": os.environ.get("GITHUB_RUN_NUMBER", ""),
            "attempt": os.environ.get("GITHUB_RUN_ATTEMPT", ""),
            "sha": os.environ.get("GITHUB_SHA", ""),
            "workflow": os.environ.get("GITHUB_WORKFLOW", ""),
        },
        "staleHours": int(os.environ.get("ZEEV_BACKFILL_STALE_HOURS", os.environ.get("ZEEV_DOC_RESCUE_STALE_HOURS", "8"))),
        "recentHours": int(os.environ.get("ZEEV_RESCUE_BLOCK_RECENT_HOURS", "24")),
    }
    add_doc_rescue_marker(payload)
    report_timeout = max(
        20,
        min(int(os.environ.get("ZEEV_RESCUE_BLOCK_EMAIL_TIMEOUT_SECONDS", "60") or "60"), 120),
    )
    return request_json(
        "POST",
        f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
        headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
        payload=payload,
        timeout=report_timeout,
        retries=1,
    )


def rescue_docs(deadline=None):
    requested_ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    if requested_ids:
        candidate_result = {
            "ok": True,
            "explicit": True,
            "ticketIds": requested_ids,
            "sources": [{"id": ticket_id, "source": "manual"} for ticket_id in requested_ids],
        }
        ids = requested_ids
    else:
        candidate_result = doc_rescue_candidates()
        ids = parse_ticket_ids(candidate_result.get("ticketIds", []))
    limit = max(1, min(int(os.environ.get("ZEEV_DOC_RESCUE_BATCH", os.environ.get("ZEEV_BACKFILL_BATCH", "1"))), 8))
    out = {
        "ok": True,
        "mode": "rescue-docs",
        "candidates": len(ids),
        "candidateResult": candidate_result,
        "processed": 0,
        "ingested": 0,
        "downloadedDocs": 0,
        "filesAttached": 0,
        "checkedWithoutFiscal": 0,
        "checkedWithoutFiscalTickets": [],
        "attachedTickets": [],
        "obraDoneEmails": [],
        "batches": [],
        "errors": [],
    }
    for start in range(0, len(ids), limit):
        if deadline and time.time() >= deadline:
            out["timeLimitReached"] = True
            out["partial"] = out["processed"] > 0
            break
        chunk = ids[start:start + limit]
        try:
            if doc_rescue_fast_edge_enabled():
                tickets = []
                downloaded = 0
                edge_timeout = None
                if deadline:
                    remaining = max(0, deadline - time.time())
                    if remaining < 30:
                        out["timeLimitReached"] = True
                        out["partial"] = out["processed"] > 0
                        break
                    edge_timeout = max(30, min(120, int(remaining - 10)))
                edge_backfill = backfill_docs_for_ticket_ids(chunk, timeout=edge_timeout)
                result = {"backfill": edge_backfill}
                edge_direct = direct_docs_from_result(edge_backfill)
                edge_attached = int(edge_direct.get("filesAttached", 0) or 0)
                edge_errors = edge_direct.get("errors") if isinstance(edge_direct.get("errors"), list) else []
                should_fallback = (
                    doc_rescue_python_fallback_enabled()
                    and direct_doc_rescue_enabled()
                    and direct_doc_rescue_file_limit() > 0
                    and edge_attached <= 0
                    and (edge_errors or int(edge_direct.get("checkedWithoutFiscal", 0) or 0) > 0 or not edge_direct)
                    and (not deadline or deadline - time.time() >= 90)
                )
                if should_fallback:
                    tickets = sync_ids(chunk, allow_non_capex=True, reason="Fallback direto para resgate de documentos Zeev")
                    for ticket in tickets:
                        downloaded += len(embedded_downloaded_docs(ticket))
                    if downloaded > 0:
                        fallback_result = ingest(tickets, notify=False, backfill_limit=0, fanout_targets=True)
                        result["backfill"] = merge_doc_backfill_results(edge_backfill, fallback_result)
                        result["pythonFallback"] = {"downloadedDocs": downloaded, "tickets": len(tickets)}
            else:
                tickets = sync_ids(chunk, allow_non_capex=True, reason="Resgate automatico de documentos Zeev")
                downloaded = 0
                for ticket in tickets:
                    downloaded += len(embedded_downloaded_docs(ticket))
                result = ingest(tickets, notify=False, backfill_limit=0, fanout_targets=True)
            attached = 0
            backfill = result.get("backfill") if isinstance(result, dict) else {}
            direct_docs = backfill.get("directDocs") if isinstance(backfill, dict) and isinstance(backfill.get("directDocs"), dict) else backfill
            if isinstance(direct_docs, dict):
                attached = int(direct_docs.get("filesAttached", 0) or 0)
                checked_without_fiscal = int(direct_docs.get("checkedWithoutFiscal", 0) or 0)
                if direct_docs.get("checkedWithoutFiscalTickets"):
                    out["checkedWithoutFiscalTickets"].extend(direct_docs.get("checkedWithoutFiscalTickets")[:80])
                if direct_docs.get("attachedTickets"):
                    out["attachedTickets"].extend(direct_docs.get("attachedTickets")[:80])
                if direct_docs.get("obraDoneEmails"):
                    out["obraDoneEmails"].extend(direct_docs.get("obraDoneEmails")[:20])
            else:
                checked_without_fiscal = 0
            out["processed"] += len(chunk)
            out["ingested"] += len(tickets)
            out["downloadedDocs"] += downloaded
            out["filesAttached"] += attached
            out["checkedWithoutFiscal"] += checked_without_fiscal
            out["batches"].append({
                "ticketIds": chunk,
                "tickets": len(tickets),
                "downloadedDocs": downloaded,
                "filesAttached": attached,
                "checkedWithoutFiscal": checked_without_fiscal,
                "obraDoneEmails": len(direct_docs.get("obraDoneEmails") or []) if isinstance(direct_docs, dict) else 0,
            })
        except Exception as exc:
            msg = str(exc)
            out["errors"].append({"ticketIds": chunk, "error": msg[:700]})
            if "WORKER_RESOURCE_LIMIT" in msg or "HTTP 546" in msg:
                out["ok"] = out["processed"] > 0
                out["partial"] = out["processed"] > 0
                break
            raise
        if not deadline or time.time() < deadline:
            time.sleep(float(os.environ.get("ZEEV_DOC_RESCUE_PAUSE_SECONDS", "1")))
    if len(out["errors"]) > 25:
        out["errors"] = out["errors"][:25]
    if len(out["obraDoneEmails"]) > 80:
        out["obraDoneEmails"] = out["obraDoneEmails"][:80]
    if len(out["checkedWithoutFiscalTickets"]) > 200:
        out["checkedWithoutFiscalTickets"] = out["checkedWithoutFiscalTickets"][:200]
    if len(out["attachedTickets"]) > 200:
        out["attachedTickets"] = out["attachedTickets"][:200]
    out["completed"] = out["processed"] >= len(ids)
    return out


def rescue_docs_loop():
    started = time.time()
    deadline = started + max(60, min(int(os.environ.get("ZEEV_DOC_RESCUE_LOOP_SECONDS", "900")), 1200))
    max_seconds = max(60, min(int(os.environ.get("ZEEV_DOC_RESCUE_LOOP_SECONDS", "900")), 1200))
    max_rounds = max(1, min(int(os.environ.get("ZEEV_DOC_RESCUE_LOOP_ROUNDS", "6")), 20))
    max_transient_retries = max(1, min(int(os.environ.get("ZEEV_DOC_RESCUE_MAX_TRANSIENT_RETRIES", "2")), 6))
    out = {
        "ok": True,
        "mode": "rescue-docs-loop",
        "maxSeconds": max_seconds,
        "rounds": 0,
        "processed": 0,
        "ingested": 0,
        "downloadedDocs": 0,
        "filesAttached": 0,
        "checkedWithoutFiscal": 0,
        "checkedWithoutFiscalTickets": [],
        "attachedTickets": [],
        "obraDoneEmails": [],
        "errors": [],
        "roundResults": [],
    }
    for round_idx in range(max_rounds):
        if time.time() - started > max_seconds:
            out["timeLimitReached"] = True
            break
        try:
            result = rescue_docs(deadline=deadline)
        except Exception as exc:
            msg = str(exc)
            out["errors"].append({"round": round_idx + 1, "transient": is_transient_http_error(msg), "error": msg[:700]})
            if is_transient_http_error(msg) and time.time() - started < max_seconds:
                out.setdefault("transientRetries", 0)
                out["transientRetries"] += 1
                if out["transientRetries"] >= max_transient_retries:
                    out["ok"] = True
                    out["partial"] = out["processed"] > 0
                    out["paused"] = True
                    out["pauseReason"] = "erro_transitorio_supabase_ou_zeev"
                    break
                time.sleep(float(os.environ.get("ZEEV_DOC_RESCUE_TRANSIENT_PAUSE_SECONDS", "45")))
                continue
            out["ok"] = False
            break
        out["rounds"] += 1
        out["processed"] += int(result.get("processed", 0) or 0)
        out["ingested"] += int(result.get("ingested", 0) or 0)
        out["downloadedDocs"] += int(result.get("downloadedDocs", 0) or 0)
        out["filesAttached"] += int(result.get("filesAttached", 0) or 0)
        out["checkedWithoutFiscal"] += int(result.get("checkedWithoutFiscal", 0) or 0)
        if result.get("checkedWithoutFiscalTickets"):
            out["checkedWithoutFiscalTickets"].extend(result.get("checkedWithoutFiscalTickets")[:80])
        if result.get("attachedTickets"):
            out["attachedTickets"].extend(result.get("attachedTickets")[:80])
        if result.get("obraDoneEmails"):
            out["obraDoneEmails"].extend(result.get("obraDoneEmails")[:20])
        if result.get("errors"):
            out["errors"].extend(result.get("errors", [])[:10])
        out["roundResults"].append({
            "round": round_idx + 1,
            "candidates": int(result.get("candidates", 0) or 0),
            "processed": int(result.get("processed", 0) or 0),
            "downloadedDocs": int(result.get("downloadedDocs", 0) or 0),
            "filesAttached": int(result.get("filesAttached", 0) or 0),
            "checkedWithoutFiscal": int(result.get("checkedWithoutFiscal", 0) or 0),
            "obraDoneEmails": len(result.get("obraDoneEmails") or []),
            "completed": bool(result.get("completed")),
        })
        if int(result.get("candidates", 0) or 0) <= 0 or int(result.get("processed", 0) or 0) <= 0:
            out["completed"] = True
            break
        if not result.get("ok", True):
            out["ok"] = False
            break
        if time.time() < deadline:
            time.sleep(float(os.environ.get("ZEEV_DOC_RESCUE_LOOP_PAUSE_SECONDS", "2")))
    if len(out["errors"]) > 30:
        out["errors"] = out["errors"][:30]
    if len(out["obraDoneEmails"]) > 120:
        out["obraDoneEmails"] = out["obraDoneEmails"][:120]
    if len(out["checkedWithoutFiscalTickets"]) > 300:
        out["checkedWithoutFiscalTickets"] = out["checkedWithoutFiscalTickets"][:300]
    if len(out["attachedTickets"]) > 300:
        out["attachedTickets"] = out["attachedTickets"][:300]
    out["elapsedSeconds"] = round(time.time() - started, 1)
    out["completed"] = out.get("completed", False)
    if time.time() >= deadline:
        out["blockEmail"] = {"ok": True, "skipped": True, "reason": "limite_do_ciclo_atingido"}
    else:
        try:
            out["blockEmail"] = rescue_block_report(out)
        except Exception as exc:
            out["blockEmail"] = {"ok": False, "error": str(exc)[:700]}
    return out


def reconcile_registered():
    payload = {"mode": "reconcile-registered"}
    return request_json(
        "POST",
        f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
        headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
        payload=payload,
        timeout=120,
    )


def money_from_mapping_by_priority(mapping, names):
    if not isinstance(mapping, dict):
        return 0.0
    entries = [(norm_key(key), value, str(key or "")) for key, value in mapping.items()]
    for name in names:
        wanted = norm_key(name)
        if not wanted:
            continue
        for key, value, _raw_key in entries:
            if key == wanted:
                amount = parse_money(value)
                if amount:
                    return amount
    for wanted in ("valortotaldopagamento", "valortotalpagamento", "totaldopagamento", "valorpagamento", "valorapagar"):
        for key, value, _raw_key in entries:
            if key == wanted or wanted in key:
                amount = parse_money(value)
                if amount:
                    return amount
    return 0.0


def split_currency(total, parts, index):
    cents = int(round(float(total or 0) * 100))
    parts = max(1, int(parts or 1))
    index = max(1, min(int(index or 1), parts))
    base = cents // parts
    remainder = cents % parts
    value_cents = base + (1 if index <= remainder else 0)
    return round(value_cents / 100, 2)


def stored_capex_registered_value(row):
    data = row.get("ticket_raiz_dados") or {}
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            data = {}
    if not isinstance(data, dict):
        return 0.0, "", None

    campos = data.get("campos") if isinstance(data.get("campos"), dict) else {}
    value = money_from_mapping_by_priority(campos, PAYMENT_TOTAL_FIELDS)
    source = "ticket_raiz_dados.campos.valorTotalDoPagamento" if value else ""

    if not value:
        pagamento = data.get("pagamento") if isinstance(data.get("pagamento"), dict) else {}
        for key in ("valor_total", "valorTotal", "valorTotalPagamento", "valorTotalDoPagamento", "total_pagamento", "totalPagamento", "valor", "valor_pagamento"):
            value = parse_money(pagamento.get(key))
            if value:
                source = f"ticket_raiz_dados.pagamento.{key}"
                break

    if not value:
        itens = data.get("itens") if isinstance(data.get("itens"), list) else []
        value = item_total_sum([item for item in itens if isinstance(item, dict)])
        if value:
            source = "ticket_raiz_dados.itens.valor_total"

    if not value:
        value = money_from_mapping_by_priority(data, PAYMENT_TOTAL_FIELDS)
        if value:
            source = "ticket_raiz_dados.valorTotalDoPagamento"

    if not value:
        return 0.0, "", None

    rateio = data.get("rateio") if isinstance(data.get("rateio"), dict) else {}
    if rateio.get("ativo") is True or str(rateio.get("ativo") or "").strip().lower() in {"1", "true", "sim", "yes", "on"}:
        total_partes = int(parse_money(rateio.get("total_partes") or len(rateio.get("unidades") or []) or 1) or 1)
        if total_partes > 1:
            indice = int(parse_money(rateio.get("indice") or 1) or 1)
            parcela = split_currency(value, total_partes, indice)
            patched_data = dict(data)
            patched_rateio = dict(rateio)
            patched_rateio["total"] = round(float(value), 2)
            patched_rateio["valor"] = parcela
            patched_rateio["total_partes"] = total_partes
            patched_data["rateio"] = patched_rateio
            return parcela, f"{source}.rateio_parcela", patched_data

    return value, source, None


def repair_capex_registered_values():
    ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    limit = env_int("ZEEV_REPAIR_CAPEX_VALUES_LIMIT", 250, 1, 5000)
    force = os.environ.get("ZEEV_REPAIR_CAPEX_VALUES_FORCE", "").strip().lower() in {"1", "true", "sim", "yes", "on"}
    select = "id,referencia,ticket_raiz_instance_id,orcamento,ticket_raiz_dados,origem"
    if ids:
        joined = ",".join(str(x) for x in ids)
        path = f"/capex_itens?select={select}&or=(referencia.in.({joined}),ticket_raiz_instance_id.in.({joined}))&order=id.asc"
        requested = ids
    else:
        path = f"/capex_itens?select={select}&ticket_raiz_instance_id=not.is.null&or=(orcamento.is.null,orcamento.eq.0)&order=id.asc&limit={limit}"
        requested = []
    rows = supabase_rest(path, timeout=120, prefer="")
    if not isinstance(rows, list):
        rows = []

    out = {
        "ok": True,
        "mode": "repair-capex-registered-values",
        "requested": requested,
        "scanned": len(rows),
        "updated": [],
        "skipped": [],
        "errors": [],
    }
    for row in rows:
        if norm(row.get("origem")) == "planejamento historico":
            out["skipped"].append({"id": row.get("id"), "reason": "planejamento_historico_sem_tr"})
            continue
        current = parse_money(row.get("orcamento"))
        tr = row.get("ticket_raiz_instance_id") or row.get("referencia")
        value, source, patched_data = stored_capex_registered_value(row)
        if not value:
            out["skipped"].append({"tr": tr, "reason": "valor_total_nao_encontrado_no_payload_salvo"})
            continue
        if current > 0 and not force and abs(current - float(value)) < 0.005:
            out["skipped"].append({"tr": tr, "reason": "orcamento_ja_correto", "orcamento": current})
            continue
        if current > 0 and not force and "rateio_parcela" not in source:
            out["skipped"].append({"tr": tr, "reason": "orcamento_ja_preenchido", "orcamento": current})
            continue
        payload = {"orcamento": round(float(value), 2)}
        if patched_data is not None:
            payload["ticket_raiz_dados"] = patched_data
        try:
            supabase_rest(
                f"/capex_itens?id=eq.{int(row.get('id'))}",
                method="PATCH",
                payload=payload,
                timeout=90,
            )
            out["updated"].append({"tr": tr, "id": row.get("id"), "orcamento": round(float(value), 2), "source": source})
        except Exception as exc:
            out["ok"] = False
            out["errors"].append({"tr": tr, "id": row.get("id"), "error": str(exc)[:700]})
    for key in ("updated", "skipped", "errors"):
        if len(out[key]) > 120:
            out[key] = out[key][:120]
    return out


def register_obra_payments():
    ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    obra = os.environ.get("ZEEV_TARGET_OBRA") or os.environ.get("ZEEV_OBRA_DESTINO") or ""
    escopo = os.environ.get("ZEEV_TARGET_ESCOPO") or "obra"
    batch_size = max(1, min(int(os.environ.get("ZEEV_REGISTER_BATCH", "3")), 8))
    file_limit = max(0, min(int(os.environ.get("ZEEV_REGISTER_FILE_LIMIT", "0")), 40))
    out = {
        "ok": True,
        "mode": "register-obra-payments",
        "requested": ids,
        "batchSize": batch_size,
        "inserted": [],
        "updated": [],
        "skipped": [],
        "errors": [],
        "docsAttached": 0,
        "paidUpdated": 0,
        "calls": 0,
    }

    def call_chunk(chunk, current_file_limit):
        payload = {
            "mode": "register-obra-payments",
            "ticketIds": ",".join(str(x) for x in chunk),
            "obraName": obra,
            "escopo": escopo,
            "fileLimit": current_file_limit,
        }
        if len(FLOW_IDS) == 1:
            payload["flowId"] = FLOW_IDS[0]
        add_document_options(payload)
        return request_json(
            "POST",
            f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
            headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
            payload=payload,
            timeout=240,
            retries=0,
        )

    def merge_result(result):
        out["calls"] += 1
        for key in ("inserted", "updated", "skipped", "errors"):
            if isinstance(result.get(key), list):
                out[key].extend(result.get(key))
        out["docsAttached"] += int(result.get("docsAttached", 0) or 0)
        out["paidUpdated"] += int(result.get("paidUpdated", 0) or 0)
        if result.get("obra"):
            out["obra"] = result.get("obra")
        if result.get("escopo"):
            out["escopo"] = result.get("escopo")

    def run_chunk(chunk, current_file_limit=None):
        if current_file_limit is None:
            current_file_limit = file_limit
        try:
            merge_result(call_chunk(chunk, current_file_limit))
        except Exception as exc:
            msg = str(exc)
            if ("WORKER_RESOURCE_LIMIT" in msg or "HTTP 546" in msg) and len(chunk) > 1:
                mid = max(1, len(chunk) // 2)
                run_chunk(chunk[:mid], current_file_limit)
                run_chunk(chunk[mid:], current_file_limit)
                return
            if ("WORKER_RESOURCE_LIMIT" in msg or "HTTP 546" in msg) and current_file_limit > 0:
                out["errors"].append({"tr": chunk[0] if chunk else None, "fileLimit": current_file_limit, "recoverable": True, "retrying": True, "error": msg[:700]})
                run_chunk(chunk, max(0, current_file_limit // 2))
                return
            if "WORKER_RESOURCE_LIMIT" in msg or "HTTP 546" in msg:
                out["ok"] = False
                out["errors"].append({"tr": chunk[0] if chunk else None, "fileLimit": current_file_limit, "recoverable": False, "error": msg[:700]})
                return
            raise

    for i in range(0, len(ids), batch_size):
        run_chunk(ids[i:i + batch_size])
        time.sleep(float(os.environ.get("ZEEV_REGISTER_PAUSE_SECONDS", "1")))

    if len(out["errors"]) > 50:
        out["errors"] = out["errors"][:50]
    return out


def register_capex_items():
    ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    unidade = (
        os.environ.get("ZEEV_TARGET_UNIDADE")
        or os.environ.get("ZEEV_TARGET_ESCOLA")
        or os.environ.get("ZEEV_CAPEX_UNIDADE")
        or ""
    )
    ano = os.environ.get("ZEEV_TARGET_ANO") or os.environ.get("ZEEV_CAPEX_ANO") or ""
    batch_size = max(1, min(int(os.environ.get("ZEEV_REGISTER_BATCH", "6")), 10))
    file_limit = max(0, min(int(os.environ.get("ZEEV_REGISTER_FILE_LIMIT", "0")), 40))
    out = {
        "ok": True,
        "mode": "register-capex-items",
        "requested": ids,
        "targetUnidade": unidade,
        "targetAno": ano,
        "batchSize": batch_size,
        "inserted": [],
        "skipped": [],
        "errors": [],
        "docsAttached": 0,
        "calls": 0,
    }

    def call_chunk(chunk, current_file_limit):
        payload = {
            "mode": "register-capex-items",
            "ticketIds": ",".join(str(x) for x in chunk),
            "unidadeName": unidade,
            "ano": ano,
            "fileLimit": current_file_limit,
        }
        add_document_options(payload)
        return request_json(
            "POST",
            f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
            headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
            payload=payload,
            timeout=240,
            retries=0,
        )

    def merge_result(result):
        out["calls"] += 1
        for key in ("inserted", "skipped", "errors"):
            if isinstance(result.get(key), list):
                out[key].extend(result.get(key))
        out["docsAttached"] += int(result.get("docsAttached", 0) or 0)
        if result.get("unidade"):
            out["unidade"] = result.get("unidade")
        if result.get("ano"):
            out["ano"] = result.get("ano")

    def run_chunk(chunk, current_file_limit=None):
        if current_file_limit is None:
            current_file_limit = file_limit
        try:
            merge_result(call_chunk(chunk, current_file_limit))
        except Exception as exc:
            msg = str(exc)
            if ("WORKER_RESOURCE_LIMIT" in msg or "HTTP 546" in msg) and len(chunk) > 1:
                mid = max(1, len(chunk) // 2)
                run_chunk(chunk[:mid], current_file_limit)
                run_chunk(chunk[mid:], current_file_limit)
                return
            if ("WORKER_RESOURCE_LIMIT" in msg or "HTTP 546" in msg) and current_file_limit > 0:
                out["errors"].append({"tr": chunk[0] if chunk else None, "fileLimit": current_file_limit, "recoverable": True, "retrying": True, "error": msg[:700]})
                run_chunk(chunk, max(0, current_file_limit // 2))
                return
            if "WORKER_RESOURCE_LIMIT" in msg or "HTTP 546" in msg:
                out["ok"] = False
                out["errors"].append({"tr": chunk[0] if chunk else None, "fileLimit": current_file_limit, "recoverable": False, "error": msg[:700]})
                return
            raise

    for i in range(0, len(ids), batch_size):
        run_chunk(ids[i:i + batch_size])
        time.sleep(float(os.environ.get("ZEEV_REGISTER_PAUSE_SECONDS", "1")))

    if len(out["errors"]) > 80:
        out["errors"] = out["errors"][:80]
    return out


def force_pending_ticket():
    ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    reason = os.environ.get("ZEEV_FORCE_PENDING_REASON") or "Erro da solicitante: ticket deve ser tratado como CAPEX."
    tickets = sync_ids(ids, allow_non_capex=True, reason=reason, rescue_docs=False)
    print(json.dumps({
        "progress": "force-pending-preview",
        "tickets": [
            {
                "tr": ticket.get("zeev_instance_id"),
                "capexFieldName": ticket.get("capex_field_name") or "",
                "capexFieldValue": ticket.get("capex_field_value") or "",
                "flowId": ticket.get("flow_id"),
                "flowName": ticket.get("flow_name") or "",
                "requester": ticket.get("requester_name") or "",
                "valor": ticket.get("valor") or ticket.get("valor_final"),
                "manualForced": ticket.get("capex_field_name") == "manual_codex",
            }
            for ticket in tickets
        ],
    }, ensure_ascii=False), flush=True)
    fetched = {int(t.get("zeev_instance_id") or 0) for t in tickets if t.get("zeev_instance_id")}
    missing = [ticket_id for ticket_id in ids if ticket_id not in fetched]
    payload = {
        "mode": "force-pending-ticket",
        "ticketIds": ",".join(str(x) for x in ids),
        "reason": reason,
        "tickets": tickets,
        "directZeevRead": True,
        "directReadMissingIds": missing,
        "fileLimit": 0,
    }
    add_document_options(payload)
    return request_json(
        "POST",
        f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
        headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
        payload=payload,
        timeout=240,
        retries=0,
    )


def probe_zeev_ticket():
    ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    if not ids:
        raise SystemExit("probe-zeev-ticket falhou: informe um TR.")
    if not has_zeev_token():
        raise SystemExit("probe-zeev-ticket falhou: ZEEV_TOKEN ausente no cofre do GitHub.")

    started = time.monotonic()
    identity = request_json(
        "GET",
        f"{ZEEV_BASE_URL}/api/2/tokens",
        timeout=15,
        retries=1,
    )
    if not isinstance(identity, dict):
        raise SystemExit("probe-zeev-ticket falhou: identidade Zeev vazia.")

    rows = report_instance(ids[0], fields=[], page_size=1, timeout=20, retries=1)
    row = next((item for item in rows if int(item.get("id") or item.get("instanceId") or 0) == ids[0]), rows[0] if rows else {})
    if not row:
        raise SystemExit(f"probe-zeev-ticket falhou: TR {ids[0]} nao retornou dados.")
    return {
        "ok": True,
        "mode": "probe-zeev-ticket",
        "probe": "github-direct",
        "ticketId": ids[0],
        "active": row.get("active"),
        "flowResult": row.get("flowResult") or "",
        "flowId": int((row.get("flow") or {}).get("id") or row.get("flowId") or 0),
        "elapsedMs": int((time.monotonic() - started) * 1000),
    }


def require_ok(result, context):
    if isinstance(result, dict) and result.get("ok") is False:
        detail = result.get("error") or result.get("reason") or "resultado ok=false"
        raise SystemExit(f"{context} falhou: {detail}")
    return result


def refresh_payment_statuses():
    ticket_ids = os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or ""
    target_ids = parse_ticket_ids(ticket_ids)
    total_limit = max(1, int(os.environ.get("ZEEV_STATUS_REFRESH_LIMIT", os.environ.get("ZEEV_BACKFILL_LIMIT", "40"))))
    if target_ids:
        total_limit = len(target_ids)
    base_batch = max(1, min(int(os.environ.get("ZEEV_STATUS_REFRESH_BATCH", os.environ.get("ZEEV_BACKFILL_BATCH", "6"))), 12))
    stale_hours = int(os.environ.get("ZEEV_STATUS_REFRESH_STALE_HOURS", os.environ.get("ZEEV_BACKFILL_STALE_HOURS", "8")))
    only_overdue = os.environ.get("ZEEV_STATUS_ONLY_OVERDUE", "true").lower() != "false"
    out = {
        "ok": True,
        "mode": "refresh-payment-statuses",
        "zeevRead": "github-direct",
        "requestedLimit": total_limit,
        "batchSize": base_batch,
        "processed": 0,
        "calls": 0,
        "scannedPayments": 0,
        "updatedPaid": 0,
        "updatedDueDate": 0,
        "filesAttached": 0,
        "updated": [],
        "unchanged": [],
        "errors": [],
    }
    if not target_ids:
        discovery = request_json(
            "POST",
            f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
            headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
            payload={
                "mode": "refresh-payment-statuses",
                "discoveryOnly": True,
                "limit": total_limit,
                "staleHours": stale_hours,
                "onlyOverdue": only_overdue,
            },
            timeout=60,
            retries=1,
        )
        target_ids = parse_ticket_ids((discovery or {}).get("ticketIds") or [])
        out["discovered"] = len(target_ids)

    for current_target_chunk in chunked(target_ids[:total_limit], base_batch):
        current_ticket_ids = ",".join(str(x) for x in current_target_chunk)
        try:
            tickets = sync_ids(current_target_chunk)
            found_ids = {int(ticket.get("zeev_instance_id") or 0) for ticket in tickets}
            for missing_id in current_target_chunk:
                if missing_id not in found_ids:
                    out["errors"].append({"tr": missing_id, "error": "TR nao retornado pela API Zeev no GitHub Runner."})
            result = request_json(
                "POST",
                f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
                headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
                payload={
                    "mode": "refresh-payment-statuses",
                    "ticketIds": current_ticket_ids,
                    "tickets": tickets,
                    "limit": len(current_target_chunk),
                    "staleHours": stale_hours,
                    "onlyOverdue": False,
                    "skipDocuments": True,
                },
                timeout=120,
                retries=1,
            )
        except Exception as exc:
            out["errors"].append({"ticketIds": current_target_chunk, "error": str(exc)[:700]})
            continue

        out["calls"] += 1
        scanned = int(result.get("scannedPayments", 0) or 0)
        out["scannedPayments"] += scanned
        out["processed"] += len(tickets)
        for key in ("updatedPaid", "updatedDueDate", "filesAttached"):
            out[key] += int(result.get(key, 0) or 0)
        for key in ("updated", "unchanged", "errors"):
            if isinstance(result.get(key), list):
                out[key].extend(result.get(key))
        time.sleep(float(os.environ.get("ZEEV_STATUS_REFRESH_PAUSE_SECONDS", "1")))

    for key in ("updated", "unchanged", "errors"):
        if len(out[key]) > 80:
            out[key] = out[key][:80]
    out["completed"] = out["processed"] >= len(target_ids)
    out["ok"] = not out["errors"]
    return out


def finance_description_needs_repair(row, force=False):
    if force:
        return True
    campos = row.get("campos_extraidos") if isinstance(row.get("campos_extraidos"), dict) else {}
    description = clean_summary_text(row.get("pedido") or "")
    return (
        not description
        or str(campos.get("_descricao_status") or "") != "completa"
        or str(campos.get("_descricao_regra") or "") != "informacoes_referentes_solicitacao_v5"
    )


def patch_registered_finance_description(ticket_id, description):
    if not description:
        return {"capex": 0, "payments": 0}
    capex_rows = supabase_rest(
        f"/capex_itens?or=(ticket_raiz_instance_id.eq.{int(ticket_id)},referencia.eq.{int(ticket_id)})",
        method="PATCH",
        payload={"pedido": description},
        timeout=90,
        prefer="return=representation",
    )
    payment_rows = supabase_rest(
        f"/pagamentos?ticket_raiz=eq.{int(ticket_id)}",
        method="PATCH",
        payload={"ref": description},
        timeout=90,
        prefer="return=representation",
    )
    return {
        "capex": len(capex_rows) if isinstance(capex_rows, list) else 0,
        "payments": len(payment_rows) if isinstance(payment_rows, list) else 0,
    }


def repair_finance_description_row(row):
    ticket_id = row_ticket_id(row)
    description_fields = finance_request_description_fields(int(row.get("flow_id") or 0))
    persisted_fields = []
    if isinstance(row.get("raw_fields"), list):
        persisted_fields = merge_zeev_fields(persisted_fields, row.get("raw_fields"))
    raw_instance = row.get("raw_instance") if isinstance(row.get("raw_instance"), dict) else {}
    if isinstance(raw_instance.get("formFields"), list):
        persisted_fields = merge_zeev_fields(persisted_fields, raw_instance.get("formFields"))
    lookup_fields = row_stored_fields(row)
    description, source = field_value_with_source_by_priority(lookup_fields, description_fields)
    errors = []
    report_link = str(row.get("ticket_link") or raw_instance.get("reportLink") or raw_instance.get("reportUrl") or "").strip()

    if not description and report_link:
        try:
            report_fields, _ = fetch_report_link_fields(report_link)
            persisted_fields = merge_zeev_fields(persisted_fields, report_fields)
            lookup_fields = merge_zeev_fields(lookup_fields, report_fields)
            description, source = field_value_with_source_by_priority(lookup_fields, description_fields)
        except Exception as exc:
            errors.append(f"reportLink: {str(exc)[:260]}")

    if not description:
        try:
            rows = report_instance(
                ticket_id,
                int(row.get("flow_id") or 0),
                fields=description_fields,
                timeout=35,
                retries=1,
            )
            target = next(
                (item for item in rows if int(item.get("id") or item.get("instanceId") or 0) == ticket_id),
                rows[0] if rows else {},
            )
            report_fields = target.get("formFields") or []
            persisted_fields = merge_zeev_fields(persisted_fields, report_fields)
            lookup_fields = merge_zeev_fields(lookup_fields, report_fields)
            description, source = field_value_with_source_by_priority(lookup_fields, description_fields)
            report_link = str(target.get("reportLink") or target.get("reportUrl") or report_link).strip()
        except Exception as exc:
            errors.append(f"instances/report: {str(exc)[:260]}")

    if not description and report_link:
        try:
            report_fields, _ = fetch_report_link_fields(report_link)
            persisted_fields = merge_zeev_fields(persisted_fields, report_fields)
            lookup_fields = merge_zeev_fields(lookup_fields, report_fields)
            description, source = field_value_with_source_by_priority(lookup_fields, description_fields)
        except Exception as exc:
            errors.append(f"reportLink apos report: {str(exc)[:260]}")

    campos = dict(row.get("campos_extraidos") or {}) if isinstance(row.get("campos_extraidos"), dict) else {}
    campos["_descricao_regra"] = "informacoes_referentes_solicitacao_v5"
    campos["_descricao_revisada_em"] = datetime.now(timezone.utc).isoformat()
    campos["_descricao_status"] = "completa" if description else "nao_encontrada"
    campos["_descricao_origem"] = source or ""
    if description:
        campos.pop("_descricao_alerta", None)
    else:
        campos["_descricao_alerta"] = "O campo Informacoes referentes a solicitacao nao foi retornado pelo Zeev."

    row_id = urllib.parse.quote(str(row.get("id") or ""), safe="")
    if not row_id:
        raise RuntimeError(f"TR {ticket_id} sem id interno para atualizar.")
    updated = supabase_rest(
        f"/capex_zeev_solicitacoes?id=eq.{row_id}",
        method="PATCH",
        payload={
            "pedido": description or None,
            "raw_fields": persisted_fields,
            "campos_extraidos": campos,
        },
        timeout=90,
        prefer="return=representation",
    )
    patched = patch_registered_finance_description(ticket_id, description) if description else {"capex": 0, "payments": 0}
    return {
        "tr": ticket_id,
        "description": description,
        "source": source,
        "descriptionFields": description_fields[:20],
        "rowPatched": len(updated) if isinstance(updated, list) else 0,
        "registeredPatched": int(patched.get("capex") or 0),
        "paymentRefsPatched": int(patched.get("payments") or 0),
        "errors": errors,
    }


def repair_finance_descriptions():
    limit = max(1, min(int(os.environ.get("ZEEV_FINANCE_DESCRIPTION_REPAIR_LIMIT", os.environ.get("ZEEV_BACKFILL_LIMIT", "40")) or "40"), 160))
    cycles = max(1, min(int(os.environ.get("ZEEV_FINANCE_DESCRIPTION_REPAIR_CYCLES", "1") or "1"), 12))
    force = os.environ.get("ZEEV_FINANCE_DESCRIPTION_REPAIR_FORCE", "false").lower() == "true"
    target_ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    target_set = set(target_ids)
    pending_only = os.environ.get("ZEEV_FINANCE_DESCRIPTION_REPAIR_PENDING_ONLY", "false").lower() == "true"
    missing_only = os.environ.get("ZEEV_FINANCE_DESCRIPTION_REPAIR_MISSING_ONLY", "false").lower() == "true"
    select = ",".join([
        "id", "zeev_instance_id", "flow_id", "flow_name", "request_name", "status", "pedido",
        "start_date_time", "ticket_link", "descricao_confiavel", "campos_extraidos", "raw_fields", "raw_tasks", "raw_instance",
    ])
    filters = [f"select={select}"]
    if pending_only:
        filters.append("status=eq.pendente")
    if missing_only:
        filters.append("setor=eq.FINANCEIRO")
        filters.append("descricao_confiavel=eq.false")
    if target_ids:
        filters.append(f"zeev_instance_id=in.({','.join(map(str, target_ids))})")
    filters.append("order=start_date_time.desc.nullslast,id.desc")
    rows = supabase_rest_all(
        "/capex_zeev_solicitacoes?" + "&".join(filters),
        page_size=1000,
        timeout=90,
    )
    candidates = [
        row for row in rows
        if row_ticket_id(row)
        and (not target_set or row_ticket_id(row) in target_set)
        and is_finance_row(row)
        and finance_description_needs_repair(row, force=force)
    ]
    out = {
        "ok": True,
        "mode": "repair-finance-descriptions",
        "descriptionRule": "informacoes_referentes_solicitacao_v5",
        "missingOnly": missing_only,
        "scannedRows": len(rows),
        "financeCandidatesTotal": len(candidates),
        "processed": 0,
        "descriptionsFound": 0,
        "descriptionsMissing": 0,
        "registeredPatched": 0,
        "paymentRefsPatched": 0,
        "tickets": [],
        "missing": [],
        "errors": [],
    }
    for cycle in range(cycles):
        batch = candidates[cycle * limit:(cycle + 1) * limit]
        if not batch:
            break
        concurrency = max(1, min(int(os.environ.get("ZEEV_FINANCE_DESCRIPTION_REPAIR_CONCURRENCY", "5") or "5"), 8, len(batch)))
        results = []
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = {executor.submit(repair_finance_description_row, row): row for row in batch}
            for future in as_completed(futures):
                row = futures[future]
                tr = row_ticket_id(row)
                try:
                    results.append(future.result())
                except Exception as exc:
                    out["ok"] = False
                    out["errors"].append({"tr": tr, "error": str(exc)[:700]})
                    results.append({"tr": tr, "description": "", "registeredPatched": 0, "paymentRefsPatched": 0})
        for result in sorted(results, key=lambda item: int(item.get("tr") or 0), reverse=True):
            tr = int(result.get("tr") or 0)
            out["processed"] += 1
            description = str(result.get("description") or "").strip()
            if not description:
                out["descriptionsMissing"] += 1
                if len(out["missing"]) < 120:
                    out["missing"].append({
                        "tr": tr,
                        "reason": "campo_informacoes_referentes_solicitacao_vazio",
                        "descriptionFields": result.get("descriptionFields") or [],
                        "probes": result.get("errors") or [],
                    })
                continue
            out["descriptionsFound"] += 1
            out["registeredPatched"] += int(result.get("registeredPatched") or 0)
            out["paymentRefsPatched"] += int(result.get("paymentRefsPatched") or 0)
            if len(out["tickets"]) < 160:
                out["tickets"].append({"tr": tr, "description": description, "source": result.get("source") or ""})
    return out


def default_window():
    now = datetime.now(business_tz())
    start = now - timedelta(hours=float(os.environ.get("ZEEV_SYNC_OVERLAP_HOURS", "72")))
    return start.isoformat(timespec="seconds"), (now + timedelta(minutes=5)).isoformat(timespec="seconds")


def main():
    mode = os.environ.get("ZEEV_SYNC_MODE", "incremental")
    incremental_started = time.monotonic()
    incremental_budget_seconds = env_int("ZEEV_INCREMENTAL_MAX_RUNTIME_SECONDS", 1500, 300, 3300)
    incremental_skipped_stages = []

    def incremental_remaining_seconds():
        return max(0, incremental_budget_seconds - int(time.monotonic() - incremental_started))

    def incremental_stage_allowed(stage, minimum_remaining):
        if mode != "incremental":
            return True
        remaining = incremental_remaining_seconds()
        if remaining >= minimum_remaining:
            return True
        incremental_skipped_stages.append({"stage": stage, "remainingSeconds": remaining, "minimumSeconds": minimum_remaining})
        print(json.dumps({
            "progress": "incremental-stage-deferred",
            "stage": stage,
            "remainingSeconds": remaining,
            "minimumSeconds": minimum_remaining,
        }, ensure_ascii=False), flush=True)
        return False
    if not ZEEV_SYNC_SECRET:
        raise SystemExit("ZEEV_SYNC_SECRET e obrigatorio.")
    health_skip = maybe_skip_for_supabase_health(mode)
    if health_skip:
        print(json.dumps(health_skip, ensure_ascii=False))
        return
    if mode in {"reconcile-registered", "reconcile", "dedupe-registered"}:
        result = reconcile_registered()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"repair-capex-registered-values", "repair-capex-values", "repair-registered-values"}:
        result = repair_capex_registered_values()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"register-obra-payments", "register-obra", "obra-payments"}:
        result = register_obra_payments()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"register-capex-items", "register-capex", "capex-items"}:
        result = register_capex_items()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"force-pending-ticket", "force-pending", "pending-ticket"}:
        result = force_pending_ticket()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"probe-zeev-ticket", "probe-zeev", "probe-ticket"}:
        result = require_ok(probe_zeev_ticket(), "probe-zeev-ticket")
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"refresh-payment-statuses", "refresh-payments", "payment-statuses"}:
        result = require_ok(refresh_payment_statuses(), "refresh-payment-statuses")
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"doc-rescue-audit", "rescue-docs-audit", "audit-docs", "auditar-docs"}:
        result = doc_rescue_audit()
        print(json.dumps(result, ensure_ascii=False))
        return
    if not has_zeev_token():
        raise SystemExit("ZEEV_TOKEN e obrigatorio.")
    if mode in {"id-sweep", "capex-id-sweep", "sweep-ids", "varrer-ids"}:
        result = id_sweep_capex()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"correction-sweep", "capex-correction-sweep", "sweep-corrections", "varrer-correcoes"}:
        result = correction_sweep_capex()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"rescue-docs-loop", "doc-rescue-loop", "resgate-docs-loop"}:
        result = rescue_docs_loop()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"rescue-docs", "doc-rescue", "direct-doc-rescue", "resgate-docs"}:
        result = rescue_docs()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"backfill-docs", "docs-backfill", "backfill"}:
        result = backfill_docs()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"read-test", "test-read", "teste-leitura"}:
        result = read_test()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"inspect-docs", "doc-inspect", "inspect-documentos"}:
        result = inspect_docs()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"extract-fiscal-numbers", "fiscal-numbers", "numeros-fiscais"}:
        result = extract_fiscal_numbers()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"repair-pending-fiscal-metadata", "repair-pending-fiscal", "repair-pending-fiscal-fields"}:
        result = repair_pending_fiscal_metadata()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"repair-finance-descriptions", "repair-pending-descriptions", "repair-descriptions"}:
        result = repair_finance_descriptions()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"repair-fiscal-metadata", "repair-all-fiscal-metadata", "repair-fiscal"}:
        result = repair_fiscal_metadata()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"repair-payment-fiscal-fields", "repair-payment-fiscal", "repair-fiscal-fields"}:
        result = repair_payment_fiscal_fields()
        print(json.dumps(result, ensure_ascii=False))
        return
    deep_mode = mode in {"deep", "deep-retro", "deep-incremental"} or os.environ.get("ZEEV_DEEP_SCAN", "0") == "1"
    if mode in {"retro", "deep", "deep-retro"}:
        start = os.environ.get("ZEEV_SYNC_START", "2026-04-01T00:00:00-03:00")
        end = os.environ.get("ZEEV_SYNC_END", "2026-07-01T23:59:59-03:00")
    else:
        start, end = default_window()
    max_pages = int(os.environ.get("ZEEV_MAX_PAGES", "16" if mode not in {"retro", "deep", "deep-retro"} else "999"))
    page_size = int(os.environ.get("ZEEV_RECORDS_PER_PAGE", "30"))
    notify = os.environ.get("ZEEV_NOTIFY", "false").lower() == "true"
    ticket_ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS", ""))
    extra_ticket_ids = parse_ticket_ids(os.environ.get("ZEEV_EXTRA_TICKET_IDS", ""))
    id_sweep_result = None
    correction_sweep_result = None
    last_task_scan_result = None
    auto_extra_ticket_limit = 0
    if mode == "incremental" and not deep_mode:
        max_pages = min(max_pages, int(os.environ.get("ZEEV_INCREMENTAL_MAX_PAGES_CAP", "2") or "2"))
        extra_limit = max(0, int(os.environ.get("ZEEV_INCREMENTAL_EXTRA_TICKET_CAP", "5") or "5"))
        if extra_limit and not extra_ticket_ids:
            auto_extra_ticket_limit = extra_limit
        if extra_limit and len(extra_ticket_ids) > extra_limit:
            print(json.dumps({
                "progress": "extra-ticket-cap",
                "requested": len(extra_ticket_ids),
                "used": extra_limit,
            }, ensure_ascii=False))
            extra_ticket_ids = extra_ticket_ids[:extra_limit]
    if ticket_ids:
        tickets = sync_ids(
            ticket_ids,
            allow_non_capex=True,
            reason="TR estruturado ja registrado como CAPEX na plataforma.",
            rescue_docs=False,
        )
    else:
        if deep_mode:
            progressive_ingest = os.environ.get("ZEEV_PROGRESSIVE_INGEST", "1") != "0"
            start_page = int(os.environ.get("ZEEV_START_PAGE", "1") or "1")
            merged = {t["zeev_instance_id"]: t for t in deep_sync(start, end, max_pages=max_pages, page_size=page_size, notify=notify, progressive_ingest=progressive_ingest, start_page=start_page)}
        else:
            merged = {t["zeev_instance_id"]: t for t in sync(start, end, FLOW_IDS, max_pages=max_pages, page_size=page_size)}
        if (extra_ticket_ids or auto_extra_ticket_limit) and incremental_stage_allowed("known-ticket-refresh", 420):
            if auto_extra_ticket_limit:
                extra_ticket_ids = known_ticket_refresh_ids(auto_extra_ticket_limit)
            for ticket in sync_ids(
                extra_ticket_ids,
                allow_non_capex=True,
                reason="TR estruturado ja registrado como CAPEX na plataforma.",
                rescue_docs=False,
            ):
                merged[ticket["zeev_instance_id"]] = ticket
        if mode == "incremental" and not deep_mode:
            last_task_pages = env_int("ZEEV_INCREMENTAL_LAST_TASK_MAX_PAGES", 0, 0, 20)
            if last_task_pages and incremental_stage_allowed("last-task-scan", 600):
                now = datetime.now(business_tz())
                lookback_hours = env_int("ZEEV_INCREMENTAL_LAST_TASK_LOOKBACK_HOURS", 36, 1, 720)
                last_task_start = (now - timedelta(hours=lookback_hours)).isoformat(timespec="seconds")
                last_task_end = now.isoformat(timespec="seconds")
                last_task_scan = sync_last_task_updates(last_task_start, last_task_end, FLOW_IDS, max_pages=last_task_pages, page_size=page_size)
                for ticket in last_task_scan.get("tickets", []):
                    merged[ticket["zeev_instance_id"]] = ticket
                last_task_scan_result = {
                    "start": last_task_scan.get("start"),
                    "end": last_task_scan.get("end"),
                    "pages": last_task_scan.get("pages"),
                    "tickets": len(last_task_scan.get("tickets") or []),
                    "ticketIds": [t.get("zeev_instance_id") for t in (last_task_scan.get("tickets") or [])[:30]],
                    "errors": last_task_scan.get("errors") or [],
                }
            correction_limit = env_int("ZEEV_INCREMENTAL_CORRECTION_SWEEP_LIMIT", 0, 0, 500)
            if correction_limit and incremental_stage_allowed("correction-sweep", 360):
                correction_sweep_result = collect_correction_sweep_tickets(limit=correction_limit, update_state=True)
                for ticket in correction_sweep_result.get("tickets", []):
                    merged[ticket["zeev_instance_id"]] = ticket
                correction_sweep_result = {k: v for k, v in correction_sweep_result.items() if k != "tickets"}
            sweep_limit = env_int("ZEEV_INCREMENTAL_ID_SWEEP_LIMIT", 0, 0, 500)
            if sweep_limit and incremental_stage_allowed("id-sweep", 360):
                id_sweep_result = collect_id_sweep_tickets(limit=sweep_limit, update_state=True)
                for ticket in id_sweep_result.get("tickets", []):
                    merged[ticket["zeev_instance_id"]] = ticket
                id_sweep_result = {k: v for k, v in id_sweep_result.items() if k != "tickets"}
        tickets = sorted(merged.values(), key=lambda x: x["zeev_instance_id"], reverse=True)
    # Data/status scans must stay lightweight. Document discovery and downloads
    # run only in the dedicated rescue modes on the authenticated GitHub runner.
    result = ingest(tickets, notify=notify, backfill_limit=0, skip_document_backfill=True)
    description_repair = None
    auto_description_repair_limit = env_int("ZEEV_AUTO_DESCRIPTION_REPAIR_LIMIT", 0, 0, 20)
    if mode == "incremental" and auto_description_repair_limit and incremental_stage_allowed("finance-description-repair", 150):
        previous_env = {
            name: os.environ.get(name)
            for name in (
                "ZEEV_FINANCE_DESCRIPTION_REPAIR_LIMIT",
                "ZEEV_FINANCE_DESCRIPTION_REPAIR_CYCLES",
                "ZEEV_FINANCE_DESCRIPTION_REPAIR_PENDING_ONLY",
                "ZEEV_FINANCE_DESCRIPTION_REPAIR_MISSING_ONLY",
                "ZEEV_FINANCE_DESCRIPTION_REPAIR_CONCURRENCY",
            )
        }
        try:
            os.environ["ZEEV_FINANCE_DESCRIPTION_REPAIR_LIMIT"] = str(auto_description_repair_limit)
            os.environ["ZEEV_FINANCE_DESCRIPTION_REPAIR_CYCLES"] = "1"
            os.environ["ZEEV_FINANCE_DESCRIPTION_REPAIR_PENDING_ONLY"] = "true"
            os.environ["ZEEV_FINANCE_DESCRIPTION_REPAIR_MISSING_ONLY"] = "true"
            os.environ["ZEEV_FINANCE_DESCRIPTION_REPAIR_CONCURRENCY"] = "2"
            description_repair = repair_finance_descriptions()
        except Exception as exc:
            description_repair = {"ok": False, "mode": "repair-finance-descriptions", "error": str(exc)[:700]}
        finally:
            for name, value in previous_env.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value
    value_repair = None
    repair_values_enabled = os.environ.get("ZEEV_REPAIR_CAPEX_VALUES_AFTER_INGEST", "1").strip().lower() not in {"0", "false", "nao", "não", "no"}
    if repair_values_enabled and incremental_stage_allowed("capex-value-repair", 180):
        try:
            os.environ.setdefault("ZEEV_REPAIR_CAPEX_VALUES_LIMIT", "80")
            value_repair = repair_capex_registered_values()
        except Exception as exc:
            value_repair = {"ok": False, "mode": "repair-capex-registered-values", "error": str(exc)[:700]}
    print(json.dumps({"mode": "ticketIds" if ticket_ids else mode, "deep": deep_mode, "start": start, "end": end, "tickets": len(tickets), "ticketIds": [t.get("zeev_instance_id") for t in tickets], "lastTaskScan": last_task_scan_result, "idSweep": id_sweep_result, "correctionSweep": correction_sweep_result, "ingest": result, "financeDescriptionRepair": description_repair, "capexValueRepair": value_repair, "runtimeSeconds": round(time.monotonic() - incremental_started, 2), "runtimeBudgetSeconds": incremental_budget_seconds if mode == "incremental" else None, "deferredStages": incremental_skipped_stages}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        mode = os.environ.get("ZEEV_SYNC_MODE", "incremental")
        if allow_transient_success() and supabase_automation_mode(mode) and is_transient_http_error(str(exc)):
            print(json.dumps({
                "ok": True,
                "mode": mode,
                "skipped": True,
                "reason": "erro_transitorio_sem_reportar_falha",
                "error": str(exc)[:700],
            }, ensure_ascii=False))
            sys.exit(0)
        try:
            report_sync_error(exc)
        except Exception as report_exc:
            print(json.dumps({"syncError": str(exc)[:500], "reportError": str(report_exc)[:500]}, ensure_ascii=False), file=sys.stderr)
        raise
