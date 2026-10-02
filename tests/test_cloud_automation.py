import importlib.util
import io
import pathlib
import unittest
import urllib.error
from unittest.mock import patch, MagicMock

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


storage = load("storage", "supabase_storage_maintenance.py")
capex = load("capex", "zeev_capex_sync.py")


class CloudAutomationTests(unittest.TestCase):
    def test_dry_run_never_rewrites_or_deletes(self):
        objects = [{"name": name, "size_bytes": 100, "etag": "same"} for name in ["a", "b"]]
        with patch.object(storage, "DRY_RUN", True), patch.object(storage, "METADATA_ONLY", False), \
                patch.object(storage, "rpc") as rpc, patch.object(storage, "delete_object") as delete:
            result = storage.dedupe_bucket("pagamentos", objects)
        rpc.assert_not_called()
        delete.assert_not_called()
        self.assertEqual(result["wouldDelete"], 1)
        self.assertEqual(result["deleted"], 0)

    def test_metadata_only_reads_once_per_bucket(self):
        with patch.object(storage, "require_env"), patch.object(storage, "METADATA_ONLY", True), \
                patch.object(storage, "storage_objects", return_value=[]) as read, \
                patch.object(storage, "dedupe_bucket") as dedupe, \
                patch.object(storage, "compress_bucket") as compress, patch("sys.stdout", new_callable=io.StringIO):
            storage.main()
        self.assertEqual(read.call_count, len(storage.BUCKETS))
        dedupe.assert_not_called()
        compress.assert_not_called()

    def test_compression_limits_attempts_not_successes(self):
        objects = [{"name": str(i)+".pdf", "size_bytes": 200000} for i in range(20)]
        with patch.object(storage, "METADATA_ONLY", False), patch.object(storage, "COMPRESS_LIMIT", 2), \
                patch.object(storage, "download_object", return_value=(b"x", "application/pdf")) as download, \
                patch.object(storage, "compressed_bytes", return_value=(None, "unsupported")):
            result = storage.compress_bucket("pagamentos", objects)
        self.assertEqual(download.call_count, 2)
        self.assertEqual(result["compressed"], 0)

    def test_zeev_503_has_bounded_backoff_then_succeeds(self):
        url = capex.ZEEV_BASE_URL + "/api/2/instances/report"
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"ok":true}'
        response.__enter__.return_value.headers = {}
        errors = [urllib.error.HTTPError(url, 503, "Unavailable", {}, io.BytesIO(b"busy")) for _ in range(2)]
        with patch.object(capex, "zeev_tokens", return_value=["test"]), \
                patch.object(capex, "zeev_auth_attempts", return_value=[("bearer", {})]), \
                patch.object(capex.urllib.request, "urlopen", side_effect=errors+[response]), \
                patch.object(capex.time, "sleep") as sleep:
            self.assertTrue(capex.request_json("GET", url)["ok"])
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [15, 30])

    def test_persistent_503_is_failure_not_false_success(self):
        url = capex.ZEEV_BASE_URL + "/test"
        with patch.object(capex, "zeev_tokens", return_value=["test"]), \
                patch.object(capex, "zeev_auth_attempts", return_value=[("bearer", {})]), \
                patch.object(capex.urllib.request, "urlopen", side_effect=urllib.error.HTTPError(url, 503, "Busy", {}, io.BytesIO())), \
                patch.object(capex.time, "sleep"):
            with self.assertRaises(RuntimeError):
                capex.request_json("GET", url)

    def test_scheduled_workflow_has_no_duplicate_clock(self):
        for name in ["zeev-capex-sync", "zeev-real-estate-sync", "supabase-storage-maintenance"]:
            text = (ROOT / ".github/workflows" / (name+".yml")).read_text(encoding="utf-8")
            self.assertNotIn("  schedule:", text)
        text = (ROOT / ".github/workflows/zeev-capex-sync.yml").read_text(encoding="utf-8")
        self.assertIn("      scheduled_light:", text)
        for name in ["ZEEV_ATTACH_ALL_TICKET_DOCS", "ZEEV_DOC_RESCUE_LIMIT", "ZEEV_STATUS_REFRESH_LIMIT", "ZEEV_REPAIR_CAPEX_VALUES_AFTER_INGEST", "ZEEV_BACKFILL_LIMIT"]:
            line = next(l for l in text.splitlines() if name+":" in l)
            self.assertIn("inputs.scheduled_light) && '0'", line)
        self.assertIn('ZEEV_INCREMENTAL_MAX_PAGES_CAP: "1"', text)


if __name__ == "__main__":
    unittest.main()
