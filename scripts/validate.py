#!/usr/bin/env python3
"""
Validate government-ai-map-data.json before deploy.

Exit codes:
  0 = clean
  1 = schema violation (BLOCK deploy)
  2 = soft warning (non-blocking, prints WARN lines)

Run:
  python3 scripts/validate.py
  python3 scripts/validate.py --check-urls   # also pings every source URL (slow)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

DATA = Path(__file__).resolve().parent.parent / "government-ai-map-data.json"

REQUIRED_REF_FIELDS = ["id", "country", "category", "coordinates", "program"]
REQUIRED_COORD_FIELDS = ["lat", "lng"]
ALLOWED_HORIZONS = {"short", "medium", "long"}
ALLOWED_CONFIDENCE = {"verified", "report-only"}


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)


def warn(msg: str) -> None:
    print(f"WARN:  {msg}")


def validate_schema(d: dict) -> tuple[int, int]:
    errors = 0
    warnings = 0

    # meta
    meta = d.get("meta", {})
    if not isinstance(meta, dict):
        fail("meta is missing or not an object")
        errors += 1
        return errors, warnings

    for k in ("title", "date", "categories"):
        if k not in meta:
            fail(f"meta.{k} is required")
            errors += 1

    cats = meta.get("categories", [])
    cat_ids = set()
    for i, c in enumerate(cats):
        for k in ("id", "label", "color"):
            if k not in c:
                fail(f"meta.categories[{i}].{k} is required")
                errors += 1
        if "id" in c:
            if c["id"] in cat_ids:
                fail(f"duplicate category id: {c['id']}")
                errors += 1
            cat_ids.add(c["id"])
        if "color" in c and not (
            isinstance(c["color"], str)
            and c["color"].startswith("#")
            and len(c["color"]) in (4, 7)
        ):
            fail(f"meta.categories[{i}].color must be hex like #abc or #aabbcc")
            errors += 1

    # references
    refs = d.get("references", [])
    if not isinstance(refs, list) or len(refs) == 0:
        fail("references must be a non-empty array")
        errors += 1
        return errors, warnings

    ref_ids = set()
    for i, r in enumerate(refs):
        rid = r.get("id", f"<index {i}>")
        for k in REQUIRED_REF_FIELDS:
            if k not in r:
                fail(f"references[{rid}].{k} is required")
                errors += 1

        if "id" in r:
            if r["id"] in ref_ids:
                fail(f"duplicate reference id: {r['id']}")
                errors += 1
            ref_ids.add(r["id"])

        if r.get("category") and r["category"] not in cat_ids:
            fail(f"references[{rid}].category '{r['category']}' not in meta.categories")
            errors += 1

        coords = r.get("coordinates", {})
        if isinstance(coords, dict):
            for k in REQUIRED_COORD_FIELDS:
                if k not in coords:
                    fail(f"references[{rid}].coordinates.{k} is required")
                    errors += 1
                else:
                    v = coords[k]
                    if not isinstance(v, (int, float)):
                        fail(f"references[{rid}].coordinates.{k} must be a number")
                        errors += 1
                    elif k == "lat" and not -90 <= v <= 90:
                        fail(f"references[{rid}].coordinates.lat out of range: {v}")
                        errors += 1
                    elif k == "lng" and not -180 <= v <= 180:
                        fail(f"references[{rid}].coordinates.lng out of range: {v}")
                        errors += 1

        if "horizon" in r and r["horizon"] not in ALLOWED_HORIZONS:
            fail(f"references[{rid}].horizon must be one of {ALLOWED_HORIZONS}")
            errors += 1

        if "confidence" in r and r["confidence"] not in ALLOWED_CONFIDENCE:
            fail(f"references[{rid}].confidence must be one of {ALLOWED_CONFIDENCE}")
            errors += 1

        # source URL warnings (non-fatal, but visible)
        sources = r.get("sources", [])
        if not sources:
            warn(f"references[{rid}] has no sources")
            warnings += 1
        for j, s in enumerate(sources):
            url = (s or {}).get("url", "")
            if not url:
                warn(f"references[{rid}].sources[{j}] has empty url")
                warnings += 1
                continue
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https"):
                fail(f"references[{rid}].sources[{j}].url must be http(s): {url}")
                errors += 1

    # bets_framing cross-references
    bets = d.get("bets_framing", {})
    for k in ("bets_order",):
        for bid in bets.get(k, []) or []:
            if bid not in ref_ids:
                fail(f"bets_framing.{k} references unknown id: {bid}")
                errors += 1

    closing = d.get("closing_narrative", {})
    for bid in closing.get("source_anchors", []) or []:
        if bid not in ref_ids:
            fail(f"closing_narrative.source_anchors references unknown id: {bid}")
            errors += 1

    return errors, warnings


def check_urls(d: dict) -> int:
    """Optional: HEAD-check every source URL. Returns warning count."""
    try:
        import urllib.request
    except ImportError:
        warn("urllib.request not available, skipping URL check")
        return 0

    warnings = 0
    seen: set[str] = set()
    for r in d.get("references", []):
        for s in r.get("sources", []):
            url = (s or {}).get("url", "")
            if not url or url in seen:
                continue
            seen.add(url)
            req = urllib.request.Request(
                url, method="HEAD", headers={"User-Agent": "gov-ai-map-validator/1.0"}
            )
            try:
                with urllib.request.urlopen(req, timeout=8) as resp:
                    if resp.status >= 400:
                        warn(f"URL {resp.status}: {url}")
                        warnings += 1
            except Exception as e:
                warn(f"URL unreachable ({type(e).__name__}): {url}")
                warnings += 1
    return warnings


def main() -> int:
    if not DATA.exists():
        fail(f"data file not found: {DATA}")
        return 1
    try:
        d = json.loads(DATA.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        fail(f"invalid JSON: {e}")
        return 1

    errors, warnings = validate_schema(d)

    if "--check-urls" in sys.argv:
        warnings += check_urls(d)

    n_refs = len(d.get("references", []))
    n_cats = len(d.get("meta", {}).get("categories", []))
    print(f"\nSchema: {n_refs} references, {n_cats} categories")
    print(f"Errors:   {errors}")
    print(f"Warnings: {warnings}")

    if errors > 0:
        return 1
    if warnings > 0:
        return 2
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
