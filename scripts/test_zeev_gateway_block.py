import io
import unittest
import urllib.error
from unittest import mock

from scripts import zeev_capex_sync as sync


class GatewayBlockTests(unittest.TestCase):
    def test_gateway_denial_is_not_retried_or_returned_as_empty(self):
        body = b'<html><h2>The request is blocked.</h2></html>'
        error = urllib.error.HTTPError(sync.ZEEV_BASE_URL, 403, 'Forbidden', {}, io.BytesIO(body))
        with mock.patch.object(sync, 'ZEEV_TOKEN', 'test-token'), mock.patch.object(
            sync.urllib.request, 'urlopen', side_effect=error
        ) as transport, mock.patch.object(sync.time, 'sleep') as sleep:
            with self.assertRaises(sync.ZeevAccessBlocked) as raised:
                sync.request_json('POST', sync.ZEEV_BASE_URL + '/api/2/instances/report', payload={'page': 1})
        self.assertEqual(transport.call_count, 1)
        sleep.assert_not_called()
        self.assertNotIn('<html>', str(raised.exception))
        self.assertNotIn('test-token', str(raised.exception))
        self.assertFalse(sync.is_transient_http_error(str(raised.exception)))

    def test_json_permission_error_not_misclassified_as_gateway(self):
        self.assertFalse(sync.zeev_gateway_block(403, '{"error":"permission denied"}'))
        self.assertFalse(sync.zeev_gateway_block(401, 'The request is blocked'))

    def test_credentials_only_for_exact_origin(self):
        self.assertTrue(sync.same_api_origin(sync.ZEEV_BASE_URL + '/api/2/instances/report', sync.ZEEV_BASE_URL))
        for url in [sync.ZEEV_BASE_URL + '.evil.test/api', sync.ZEEV_BASE_URL + ':8443/api', sync.ZEEV_BASE_URL.replace('https:', 'http:')]:
            self.assertFalse(sync.same_api_origin(url, sync.ZEEV_BASE_URL))


if __name__ == '__main__':
    unittest.main()
