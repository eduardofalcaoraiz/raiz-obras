import io
import json
import os
import sys
import urllib.parse
from collections import defaultdict

import requests


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DRY_RUN = os.environ.get("STORAGE_MAINTENANCE_DRY_RUN", "false").lower() in {"1", "true", "yes", "sim"}
BUCKETS = [b.strip() for b in os.environ.get("STORAGE_MAINTENANCE_BUCKETS", "pagamentos,documentos").split(",") if b.strip()]
SCAN_LIMIT = int(os.environ.get("STORAGE_MAINTENANCE_SCAN_LIMIT", "1200"))
MIN_BYTES = int(os.environ.get("STORAGE_MAINTENANCE_MIN_BYTES", "120000"))
DEDUPE_LIMIT = int(os.environ.get("STORAGE_DEDUPE_LIMIT", "40"))
COMPRESS_LIMIT = int(os.environ.get("STORAGE_COMPRESS_LIMIT", "4"))
MIN_SAVING_RATIO = float(os.environ.get("STORAGE_COMPRESS_MIN_SAVING_RATIO", "0.08"))
JPEG_QUALITY = int(os.environ.get("STORAGE_COMPRESS_JPEG_QUALITY", "84"))
MAX_IMAGE_DIM = int(os.environ.get("STORAGE_COMPRESS_MAX_IMAGE_DIM", "2200"))


def require_env():
    missing = [name for name, value in {
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_SERVICE_ROLE_KEY": SERVICE_KEY,
    }.items() if not value]
    if missing:
        raise SystemExit(f"Missing required env: {', '.join(missing)}")


def headers(content_type="application/json"):
    out = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    }
    if content_type:
        out["Content-Type"] = content_type
    return out


def rpc(name, payload):
    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{name}",
        headers=headers(),
        data=json.dumps(payload),
        timeout=60,
    )
    if not res.ok:
        raise RuntimeError(f"RPC {name} failed {res.status_code}: {res.text[:500]}")
    return res.json()


def storage_objects(bucket):
    return rpc("raiz_storage_objects_for_maintenance", {
        "p_bucket": bucket,
        "p_min_bytes": MIN_BYTES,
        "p_limit": SCAN_LIMIT,
    })


def object_url(bucket, path):
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in path.split("/"))
    return f"{SUPABASE_URL}/storage/v1/object/{bucket}/{encoded}"


def download_object(bucket, path):
    res = requests.get(object_url(bucket, path), headers=headers(None), timeout=120)
    if not res.ok:
        raise RuntimeError(f"download {bucket}/{path} failed {res.status_code}: {res.text[:300]}")
    return res.content, res.headers.get("content-type", "application/octet-stream")


def upload_object(bucket, path, body, content_type):
    if DRY_RUN:
        return {"dryRun": True}
    res = requests.post(
        object_url(bucket, path),
        headers={**headers(content_type or "application/octet-stream"), "x-upsert": "true"},
        data=body,
        timeout=180,
    )
    if not res.ok and res.status_code != 409:
        raise RuntimeError(f"upload {bucket}/{path} failed {res.status_code}: {res.text[:500]}")
    return {"ok": True, "status": res.status_code}


def delete_object(bucket, path):
    if DRY_RUN:
        return {"dryRun": True}
    res = requests.delete(object_url(bucket, path), headers=headers(None), timeout=60)
    if not res.ok and res.status_code not in {404}:
        raise RuntimeError(f"delete {bucket}/{path} failed {res.status_code}: {res.text[:500]}")
    return {"ok": True, "status": res.status_code}


def canonical_score(name):
    if name.startswith("obra_"):
        group = 0
    elif name.startswith("capex/"):
        group = 1
    elif name.startswith("zeev_pendente/"):
        group = 2
    else:
        group = 3
    return (group, len(name), name)


def dedupe_bucket(bucket, objects):
    groups = defaultdict(list)
    for obj in objects:
        etag = str(obj.get("etag") or "").strip().strip('"')
        size = int(obj.get("size_bytes") or 0)
        if not etag or size <= 0:
            continue
        groups[(etag, size)].append(obj)

    result = {"groups": 0, "deleted": 0, "rewritten": 0, "errors": []}
    for (_etag, _size), copies in sorted(groups.items(), key=lambda item: len(item[1]), reverse=True):
        if len(copies) < 2:
            continue
        canonical = sorted(copies, key=lambda item: canonical_score(item["name"]))[0]
        result["groups"] += 1
        for duplicate in sorted(copies, key=lambda item: canonical_score(item["name"]))[1:]:
            if result["deleted"] >= DEDUPE_LIMIT:
                return result
            old_path = duplicate["name"]
            new_path = canonical["name"]
            try:
                rewrite = rpc("raiz_rewrite_storage_path", {
                    "p_bucket": bucket,
                    "p_old_path": old_path,
                    "p_new_path": new_path,
                })
                if not DRY_RUN:
                    delete_object(bucket, old_path)
                result["deleted"] += 1
                result["rewritten"] += 1 if rewrite else 0
            except Exception as exc:
                result["errors"].append({"bucket": bucket, "path": old_path, "error": str(exc)[:300]})
                if len(result["errors"]) >= 10:
                    return result
    return result


def compress_pdf(data):
    import fitz

    src = fitz.open(stream=data, filetype="pdf")
    if src.is_encrypted:
        return None, "encrypted_pdf"
    out = io.BytesIO()
    src.save(out, garbage=4, deflate=True, clean=True)
    compressed = out.getvalue()
    # Validate the result before replacing the original.
    fitz.open(stream=compressed, filetype="pdf").close()
    src.close()
    return compressed, "application/pdf"


def compress_image(data, mimetype):
    from PIL import Image

    img = Image.open(io.BytesIO(data))
    img.load()
    if mimetype.lower().endswith("png") or img.format == "PNG":
        out = io.BytesIO()
        img.save(out, format="PNG", optimize=True)
        return out.getvalue(), "image/png"
    if img.mode not in {"RGB", "L"}:
        img = img.convert("RGB")
    scale = min(1.0, MAX_IMAGE_DIM / max(img.size))
    if scale < 1:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue(), "image/jpeg"


def compressed_bytes(obj, data):
    mimetype = (obj.get("mimetype") or "").lower()
    name = (obj.get("name") or "").lower()
    if "pdf" in mimetype or name.endswith(".pdf"):
        return compress_pdf(data)
    if "image/jpeg" in mimetype or name.endswith((".jpg", ".jpeg")):
        return compress_image(data, "image/jpeg")
    if "image/png" in mimetype or name.endswith(".png"):
        return compress_image(data, "image/png")
    return None, "unsupported"


def compress_bucket(bucket, objects):
    result = {"checked": 0, "compressed": 0, "savedBytes": 0, "skipped": [], "errors": []}
    candidates = [
        obj for obj in objects
        if int(obj.get("size_bytes") or 0) >= MIN_BYTES
        and (str(obj.get("mimetype") or "").lower().startswith("image/") or str(obj.get("mimetype") or "").lower() == "application/pdf" or str(obj.get("name") or "").lower().endswith((".pdf", ".jpg", ".jpeg", ".png")))
    ]
    for obj in candidates:
        if result["compressed"] >= COMPRESS_LIMIT:
            break
        path = obj["name"]
        old_size = int(obj.get("size_bytes") or 0)
        result["checked"] += 1
        try:
            data, content_type = download_object(bucket, path)
            compressed, new_type = compressed_bytes(obj, data)
            if not compressed:
                result["skipped"].append({"bucket": bucket, "path": path, "reason": new_type})
                continue
            saving = old_size - len(compressed)
            if saving <= 0 or saving / max(old_size, 1) < MIN_SAVING_RATIO:
                result["skipped"].append({"bucket": bucket, "path": path, "reason": "saving_too_small", "old": old_size, "new": len(compressed)})
                continue
            upload_object(bucket, path, compressed, new_type or content_type)
            result["compressed"] += 1
            result["savedBytes"] += saving
        except Exception as exc:
            result["errors"].append({"bucket": bucket, "path": path, "error": str(exc)[:300]})
            if len(result["errors"]) >= 10:
                break
    return result


def main():
    require_env()
    summary = {"ok": True, "dryRun": DRY_RUN, "buckets": {}, "totals": {"deleted": 0, "compressed": 0, "savedBytes": 0}}
    for bucket in BUCKETS:
        objects = storage_objects(bucket)
        dedupe = dedupe_bucket(bucket, objects)
        # Reload after dedupe so compression does not waste work on objects that were removed.
        refreshed = storage_objects(bucket)
        compressed = compress_bucket(bucket, refreshed)
        summary["buckets"][bucket] = {"objectsSeen": len(objects), "dedupe": dedupe, "compression": compressed}
        summary["totals"]["deleted"] += dedupe.get("deleted", 0)
        summary["totals"]["compressed"] += compressed.get("compressed", 0)
        summary["totals"]["savedBytes"] += compressed.get("savedBytes", 0)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
