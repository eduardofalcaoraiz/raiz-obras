import unittest
import time
from unittest.mock import patch
from datetime import datetime, timezone
from sync_obra_documents import candidates, recover
from zeev_report_documents import collect_report_documents
from zeev_capex_sync import collect_doc_candidates_from_value


class CandidatesTest(unittest.TestCase):
    def test_empty_form_field_id_is_not_a_file_id(self):
        docs = []
        collect_doc_candidates_from_value(docs, 'Documento', {'id': 12345, 'name': 'anexarNotaFiscal', 'value': ''}, 'raw_fields')
        self.assertEqual(docs, [])
        collect_doc_candidates_from_value(docs, 'Documento', {'id': 56789, 'fileName': 'sample.pdf'}, 'files')
        self.assertEqual(docs[0]['fileId'], '56789')

    def test_report_general_attachments_stay_on_origin(self):
        seen, docs = [], []
        def fetch(url):
            seen.append(url)
            return 200, 'text/html', '<a href="/document/download/pedido?c=a&amp;b=c">Download</a><a href="https://other.test/document/download/file">Other</a>'
        collect_report_documents('https://example.test/2.0/audit?c=test', docs, fetch,
                                 lambda out, name, url, **kw: out.append(url))
        self.assertEqual(docs, ['https://example.test/document/download/pedido?c=a&b=c'])
        self.assertIn('audit-legacy', seen[1])

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

    def test_nested_storage_errors_fail_the_run(self):
        with patch('sync_obra_documents.sync.sync_ids', return_value=[{}]), \
             patch('sync_obra_documents.sync.embedded_downloaded_docs', return_value=[{}]), \
             patch('sync_obra_documents.sync.ingest', return_value={'backfill': {'directDocs': {'errors': ['storage failure']}}}):
            with self.assertRaises(RuntimeError):
                recover([101], time.time() + 60)

    def test_failed_download_is_not_success(self):
        ticket = {'campos_extraidos': {'_zeev_doc_rescue': {'candidates': 2}}}
        with patch('sync_obra_documents.sync.sync_ids', return_value=[ticket]), \
             patch('sync_obra_documents.sync.embedded_downloaded_docs', return_value=[]), \
             patch('sync_obra_documents.sync.ingest', return_value={'ok': True}):
            with self.assertRaises(RuntimeError):
                recover([101], time.time() + 60)

    def test_successful_import(self):
        with patch('sync_obra_documents.sync.sync_ids', return_value=[{}]), \
             patch('sync_obra_documents.sync.embedded_downloaded_docs', return_value=[{}]), \
             patch('sync_obra_documents.sync.direct_doc_rescue_file_limit', return_value=12), \
             patch('sync_obra_documents.sync.ingest', return_value={'backfill': {'directDocs': {'filesAttached': 1}}}):
            recover([101], time.time() + 60)


if __name__ == '__main__':
    unittest.main()

