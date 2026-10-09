import copy
import json
import unittest
from unittest import mock
from urllib.parse import parse_qs, urlsplit

from scripts import zeev_capex_sync as sync


class RegisteredRepairTests(unittest.TestCase):
    def row(self):
        return {
            "id": 7, "ticket_raiz_instance_id": 123, "orcamento": 0,
            "updated_at": "2026-10-09T10:00:00+00:00",
            "ticket_raiz_dados": {
                "campos": {"valorTotalDoPagamento": "100,00"},
                "rateio": {"ativo": True, "total_partes": 3, "indice": 1},
                "historico": [{"nota": "keep"}], "review": {"status": "approved"},
                "linkedPurchase": 456,
            },
        }

    def repair(self, row, response):
        with mock.patch.dict(sync.os.environ, {"ZEEV_TICKET_IDS": "123", "ZEEV_REPAIR_CAPEX_VALUES_FORCE": "true"}), mock.patch.object(sync, "supabase_rest", side_effect=[[row], response]) as rest:
            result = sync.repair_capex_registered_values()
        return result, rest

    def test_manual_budget_including_zero_is_protected_even_when_forced(self):
        for key in ("orcamento", "valor", "valorTotal"):
            for value in (0, 25, None):
                with self.subTest(key=key, value=value):
                    row = self.row()
                    row["ticket_raiz_dados"]["validacaoManual"] = {key: value}
                    result, rest = self.repair(row, [])
                    self.assertEqual(rest.call_count, 1)
                    self.assertEqual(result["skipped"][0]["reason"], "validacao_manual_protegida")

    def test_rateio_preserves_metadata_and_does_not_mutate_snapshot(self):
        row = self.row()
        original = copy.deepcopy(row)
        result, rest = self.repair(row, [{"id": 7}])
        patch = rest.call_args.kwargs["payload"]
        self.assertEqual(patch["orcamento"], 33.34)
        self.assertEqual(set(patch), {"orcamento", "ticket_raiz_dados"})
        for key in ("historico", "review", "linkedPurchase", "campos"):
            self.assertEqual(patch["ticket_raiz_dados"][key], original["ticket_raiz_dados"][key])
        self.assertEqual(row, original)
        self.assertEqual(len(result["updated"]), 1)
        query = parse_qs(urlsplit(rest.call_args.args[0]).query)
        self.assertEqual(query["updated_at"], ["eq." + row["updated_at"]])
        self.assertEqual(query["orcamento"], ["eq.0"])
        self.assertEqual(json.loads(query["ticket_raiz_dados"][0][3:]), original["ticket_raiz_dados"])

    def test_concurrent_edit_is_not_reported_as_updated(self):
        result, _ = self.repair(self.row(), [])
        self.assertEqual(result["updated"], [])
        self.assertEqual(result["skipped"][0]["reason"], "registro_alterado_ou_nao_confirmado")

    def test_invalid_amounts_do_not_reach_rateio(self):
        for value in (float("nan"), float("inf"), -10):
            with mock.patch.object(sync, "money_from_mapping_by_priority", return_value=value):
                self.assertEqual(sync.stored_capex_registered_value(self.row())[0], 0)

    def test_invalid_rateio_is_not_silently_clamped(self):
        for parts, index in ((3, 4), (2.5, 1), (-2, 1)):
            row = self.row()
            row["ticket_raiz_dados"]["rateio"].update(total_partes=parts, indice=index)
            self.assertEqual(sync.stored_capex_registered_value(row)[1], "rateio_invalido")

    def test_rounding_conserves_total(self):
        self.assertEqual(sum(sync.split_currency(100, 3, i) for i in (1, 2, 3)), 100)

    def test_explicit_scope_updates_nonzero_without_environment_force(self):
        row = self.row()
        row["orcamento"] = 20
        with mock.patch.dict(sync.os.environ, {"ZEEV_TICKET_IDS": "999", "ZEEV_REPAIR_CAPEX_VALUES_FORCE": "false"}), mock.patch.object(sync, "supabase_rest", side_effect=[[row], [{"id": 7}]]) as rest:
            result = sync.repair_capex_registered_values(ticket_ids=[123], force=True)
        self.assertEqual(result["requested"], [123])
        self.assertNotIn("999", rest.call_args_list[0].args[0])
        self.assertEqual(rest.call_args.kwargs["payload"]["orcamento"], 33.34)

    def test_empty_scope_never_falls_back_to_global(self):
        with mock.patch.object(sync, "supabase_rest") as rest:
            sync.repair_capex_registered_values(ticket_ids=[], force=True)
            sync.repair_ingested_capex_values([], {"ok": True})
        rest.assert_not_called()

    def test_forced_nonrateio_refresh_and_idempotence(self):
        row = self.row()
        row["ticket_raiz_dados"].pop("rateio")
        row["orcamento"] = 20
        with mock.patch.object(sync, "supabase_rest", side_effect=[[row], [{"id": 7}]]) as rest:
            sync.repair_capex_registered_values(ticket_ids=[123], force=True)
        self.assertEqual(rest.call_args.kwargs["payload"], {"orcamento": 100.0})
        row["orcamento"] = 100
        with mock.patch.object(sync, "supabase_rest", return_value=[row]) as rest:
            result = sync.repair_capex_registered_values(ticket_ids=[123], force=True)
        self.assertEqual(rest.call_count, 1)
        self.assertEqual(result["skipped"][0]["reason"], "orcamento_ja_correto")

    def test_unconfirmed_ingest_does_not_repair(self):
        for response in (None, {}, {"ok": False}, {"ok": True, "skipped": True}, {"ok": True, "errors": ["failed"]}):
            with mock.patch.object(sync, "supabase_rest") as rest:
                sync.repair_ingested_capex_values([{"zeev_instance_id": 123}], response)
            rest.assert_not_called()

    def test_all_ingested_ids_batched_and_pending_excluded(self):
        tickets = [{"zeev_instance_id": i} for i in range(1, 164)]
        empty = {"ok": True, "requested": [], "scanned": 0}
        def approved(path, **kwargs):
            ids = parse_qs(urlsplit(path).query)["zeev_instance_id"][0][4:-1]
            return [{"zeev_instance_id": int(i)} for i in ids.split(",") if int(i) != 2]
        with mock.patch.object(sync, "supabase_rest", side_effect=approved), mock.patch.object(sync, "repair_capex_registered_values", return_value=empty) as repair:
            sync.repair_ingested_capex_values(tickets, {"ok": True})
        scopes = [call.kwargs["ticket_ids"] for call in repair.call_args_list]
        self.assertEqual([i for batch in scopes for i in batch], [i for i in range(1, 164) if i != 2])
        self.assertTrue(all(len(batch) <= 80 for batch in scopes))
        self.assertTrue(all(call.kwargs["force"] is True for call in repair.call_args_list))


if __name__ == "__main__":
    unittest.main()
