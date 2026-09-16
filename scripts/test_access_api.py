import json
import unittest
from unittest import mock
from api import zeev_file_proxy as proxy
from api import zeev_capex_sync as bridge


def response(data):
    result = mock.MagicMock()
    result.__enter__.return_value = result
    result.read.return_value = json.dumps(data).encode()
    return result


class AccessApiTests(unittest.TestCase):
    def auth(self, profile):
        handler = mock.Mock(headers={"authorization": "Bearer test-session"})
        with mock.patch.object(proxy.urllib.request, "urlopen", side_effect=[response({"id": "test-user"}), response([profile])]):
            return proxy._auth_user(handler)

    def test_pending_admin_denied(self):
        self.assertFalse(self.auth({"role": "admin", "aprovado": False}))

    def test_member_cannot_use_administrator_token_proxy(self):
        self.assertFalse(self.auth({"role": "editor", "aprovado": True}))

    def test_approved_admin_allowed(self):
        self.assertTrue(self.auth({"role": "admin", "aprovado": True}))

    def test_proxy_domain_is_exact_and_https(self):
        self.assertTrue(proxy._safe_zeev_url("https://raizeducacao.zeev.it/api/1/file"))
        for url in ["https://zeev.evil.test/file", "https://other.zeev.it/file", "http://raizeducacao.zeev.it/file", "https://user@raizeducacao.zeev.it/file"]:
            self.assertFalse(proxy._safe_zeev_url(url))

    def test_bridge_fails_closed_without_configured_secret(self):
        handler = mock.Mock(headers={"authorization": "Bearer attacker-chosen-secret", "x-cron-secret": "attacker-chosen-secret"})
        with mock.patch.dict(bridge.os.environ, {}, clear=True), mock.patch.object(bridge, "_query", return_value={}), mock.patch.object(bridge, "_read_json", return_value={}), mock.patch.object(bridge, "_json") as result:
            bridge.handler._run(handler)
        self.assertEqual(result.call_args.args[1], 401)


if __name__ == "__main__":
    unittest.main()
