# ECI HRM — Performance Appraisal Management System

A production-ready performance appraisal management system for **ECI Pvt Ltd**, built with Next.js 16, TypeScript, Prisma, and Tailwind CSS.

## Features

- **Role-based dashboards** — Admin, HR, Supervisor, Management, Employee
- **Multi-stage appraisal workflow** — Employee → Supervisor → HR → Management → Acknowledgement
- **Master data management** — Departments, Designations, Employees, Rating Scales, Appraisal Categories
- **Appraisal cycles** — Mid-year and annual cycles with configurable periods and deadlines
- **22-competency evaluation form** — Technical (10), Leadership (5), Managerial (7) skills + Goals + Explanations
- **Dual-role support** — Supervisors who are also being appraised can switch between views
- **Notifications & audit trail** — Full visibility into form status changes and user actions
- **PDF / CSV reports** — Export appraisal data for offline review
- **AI-powered analysis** (optional) — OpenAI-powered summary of appraisal results and cycle-wide insights
- **Secure authentication** — bcrypt password hashing + httpOnly JWT session cookies

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | PostgreSQL (Neon) + Prisma ORM |
| State | Zustand (client) |
| Auth | bcryptjs + jose (JWT in httpOnly cookie) |
| AI | OpenAI Chat Completions API |
| Deployment | Vercel (frontend/API) + Neon (database) + GitHub (source) |

## Quick Start (Local Development)

### Prerequisites
- [Bun](https://bun.sh) v1.1+ (or Node.js 20+)
- A PostgreSQL database (local or [Neon](https://neon.tech) free tier)

### Steps

1. **Clone & install**
   ```bash
   git clone https://github.com/<your-org>/eci-hrm.git
   cd eci-hrm
   bun install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env — fill in DATABASE_URL, DIRECT_DATABASE_URL, JWT_SECRET
   ```

3. **Create the database schema**
   ```bash
   bun run db:push        # creates all tables
   # or: bun run db:migrate dev  (if you want migration history)
   ```

4. **Seed the database**
   ```bash
   bun run db:seed              # production mode: admin + rating scales + categories only
   # OR
   bun run db:seed:demo         # demo mode: full sample dataset (10 users, 1 cycle)
   ```

5. **Start the dev server**
   ```bash
   bun run dev
   ```
   Open http://localhost:3000

### Default Login (Production Seed)
- **Email:** `imunir@eci.com.pk` (or whatever you set as `ADMIN_EMAIL`)
- **Password:** `ECI@dm1n#2025!Secure` (or whatever you set as `ADMIN_PASSWORD`)

### Default Logins (Demo Seed)
All demo accounts use the password `password123`:
- `admin@eci.com` — Admin
- `ceo@eci.com` — Management (CEO)
- `supervisor1@eci.com` — Supervisor (Program Manager)
- `supervisor2@eci.com` — Supervisor (Finance Manager)
- `ali.rashid@eci.com` — Employee
- (5 more employee accounts — see `prisma/seed.ts`)

## Project Structure

```
eci-hrm/
├── prisma/
│   ├── schema.prisma        # PostgreSQL schema (10 models)
│   └── seed.ts              # CLI seed script (production + demo modes)
├── src/
│   ├── app/
│   │   ├── api/             # API routes (auth, users, cycles, assignments, AI, ...)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx         # SPA entry — restores session, routes to dashboard
│   ├── components/
│   │   ├── auth/            # Login view
│   │   ├── layout/          # App shell, header, sidebar, footer
│   │   ├── dashboards/      # Role-specific dashboards
│   │   ├── master/          # Master data CRUD (employees, depts, designations, ...)
│   │   ├── cycles/          # Appraisal cycle management
│   │   ├── appraisal/       # Appraisal form + list + view
│   │   ├── notifications/
│   │   ├── reports/         # Report viewer + audit logs
│   │   └── ui/              # shadcn/ui components
│   ├── lib/
│   │   ├── ai.ts            # OpenAI client wrapper
│   │   ├── auth.ts          # JWT session sign/verify
│   │   ├── auth-guard.ts    # requireAuth / requireRole middleware
│   │   ├── constants.ts     # Rating scales, skills, score calculator
│   │   ├── db.ts            # Prisma client
│   │   └── types.ts
│   ├── hooks/
│   └── store/               # Zustand store
├── public/
│   └── eci-logo.jpg
├── .env.example
├── vercel.json
├── package.json
└── README.md
```

## Database Schema

10 models — see [`prisma/schema.prisma`](./prisma/schema.prisma):

| Model | Purpose |
|-------|---------|
| `User` | Employees with roles (admin, supervisor, management, employee, hr) |
| `Department` | Org departments |
| `Designation` | Job titles with required experience/education |
| `AppraisalCycle` | Mid-year / annual appraisal periods |
| `AppraisalAssignment` | Links an employee + supervisor + cycle + form status |
| `AppraisalFormData` | The full 8-section appraisal form (scores, remarks, signatures) |
| `RatingScale` | Configurable rating scales (goals 0-3, competencies 1-5, etc.) |
| `AppraisalCategory` | 22 competency items grouped by section |
| `Notification` | User notifications (cycle activated, form assigned, etc.) |
| `AuditLog` | Audit trail of all status changes |

## Appraisal Workflow

```
[Admin creates cycle]
        ↓
[Assignments generated: employee + supervisor + cycle]
        ↓
status: assigned_to_employee
        ↓ (employee fills self-evaluation)
status: submitted_by_employee
        ↓ (supervisor reviews + adds ratings)
status: submitted_by_supervisor
        ↓ (HR reviews + adds remarks)
status: submitted_to_management
        ↓ (Management approves)
status: approved
        ↓ (shared with employee)
status: acknowledged_by_employee → closed
```

At any review stage, the reviewer can **return for correction** (sends it back to the employee with a reason).

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full step-by-step guide covering:
- GitHub repo setup
- Neon database creation
- Vercel project import + environment variables
- Initial database migration + seed

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server on port 3000 |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push schema to database (no migration history) |
| `bun run db:migrate` | Create + apply a migration |
| `bun run db:deploy` | Apply pending migrations (production) |
| `bun run db:seed` | Seed admin + rating scales + categories (production mode) |
| `bun run db:seed:demo` | Seed full demo dataset |
| `bun run db:reset` | Reset database (drops all data) |

## Security

- **Passwords** are hashed with bcrypt (12 rounds)
- **Sessions** are JWTs stored in httpOnly, SameSite=lax cookies (7-day expiry)
- **Authorization** is enforced server-side on every API route via `requireRole` / `requireAuth`
- **No client-side secrets** — the `X-User-Id` header path is a dev-only fallback; production uses the cookie

## License

Proprietary — © ECI Pvt Ltd. All rights reserved.
