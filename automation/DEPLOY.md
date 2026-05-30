# How this site is hosted and auto-updated

```
                 ┌─────────────────────────────────────────────┐
                 │   Claude Code Routine (Anthropic cloud)     │
                 │   schedule: monthly  (0 14 1 * *  UTC)      │
                 │                                             │
                 │   1. Clones irivelez/government-ai-map      │
                 │   2. Re-verifies every source URL           │
                 │   3. Adds new gov AI deployments (≤5/mo)    │
                 │   4. Runs scripts/validate.py               │
                 │   5. Commits + pushes to main               │
                 └──────────────────┬──────────────────────────┘
                                    │ git push main
                                    ▼
                 ┌─────────────────────────────────────────────┐
                 │   GitHub:  irivelez/government-ai-map       │
                 └──────────────────┬──────────────────────────┘
                                    │ webhook
                                    ▼
                 ┌─────────────────────────────────────────────┐
                 │   Cloudflare Pages                          │
                 │   - Builds: none (static)                   │
                 │   - Deploys: full folder                    │
                 │   - Cache invalidation: automatic           │
                 └──────────────────┬──────────────────────────┘
                                    │ CNAME (auto)
                                    ▼
                 ┌─────────────────────────────────────────────┐
                 │   https://gov-ai-map.irinavelez.com         │
                 └─────────────────────────────────────────────┘
```

## One-time setup

### 1. Cloudflare Pages → connect this repo

1. Go to <https://dash.cloudflare.com> → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Authorize the GitHub app to access `irivelez/government-ai-map`.
3. Pick the repo. Project name: `government-ai-map` (auto-fills).
4. Build settings:
   - Framework preset: **None**
   - Build command: *(empty)*
   - Build output directory: `/` (the repo root *is* the site)
   - Root directory: *(empty)*
   - Environment variables: none
5. Click **Save and Deploy**. First deploy takes ~20 seconds.
6. You now have a default URL like `government-ai-map.pages.dev`. Test it.

### 2. Custom domain

In the Pages project → **Custom domains** → **Set up a custom domain** →
`gov-ai-map.irinavelez.com` → **Activate**.

Because `irinavelez.com` is on the same Cloudflare account, the CNAME is
created automatically. SSL provisions within ~1 minute.

### 3. Claude Code Routine

See `ROUTINE_PROMPT.md` in this folder. Paste the prompt at
<https://claude.ai/code/routines> → **New routine**.

That's it. Total wall-clock setup time: ~5 minutes after the GitHub repo is
pushed.

## Manual ops cheatsheet

| Action                              | How                                                                  |
| ----------------------------------- | -------------------------------------------------------------------- |
| Edit the JSON by hand               | Push to `main`. Cloudflare redeploys in ~30s.                        |
| Run validation locally              | `python3 scripts/validate.py`                                        |
| Run validation + URL-check locally  | `python3 scripts/validate.py --check-urls`                           |
| Fire the routine right now          | `/schedule run government-ai-map-monthly-refresh` in Claude Code CLI |
| Roll back a deploy                  | Cloudflare Pages → Deployments → previous deploy → **Rollback**      |
| Pause the auto-refresh              | Routine page → toggle **Repeats** off                                |
| Tweak the routine prompt            | Routine page → edit. Takes effect next run.                          |

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

`file://` will not work — the page uses `fetch()` and needs an HTTP origin.
