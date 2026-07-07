import argparse
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


REPO = "eduardofalcaoraiz/raiz-obras"
WORKFLOW = "zeev-capex-sync.yml"
DEFAULT_START_MONTH = "2025-04"
DEFAULT_END_MONTH = "2026-03"


def month_iter(start_month, end_month):
    sy, sm = [int(x) for x in start_month.split("-")]
    ey, em = [int(x) for x in end_month.split("-")]
    y, m = sy, sm
    while (y, m) <= (ey, em):
        yield y, m
        m += 1
        if m == 13:
            y += 1
            m = 1


def month_window(year, month):
    if month == 12:
        ny, nm = year + 1, 1
    else:
        ny, nm = year, month + 1
    start = f"{year:04d}-{month:02d}-01T00:00:00-03:00"
    end = (datetime(ny, nm, 1, 2, 59, 59, tzinfo=timezone.utc).astimezone(timezone.utc))
    # Equivalent to the last second of the requested month in Sao Paulo time.
    local_end_month = f"{ny:04d}-{nm:02d}-01T00:00:00-03:00"
    end_dt = datetime.fromisoformat(local_end_month)  # noqa: DTZ007
    end_ts = end_dt.timestamp() - 1
    end_local = datetime.fromtimestamp(end_ts, tz=end_dt.tzinfo).isoformat(timespec="seconds")
    return start, end_local


class Github:
    def __init__(self, token):
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "RaizObraViva-RetroAudit/1.0",
        }
        self.api = f"https://api.github.com/repos/{REPO}"

    def request(self, path, method="GET", payload=None, timeout=60, raw=False, headers=None):
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        merged = dict(self.headers)
        if headers:
            merged.update(headers)
        req = urllib.request.Request(
            path if path.startswith("http") else f"{self.api}{path}",
            data=body,
            method=method,
            headers=merged,
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            if raw:
                return data
            if not data:
                return {}
            return json.loads(data.decode("utf-8"))

    def dispatch(self, start, end, start_page, max_pages, notify, exclude_ids=None):
        payload = {
            "ref": "main",
            "inputs": {
                "mode": "deep-retro",
                "start": start,
                "end": end,
                "max_pages": str(max_pages),
                "start_page": str(start_page),
                "notify": "true" if notify else "false",
                "ticket_ids": "",
                "extra_ticket_ids": "",
            },
        }
        before = datetime.now(timezone.utc)
        self.request(f"/actions/workflows/{WORKFLOW}/dispatches", method="POST", payload=payload, timeout=60)
        return self.find_recent_run(start, end, before, start_page=start_page, exclude_ids=exclude_ids or set())

    def find_recent_run(self, start, end, before, start_page=None, exclude_ids=None):
        deadline = time.time() + 180
        prefix = f"Zeev CAPEX deep-retro {start} {end}"
        page_marker = f"p{start_page}" if start_page else ""
        exclude_ids = {int(x) for x in (exclude_ids or set())}
        while time.time() < deadline:
            data = self.request("/actions/runs?per_page=20", timeout=60)
            candidates = []
            for run in data.get("workflow_runs", []):
                if int(run.get("id") or 0) in exclude_ids:
                    continue
                created = datetime.fromisoformat(run["created_at"].replace("Z", "+00:00"))
                if created < (before - timedelta(seconds=30)).replace(microsecond=0):
                    continue
                title = run.get("display_title") or ""
                if not title.startswith(prefix):
                    continue
                if page_marker and page_marker not in title and title != prefix:
                    continue
                if title:
                    candidates.append(run)
            if candidates:
                return sorted(candidates, key=lambda r: r["created_at"], reverse=True)[0]
            time.sleep(5)
        raise RuntimeError(f"GitHub run not found after dispatch for {start} {end}")

    def run(self, run_id):
        return self.request(f"/actions/runs/{run_id}", timeout=60)

    def logs_zip(self, run_id):
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None

        opener = urllib.request.build_opener(NoRedirect)
        req = urllib.request.Request(f"{self.api}/actions/runs/{run_id}/logs", headers=self.headers)
        try:
            opener.open(req, timeout=60)
        except urllib.error.HTTPError as exc:
            location = exc.headers.get("Location")
            if not location:
                raise
            with urllib.request.urlopen(
                urllib.request.Request(location, headers={"User-Agent": "RaizObraViva-RetroAudit/1.0"}),
                timeout=180,
            ) as resp:
                return resp.read()
        raise RuntimeError("Unexpected direct log response")


def wait_for_run(gh, run_id, poll_seconds):
    while True:
        run = gh.run(run_id)
        status = run.get("status")
        conclusion = run.get("conclusion")
        print(
            json.dumps(
                {
                    "event": "run-status",
                    "runId": run_id,
                    "status": status,
                    "conclusion": conclusion,
                    "updatedAt": run.get("updated_at"),
                    "url": run.get("html_url"),
                },
                ensure_ascii=False,
            ),
            flush=True,
        )
        if status == "completed":
            return run
        time.sleep(poll_seconds)


def parse_logs(data, run_id):
    archive = zipfile.ZipFile(io.BytesIO(data))
    found = []
    pages = []
    page_keys = set()
    ingests = {}
    deep_end = []
    candidate_errors = []
    for name in archive.namelist():
        text = archive.read(name).decode("utf-8", errors="replace")
        for line in text.splitlines():
            match = re.search(r"({.*})", line)
            if not match:
                continue
            try:
                obj = json.loads(match.group(1))
            except Exception:
                continue
            if "capexFound" in obj:
                found.append(obj.get("capexFound"))
            if obj.get("progress") == "deep-page":
                key = (obj.get("page"), obj.get("rows"), obj.get("ticketsSoFar"), obj.get("candidateRows"))
                if key not in page_keys:
                    page_keys.add(key)
                    pages.append(
                        {
                            "page": obj.get("page"),
                            "rows": obj.get("rows"),
                            "candidateRows": obj.get("candidateRows"),
                            "ticketsSoFar": obj.get("ticketsSoFar"),
                        }
                    )
            if obj.get("progress") == "deep-page-ingest":
                ids = tuple(obj.get("ticketIds") or [])
                key = (obj.get("page"), ids)
                if key not in ingests:
                    ingests[key] = {
                        "page": obj.get("page"),
                        "ticketIds": list(ids),
                        "new": (obj.get("ingest") or {}).get("new") or 0,
                        "updated": (obj.get("ingest") or {}).get("updated") or 0,
                    }
            if obj.get("progress") == "deep-end":
                deep_end.append(obj)
            if "candidateError" in obj:
                candidate_errors.append(obj)
    ingest_rows = list(ingests.values())
    return {
        "runId": run_id,
        "uniqueFoundCount": len(set(found)),
        "uniqueFound": sorted(set(found), reverse=True),
        "newTotalThisRun": sum(row["new"] for row in ingest_rows),
        "updatedTotalThisRun": sum(row["updated"] for row in ingest_rows),
        "ingests": ingest_rows,
        "pages": pages,
        "lastPageRows": pages[-1]["rows"] if pages else None,
        "hasMonthEnd": bool(pages and (pages[-1]["rows"] or 0) < 30),
        "deepEnd": deep_end[-1:] if deep_end else [],
        "candidateErrors": candidate_errors,
    }


def append_jsonl(path, row):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", default=".github_token")
    parser.add_argument("--start-month", default=DEFAULT_START_MONTH)
    parser.add_argument("--end-month", default=DEFAULT_END_MONTH)
    parser.add_argument("--first-month-start-page", type=int, default=1)
    parser.add_argument("--resume-run-id", type=int)
    parser.add_argument("--resume-run-start-page", type=int)
    parser.add_argument("--max-pages", type=int, default=5)
    parser.add_argument("--poll-seconds", type=int, default=45)
    parser.add_argument("--notify", action="store_true")
    parser.add_argument("--base-new-total", type=int, default=0)
    parser.add_argument("--report", default="tmp/zeev_retro_audit_report.jsonl")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    token = (root / args.token_file).read_text(encoding="utf-8").strip()
    gh = Github(token)
    report_path = root / args.report
    total_new = args.base_new_total
    total_updated = 0
    resume_run_used = False
    used_run_ids = set()

    for year, month in month_iter(args.start_month, args.end_month):
        month_key = f"{year:04d}-{month:02d}"
        start, end = month_window(year, month)
        page = args.first_month_start_page if month_key == args.start_month else 1
        print(json.dumps({"event": "month-start", "month": month_key, "start": start, "end": end, "page": page}, ensure_ascii=False), flush=True)
        while True:
            if args.resume_run_id and not resume_run_used:
                run_id = args.resume_run_id
                run_start_page = args.resume_run_start_page or page
                resume_run_used = True
                used_run_ids.add(int(run_id))
            else:
                run = gh.dispatch(start, end, page, args.max_pages, args.notify, exclude_ids=used_run_ids)
                run_id = int(run["id"])
                used_run_ids.add(run_id)
                run_start_page = page
                print(
                    json.dumps(
                        {
                            "event": "dispatched",
                            "month": month_key,
                            "startPage": page,
                            "endPage": page + args.max_pages - 1,
                            "runId": run_id,
                            "url": run.get("html_url"),
                        },
                        ensure_ascii=False,
                    ),
                    flush=True,
                )

            run = wait_for_run(gh, run_id, args.poll_seconds)
            if run.get("conclusion") != "success":
                row = {
                    "event": "run-failed",
                    "month": month_key,
                    "startPage": run_start_page,
                    "runId": run_id,
                    "conclusion": run.get("conclusion"),
                    "url": run.get("html_url"),
                }
                append_jsonl(report_path, row)
                print(json.dumps(row, ensure_ascii=False), flush=True)
                raise SystemExit(2)

            parsed = parse_logs(gh.logs_zip(run_id), run_id)
            total_new += parsed["newTotalThisRun"]
            total_updated += parsed["updatedTotalThisRun"]
            row = {
                "event": "chunk-complete",
                "month": month_key,
                "startPage": run_start_page,
                "endPage": run_start_page + args.max_pages - 1,
                "runId": run_id,
                "new": parsed["newTotalThisRun"],
                "updated": parsed["updatedTotalThisRun"],
                "uniqueFound": parsed["uniqueFound"],
                "pages": parsed["pages"],
                "lastPageRows": parsed["lastPageRows"],
                "hasMonthEnd": parsed["hasMonthEnd"],
                "candidateErrors": parsed["candidateErrors"],
                "totals": {"new": total_new, "updated": total_updated},
                "url": run.get("html_url"),
            }
            append_jsonl(report_path, row)
            print(json.dumps(row, ensure_ascii=False), flush=True)
            if parsed["candidateErrors"]:
                raise SystemExit(3)
            if parsed["hasMonthEnd"]:
                append_jsonl(report_path, {"event": "month-complete", "month": month_key, "totals": {"new": total_new, "updated": total_updated}})
                print(json.dumps({"event": "month-complete", "month": month_key, "totals": {"new": total_new, "updated": total_updated}}, ensure_ascii=False), flush=True)
                break
            page = run_start_page + args.max_pages

    done = {"event": "audit-complete", "startMonth": args.start_month, "endMonth": args.end_month, "totals": {"new": total_new, "updated": total_updated}}
    append_jsonl(report_path, done)
    print(json.dumps(done, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
