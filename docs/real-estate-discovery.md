# Daily Real Estate discovery

The GitHub Actions workflow `zeev-real-estate-sync.yml` runs at 11:00 UTC
(08:00 America/Sao_Paulo). It does not depend on a desktop, open browser or
signed-in user. GitHub can delay scheduled starts. Manual dispatch is available
for an initial run or recovery. Existing CAPEX schedules are unchanged.
Manual dispatch can select `links_only` to drain deferred links without repeating
the source windows. The scheduled job always runs normal discovery.

## Discovery and limits

- Reads Zeev only; never starts, completes or modifies source requests.
- Uses creation and last-finished-task windows, with a 36-hour overlap after
  completing each window. The initial window is two days, not all historical TRs.
- Covers all flows exposed to the configured administrator token. Explicit field
  names are required because unfiltered Zeev responses can omit form values.
- Ignores confirmed technical bank-data flow 276. Does not download attachments.
- Recognizes rent, taxes, utilities and subleases. The owner's requester email,
  creator task and explicit parent/child ticket references provide extra evidence.
- Maximum 120 light report pages of 100 records, shared equally between discovery
  windows; full task metadata is fetched only for candidates and related tickets.
  Up to 200 linked reads and 40 rotating pending refreshes per run.
- Page checkpoints advance only after ingestion. Deferred links are stored in a
  durable backlog. Partial runs are visible and continue next day; they must not
  be interpreted as a complete audit.
- Linked requester identity has a private 30-day metadata cache to avoid reading
  the same old parent ticket repeatedly. Monetary snapshots are never reused from
  this identity cache; financial child details are fetched separately.
- Form edits on already-approved old tickets without any task activity may not
  appear in change reports. This is new-ticket discovery, not a daily full audit.

## Second check

Property and sublease records, existing TR links and `real_estate_lancamentos`
are the reference set. The latter contains imported spreadsheet history and
source URLs. This job does NOT authenticate to or reread Google Sheets daily.
No private spreadsheet is made public. Source refreshes remain a separate import.
Supplier alone never constitutes approval; ambiguity is shown for human review.

## Approval and financial safety

`Registros pendentes > Real Estate` is initially restricted to the responsible
approved administrator. New snapshots and revisions stay in a separate RLS
protected table. Ingestion is service-role-only. Owner RPC approval validates
the queue revision and the previous stored TR snapshot in a transaction.

Approval attaches/updates a TR in `real_estate_tickets` and preserves existing
property links and documents. It does not duplicate spreadsheet ledger rows,
overwrite the contractual base rent, mark an item paid, change CAPEX or send email.
The UI supports destination/category correction and approve/ignore decisions.
Amounts and competence come from the source; missing values must be resolved in
Zeev before approval. Multiple property allocations and missing component splits
require further manual analysis, not automatic allocation of the full amount.

`real_estate_sync_runs` exposes completed/partial/failed runs in the queue.
Queue source fingerprints deduplicate repeated scans; decisions are retained.
Changing source fields produces a new pending revision, not an automatic change
to the definitive history. Credentials exist only as GitHub Actions secrets.

## Verification

`node --test tests/real-estate-discovery.test.cjs`

Deployment also validates owner authorization, duplicate decisions, stale-source
protection and ignored candidates in a database transaction that is rolled back.
Desktop/mobile UI checks use isolated synthetic data, never approve real items.
