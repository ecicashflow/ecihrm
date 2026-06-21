# Deployment Guide — ECI HRM Performance Appraisal System

This guide walks you through deploying the ECI HRM system to **GitHub** (source), **Neon** (PostgreSQL database), and **Vercel** (hosting). The entire process takes about 20–30 minutes.

---

## Prerequisites

- A [GitHub](https://github.com) account
- A [Neon](https://neon.tech) account (free tier is fine)
- A [Vercel](https://vercel.com) account (free tier is fine)
- An [OpenAI](https://platform.openai.com) API key (optional — only for AI features)
- [Bun](https://bun.sh) installed locally (optional — only needed for local dev)

---

## Step 1 — Push to GitHub

### 1.1 Create a new GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. **Repository name:** `eci-hrm` (or whatever you prefer)
3. **Visibility:** Public (as you requested) or Private
4. **Do NOT** initialize with README, .gitignore, or license (the project already has these)
5. Click **Create repository**

### 1.2 Push the project

From your local project directory:

```bash
# If you haven't already cloned the project locally, do so first.
# Then from inside the project folder:

# Initialize git (if not already done)
git init

# Add the GitHub remote (replace YOUR-USERNAME and YOUR-REPO)
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git

# Stage all files
git add .

# Commit
git commit -m "Initial commit: ECI HRM Performance Appraisal System"

# Push to GitHub
git branch -M main
git push -u origin main
```

> **Verify:** Open your repo on GitHub. You should see all source files, `README.md`, `prisma/schema.prisma`, etc. You should **NOT** see `.env`, `node_modules/`, or any `.db` files (they're in `.gitignore`).

---

## Step 2 — Create a Neon PostgreSQL Database

### 2.1 Sign up / Sign in

1. Go to [neon.tech](https://neon.tech) and sign up (GitHub/Google login is fastest)
2. Click **Create New Project**

### 2.2 Configure the project

| Field | Value |
|-------|-------|
| Project name | `eci-hrm` |
| Database name | `eci_hrm` |
| Database user | (leave default — Neon generates one) |
| Region | Choose the closest to your users (e.g., `AWS Asia Pacific (Singapore)` for Pakistan) |
| Postgres version | 16 (default) |

3. Click **Create project**

### 2.3 Copy your connection strings

After project creation, Neon shows a **Connection Details** page with two connection strings. **Copy both** — you'll need them for Vercel:

1. **Pooled connection** (for the app at runtime):
   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/eci_hrm?schema=public&pgbouncer=true
   ```
   → This goes into `DATABASE_URL` on Vercel

2. **Direct connection** (for migrations):
   ```
   postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/eci_hrm?schema=public
   ```
   → This goes into `DIRECT_DATABASE_URL` on Vercel

> **Important:** The pooled URL has `-pooler` in the hostname and `&pgbouncer=true` in the query string. The direct URL does not. You need **both**.

---

## Step 3 — Deploy to Vercel

### 3.1 Import the project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Find and select your `eci-hrm` GitHub repo
4. Vercel auto-detects Next.js — leave the defaults:
   - **Framework Preset:** Next.js
   - **Build Command:** `bun run build` (Vercel auto-detects Bun from `bun.lock`)
   - **Output Directory:** `.next` (auto-detected)
   - **Install Command:** `bun install` (auto-detected)

### 3.2 Add environment variables

**CRITICAL:** Before clicking Deploy, expand the **Environment Variables** section and add ALL of these:

| Name | Value | Required? |
|------|-------|-----------|
| `DATABASE_URL` | Neon **pooled** connection string | ✅ Yes |
| `DIRECT_DATABASE_URL` | Neon **direct** connection string | ✅ Yes |
| `JWT_SECRET` | A random 32+ character string (generate below) | ✅ Yes |
| `OPENAI_API_KEY` | Your OpenAI API key (`sk-...`) | ❌ Optional (disables AI features if empty) |
| `OPENAI_MODEL` | `gpt-4o-mini` | ❌ Optional |
| `ADMIN_EMAIL` | `imunir@eci.com.pk` | ❌ Optional (used by seed script) |
| `ADMIN_NAME` | `Muhammad Unir` | ❌ Optional |
| `ADMIN_PASSWORD` | `ECI@dm1n#2025!Secure` | ❌ Optional |
| `ADMIN_EMPLOYEE_ID` | `ECI-001` | ❌ Optional |

**Generate a JWT secret** (run this in your terminal):
```bash
openssl rand -base64 32
```
Copy the output and paste it as the `JWT_SECRET` value.

> **Tip:** Check the box "Apply to all environments" (Production, Preview, Development) for each variable so they work everywhere.

### 3.3 Deploy

1. Click **Deploy**
2. Wait for the build to complete (2–4 minutes). You'll see live build logs.
3. If the build succeeds, you'll see a "Congratulations" page with your deployment URL (e.g., `https://eci-hrm-xxx.vercel.app`).

> **If the build fails:** Check the build logs. The most common issues are:
> - Missing `DATABASE_URL` or `DIRECT_DATABASE_URL` → Prisma can't generate the client
> - Missing `JWT_SECRET` → The app throws at build time
> - Syntax errors → Check the logs for the specific file/line

---

## Step 4 — Initialize the Database

After the first deployment, the database is empty (tables don't exist yet). You need to run the migration and seed.

### 4.1 Option A: Run via Vercel CLI (recommended)

1. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Log in and link the project:
   ```bash
   vercel login
   vercel link  # select your eci-hrm project
   ```

3. Pull environment variables locally:
   ```bash
   vercel env pull .env.vercel
   ```
   This creates `.env.vercel` with all the production env vars (including the real Neon connection strings).

4. Run the database migration and seed with those env vars:
   ```bash
   # Load the Vercel env vars and run the migration + seed
   set -a; source .env.vercel; set +a
   bun run db:push        # creates all tables in Neon
   bun run db:seed        # creates admin + rating scales + 22 categories
   ```

5. Verify the seed output shows:
   ```
   PRODUCTION SEED COMPLETE
   Admin Email:     imunir@eci.com.pk
   ```

### 4.2 Option B: Run locally with Neon connection strings

If you don't want to use the Vercel CLI:

1. Create a `.env` file locally (copy from `.env.example`)
2. Fill in the real Neon connection strings, JWT secret, and admin credentials
3. Run:
   ```bash
   bun install        # install dependencies
   bun run db:push    # create tables in Neon
   bun run db:seed    # seed admin + master data
   ```

### 4.3 Option C: Demo data (for testing only)

If you want to test with a full demo dataset (10 users, 1 cycle, 6 assignments):

```bash
bun run db:seed:demo
```

Demo logins (all use password `password123`):
- `admin@eci.com` — Admin
- `ceo@eci.com` — Management
- `supervisor1@eci.com` — Supervisor
- `ali.rashid@eci.com` — Employee

> **Warning:** Demo mode wipes all existing data. Only use it on a fresh database or when you want to reset.

---

## Step 5 — Verify the Deployment

1. Open your Vercel deployment URL (e.g., `https://eci-hrm-xxx.vercel.app`)
2. You should see the **ECI HRM login page** with the ECI logo
3. Log in with:
   - **Email:** `imunir@eci.com.pk` (or whatever `ADMIN_EMAIL` you set)
   - **Password:** `ECI@dm1n#2025!Secure` (or whatever `ADMIN_PASSWORD` you set)
4. You should see the admin dashboard with stats (0 employees, 0 cycles initially — because production seed only creates the admin + rating scales + categories)

### If you see a blank page or error:
- Check the **Vercel function logs** (Vercel Dashboard → your project → Logs)
- Common issues:
  - `PrismaClientInitializationError` → `DATABASE_URL` is wrong or Neon project is suspended (free tier sleeps after inactivity)
  - `JWT_SECRET` missing → check environment variables
  - `401` on all API calls → the cookie isn't being set; check that `JWT_SECRET` is the same across all Vercel environments

---

## Step 6 — Add Real Data

Once logged in as admin:

1. **Master Data → Departments** → Create your departments (Administration, Program, Finance, etc.)
2. **Master Data → Designations** → Create job titles (CEO, HR Manager, Program Officer, etc.)
3. **Master Data → Employees** → Add your real employees. Set their:
   - Employee ID, Name, Email, Designation, Department
   - Role (employee, supervisor, management, hr, admin)
   - Line Manager (who supervises them)
   - **Password** (set an initial password for each employee)
4. **Appraisal → Cycles** → Create your first appraisal cycle:
   - Name (e.g., "Mid-Year Performance Appraisal 2025")
   - Type (mid_year or annual)
   - Period dates and submission deadline
   - Applicable departments
5. The system auto-creates assignments when a cycle is activated — each employee gets linked to their supervisor.

---

## Ongoing Maintenance

### Updating the app

1. Make changes locally
2. Push to GitHub:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```
3. Vercel auto-deploys on every push to `main`

### Database migrations

When you change `prisma/schema.prisma`:

```bash
# Locally, with your .env pointing to Neon:
bun run db:migrate -- --name descriptive_name
```

This creates a migration file in `prisma/migrations/`. Commit it to git. On Vercel, the `postinstall` hook runs `prisma generate`, and you should run `bun run db:deploy` after deployment to apply pending migrations.

### Neon free tier limits

- **Storage:** 0.5 GB (more than enough for HRM data)
- **Compute:** 300 hours/month (suspended after 5 days of inactivity)
- If the database is suspended, the app shows a connection error. Just visit the Neon dashboard to wake it up (free).

### Adding AI features (optional)

If you didn't set `OPENAI_API_KEY` initially:
1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Add `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-4o-mini` to Vercel env vars
3. Redeploy (push any commit or click "Redeploy" in Vercel)
4. The "AI Analysis" buttons on appraisal forms and cycle reports will now work

---

## Troubleshooting

### Build fails on Vercel with "Prisma can't reach database"
- Make sure `DIRECT_DATABASE_URL` is set (not just `DATABASE_URL`)
- The `postinstall: prisma generate` hook needs to run — check that `package.json` has it

### Login fails with "Invalid email or password"
- You either haven't seeded the database, or the seed used different credentials
- Re-run `bun run db:seed` with the correct `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars

### Pages load but data is empty
- You ran the production seed (admin-only) instead of the demo seed
- Either add data manually via the UI, or run `bun run db:seed:demo` for test data

### Cookie not persisting / logged out on refresh
- Check that `JWT_SECRET` is set in Vercel (all environments: Production, Preview, Development)
- The cookie is `httpOnly` + `secure` in production — it only works over HTTPS (Vercel provides this automatically)

### "AI features are not configured"
- `OPENAI_API_KEY` is not set in Vercel environment variables
- Add it and redeploy

---

## Quick Reference

| Resource | URL |
|----------|-----|
| GitHub repo | `https://github.com/YOUR-USERNAME/eci-hrm` |
| Vercel dashboard | `https://vercel.com/YOUR-USERNAME/eci-hrm` |
| Neon dashboard | `https://console.neon.tech/projects` |
| Production app | `https://eci-hrm-xxx.vercel.app` (your Vercel URL) |

| Command | Purpose |
|---------|---------|
| `bun run dev` | Start local dev server |
| `bun run build` | Production build |
| `bun run lint` | Check code quality |
| `bun run db:push` | Push schema to database |
| `bun run db:seed` | Seed admin + master data (production) |
| `bun run db:seed:demo` | Seed full demo dataset |
| `vercel env pull` | Pull production env vars locally |
