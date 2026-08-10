import unittest
from unittest import mock

from scripts import zeev_capex_sync as sync


def form_field(name, value, label=""):
    return {
        "name": name,
        "label": label or name,
        "value": value,
        "row": 1,
    }


class FinanceDescriptionTests(unittest.TestCase):
    def test_single_installment_uses_next_payment_as_total(self):
        fields = [
            form_field("qtdParcelas", "1"),
            form_field("valorDoProximoPagamento", "7.760,00"),
        ]

        self.assertEqual(sync.pick_ticket_value(fields, [], financeiro=True), 7760.0)

    def test_multiple_installments_do_not_use_next_payment_as_total(self):
        fields = [
            form_field("qtdParcelas", "3"),
            form_field("valorDoProximoPagamento", "2.000,00"),
        ]

        self.assertEqual(sync.pick_ticket_value(fields, [], financeiro=True), 0.0)

    def test_explicit_payment_total_wins_over_next_payment(self):
        fields = [
            form_field("qtdParcelas", "3"),
            form_field("valorDoProximoPagamento", "2.000,00"),
            form_field("valorTotalDoPagamento", "6.000,00"),
        ]

        self.assertEqual(sync.pick_ticket_value(fields, [], financeiro=True), 6000.0)

    def test_request_information_wins_over_fiscal_and_item_descriptions(self):
        fields = [
            form_field("descricaoDaNotaFiscal", "Servicos executados conforme NF 9981"),
            form_field("naturezaOrcamentaria", "Manutencao predial"),
            form_field("item", "Material eletrico"),
            form_field("informacoesReferentesASolicitacao", "Adequacao da rede eletrica das salas do segundo andar"),
        ]

        description = sync.ticket_description(
            fields,
            [{"descricao": "Material eletrico", "quantidade": 1}],
            financeiro=True,
        )

        self.assertEqual(description, "Adequacao da rede eletrica das salas do segundo andar")

    def test_fiscal_description_is_never_used_as_request_description(self):
        fields = [
            form_field("descricaoDaNotaFiscal", "Troca de luminarias"),
            form_field("naturezaOrcamentaria", "Facilities"),
            form_field("item", "Luminarias"),
        ]

        description = sync.ticket_description(fields, [], financeiro=True)

        self.assertEqual(description, "")

    def test_exact_display_label_is_supported(self):
        fields = [
            form_field("campoTexto123", "Reparo da cobertura do patio", "Informa\u00e7\u00f5es referentes \u00e0 solicita\u00e7\u00e3o"),
        ]

        description = sync.ticket_description(fields, [], financeiro=True)

        self.assertEqual(description, "Reparo da cobertura do patio")

    def test_purchase_request_information_wins_over_budget_item(self):
        fields = [
            form_field("item", "02.07.00026 - Manut Edificacoes / 1.35.007078 - REFORMA PREDIAL"),
            form_field("informacoes", "Instalacao de tablado de madeira para o professor na Sala 8"),
            form_field("descricaoServico", "Instalacao de tablado de madeira para o professor na Sala 8"),
        ]

        description = sync.ticket_description(
            fields,
            [{"descricao": "02.07.00026 - Manut Edificacoes / 1.35.007078 - REFORMA PREDIAL"}],
            compra=True,
        )

        self.assertEqual(description, "Instalacao de tablado de madeira para o professor na Sala 8")

    def test_purchase_service_description_wins_over_longer_item(self):
        fields = [
            form_field("item", "Natureza orcamentaria muito longa para manutencao e reforma predial"),
            form_field("descricaoServico", "Instalacao de tablado na Sala 8"),
        ]

        description = sync.ticket_description(
            fields,
            [{"descricao": "Natureza orcamentaria muito longa para manutencao e reforma predial"}],
            compra=True,
        )

        self.assertEqual(description, "Instalacao de tablado na Sala 8")

    def test_generic_information_label_is_not_supported(self):
        fields = [form_field("informacoes", "Texto generico de outra secao", "Informa\u00e7\u00f5es")]

        description = sync.ticket_description(fields, [], financeiro=True)

        self.assertEqual(description, "")
        normalized = {sync.norm_key(name) for name in sync.FINANCE_REQUEST_DESCRIPTION_FIELDS}
        self.assertNotIn(sync.norm_key("Informa\u00e7\u00f5es"), normalized)

    def test_instance_reader_continues_after_metadata_only_response(self):
        metadata_only = {"id": 193329, "flow": {"id": 299}, "formFields": []}
        report_with_form = {
            "id": 193329,
            "flow": {"id": 299},
            "formFields": [
                form_field("informacoesReferentesASolicitacao", "Pagamento da manutencao eletrica"),
            ],
        }

        with mock.patch.object(sync, "request_json", return_value=metadata_only), mock.patch.object(
            sync, "report_instance", return_value=[report_with_form]
        ) as report_mock:
            _, fields = sync.instance_fields(193329, [], timeout=10, retries=1)

        self.assertTrue(report_mock.called)
        self.assertEqual(
            sync.field_value_by_priority(fields, sync.FINANCE_REQUEST_DESCRIPTION_FIELDS),
            "Pagamento da manutencao eletrica",
        )

    def test_report_parser_pairs_adjacent_table_cells(self):
        html = """
        <table>
          <tr>
            <td>Informa\u00e7\u00f5es referentes \u00e0 solicita\u00e7\u00e3o *</td>
            <td>Pagamento da troca do quadro eletrico da unidade</td>
          </tr>
          <tr>
            <td>Descri\u00e7\u00e3o da Nota Fiscal *</td>
            <td>Servicos prestados conforme contrato</td>
          </tr>
        </table>
        """

        fields = sync.report_fields_from_html(html)

        self.assertEqual(
            sync.field_value_by_priority(fields, sync.FINANCE_REQUEST_DESCRIPTION_FIELDS),
            "Pagamento da troca do quadro eletrico da unidade",
        )

    def test_flow_design_discovers_changed_technical_name(self):
        design = [{
            "name": "txtInformacoesSolicitacaoFinanceiraV4",
            "label": "Informa\u00e7\u00f5es referentes \u00e0 solicita\u00e7\u00e3o *",
        }]
        sync.FLOW_DESIGN_FINANCE_DESCRIPTION_CACHE.pop(299, None)
        with mock.patch.object(sync, "flow_design_form_fields", return_value=design):
            aliases = sync.finance_request_description_fields(299)

        fields = [form_field("txtInformacoesSolicitacaoFinanceiraV4", "Pagamento do reparo no telhado")]
        self.assertIn("txtInformacoesSolicitacaoFinanceiraV4", aliases)
        self.assertEqual(sync.field_value_by_priority(fields, aliases), "Pagamento do reparo no telhado")

    def test_v5_row_with_missing_description_still_needs_repair(self):
        row = {
            "pedido": None,
            "campos_extraidos": {
                "_descricao_regra": "informacoes_referentes_solicitacao_v5",
                "_descricao_status": "nao_encontrada",
            },
        }

        self.assertTrue(sync.finance_description_needs_repair(row))

    def test_complete_v5_description_does_not_need_repair(self):
        row = {
            "pedido": "Pagamento da reforma da recepcao",
            "campos_extraidos": {
                "_descricao_regra": "informacoes_referentes_solicitacao_v5",
                "_descricao_status": "completa",
            },
        }

        self.assertFalse(sync.finance_description_needs_repair(row))


if __name__ == "__main__":
    unittest.main()
