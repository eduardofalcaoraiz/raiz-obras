import json
import html as html_lib
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
ZEEV_TOKEN = os.environ.get("ZEEV_TOKEN", "")
ZEEV_SYNC_SECRET = os.environ.get("ZEEV_SYNC_SECRET", "")


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


FLOW_IDS = parse_flow_ids_env(os.environ.get("ZEEV_FLOW_IDS", "299,275,102,300"))
FINANCE_FLOW_IDS = {299, 275}
PURCHASE_FLOW_IDS = {102, 300}
BUSINESS_TIMEZONE = os.environ.get("ZEEV_BUSINESS_TIMEZONE", "America/Sao_Paulo")


def business_tz():
    try:
        return ZoneInfo(BUSINESS_TIMEZONE)
    except Exception:
        if BUSINESS_TIMEZONE == "America/Sao_Paulo":
            return timezone(timedelta(hours=-3), BUSINESS_TIMEZONE)
        return timezone.utc

FINANCE_DESCRIPTION_FIELDS = [
    "informacoesReferentesASolicitacao",
    "informacoesReferentesSolicitacao",
    "informacoesReferenteASolicitacao",
    "informacaoReferenteASolicitacao",
    "informacaoReferenteSolicitacao",
    "informacoesDaSolicitacao",
    "informacoesSolicitacao",
    "informacaoSolicitacao",
    "informacoes",
    "informacao",
    "Informacoes referentes a solicitacao",
    "Informacao referente a solicitacao",
]

PURCHASE_SERVICE_DESCRIPTION_FIELDS = [
    "descricaoMensagemZeev",
    "descricaoDoServico",
    "descricaoServico",
    "descricaoServicoSolicitado",
    "descricaoServicoCompra",
    "descricao do servico",
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
]

DEFAULT_CAPEX_FIELDS = {
    299: ["investimentoCAPEX", "É um investimento (CAPEX)?", "E um investimento (CAPEX)?", "CAPEX"],
    275: ["investimentoCAPEX", "É um investimento (CAPEX)?", "E um investimento (CAPEX)?", "CAPEX"],
    102: ["cAPEX", "CAPEX", "Investimento CAPEX"],
    300: ["cAPEX", "CAPEX", "Investimento CAPEX"],
}

CAPEX_FIELD_CANDIDATES = [
    "investimentoCAPEX", "cAPEX", "CAPEX", "Capex", "capex",
    "Investimento CAPEX", "Investimento Capex",
    "É um investimento (CAPEX)?", "E um investimento (CAPEX)?",
    "É um investimento CAPEX?", "E um investimento CAPEX?",
    "É CAPEX?", "E CAPEX?", "É investimento?", "E investimento?",
]

VALUE_TOTAL_FIELDS = [
    "valorTotalDoPagamento", "valor total do pagamento", "Valor total do pagamento",
    "valorTotalPagamento", "valor total pagamento",
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
    "valorBruto", "valor bruto", "valorLiquido", "valor liquido",
    "totalPagamento", "total do pagamento", "totalAPagar", "total a pagar",
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

DOCUMENT_FIELDS = [
    "anexo", "anexos", "arquivo", "arquivos", "Arquivo", "Arquivos",
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
    "valorTotalDoPagamento", "valorTotalPagamento", "valor", "valorTotal", "valorFinal", "valorCompra", "valorDaCompra", "valorSolicitado",
    "valorPedido", "valorAprovado", "valorOrcado", "valorEstimado", "orcamento", "preco",
    "precoUnitario", "precoTotal", "precoFinal", "valorUnitario", "valorTotalItem",
    "fornecedor", "nomeFornecedor", "razaoSocial", "cnpjFornecedor", "fornecedorEscolhido",
    "condicaoPagamento", "formaPagamento", "formaDePagamento", "dataPagamento", "previsaoPagamento",
    "dataEntrega", "prazoEntrega", "unidade", "unidadeEscolar", "escola", "filial", "marca",
    "localEntrega", "solicitante", "setor", "departamento", "categoria", "categoriaCompra",
    "tipoCompra", "numeroTR", "ticket", "tr", "notaFiscal", "numeroNF", "numeroNotaFiscal",
    "valorNotaFiscal", "chaveAcesso", *DOCUMENT_FIELDS,
    *PURCHASE_SERVICE_DESCRIPTION_FIELDS, *PURCHASE_ITEM_DESCRIPTION_FIELDS,
]

FINANCE_FIELDS = [
    "investimentoCAPEX", "valorTotalDoPagamento", "valorTotalPagamento", "valor", "valorTotal", "valorSolicitado", "valorPagamento",
    "valorAPagar", "valorAprovado", "precoUnitario", "dataPagamento", "previsaoPagamento", "dataVencimento", "dataDeVencimento",
    "formaPagamento", "formaDePagamento", "condicaoPagamento", "favorecido", "beneficiario", "fornecedor",
    "nomeFornecedor", "razaoSocial", "cnpj", "cnpjFornecedor", "centroDeCusto", "centroCusto",
    "unidade", "unidadeEscolar", "escola", "filial", "marca", "descricao",
    "descricaoSolicitacao", "solicitacao", "pedido", "objeto", "resumo", "justificativa",
    "observacao", "observacoes", "categoria", "categoriaFinanceira", "setor", "departamento",
    "numeroTR", "ticket", "tr", "notaFiscal", "numeroNF", "numeroNotaFiscal",
    "valorNotaFiscal", "chaveAcesso", *DOCUMENT_FIELDS,
    *FINANCE_DESCRIPTION_FIELDS,
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
        "User-Agent": "RaizObraViva/1.0 (+https://raiz-obras.vercel.app)",
        **(headers or {}),
    }
    last_error = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body, method=method, headers=merged)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            text = exc.read().decode("utf-8", errors="replace")
            last_error = RuntimeError(f"{method} {url} -> HTTP {exc.code}: {text}")
            if exc.code not in (429, 500, 502, 503, 504, 546):
                raise last_error
        except Exception as exc:
            last_error = exc
        time.sleep(2 + attempt * 3)
    raise last_error


def capex_fields(flow_id=None):
    names = list(CAPEX_FIELD_CANDIDATES)
    for extra in DEFAULT_CAPEX_FIELDS.get(int(flow_id or 0), []):
        if norm_key(extra) not in {norm_key(x) for x in names}:
            names.append(extra)
    return names


def flow_text(row):
    flow = row.get("flow") or {}
    return " ".join(str(x or "") for x in [
        flow.get("name"),
        row.get("flowName"),
        row.get("requestName"),
        (row.get("service") or {}).get("name"),
    ])


def is_finance_row(row):
    flow = row.get("flow") or {}
    flow_id = int(flow.get("id") or row.get("flowId") or 0)
    return flow_id in FINANCE_FLOW_IDS or "financeir" in norm(flow_text(row))


def is_purchase_row(row):
    flow = row.get("flow") or {}
    flow_id = int(flow.get("id") or row.get("flowId") or 0)
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


def report_page(flow_id, page, start, end, page_size=30):
    page_size = finished_task_page_size(page_size)
    payload = {
        "flowId": flow_id,
        "startDateIntervalBegin": start,
        "startDateIntervalEnd": end,
        "recordsPerPage": page_size,
        "pageNumber": page,
        "useCache": False,
        "formFieldNames": capex_fields(flow_id),
        "showPendingInstanceTasks": True,
        "showFinishedInstanceTasks": True,
        "showPendingAssignees": True,
    }
    data = request_json(
        "POST",
        f"{ZEEV_BASE_URL}/api/2/instances/report",
        headers={"Authorization": f"Bearer {ZEEV_TOKEN}"},
        payload=payload,
        timeout=90,
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


def instance_fields(instance_id, fields):
    params = [("showPendingInstanceTasks", "true"), ("showFinishedInstanceTasks", "true"),
              ("showPendingAssignees", "true"), ("useCache", "false"),
              ("allowOpenUrlsForFilesInForm", "true")]
    for field in fields or []:
        params.append(("formFieldNames", field))
    url = f"{ZEEV_BASE_URL}/api/2/instances/{instance_id}?" + urllib.parse.urlencode(params)
    data = request_json("GET", url, headers={"Authorization": f"Bearer {ZEEV_TOKEN}"}, timeout=90)
    return data, data.get("formFields") or []


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
    fields = unique_fields(
        capex_fields(flow_id),
        FINANCE_FIELDS if financeiro else PURCHASE_FIELDS,
        env_list(os.environ.get("ZEEV_EXTRA_DOCUMENT_FIELDS", "")),
        VALUE_TOTAL_FIELDS,
        ITEM_DESC_FIELDS,
        ITEM_QTY_FIELDS,
        ITEM_UNIT_MEASURE_FIELDS,
        ITEM_UNIT_FIELDS,
        ITEM_TOTAL_FIELDS,
    )
    all_fields = {}
    errors = []
    latest = row
    try:
        detail, found = instance_fields(row["id"], [])
        latest = detail or latest
        for field in found:
            display = field_display_name(field)
            if not display:
                continue
            key = f"{display}|{field.get('row') or 1}"
            all_fields[key] = field
    except Exception as exc:
        errors.append({"field": "__all__", "error": str(exc)[:300]})
    for i in range(0, len(fields), 8):
        chunk = fields[i:i + 8]
        try:
            detail, found = instance_fields(row["id"], chunk)
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
            for field_name in chunk:
                try:
                    detail, found = instance_fields(row["id"], [field_name])
                    latest = detail or latest
                    for field in found:
                        display = field_display_name(field)
                        if not display:
                            continue
                        key = f"{display}|{field.get('row') or 1}"
                        all_fields[key] = field
                except Exception as single_exc:
                    errors.append({"field": field_name, "error": str(single_exc)[:300]})
    base = row.get("formFields") or []
    for field in base:
        display = field_display_name(field)
        if not display:
            continue
        key = f"{display}|{field.get('row') or 1}"
        all_fields[key] = field
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
    explicit = money_by_priority(fields, VALUE_TOTAL_FIELDS)
    if explicit:
        return explicit
    if financeiro:
        finance_fallback = money_by_priority(fields, ["precoUnitario", "preço unitário", "preco unitario", "valorUnitario", "valor unitario"])
        if finance_fallback:
            return finance_fallback
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


def ticket_description(fields, items, financeiro=False, compra=False):
    if financeiro:
        return field_value_by_priority(fields, FINANCE_DESCRIPTION_FIELDS)
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
    pedido = ticket_description(fields, itens, financeiro=financeiro, compra=compra)
    service_desc = field_value_by_priority(fields, PURCHASE_SERVICE_DESCRIPTION_FIELDS) if compra else ""
    descricao_truncada = bool(compra and service_desc and service_desc == pedido and looks_truncated_zeev_text(pedido))
    atual = current_task(tasks)
    situacao, realizado = suggested_capex_status(row, ready)
    campos_extraidos = fields_object(fields)
    resumo_card, resumo_source = card_summary_cascade(pedido, items=itens, compra=compra)
    if resumo_card:
        campos_extraidos["_resumo_card"] = resumo_card
        campos_extraidos["_resumo_card_source"] = resumo_source
        campos_extraidos["_pedido_completo_chars"] = len(clean_summary_text(pedido))
    if descricao_truncada:
        campos_extraidos["_descricao_status"] = "parcial"
        campos_extraidos["_descricao_origem"] = "descricaoDoServico"
        campos_extraidos["_descricao_alerta"] = "O Zeev retornou a descricao do servico limitada a 100 caracteres. Abra o Ticket Raiz para conferir o texto integral."
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
        "raw_instance": row,
        "raw_tasks": tasks,
        "itens_json": itens,
        "pagamento_json": {
            "forma": field_value_by_priority(fields, ["formaDePagamento", "formaPagamento", "condicaoPagamento"]) or None,
            "data_pagamento": field_value(fields, ["dataPagamento"]) or None,
            "previsao_pagamento": field_value_by_priority(fields, ["previsaoPagamento", "dataDeVencimento", "dataVencimento"]) or None,
            "data_entrega": field_value(fields, ["dataEntrega", "prazoEntrega"]) or None,
            "nota_fiscal": field_value(fields, ["notaFiscal", "numeroNF", "numeroNotaFiscal"]) or None,
            "chave_acesso": field_value(fields, ["chaveAcesso"]) or None,
            "valor_total": valor or None,
        },
        "campos_extraidos": campos_extraidos,
        "enrichment_errors": enrichment_errors,
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
                    tickets[ticket["zeev_instance_id"]] = ticket
            if len(rows) < page_size:
                break
        print(json.dumps({"progress": "flow-end", "flowId": flow_id, "ticketsSoFar": len(tickets)}, ensure_ascii=False), flush=True)
    return sorted(tickets.values(), key=lambda x: x["zeev_instance_id"], reverse=True)


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
            return build_ticket(enriched)

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


def sync_ids(instance_ids):
    tickets = {}
    for instance_id in parse_ticket_ids(instance_ids):
        try:
            base, _ = instance_fields(instance_id, [])
            row = base if isinstance(base, dict) and base else {"id": instance_id}
            row.setdefault("id", instance_id)
            enriched = enrich_instance(row)
            ticket = build_ticket(enriched)
            if ticket:
                tickets[ticket["zeev_instance_id"]] = ticket
        except Exception as exc:
            print(json.dumps({"ticketId": instance_id, "error": str(exc)[:500]}, ensure_ascii=False), file=sys.stderr)
    return sorted(tickets.values(), key=lambda x: x["zeev_instance_id"], reverse=True)


def ingest(tickets, notify=False, partial=False):
    payload = {"mode": "ingest", "tickets": tickets, "notify": notify}
    backfill_limit = os.environ.get("ZEEV_INGEST_BACKFILL_LIMIT") or os.environ.get("ZEEV_BACKFILL_LIMIT")
    if backfill_limit and not partial:
        try:
            payload["backfillLimit"] = max(0, int(backfill_limit))
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
    base_batch = max(1, min(int(os.environ.get("ZEEV_BACKFILL_BATCH", "2")), 8))
    base_file_limit = max(1, min(int(os.environ.get("ZEEV_BACKFILL_FILE_LIMIT", "3")), 8))
    shared = {
        "mode": "backfill-docs",
        "refresh": os.environ.get("ZEEV_BACKFILL_REFRESH", "true").lower() != "false",
        "staleHours": int(os.environ.get("ZEEV_BACKFILL_STALE_HOURS", "8")),
        "includePending": os.environ.get("ZEEV_BACKFILL_PENDING", "true").lower() != "false",
        "includePayments": os.environ.get("ZEEV_BACKFILL_PAYMENTS", "true").lower() != "false",
        "includeCapex": os.environ.get("ZEEV_BACKFILL_CAPEX", "true").lower() != "false",
    }
    ticket_ids = os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or ""
    if ticket_ids:
        shared["ticketIds"] = ticket_ids
        base_batch = min(max(total_limit, 1), 8)
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
    out["completed"] = out.get("completed", False) or out["processed"] >= total_limit
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


def register_obra_payments():
    ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or "")
    obra = os.environ.get("ZEEV_TARGET_OBRA") or os.environ.get("ZEEV_OBRA_DESTINO") or ""
    escopo = os.environ.get("ZEEV_TARGET_ESCOPO") or "obra"
    batch_size = max(1, min(int(os.environ.get("ZEEV_REGISTER_BATCH", "1")), 4))
    file_limit = max(1, min(int(os.environ.get("ZEEV_REGISTER_FILE_LIMIT", "2")), 4))
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

    def call_chunk(chunk):
        payload = {
            "mode": "register-obra-payments",
            "ticketIds": ",".join(str(x) for x in chunk),
            "obraName": obra,
            "escopo": escopo,
            "fileLimit": file_limit,
        }
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

    def run_chunk(chunk):
        try:
            merge_result(call_chunk(chunk))
        except Exception as exc:
            msg = str(exc)
            if ("WORKER_RESOURCE_LIMIT" in msg or "HTTP 546" in msg) and len(chunk) > 1:
                mid = max(1, len(chunk) // 2)
                run_chunk(chunk[:mid])
                run_chunk(chunk[mid:])
                return
            if "WORKER_RESOURCE_LIMIT" in msg or "HTTP 546" in msg:
                out["ok"] = False
                out["errors"].append({"tr": chunk[0] if chunk else None, "recoverable": False, "error": msg[:700]})
                return
            raise

    for i in range(0, len(ids), batch_size):
        run_chunk(ids[i:i + batch_size])
        time.sleep(float(os.environ.get("ZEEV_REGISTER_PAUSE_SECONDS", "1")))

    if len(out["errors"]) > 50:
        out["errors"] = out["errors"][:50]
    return out


def refresh_payment_statuses():
    ticket_ids = os.environ.get("ZEEV_TICKET_IDS") or os.environ.get("ZEEV_EXTRA_TICKET_IDS") or ""
    payload = {
        "mode": "refresh-payment-statuses",
        "ticketIds": ticket_ids,
        "limit": int(os.environ.get("ZEEV_STATUS_REFRESH_LIMIT", os.environ.get("ZEEV_BACKFILL_LIMIT", "12"))),
        "fileLimit": int(os.environ.get("ZEEV_BACKFILL_FILE_LIMIT", "4")),
        "onlyOverdue": os.environ.get("ZEEV_STATUS_ONLY_OVERDUE", "true").lower() != "false",
    }
    return request_json(
        "POST",
        f"{SUPABASE_URL}/functions/v1/zeev-capex-sync",
        headers={"Authorization": f"Bearer {ZEEV_SYNC_SECRET}", "x-cron-secret": ZEEV_SYNC_SECRET},
        payload=payload,
        timeout=300,
        retries=1,
    )


def default_window():
    now = datetime.now(business_tz())
    start = now - timedelta(hours=float(os.environ.get("ZEEV_SYNC_OVERLAP_HOURS", "72")))
    return start.isoformat(timespec="seconds"), (now + timedelta(minutes=5)).isoformat(timespec="seconds")


def main():
    mode = os.environ.get("ZEEV_SYNC_MODE", "incremental")
    if not ZEEV_SYNC_SECRET:
        raise SystemExit("ZEEV_SYNC_SECRET e obrigatorio.")
    if mode in {"reconcile-registered", "reconcile", "dedupe-registered"}:
        result = reconcile_registered()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"register-obra-payments", "register-obra", "obra-payments"}:
        result = register_obra_payments()
        print(json.dumps(result, ensure_ascii=False))
        return
    if mode in {"refresh-payment-statuses", "refresh-payments", "payment-statuses"}:
        result = refresh_payment_statuses()
        print(json.dumps(result, ensure_ascii=False))
        return
    if not ZEEV_TOKEN:
        raise SystemExit("ZEEV_TOKEN e obrigatorio.")
    if mode in {"backfill-docs", "docs-backfill", "backfill"}:
        result = backfill_docs()
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
    if ticket_ids:
        tickets = sync_ids(ticket_ids)
    else:
        if deep_mode:
            progressive_ingest = os.environ.get("ZEEV_PROGRESSIVE_INGEST", "1") != "0"
            start_page = int(os.environ.get("ZEEV_START_PAGE", "1") or "1")
            merged = {t["zeev_instance_id"]: t for t in deep_sync(start, end, max_pages=max_pages, page_size=page_size, notify=notify, progressive_ingest=progressive_ingest, start_page=start_page)}
        else:
            merged = {t["zeev_instance_id"]: t for t in sync(start, end, FLOW_IDS, max_pages=max_pages, page_size=page_size)}
        for ticket in sync_ids(extra_ticket_ids):
            merged[ticket["zeev_instance_id"]] = ticket
        tickets = sorted(merged.values(), key=lambda x: x["zeev_instance_id"], reverse=True)
    result = ingest(tickets, notify=notify)
    print(json.dumps({"mode": "ticketIds" if ticket_ids else mode, "deep": deep_mode, "start": start, "end": end, "tickets": len(tickets), "ticketIds": [t.get("zeev_instance_id") for t in tickets], "ingest": result}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        try:
            report_sync_error(exc)
        except Exception as report_exc:
            print(json.dumps({"syncError": str(exc)[:500], "reportError": str(report_exc)[:500]}, ensure_ascii=False), file=sys.stderr)
        raise
