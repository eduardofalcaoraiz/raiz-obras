# Cloud automations

The Supabase pg_cron clock dispatches fixed GitHub Actions workflows. No personal
computer, browser session or Codex session is required.

| Job | UTC | America/Sao_Paulo | Execution |
| --- | --- | --- | --- |
| raiz-capex-hourly | minute 12 hourly | minute 12 hourly | incremental, one page |
| raiz-real-estate-daily | 11:00 daily | 08:00 daily | discovery for owner approval |
| raiz-storage-audit | 04:24 daily | 01:24 daily | bounded metadata-only audit |
| raiz-automation-receipts | every 5 minutes | every 5 minutes | HTTP dispatch receipts |

GitHub cron triggers are removed to prevent double scheduling. Runner queues and
provider outages can still delay execution; the scheduled time is not a guarantee
of completion. Vercel remains push-triggered.

`sql/cloud_automation_scheduler.sql` installs private, allowlisted dispatch
functions and an RLS-protected receipt table. The GitHub credential is provisioned
separately in Supabase Vault as `raiz_github_actions_dispatch`; it is never exposed
to the browser. Keep that credential valid and revoke/rotate it when necessary.

CAPEX uses `scheduled_light=true`, with no attachments, historical scans, rescues,
mass repair, status refresh or emails. There is at most one dispatcher request per
hour for CAPEX and per UTC day for other jobs. Existing workflow concurrency also
prevents simultaneous workers. User approvals are not bypassed.

Storage defaults to `metadata-only`. Reported bytes are a bounded sample, NOT the
organization quota or full bucket usage. Downloads/compression/deletion require an
explicit manual non-default mode. Dry-run never rewrites document paths. Optional
compression is limited by attempted files, not only successful reductions.

The obsolete `raiz-free-tier-maintenance` pg_cron job is disabled on the Pro plan.
Its function is retained but not called automatically.

## Operations

- Inspect `cron.job`, `cron.job_run_details`, `cloud_automation_dispatches`, GitHub
  workflow outcomes, and `real_estate_sync_runs`. HTTP 204 means accepted, not completed.
- `http_error` or `unknown` receipts need investigation; there is no blind redispatch
  after ambiguous network responses. Inspect GitHub before retrying manually.
- Pause a job with `cron.alter_job(job_id, active := false)`; pause all CAPEX work
  additionally using the `ZEEV_AUTOMATION_PAUSED` GitHub secret.
- GitHub provides workflow failure notifications according to account settings;
  this change does not send emails to platform users or add a separate alert service.
- Install/activate schedules only after publishing the matching workflows.
- Run `python -m unittest discover -s tests -p test_cloud_automation.py` for focused
  offline regression tests.
