# Replit → GitHub → Render Deployment Guide
### A Reusable Workflow for Cost-Efficient App Deployment

---

## Overview

This guide standardizes a zero-to-production workflow for apps built on Replit, version-controlled on GitHub, and hosted on Render.

```
Replit          →       GitHub        →       Render
(development)       (version control)        (hosting)
```

- **Replit** — where you build and test
- **GitHub** — where your code lives and acts as the deploy trigger
- **Render** — where your app runs in production

**Cost:** Free for most small apps (Render free tier + GitHub free tier)

---

## Part 1 — Prepare the App in Replit

### 1.1 Verify production readiness

Before pushing anything, confirm these three things in your app:

**Port binding** — Your server must read the port from an environment variable:
```javascript
// Node.js / Express
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log(`Listening on port ${port}`));
```
```python
# Python / Flask or FastAPI
port = int(os.environ.get("PORT", 8000))
app.run(host="0.0.0.0", port=port)
```
Render assigns a random port at runtime. If your app hardcodes a port, it will not start.

**Start script** — Your `package.json` (Node.js) must have a `start` script:
```json
"scripts": {
  "build": "...",
  "start": "node dist/index.js"
}
```
For Python, Render will use a start command you specify manually.

**No Replit-specific dependencies** — Remove or replace anything that only works inside Replit:
- Replit object storage (replace with local disk, Cloudinary, or S3)
- Replit database client (replace with a standard PostgreSQL client)
- Any `REPL_ID` or `REPL_SLUG` environment variable usage in production paths

### 1.2 Handle environment variables correctly

Never hardcode secrets. Use `process.env.VARIABLE_NAME` for all:
- Database connection strings
- Session secrets
- API keys
- Any value that differs between development and production

In Replit, set development values in the Secrets panel (left sidebar → lock icon).
On Render, set production values in the dashboard (covered in Part 3).

### 1.3 Create the `render.yaml` file

Add a `render.yaml` to the root of your project. This is the infrastructure-as-code file that tells Render exactly how to build and run your app.

**Template for a Node.js app with PostgreSQL:**
```yaml
databases:
  - name: my-app-db
    plan: free
    databaseName: myapp
    user: myapp
    region: oregon

services:
  - type: web
    name: my-app
    plan: free
    runtime: node
    region: oregon
    branch: main
    buildCommand: npm install --include=dev && npm run build && npm run db:push
    startCommand: npm start
    healthCheckPath: /
    envVars:
      - key: NODE_ENV
        value: production
      - key: SESSION_SECRET
        generateValue: true
      - key: DATABASE_URL
        fromDatabase:
          name: my-app-db
          property: connectionString
```

**Template for a Node.js app without a database:**
```yaml
services:
  - type: web
    name: my-app
    plan: free
    runtime: node
    region: oregon
    branch: main
    buildCommand: npm install --include=dev && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

**Template for a Python (Flask/FastAPI) app:**
```yaml
services:
  - type: web
    name: my-app
    plan: free
    runtime: python
    region: oregon
    branch: main
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app
    envVars:
      - key: PYTHON_VERSION
        value: "3.11.0"
```

> **Key rule for Node.js:** Always use `npm install --include=dev` as the install step,
> not plain `npm install`. When `NODE_ENV=production` is set, plain `npm install`
> skips devDependencies — including build tools like `vite`, `esbuild`, and `tsx`.

### 1.4 Create a `.gitignore` file

Make sure these are never pushed to GitHub:
```
node_modules/
dist/
.env
*.log
uploads/
.replit
replit.nix
.local/
```

---

## Part 2 — Set Up GitHub

### 2.1 Create the GitHub repository

1. Go to [github.com](https://github.com) → **New repository**
2. Name it (e.g. `my-app`)
3. Set to **Private** (recommended for business apps)
4. Do not initialize with README (your project already has files)
5. Click **Create repository**

### 2.2 Connect Replit to GitHub (first time only)

In the Replit shell:
```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
```

### 2.3 Push your code

```bash
git add .
git commit -m "Initial commit"
git push -u origin main
```

For all future updates:
```bash
git add .
git commit -m "Describe what you changed"
git push origin main
```

### 2.4 Branch strategy (recommended)

For solo projects, working directly on `main` is fine.
For team projects or when you want a safety net:
```bash
# Create a feature branch
git checkout -b feature/my-new-feature

# Push the branch
git push origin feature/my-new-feature

# Merge to main when ready (via GitHub Pull Request)
```

Only pushes to `main` trigger automatic deploys on Render.

---

## Part 3 — Deploy on Render

### 3.1 Create a Render account

Go to [render.com](https://render.com) and sign up with your GitHub account.
This automatically connects Render to your GitHub repositories.

### 3.2 Deploy using the Blueprint (render.yaml)

1. In the Render dashboard, click **New** → **Blueprint**
2. Select your GitHub repository
3. Render reads your `render.yaml` and shows a preview of all resources it will create
4. Review the list, then click **Apply**

Render will:
- Create the PostgreSQL database (if defined)
- Create the web service
- Link the database URL to the service automatically
- Start the first build immediately

### 3.3 Add environment variables

After the Blueprint is applied, go to your web service → **Environment** → **Environment Variables** and add any secrets not in `render.yaml`:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Auto-filled if using `fromDatabase` | — |
| `SESSION_SECRET` | Auto-filled if using `generateValue: true` | — |
| `API_KEY` | Any third-party API key | `sk-abc123...` |
| `UPLOADS_DIR` | Where to store uploaded files | `/tmp/uploads` |

> Never put secrets directly in `render.yaml` — that file is committed to GitHub.
> Use `generateValue: true` for auto-generated secrets, or add them manually in the dashboard.

### 3.4 Monitor the first build

Click on the web service → **Logs** tab. You will see the build steps run in sequence. A successful build ends with your start command running and a line like:
```
Server listening on port 10000
```

**Expected build time:** 3–8 minutes on the first deploy, 2–4 minutes on subsequent deploys.

### 3.5 Access your live app

Once the service status shows **Live**, your app is available at:
```
https://your-app-name.onrender.com
```
The URL is shown at the top of the web service page.

---

## Part 4 — Ongoing Workflow

### Every code change follows this loop:

```
1. Edit code in Replit
2. Test locally in Replit's preview
3. git add . && git commit -m "What changed"
4. git push origin main
5. Render auto-detects the push and deploys in ~4 minutes
6. Live app updates automatically
```

No manual steps on Render are needed after initial setup.

### What deploys replace vs. preserve:

| Item | On deploy |
|---|---|
| Application code | ✅ Replaced with latest version |
| Database rows (your data) | ❌ Never touched |
| Database structure (schema) | Only updated if you changed the schema |
| Environment variables | ❌ Never touched |
| Uploaded files (local disk) | ⚠️ Lost on free tier (see below) |

---

## Part 5 — Cost and Performance Best Practices

### Free tier facts

| Resource | Free limit | Expiry |
|---|---|---|
| Web service | 750 hours/month | Never (enough for 1 active service) |
| PostgreSQL | 256 MB storage | **Deleted after 90 days** |
| Bandwidth | 100 GB/month | — |
| Build minutes | 500/month | — |

### Keep costs at $0

- **One free web service** is enough for most apps
- Use Render's **free PostgreSQL** for development and small production apps
- Set a calendar reminder at day 80 to renew or upgrade the database before it expires
- Use `/tmp/` for file uploads on free tier (ephemeral but free)

### Avoid the free tier sleep

Free web services sleep after 15 minutes of inactivity. The first request after sleep takes 30–60 seconds. Options:
- **Accept it** — fine for internal tools used during business hours
- **UptimeRobot** (free) — pings your app every 5 minutes to keep it awake
- **Starter plan ($7/month)** — no sleep, always on

### File uploads on free tier

Free Render services have no persistent disk. Files uploaded by users are lost on every restart. Solutions by cost:

| Solution | Cost | Notes |
|---|---|---|
| `/tmp/` (current) | Free | Files lost on restart — OK for testing |
| Render Disk | $1/month per GB | Persistent, easiest to set up |
| Cloudinary | Free tier (25 GB) | Best for images, requires code changes |
| Backblaze B2 | Free tier (10 GB) | S3-compatible, requires code changes |

---

## Part 6 — Common Pitfalls and Fixes

| Problem | Cause | Fix |
|---|---|---|
| `tsx: not found` during build | `NODE_ENV=production` skips devDependencies | Use `npm install --include=dev` |
| App crashes on start | Port hardcoded | Use `process.env.PORT` |
| `DATABASE_URL must be set` | Env var not linked | Use `fromDatabase` in render.yaml or add manually |
| Build times out | Build over 15 minutes | Check for hanging processes in build script |
| DB schema error on startup | db:push failed during build | Check build logs for the db:push step |
| Files disappear after deploy | Ephemeral free tier disk | Use `/tmp/` for now, add a Render Disk for persistence |
| Free DB deleted | 90-day expiry | Upgrade to paid DB or recreate and restore from backup |
| App works on Replit but not Render | Replit-specific dependency | Audit code for Replit-only imports |

---

## Quick Reference Card

```
REPLIT CHECKLIST (before every push)
  □ Port reads from process.env.PORT
  □ No hardcoded secrets
  □ .gitignore includes node_modules, .env, dist, uploads
  □ render.yaml exists in project root
  □ npm run build works without errors

PUSH COMMANDS
  git add .
  git commit -m "Description of change"
  git push origin main

RENDER CHECKLIST (first deployment only)
  □ New → Blueprint → select repo → Apply
  □ Add any secrets not in render.yaml
  □ Wait for build to complete (~5 min)
  □ Visit the .onrender.com URL

RECURRING REMINDERS
  □ Day 80 after DB creation: renew or upgrade PostgreSQL
  □ Monitor bandwidth if your app grows
```
