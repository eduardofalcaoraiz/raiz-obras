import io
import unittest
import urllib.error
from unittest import mock

from scripts import zeev_capex_sync as sync


class ZeevRequestHeadersTests(unittest.TestCase):
    def request(self, url, headers=None, payload=None):
        response = mock.MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = b'{"id":190638}'
        response.headers = {"Content-Type": "application/json"}
        with mock.patch.object(sync, "ZEEV_TOKEN", "test-token"), mock.patch.object(
            sync.urllib.request, "urlopen", return_value=response
        ) as transport:
            result = sync.request_json(
                "POST" if payload else "GET", url, headers=headers, payload=payload, retries=1
            )
        self.assertEqual(result["id"], 190638)
        transport.assert_called_once()
        return transport.call_args.args[0]

    def test_zeev_default_language_preserves_auth_and_body(self):
        request = self.request(sync.ZEEV_BASE_URL + "/api/2/instances/report", payload={"page": 1})
        self.assertEqual(request.get_header("Accept-language"), sync.ZEEV_ACCEPT_LANGUAGE)
        self.assertEqual(request.get_header("Authorization"), "Bearer test-token")
        self.assertEqual(request.data, b'{"page": 1}')

    def test_caller_language_is_preserved_case_insensitively(self):
        request = self.request(sync.ZEEV_BASE_URL + "/api/2/instances/190638", {"accept-language": "pt-BR"})
        self.assertEqual(request.get_header("Accept-language"), "pt-BR")

    def test_non_zeev_request_has_no_added_language_or_token(self):
        request = self.request("https://example.test/data")
        self.assertIsNone(request.get_header("Accept-language"))
        self.assertIsNone(request.get_header("Authorization"))

    def test_other_server_errors_still_surface(self):
        error = urllib.error.HTTPError("https://example.test", 500, "Internal error", {}, io.BytesIO(b"failure"))
        with mock.patch.object(sync, "ZEEV_TOKEN", "test-token"), mock.patch.object(
            sync.urllib.request, "urlopen", side_effect=error
        ):
            with self.assertRaisesRegex(RuntimeError, "HTTP 500"):
                sync.request_json("GET", sync.ZEEV_BASE_URL + "/api/2/instances/190638", retries=1)


if __name__ == "__main__":
    unittest.main()
