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
    os.environ['ZEEV_TICKET_IDS'] = ','.join(map(str, ids))
    result = sync.rescue_docs(deadline=time.time() + 1500)
    print(json.dumps({k: result.get(k) for k in ('ok', 'candidates', 'processed', 'downloadedDocs',
                                               'filesAttached', 'completed', 'checkedWithoutFiscal')}))
    if not result.get('ok') or result.get('errors') or not result.get('completed'):
        raise RuntimeError('Attachment synchronization was incomplete; inspect the remaining tickets.')


if __name__ == '__main__':
    main()

