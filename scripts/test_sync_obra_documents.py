import unittest
from datetime import datetime, timezone
from sync_obra_documents import candidates


class CandidatesTest(unittest.TestCase):
    def test_scope_rotation_and_recent_checks(self):
        rows = [
            dict(ticket_raiz='101', escopo_fin='obra', zeev_docs_checked_at=None),
            dict(ticket_raiz='102', escopo_fin='fora_obra'),
            dict(ticket_raiz='103', escopo_fin='obra', zeev_docs_checked_at='2026-10-21T11:00:00Z'),
            dict(ticket_raiz='104', escopo_fin='obra', zeev_docs_checked_at='2026-10-20T11:00:00Z'),
            dict(ticket_raiz='101', escopo_fin='obra'),
        ]
        now = datetime(2026, 10, 21, 12, tzinfo=timezone.utc)
        self.assertEqual(candidates(rows, now=now), [101, 104])
        self.assertEqual(candidates(rows, requested=[103], now=now), [103])
        self.assertEqual(candidates(rows, requested=[102], now=now), [])

    def test_limit_and_legacy_scope(self):
        rows = [dict(ticket_raiz='103'), dict(ticket_raiz='101;102', escopo_fin='')]
        self.assertEqual(candidates(rows, limit=2), [101, 102])


if __name__ == '__main__':
    unittest.main()

