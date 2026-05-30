# How this site is hosted and auto-updated

```
        ┌──────────────────────────────────────────────────────┐
        │  Claude Code Routines (Anthropic cloud)               │
        │   • monthly content refresh   cron  0 14 1 * *  (UTC) │
        │   • weekly  link-health       cron  0 14 * * 1  (UTC) │
        │                                                       │
        │   re-grounds / fixes government-ai-map-data.json,     │
        │   runs scripts/validate.py, commits + pushes main     │
        └───────────────────────────┬──────────────────────────┘
                                     │ git push main
                                     ▼
        ┌──────────────────────────────────────────────────────┐
        │  GitHub: irivelez/government-ai-map  (branch: main)   │
        └───────────────────────────┬──────────────────────────┘
                                     │ on: push → triggers
                                     ▼
        ┌──────────────────────────────────────────────────────┐
        │  GitHub Actions — .github/workflows/deploy.yml        │
        │   1. python3 scripts/validate.py  (grounding gate;    │
        │      a missing source link is a hard error → blocks)  │
        │   2. npx wrangler pages deploy .  (Direct Upload)     │
        └───────────────────────────┬──────────────────────────┘
                                     │ wrangler Direct Upload (API token)
                                     ▼
        ┌──────────────────────────────────────────────────────┐
        │  Cloudflare Pages  (project: government-ai-map)       │
        │   - source: Direct Upload  (NOT connected to Git)     │
        │   - build: none (static); serves the repo folder      │
        └───────────────────────────┬──────────────────────────┘
                                     │ CNAME (auto, same CF account)
                                     ▼
        ┌──────────────────────────────────────────────────────┐
        │  https://gov-ai-map.irinavelez.com                    │
        └──────────────────────────────────────────────────────┘
```

**The deploy is driven by GitHub Actions + wrangler — not by a Cloudflare "Connect
to Git" integration.** The Cloudflare Pages project is a *Direct Upload* project;
the only thing that publishes to it is the Actions workflow running
`wrangler pages deploy`. This matters: if you ALSO connect the repo via Cloudflare's
Git integration, every push deploys twice (once from Cloudflare's build, once from
Actions). Keep it Direct-Upload-only. See "Confirm you are not double-deploying" below.

## One-time setup

### 1. Cloudflare Pages project (Direct Upload — do NOT connect Git)

The project is named `government-ai-map`. It is created the first time
`wrangler pages deploy . --project-name=government-ai-map` runs (the workflow does
this), or you can pre-create it: **Workers & Pages → Create application → Pages →
Upload assets**, name it `government-ai-map`.

Do **not** use **Connect to Git** for this project. This repo deploys through
GitHub Actions; a Git connection would double-deploy.

### 2. GitHub Actions secrets

The workflow authenticates to Cloudflare with two repo secrets
(**Settings → Secrets and variables → Actions → New repository secret**):

| Secret                  | What it is                                                       | Length |
| ----------------------- | ---------------------------------------------------------------- | ------ |
| `CLOUDFLARE_API_TOKEN`  | Token with the **Cloudflare Pages → Edit** permission.           | 53     |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID (Pages project → right sidebar).      | 32     |

(The workflow prints these lengths — not the values — as a sanity check on each run.)

On every push to `main`, `.github/workflows/deploy.yml`:
1. runs `python3 scripts/validate.py` — exit 1 (schema / ungrounded card) **blocks
   the deploy**; exit 2 (warnings only) is allowed through;
2. runs `npx wrangler pages deploy . --project-name=government-ai-map --branch=main`.

There is no build step — the repo root *is* the site.

### 3. Custom domain

In the Pages project → **Custom domains** → **Set up a custom domain** →
`gov-ai-map.irinavelez.com` → **Activate**. Because `irinavelez.com` is on the same
Cloudflare account, the CNAME is created automatically; SSL provisions within ~1 min.

### 4. Claude Code Routines

Two routines keep the data fresh and grounded (created via the `/schedule` skill or
pasted at <https://claude.ai/code/routines>):

- **Monthly content refresh** — prompt in [`ROUTINE_PROMPT.md`](./ROUTINE_PROMPT.md),
  cron `0 14 1 * *`.
- **Weekly link-health** — prompt in [`ROUTINE_PROMPT_WEEKLY.md`](./ROUTINE_PROMPT_WEEKLY.md),
  cron `0 14 * * 1`.

Both clone `irivelez/government-ai-map`, edit only `government-ai-map-data.json`,
and push to `main` (which triggers the Actions deploy above). Each run is a full
Claude Code session you can open and inspect.

## Confirm you are not double-deploying

A Cloudflare *Git* integration always leaves traces on GitHub. To check this repo is
Direct-Upload-only (verified for this repo on 2026-05-30 — all four were absent):

```bash
gh api repos/irivelez/government-ai-map/deployments        # CF Git creates GitHub Deployments; expect []
gh api repos/irivelez/government-ai-map/environments       # CF Git registers Production/Preview; expect none
gh api repos/irivelez/government-ai-map/hooks              # expect no Cloudflare webhook
gh api repos/irivelez/government-ai-map/commits/main/check-runs --jq '.check_runs[].name'
#   → only "validate-and-deploy" (github-actions). A "Cloudflare Pages" check here
#     would mean the Git integration is also live → disconnect it in the CF dashboard.
```

Authoritative confirmation (needs Cloudflare access): **Pages project → Settings →
Builds & deployments** should show **Direct Upload** with no connected Git repository.

## Manual ops cheatsheet

| Action                              | How                                                                  |
| ----------------------------------- | -------------------------------------------------------------------- |
| Edit the JSON by hand               | Push to `main`. GitHub Actions validates + redeploys in ~30s.        |
| Run validation locally              | `python3 scripts/validate.py`                                        |
| Run validation + URL-check locally  | `python3 scripts/validate.py --check-urls`                           |
| Fire the monthly routine now        | `/schedule run government-ai-map-monthly-refresh` (or **Run now** in the routines UI) |
| Fire the weekly link-check now      | `/schedule run government-ai-map-weekly-linkcheck`                   |
| Watch a deploy                      | GitHub → **Actions** tab → `Deploy to Cloudflare Pages`              |
| Roll back a deploy                  | Cloudflare Pages → Deployments → previous deploy → **Rollback**      |
| Pause an auto-refresh routine       | Routines page → toggle the routine **off**                          |
| Tweak a routine prompt              | Routines page → edit (or re-run `/schedule`). Takes effect next run. |

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

`file://` will not work — the page uses `fetch()` and needs an HTTP origin.
