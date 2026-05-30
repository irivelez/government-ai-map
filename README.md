# Government & Diplomatic AI Deployments — Global Map

Live site: <https://gov-ai-map.irinavelez.com>

An interactive, data-driven world map of how governments, embassies,
institutions and development banks are deploying AI to deliver services to
citizens. Bilingual (EN/ES), 2D map ⇄ 3D globe, category-filtered, with
sourced references and a guided "Bets" narrative.

The site is **autonomous**: a monthly Claude Code Routine re-grounds and
re-researches the global landscape on the **1st of each month**, and a weekly
routine checks for dead source links every Monday. Both regenerate
[`government-ai-map-data.json`](./government-ai-map-data.json) and commit to
`main`; the push triggers a GitHub Actions workflow that validates the data and
deploys to Cloudflare Pages. No human in the loop on the normal path. See
[`automation/DEPLOY.md`](./automation/DEPLOY.md) for architecture,
[`automation/ROUTINE_PROMPT.md`](./automation/ROUTINE_PROMPT.md) (monthly) and
[`automation/ROUTINE_PROMPT_WEEKLY.md`](./automation/ROUTINE_PROMPT_WEEKLY.md)
(weekly) for the curator instructions.

---

## What's in this repo

| File                              | Role                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| `index.html`                      | The page: markup, all CSS, design system.                           |
| `map.js`                          | All app logic (data loading, 2D/3D render, filtering, narrative).   |
| `government-ai-map-data.json`     | **The single source of content.** Swap this file to update the map. |
| `countries-110m.json`             | Vendored basemap (offline-resilient).                               |
| `scripts/validate.py`             | Schema + **grounding gate** (every card needs a real link) + URL liveness checker. Runs in CI and pre-commit. |
| `automation/ROUTINE_PROMPT.md`    | The monthly content-refresh routine prompt.                         |
| `automation/ROUTINE_PROMPT_WEEKLY.md` | The weekly link-health routine prompt.                          |
| `automation/DEPLOY.md`            | Hosting + autonomous-pipeline architecture.                         |

**Runtime deps (CDN, pinned at runtime):** d3 v7.9.0, topojson-client v3.1.0,
Google Fonts (Space Grotesk, IBM Plex Mono). No build step, no backend.

---

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

`file://` won't work — the page uses `fetch()` and needs an HTTP origin.

## Validate the data

```bash
python3 scripts/validate.py                 # schema only (fast)
python3 scripts/validate.py --check-urls    # also pings every source URL
```

Exit codes: `0` clean · `1` schema error (block deploy) · `2` warnings only.

## Deploy

Push to `main`. The GitHub Actions workflow (`.github/workflows/deploy.yml`)
validates the data, then deploys the static folder to Cloudflare Pages via
wrangler, served at `gov-ai-map.irinavelez.com`. There is no build step.

## Update the data manually

Edit `government-ai-map-data.json`, push to `main`. That's the entire workflow.

## Data schema

See the top of `government-ai-map-data.json` (`meta.schema_notes`) and the
inline comments in `scripts/validate.py`. The short version:

- `meta.categories[]` → marker colors and the legend.
- `references[]` → one map marker each. Required: `id`, `country`,
  `category`, `coordinates { lat, lng }`, `program`, `sources[]`.
- `bets_framing` / `closing_narrative` → the guided narrative; `bets_order`
  and `source_anchors` are arrays of reference `id`s.

## License

MIT — see [`LICENSE`](./LICENSE).
