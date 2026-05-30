#!/usr/bin/env python3
"""
Validate government-ai-map-data.json before deploy.

GROUNDING INVARIANT (hard gate)
  Every reference MUST cite at least one source, and every listed source MUST
  carry a real http(s) URL. A card the public cannot click through to verify is
  a schema ERROR, not a warning — it blocks the deploy. This is what guarantees
  the map's promise: every fact shown has a real link behind it.

  Structural presence of a URL is enforced here (deterministic, runs in CI).
  URL *liveness* is intentionally NOT a hard CI gate — a transient outage on a
  government site should not block an unrelated content update. Liveness is
  checked with --check-urls and kept healthy by the weekly link-health routine.

Exit codes:
  0 = clean
  1 = schema violation / ungrounded reference (BLOCK deploy)
  2 = soft warning (non-blocking, prints WARN lines)

Run:
  python3 scripts/validate.py                       # schema + grounding gate (fast, deterministic)
  python3 scripts/validate.py --check-urls          # also GET every source URL (liveness; slow, network)
  python3 scripts/validate.py --check-urls --strict # a ref with NO reachable source becomes an ERROR
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

# Browser-like UA: many government sites 403 unknown bots, which would otherwise
# produce false "dead link" warnings. We only ever read a few bytes.
LINKCHECK_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 gov-ai-map-linkcheck/2.0"
)


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

        # --- GROUNDING INVARIANT (hard gate) ---
        # Every card must be verifiable: >=1 source, and every source has a real
        # http(s) URL. No unlinked sources — they render as dead text on the card.
        sources = r.get("sources", [])
        if not isinstance(sources, list) or len(sources) == 0:
            fail(f"references[{rid}] has no sources[] — every card must cite at least one verifiable source")
            errors += 1
        else:
            valid_urls = 0
            for j, s in enumerate(sources):
                url = (s or {}).get("url", "")
                if not url:
                    fail(
                        f"references[{rid}].sources[{j}] has empty url — every listed source "
                        f"must link to a verifiable page (no unlinked sources allowed)"
                    )
                    errors += 1
                    continue
                parsed = urlparse(url)
                if parsed.scheme not in ("http", "https") or not parsed.netloc:
                    fail(f"references[{rid}].sources[{j}].url must be a valid http(s) URL: {url}")
                    errors += 1
                    continue
                valid_urls += 1
            if valid_urls == 0:
                fail(
                    f"references[{rid}] has no source with a valid http(s) URL — "
                    f"the card would not be verifiable by the public"
                )
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


def _probe(url: str, cache: dict[str, tuple[bool, str]]) -> tuple[bool, str]:
    """GET a URL (following redirects), read a few bytes, return (ok, detail)."""
    if url in cache:
        return cache[url]
    import urllib.request
    import urllib.error

    req = urllib.request.Request(
        url,
        method="GET",
        headers={"User-Agent": LINKCHECK_UA, "Accept": "text/html,application/xhtml+xml,*/*"},
    )
    # Codes that mean "the page exists but the server refuses an automated client."
    # Government/multilateral sites (e.g. iadb.org, pib.gov.in) commonly return
    # these to bots while serving humans fine — so they are NOT dead links.
    bot_block = {401, 403, 406, 429}
    try:
        # urlopen follows 3xx redirects by default.
        with urllib.request.urlopen(req, timeout=12) as resp:
            status = getattr(resp, "status", 200) or 200
            resp.read(2048)  # ensure the body is actually served, not just headers
            result = (status < 400, f"HTTP {status}")
    except urllib.error.HTTPError as e:
        if e.code in bot_block:
            result = (True, f"HTTP {e.code} (bot-blocked; verify manually)")
        else:
            result = (False, f"HTTP {e.code}")
    except Exception as e:  # noqa: BLE001 - any network failure is a dead-link signal
        result = (False, type(e).__name__)
    cache[url] = result
    return result


def check_urls(d: dict, strict: bool = False) -> tuple[int, int]:
    """GET-check every source URL. Returns (errors, warnings).

    A single dead link among several is a warning. A reference whose *only*
    source(s) are all unreachable is the serious case: the card is currently
    unverifiable. That escalates to an ERROR under --strict, else a loud warning.
    """
    errors = 0
    warnings = 0
    cache: dict[str, tuple[bool, str]] = {}

    for r in d.get("references", []):
        rid = r.get("id", "<unknown>")
        urls = [(s or {}).get("url", "") for s in r.get("sources", []) if (s or {}).get("url", "")]
        reachable = 0
        for url in urls:
            ok, detail = _probe(url, cache)
            if ok and "bot-blocked" in detail:
                # exists for humans; surface as an informational NOTE, not a warning
                print(f"NOTE:  {detail}: {url}  [{rid}]")
                reachable += 1
            elif ok:
                reachable += 1
            else:
                warn(f"URL unreachable ({detail}): {url}  [{rid}]")
                warnings += 1
        if urls and reachable == 0:
            msg = f"references[{rid}] has NO reachable source — card is currently unverifiable"
            if strict:
                fail(msg)
                errors += 1
            else:
                warn(msg)
                warnings += 1
    return errors, warnings


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
        u_err, u_warn = check_urls(d, strict="--strict" in sys.argv)
        errors += u_err
        warnings += u_warn

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
