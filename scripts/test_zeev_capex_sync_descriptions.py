import unittest

from scripts import zeev_capex_sync as sync


def form_field(name, value, label=""):
    return {
        "name": name,
        "label": label or name,
        "value": value,
        "row": 1,
    }


class FinanceDescriptionTests(unittest.TestCase):
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

    def test_generic_information_label_is_not_supported(self):
        fields = [form_field("informacoes", "Texto generico de outra secao", "Informa\u00e7\u00f5es")]

        description = sync.ticket_description(fields, [], financeiro=True)

        self.assertEqual(description, "")
        normalized = {sync.norm_key(name) for name in sync.FINANCE_REQUEST_DESCRIPTION_FIELDS}
        self.assertNotIn(sync.norm_key("Informa\u00e7\u00f5es"), normalized)


if __name__ == "__main__":
    unittest.main()
