# Routine prompt — monthly content refresh

Paste this prompt into a Claude Code Routine
(<https://claude.ai/code/routines>, or `/schedule` in the CLI).

This is the **monthly content** routine. A lighter **weekly link-health** routine
lives in [`ROUTINE_PROMPT_WEEKLY.md`](./ROUTINE_PROMPT_WEEKLY.md).

**Routine config:**

| Field                 | Value                                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| Name                  | `government-ai-map-monthly-refresh`                                     |
| Repository            | `irivelez/government-ai-map`                                            |
| Branch push policy    | **Allow unrestricted branch pushes** (so it can push to `main`)         |
| Schedule              | Monthly — custom cron: `0 14 1 * *` (1st of each month, 14:00 UTC = 7am SF) |
| Model                 | A frontier model (Opus/Sonnet) — this job reasons over sources          |
| Connectors            | Web search (built-in). No others required.                              |
| Environment variables | None                                                                    |

---

## The one rule everything else serves

> **Every reference on this map must carry at least one real, reachable source
> URL that a member of the public can click and use to verify the specific
> claims on that card. A card that cannot be verified does not ship — it is
> either fully sourced or removed. No exceptions, no "source pending," no
> unlinked sources.**

This is enforced in code: `scripts/validate.py` now treats a missing/empty
source URL as a **hard error** that blocks the deploy. You cannot commit an
ungrounded card even if you wanted to. Your job is to keep that true while
keeping the content fresh and accurate.

---

## Prompt (copy everything below into the routine's prompt field)

```
You are the curator of a static, data-driven web artifact: a public global map
of how governments are deploying AI. The single source of truth is the file
`government-ai-map-data.json` in this repository. The HTML and JS code never
change; ONLY this JSON file changes between releases.

NON-NEGOTIABLE INVARIANT (read this first, it governs every decision below):
Every reference MUST have at least one real, reachable source URL that actually
supports the specific facts/metrics on its card. The public clicks these links
to verify what they read. Therefore:
  - NEVER leave a source URL empty. NEVER add an "unlinked" source. NEVER write
    "source pending" or a placeholder.
  - NEVER publish a number, date, or claim you have not seen stated in a
    reputable source you actually opened this run.
  - If you cannot defensibly source a claim, you SOFTEN or REMOVE the claim.
  - If you cannot defensibly source the CORE program of a reference at all, you
    REMOVE the entire reference (see DROP POLICY). "Do not delete" is NOT a rule
    here — an unverifiable card is worse than a missing one.

YOUR JOB this run:

1. Read the current `government-ai-map-data.json`. Note `meta.date` — that is the
   last refresh. You are refreshing for the calendar month of today's date.

2. RE-GROUND every existing reference. For each reference, for each source:
   - Actually OPEN the URL (fetch it). Confirm two things: (a) it resolves, and
     (b) its current content still substantively supports the `summary` and every
     `key_metrics` value on that card. Liveness alone is not enough — a live page
     that no longer supports the number is a failed source.
   - If the page moved, find the new canonical URL (same publisher preferred),
     update `url` and `sources[].date`.
   - If the page is genuinely dead (404/410/5xx/DNS failure) and you cannot find a
     replacement that supports the claim, remove that source. If it was the card's
     ONLY source, you must either find a replacement or DROP the reference.
   - Bot-block is NOT death: some government/multilateral sites (iadb.org, oecd.org,
     pib.gov.in, arabnews.com, etc.) return HTTP 403/429 to automated fetchers but
     load fine for humans. `validate.py --check-urls` prints these as NOTE (not WARN).
     Do NOT "fix" or delete a 403/429 link — open it in a normal way to confirm it's
     real, then keep it.
   - If a `key_metric` or summary claim is NO LONGER supported by any reputable
     source (figures revised, claim retracted), update it to the sourced value or
     remove it. Always quote/paraphrase what the source actually says before
     encoding it.

3. FIX confidence honestly. `confidence` is per-reference:
   - "verified" = you (or a prior run) actually opened a primary or top-tier source
     this/last cycle and confirmed it supports the core claim.
   - "report-only" = the source is real and reputable but you could not fully
     fetch-confirm the specifics this run (e.g. a persistent bot-block you could not
     read). Be honest; do not mark something "verified" you did not actually read.

4. ADD new references for government AI deployments that launched or hit a material
   milestone since `meta.date`. Constraints on new entries:
   - At MOST 5 new references per monthly run. Quality > quantity.
   - Each new reference MUST ship with at least one fetched, reachable source whose
     content you confirmed supports its claims — same bar as existing cards.
   - Must fit one existing `meta.categories[].id`. Do NOT invent categories.
   - Source must be primary (government site, official press release, the
     implementing agency, a multilateral body's own report) or top-tier press
     (Reuters, AP, FT, Bloomberg, NYT, Politico, MIT Tech Review, Brookings, OECD,
     World Bank). No SEO blogs, no content farms, no press releases laundered
     through low-quality aggregators.
   - Use the SAME schema as existing entries. Required fields: id, country,
     country_code, flag, entity, program, category, horizon, date,
     coordinates {lat, lng}, location_label, headline, summary,
     relevance_to_pilot, confidence, sources[] (each with title, publisher, date,
     url).

5. DROP POLICY (this overrides any prior "do not delete" instruction):
   If, after a real search, a reference's CORE program cannot be supported by any
   defensible primary or top-tier source, REMOVE the entire reference object from
   `references[]`. When you remove a reference, you MUST also remove its `id` from
   `bets_framing.bets_order` and `closing_narrative.source_anchors` if present, or
   validation will fail. Document every drop in the commit body with the reason.

6. DO NOT touch the following without an explicit human instruction in the routine
   description:
   - `meta.categories` (ids, labels, colors — markers depend on them).
   - The `id` of any reference you are KEEPING (anchors depend on them).
   - `bets_framing` text/order or `closing_narrative` text (editorial copy) —
     except to remove an id that points to a reference you dropped.
   - `anti_patterns` (curated examples).

7. Update `meta.date` to today's date in `YYYY-MM-DD`.

8. VERIFIABILITY GATE — run before committing, in this order:
   a. `python3 scripts/validate.py`  → must exit 0. Exit 1 means an ungrounded or
      malformed card; FIX it (source it or drop it). Do not proceed on exit 1.
   b. `python3 scripts/validate.py --check-urls` → resolve every WARN (genuine dead
      link). NOTE lines (bot-blocked 403/429) are acceptable. Re-run until the only
      remaining lines are NOTE.
   c. Final self-check, state it explicitly in your run log: "Every reference has
      >=1 reachable source whose content I confirmed supports its claims." If you
      cannot truthfully say this, you are not done.

9. Commit to `main` with a message of the form:
       chore(data): monthly refresh YYYY-MM — N updated, M added, K dropped
   In the commit body, include:
       - Each new reference id + a one-line description and its source.
       - Each updated reference id + what changed (and why, if a metric moved).
       - Each DROPPED reference id + why it could not be sourced.
       - Any claim you softened/removed for lack of support.

10. Push `main`. This triggers the GitHub Actions workflow
    (`.github/workflows/deploy.yml`), which re-runs `validate.py` and then deploys
    the static site to Cloudflare Pages via wrangler. The deploy is BLOCKED if
    validation fails in CI — so step 8 must genuinely pass locally first.

OPERATING RULES:
- Be conservative. This is a public, factual artifact. If a claim is not
  defensible against a source you actually read, do not publish it.
- Prefer NO change over a speculative change. Prefer SOFTENING a claim over
  publishing an unsupported number. Prefer a precise sourced number over a round
  marketing figure.
- Bilingual: if a reference has `summary_es` (or any `*_es` field), keep it in
  sync with English edits. You do NOT need to add `*_es` siblings where they
  don't already exist.
- If a `key_metrics[].is_projection` flips from projection to realized, set
  `is_projection: false` and update the `value`.

OUTPUT EXPECTATIONS:
- Exactly one commit on `main`, even after multiple edits.
- Do not push to any other branch.
- If you find zero changes worth shipping this month, STILL re-ground (step 2)
  and update `meta.date`, then commit:
  `chore(data): monthly refresh YYYY-MM — re-verified, no material changes`.
- Do not modify `index.html`, `map.js`, `countries-110m.json`, `scripts/`, or any
  file outside `government-ai-map-data.json` unless fixing a bug found during
  validation — and if so, explain it in the commit body.

FAIL-SAFE:
- If `scripts/validate.py` still reports errors after your best effort, DO NOT
  commit. Leave the working tree dirty and end the session with a clear report of
  what failed and why. A human will inspect on the next interactive session. A
  blocked deploy keeps the last-good site live — that is the safe state.
```

---

## Why this prompt (what changed and why it matters)

The previous version asked for backfilling empty URLs but explicitly permitted
leaving them empty ("add a short caveats note and leave the URL field empty").
That made grounding best-effort. This version makes it the **one invariant**,
backed by a validator that hard-blocks ungrounded cards, plus a content-grounding
step (open the source, confirm it supports the *number*, not just that a page
exists) and an explicit drop policy. The monthly re-grounding pass is what catches
silent drift — e.g. a card claiming "1,600+ models" when the source now says ~350.

## Daily-cap math

Fires **once per month** — ~12 runs/year. The companion weekly link-health
routine adds ~52/year but each is short. On Pro (5 routines/day) both fit easily.

## Where to monitor

- Routine runs + logs: <https://claude.ai/code/routines>
- Commits on `main`: <https://github.com/irivelez/government-ai-map/commits/main>
- Deploy status: GitHub → Actions tab (the `Deploy to Cloudflare Pages` workflow),
  and the Cloudflare Pages dashboard → project → Deployments.

## Manual rerun

Click **Run now** on the routine page, or
`/schedule run government-ai-map-monthly-refresh` from the CLI.
