import io
import unittest
from unittest import mock
from scripts import zeev_capex_sync as sync


class OpenUrlTests(unittest.TestCase):
    def test_report_precedes_direct_instance(self):
        row={'id':198911,'formFields':[{'name':'anexo','openUrl':'https://example.test/file.pdf'}]}
        with mock.patch.object(sync,'report_instance',return_value=[row]) as report, mock.patch.object(sync,'request_json') as direct:
            _,fields=sync.instance_fields(198911,['anexo'])
        self.assertEqual(fields[0]['openUrl'],'https://example.test/file.pdf')
        report.assert_called_once()
        direct.assert_not_called()

    def test_signed_url_takes_precedence(self):
        out=[]
        sync.collect_doc_candidates_from_value(out,'anexo',{'url':'https://raizeducacao.zeev.it/document/download/private.pdf','openUrl':'https://raizeducacao.zeev.it/document/download/signed.pdf'},'test')
        self.assertTrue(out[0]['url'].endswith('/signed.pdf'))

    def test_login_html_does_not_stop_auth_retry(self):
        def response(content,ctype):
            result=mock.MagicMock()
            result.__enter__.return_value=result
            result.headers={'Content-Type':ctype}
            result.read.return_value=content
            result.status=200
            return result
        with mock.patch.object(sync,'ZEEV_TOKEN','test'),mock.patch.object(sync.urllib.request,'urlopen',side_effect=[response(b'<html>login</html>','text/html'),response(b'%PDF-good','application/pdf')]) as transport:
            result=sync.fetch_binary_for_rescue(sync.ZEEV_BASE_URL+'/document/download/a.pdf?c=test')
        self.assertEqual(result['body'],b'%PDF-good')
        self.assertEqual(transport.call_count,2)


if __name__=='__main__':
    unittest.main()
