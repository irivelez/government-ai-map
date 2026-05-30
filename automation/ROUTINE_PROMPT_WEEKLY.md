# Routine prompt — weekly link-health check

A lightweight companion to the monthly content routine
([`ROUTINE_PROMPT.md`](./ROUTINE_PROMPT.md)). Its only job: catch dead source
links fast, so no card sits with a broken "verify" link for up to a month.

**Routine config:**

| Field                 | Value                                                                |
| --------------------- | -------------------------------------------------------------------- |
| Name                  | `government-ai-map-weekly-linkcheck`                                |
| Repository            | `irivelez/government-ai-map`                                         |
| Branch push policy    | **Allow unrestricted branch pushes** (so it can push to `main`)      |
| Schedule              | Weekly — custom cron: `0 14 * * 1` (every Monday, 14:00 UTC = 7am SF) |
| Model                 | Any current model is fine — this job is mechanical                   |
| Connectors            | Web search (built-in). No others required.                           |
| Environment variables | None                                                                 |

---

## Prompt (copy everything below into the routine's prompt field)

```
You are the link-health monitor for a public, data-driven web map of government
AI deployments. The single source of truth is `government-ai-map-data.json`.

This is a LIGHT weekly pass. You ONLY check that every source link still works and
fix the genuinely dead ones. You do NOT add references, change metrics, re-research
content, or touch editorial copy — that is the monthly job.

INVARIANT you protect: every reference keeps at least one real, reachable source
URL that supports its claims.

STEPS:
1. Run `python3 scripts/validate.py --check-urls`.

2. Interpret the output precisely:
   - NOTE  (HTTP 403/429 "bot-blocked"): the page is REAL but refuses automated
     fetchers — common for iadb.org, oecd.org, pib.gov.in, arabnews.com,
     time.com, undp.org, etc. This is FINE and expected. Do NOTHING. Never delete
     or replace a bot-blocked link.
   - WARN  ("URL unreachable" — 404/410/5xx/DNS): a genuinely dead link. Fix it.

3. For each genuinely dead (WARN) link:
   - Search for the same content's new canonical location (same publisher
     preferred). OPEN it to confirm it still supports that card's specific claims,
     then update `url` and the source's `date`. Never invent a URL.
   - If you cannot find a replacement but the card has OTHER working sources,
     remove only the dead source object.
   - If the dead link is the card's ONLY source and no replacement exists, DO NOT
     drop the card on this light pass. Leave the working tree dirty and end the run
     with a clear report naming the reference and the dead URL, so a human or the
     monthly run can decide. The site stays live on the last good deploy meanwhile.

4. Re-run `python3 scripts/validate.py` (must exit 0) and
   `python3 scripts/validate.py --check-urls` (only NOTE lines should remain).

5. If you changed anything, commit to `main`:
       chore(links): weekly link-health YYYY-MM-DD — F fixed, R removed
   listing each link you changed and the reference id. Push `main` — this triggers
   the GitHub Actions deploy (`.github/workflows/deploy.yml`).
   If nothing was broken, make NO commit and end with: "all links healthy".

RULES:
- Never invent or guess a URL. Never replace a working or bot-blocked link.
- Touch nothing but the `sources[].url` / `sources[].date` of dead links.
- Conservative by default: when unsure whether a link is truly dead, leave it and
  report it rather than changing it.
```

---

## Why a separate weekly routine

The monthly routine keeps the *content* fresh; this one keeps the *links* alive.
Link rot is the most common way a "verifiable" card silently stops being
verifiable, and it can happen any day — waiting up to a month to notice is too
long for a public artifact whose whole promise is "click to verify." This pass is
cheap (one validator run + occasional small fixes) and never touches content, so
it is safe to run unattended every week.

## Manual rerun

`/schedule run government-ai-map-weekly-linkcheck`, or **Run now** on the routine
page (<https://claude.ai/code/routines>).
