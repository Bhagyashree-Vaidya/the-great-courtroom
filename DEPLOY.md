# Deploying LinkedIn Council

Two pieces deploy separately, mirroring the JobPilot setup:

- **Backend** (FastAPI, holds the OpenRouter key) -> Fly.io
- **Frontend** (React/Vite static site) -> Vercel
- Custom domain: `council.shreevaidya.com` -> the Vercel frontend

The frontend talks to the backend over HTTPS. The backend is gated by a shared
password (`COUNCIL_PASSWORD`) so strangers cannot spend your OpenRouter credits.

---

## 1. Backend on Fly.io

From the repo root (`~/Desktop/Jobs/llm-council`):

```bash
# One-time: create the app without deploying yet.
fly launch --no-deploy --copy-config --name linkedin-council-api

# Set secrets (these never go in git). Use a strong password.
fly secrets set \
  OPENROUTER_API_KEY="sk-or-v1-..." \
  COUNCIL_PASSWORD="pick-a-strong-password" \
  ALLOWED_ORIGINS="https://council.shreevaidya.com"

# Deploy.
fly deploy
```

After it deploys, note the backend URL (e.g. `https://linkedin-council-api.fly.dev`).
Verify it:

```bash
curl https://linkedin-council-api.fly.dev/        # -> {"status":"ok",...}
```

If you later change the frontend domain, update `ALLOWED_ORIGINS`:

```bash
fly secrets set ALLOWED_ORIGINS="https://council.shreevaidya.com"
```

## 2. Frontend on Vercel

In the Vercel dashboard: **Add New Project** -> import the `llm-council` repo.

- **Root Directory**: `frontend`
- **Framework Preset**: Vite (auto-detected via `frontend/vercel.json`)
- **Environment Variable**: add
  `VITE_API_BASE = https://linkedin-council-api.fly.dev`
  (the Fly URL from step 1, no trailing slash)

Deploy. Vercel gives you a `*.vercel.app` URL. Open it, enter the password,
and confirm a full council run works end to end.

## 3. Custom domain

In Vercel project -> **Settings -> Domains**, add `council.shreevaidya.com`.
Vercel shows a CNAME (or A) record to add at your DNS provider. Add it, wait for
it to verify, then make sure `ALLOWED_ORIGINS` on Fly matches exactly:

```bash
fly secrets set ALLOWED_ORIGINS="https://council.shreevaidya.com"
```

## 4. Spend backstop (do this once)

In the OpenRouter dashboard, set a hard monthly limit on the key (e.g. $10) so
even a leaked password caps the worst case. Settings -> Keys -> edit the key.

---

## Notes

- **Conversation history is ephemeral.** Fly's filesystem resets on each deploy,
  so old conversations disappear. Fine for a draft tool. To persist, add a Fly
  volume mounted at `/app/data` and set `DATA_DIR=/app/data/conversations`.
- **The gate is off locally.** With no `COUNCIL_PASSWORD` in your local `.env`,
  `./start.sh` runs ungated as before.
- **Costs.** Fly's free-tier machine auto-stops when idle (`min_machines_running = 0`),
  so the backend costs ~nothing when nobody is using it. First request after idle
  has a few seconds of cold start.
