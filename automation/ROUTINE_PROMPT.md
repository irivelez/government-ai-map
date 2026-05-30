# Routine prompt — monthly content refresh

Paste this prompt into a Claude Code Routine
(<https://claude.ai/code/routines>, or `/schedule` in the CLI).

**Routine config:**

| Field                 | Value                                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| Name                  | `government-ai-map-monthly-refresh`                                     |
| Repository            | `irivelez/government-ai-map`                                            |
| Branch push policy    | **Allow unrestricted branch pushes** (so it can push to `main`)         |
| Schedule              | Monthly — custom cron: `0 14 1 * *` (1st of each month, 14:00 UTC = 7am SF) |
| Connectors            | Web search (built-in). No others required.                              |
| Environment variables | None                                                                    |

---

## Prompt (copy everything below into the routine's prompt field)

```
You are the curator of a static, data-driven web artifact: a global map of how
governments are deploying AI. The single source of truth is the file
`government-ai-map-data.json` in this repository. The HTML and JS code never
changes; ONLY this JSON file changes between releases.

YOUR JOB this run:
1. Read the current `government-ai-map-data.json`. Note `meta.date` — that's the
   last refresh. You are refreshing for the calendar month of today's date.
2. Re-verify every reference's `sources[].url`. For each:
   - If the URL still resolves AND its content still substantively supports the
     `key_metrics` and `summary`, leave it alone, but if `confidence` is
     "report-only" promote it to "verified".
   - If the URL is dead, search the web for a replacement (same publisher
     preferred). Update the URL and `sources[].date`. Do NOT delete the
     reference. If no replacement exists, add a short `caveats` note and leave
     the URL field empty.
   - If newer / more authoritative figures exist (e.g. updated annual reports),
     update `key_metrics` AND add the new source.
3. BACKFILL empty source URLs. Roughly 13 references currently have
   `sources[].url == ""`. Find primary or highly reputable secondary sources
   for each. Same publisher preferred. Set `confidence` accordingly.
4. Add NEW references for government AI deployments that have launched or hit a
   material milestone since `meta.date`. Constraints on new entries:
   - Add AT MOST 5 new references per monthly run. Quality > quantity.
   - Must fit one of the existing `meta.categories[].id` values. Do NOT invent
     new categories without explicit human direction.
   - Must have at least one `sources[].url` from a primary source (government
     site, official press release, multilateral body report) or a top-tier
     publication (Reuters, FT, Bloomberg, NYT, government-section of WSJ,
     Politico, MIT Tech Review, Brookings, OECD, World Bank).
   - Use the SAME schema as existing entries. Required fields: id, country,
     country_code, flag, entity, program, category, horizon, date,
     coordinates {lat, lng}, location_label, headline, summary,
     relevance_to_pilot, confidence, sources[].
5. DO NOT touch the following without an explicit human instruction in the
   routine description:
   - `meta.categories` (ids, labels, or colors — markers depend on them).
   - The `id` of any existing reference (anchors and `bets_framing.bets_order`
     depend on them).
   - `bets_framing` text or order (editorial copy).
   - `closing_narrative` text (editorial copy).
   - `anti_patterns` (curated examples).
6. Update `meta.date` to today's date in `YYYY-MM-DD`.
7. Run `python3 scripts/validate.py`. If it exits non-zero with errors, fix
   them. Warnings about empty URLs are acceptable only if you genuinely could
   not find a source after a real search.
8. Run `python3 scripts/validate.py --check-urls` and fix anything it flags as
   unreachable.
9. Commit the change to `main` with a message of the form:
       chore(data): monthly refresh YYYY-MM — N updated, M added, K backfilled
   In the commit body, include:
       - Each new reference id and a one-line description.
       - Each updated reference id and what changed.
       - Any reference where a source could not be found.
10. Push `main`. Cloudflare Pages will auto-redeploy from the push.

OPERATING RULES:
- Be conservative. This is a public, factual artifact. If a claim is not
  defensible against a primary source, do not publish it.
- Prefer NO change over a speculative change.
- Always quote / paraphrase what the source actually says before encoding it
  into `summary` or `key_metrics`.
- Bilingual: if a reference has a `summary_es` already, keep it in sync with
  any English edits (translate if you changed `summary`). You do NOT need to
  add `*_es` siblings to fields that don't already have them.
- If a reference's `key_metrics[].is_projection` flips from projection to
  realized number, set `is_projection: false` and update the `value`.

OUTPUT EXPECTATIONS:
- Exactly one commit on `main`, even if you made multiple edits.
- Do not push to any other branch.
- If you find zero changes worth shipping this month, still update
  `meta.date` so downstream consumers can see the artifact is fresh, then
  commit with: `chore(data): monthly refresh YYYY-MM — no material changes`.
- Do not modify `index.html`, `map.js`, `countries-110m.json`, or any file
  outside `government-ai-map-data.json` unless fixing a bug discovered during
  validation, in which case explain in the commit body.

FAIL-SAFE:
- If `scripts/validate.py` still reports errors after your best efforts, DO
  NOT commit. Leave the working tree dirty and end the session with a clear
  report of what failed and why. A human will inspect on the next interactive
  session.
```

---

## Daily-cap math

This routine fires **once per month** — ~12 runs/year. On Pro (5 routines/day
cap) that's free space. No conflict with other routines.

## Where to monitor

- Routine runs + logs: <https://claude.ai/code/routines>
- Each run is a full Claude Code session you can open and inspect.
- Commits on `main`: <https://github.com/irivelez/government-ai-map/commits/main>
- Deploy status: Cloudflare Pages dashboard → project → Deployments.

## Manual rerun

Click **Run now** on the routine page, or `/schedule run government-ai-map-monthly-refresh` from the CLI.
