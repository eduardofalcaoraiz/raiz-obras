import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


ZEEV_BASE_URL = os.environ.get("ZEEV_BASE_URL", "https://raizeducacao.zeev.it").rstrip("/")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hjccxfznojjosvanwztv.supabase.co").rstrip("/")
ZEEV_TOKEN = os.environ.get("ZEEV_TOKEN", "")
ZEEV_SYNC_SECRET = os.environ.get("ZEEV_SYNC_SECRET", "")
FLOW_IDS = [int(x) for x in os.environ.get("ZEEV_FLOW_IDS", "299,275,102,300").split(",") if x.strip()]
FINANCE_FLOW_IDS = {299, 275}
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
    "descricaoServico",
    "descricao do servico",
    "descricaoServicoSolicitado",
    "descricaoDoServico",
    "descricaoServicoCompra",
]

PURCHASE_JUSTIFICATION_FIELDS = [
    "justificativaDoPedido",
    "justificativa do pedido",
    "justificativaPedido",
    "justificativa pedido",
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
    "valorNotaFiscal", "chaveAcesso", "anexo", "arquivo", "arquivoNF", "comprovante", "boleto", "pix",
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
    "numeroTR", "ticket", "tr",
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
            if exc.code not in (429, 500, 502, 503, 504):
                raise last_error
        except Exception as exc:
            last_error = exc
        time.sleep(2 + attempt * 3)
    raise last_error


def capex_fields(flow_id):
    return DEFAULT_CAPEX_FIELDS.get(flow_id, ["investimentoCAPEX", "cAPEX"])


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


def report_page(flow_id, page, start, end, page_size=30):
    payload = {
        "flowId": flow_id,
        "startDateIntervalBegin": start,
        "startDateIntervalEnd": end,
        "recordsPerPage": page_size,
        "pageNumber": page,
        "useCache": False,
        "formFieldNames": capex_fields(flow_id),
        "showPendingInstanceTasks": True,
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


def instance_fields(instance_id, fields):
    params = [("showPendingInstanceTasks", "true"), ("showFinishedInstanceTasks", "true"),
              ("showPendingAssignees", "true"), ("useCache", "false")]
    for field in fields or []:
        params.append(("formFieldNames", field))
    url = f"{ZEEV_BASE_URL}/api/2/instances/{instance_id}?" + urllib.parse.urlencode(params)
    data = request_json("GET", url, headers={"Authorization": f"Bearer {ZEEV_TOKEN}"}, timeout=90)
    return data, data.get("formFields") or []


def enrich_instance(row):
    flow_id = int((row.get("flow") or {}).get("id") or row.get("flowId") or 0)
    fields = unique_fields(
        FINANCE_FIELDS if flow_id in FINANCE_FLOW_IDS else PURCHASE_FIELDS,
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


def ticket_description(fields, items, financeiro=False, compra=False):
    if financeiro:
        return field_value_by_priority(fields, FINANCE_DESCRIPTION_FIELDS)
    if compra:
        justification = field_value_by_priority(fields, PURCHASE_JUSTIFICATION_FIELDS)
        service_desc = field_value_by_priority(fields, PURCHASE_SERVICE_DESCRIPTION_FIELDS)
        items_text = item_summary(items)
        if justification and not items_text:
            return justification
        if service_desc:
            return service_desc
        return items_text or justification
    return ""


def build_ticket(row):
    flow = row.get("flow") or {}
    flow_id = int(flow.get("id") or row.get("flowId") or 0)
    fields = row.get("formFields") or []
    capex = has_capex(fields, flow_id)
    if not capex:
        return None
    tasks = row.get("instanceTasks") or []
    ready = delivery_ready(row)
    compra = flow_id in (102, 300) or "compra" in norm(flow.get("name") or row.get("requestName"))
    financeiro = flow_id in FINANCE_FLOW_IDS or "financeir" in norm(flow.get("name") or row.get("requestName"))
    itens = extract_items(fields)
    valor = pick_ticket_value(fields, itens, financeiro=financeiro)
    result_kind = ticket_result_kind(row)
    valor_final = valor if valor and result_kind not in ("cancelado", "rejeitado") and (ready or financeiro) else None
    valor_status = "final" if valor_final else ("em_aprovacao" if compra and valor else ("estimado" if valor else "nao_encontrado"))
    unidade = field_value(fields, ["unidadeEscolar", "unidade", "escola", "filial", "localEntrega"]) or clean_unit(field_value(fields, ["centroDeCusto", "centroCusto"]))
    pedido = ticket_description(fields, itens, financeiro=financeiro, compra=compra)
    atual = current_task(tasks)
    situacao, realizado = suggested_capex_status(row, ready)
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
        "campos_extraidos": fields_object(fields),
        "enrichment_errors": row.get("__enrichmentErrors") or [],
    }


def sync(start, end, flows, max_pages, page_size):
    tickets = {}
    for flow_id in flows:
        for page in range(1, max_pages + 1):
            rows = report_page(flow_id, page, start, end, page_size=page_size)
            for row in rows:
                if not has_capex(row.get("formFields") or [], flow_id):
                    continue
                enriched = enrich_instance(row)
                ticket = build_ticket(enriched)
                if ticket:
                    tickets[ticket["zeev_instance_id"]] = ticket
            if len(rows) < page_size:
                break
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


def ingest(tickets, notify=False):
    payload = {"mode": "ingest", "tickets": tickets, "notify": notify}
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


def default_window():
    now = datetime.now(business_tz())
    start = now - timedelta(hours=float(os.environ.get("ZEEV_SYNC_OVERLAP_HOURS", "12")))
    return start.isoformat(timespec="seconds"), (now + timedelta(minutes=5)).isoformat(timespec="seconds")


def main():
    if not ZEEV_TOKEN or not ZEEV_SYNC_SECRET:
        raise SystemExit("ZEEV_TOKEN e ZEEV_SYNC_SECRET sao obrigatorios.")
    mode = os.environ.get("ZEEV_SYNC_MODE", "incremental")
    if mode == "retro":
        start = os.environ.get("ZEEV_SYNC_START", "2026-04-01T00:00:00-03:00")
        end = os.environ.get("ZEEV_SYNC_END", "2026-07-01T23:59:59-03:00")
    else:
        start, end = default_window()
    max_pages = int(os.environ.get("ZEEV_MAX_PAGES", "2" if mode != "retro" else "999"))
    page_size = int(os.environ.get("ZEEV_RECORDS_PER_PAGE", "30"))
    notify = os.environ.get("ZEEV_NOTIFY", "false").lower() == "true"
    ticket_ids = parse_ticket_ids(os.environ.get("ZEEV_TICKET_IDS", ""))
    extra_ticket_ids = parse_ticket_ids(os.environ.get("ZEEV_EXTRA_TICKET_IDS", ""))
    if ticket_ids:
        tickets = sync_ids(ticket_ids)
    else:
        merged = {t["zeev_instance_id"]: t for t in sync(start, end, FLOW_IDS, max_pages=max_pages, page_size=page_size)}
        for ticket in sync_ids(extra_ticket_ids):
            merged[ticket["zeev_instance_id"]] = ticket
        tickets = sorted(merged.values(), key=lambda x: x["zeev_instance_id"], reverse=True)
    result = ingest(tickets, notify=notify)
    print(json.dumps({"mode": "ticketIds" if ticket_ids else mode, "start": start, "end": end, "tickets": len(tickets), "ticketIds": [t.get("zeev_instance_id") for t in tickets], "ingest": result}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        try:
            report_sync_error(exc)
        except Exception as report_exc:
            print(json.dumps({"syncError": str(exc)[:500], "reportError": str(report_exc)[:500]}, ensure_ascii=False), file=sys.stderr)
        raise
