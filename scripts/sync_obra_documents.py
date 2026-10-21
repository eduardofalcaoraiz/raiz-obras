"""Cloud attachment repair for registered in-work payments using the existing sync."""
import json
import os
import time
from datetime import datetime, timedelta, timezone

import zeev_capex_sync as sync


def candidates(rows, requested=(), limit=12, now=None):
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(hours=8)
    selected = []
    for row in rows:
        if row.get('escopo_fin') not in (None, '', 'obra'):
            continue
        ids = sync.parse_ticket_ids(str(row.get('ticket_raiz') or ''))
        for ticket in ids:
            if requested and ticket not in requested:
                continue
            checked = str(row.get('zeev_docs_checked_at') or '')
            try:
                fresh = datetime.fromisoformat(checked.replace('Z', '+00:00')) >= cutoff
            except (ValueError, TypeError):
                fresh = False
            if fresh and not requested:
                continue
            # Oldest checks rotate first, including tickets that received new NFs.
            selected.append((checked, ticket))
    return list(dict.fromkeys(ticket for _, ticket in sorted(selected)))[:limit]


def main():
    if sync.AUTOMATION_PAUSED:
        print(json.dumps({'paused': True}))
        return
    requested = sync.parse_ticket_ids(os.environ.get('ZEEV_TICKET_IDS', ''))
    rows = []
    for offset in range(0, 100000, 1000):
        page = sync.supabase_rest('/pagamentos?select=id,ticket_raiz,escopo_fin,zeev_docs_checked_at'
                                 '&ticket_raiz=not.is.null&order=id.asc&limit=1000&offset=' + str(offset), prefer='')
        rows.extend(page)
        if len(page) < 1000:
            break
    else:
        raise RuntimeError('Payment scan exceeded its safety limit; no partial selection was processed.')
    ids = candidates(rows, requested, limit=40 if requested else 12)
    if requested and set(requested) - set(ids):
        raise RuntimeError('Requested tickets are not registered as in-work payments.')
    if not ids:
        print(json.dumps({'ok': True, 'candidates': 0}))
        return
    recover(ids, deadline=time.time() + 1500)


def recover(ids, deadline):
    for ticket_id in ids:
        if time.time() >= deadline:
            raise RuntimeError('Attachment synchronization reached its time budget before completing.')
        tickets = sync.sync_ids([ticket_id], allow_non_capex=True, reason='Resgate de anexos de pagamentos de obras')
        if len(tickets) != 1:
            raise RuntimeError('Zeev did not return the requested registered ticket.')
        ticket = tickets[0]
        debug = (ticket.get('campos_extraidos') or {}).get('_zeev_doc_rescue') or {}
        downloaded = len(sync.embedded_downloaded_docs(ticket))
        result = sync.ingest(tickets, notify=False, backfill_limit=0, fanout_targets=True)
        backfill = result.get('backfill') or {}
        direct = backfill.get('directDocs') or backfill
        print(json.dumps({'downloadedDocs': downloaded, 'filesAttached': direct.get('filesAttached', 0),
                          'candidates': debug.get('candidates', 0)}), flush=True)
        if any(part.get('ok') is False or part.get('errors') for part in (result, backfill, direct)):
            raise RuntimeError('The attachment service reported an incomplete import.')
        if debug.get('candidates') and not downloaded:
            raise RuntimeError('Zeev exposed attachment candidates but no file could be downloaded.')
        if downloaded >= sync.direct_doc_rescue_file_limit():
            raise RuntimeError('The attachment limit was reached; remaining files require verification.')


if __name__ == '__main__':
    main()

