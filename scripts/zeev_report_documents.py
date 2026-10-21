"""Collect the general attachments exposed by Zeev's signed audit report."""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, urlunparse


class ReportLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])
        if tag == 'iframe' and attrs.get('src'):
            self.links.append(attrs['src'])


def collect_report_documents(root, candidates, fetch, push):
    origin = urlparse(root)
    pages = [root]
    if origin.path.rstrip('/') == '/2.0/audit':
        pages.append(urlunparse(origin._replace(path='/2.0/audit-legacy')))
    seen = set()
    for page in pages[:2]:
        _, _, content = fetch(page)
        parser = ReportLinks()
        parser.feed(content)
        for link in parser.links:
            url = urljoin(page, link)
            parsed = urlparse(url)
            if parsed.netloc != origin.netloc or parsed.scheme != origin.scheme:
                continue
            if '/document/download/' not in parsed.path.lower() or url in seen:
                continue
            seen.add(url)
            name = parsed.path.rsplit('/', 1)[-1]
            push(candidates, name, url, source='reportLink')

