# B-Board

B-Board is a full-stack agile delivery workspace built with Next.js, React, Prisma, and PostgreSQL. It combines sprint planning, issue workflows, standups, QA coverage, release build tracking, and reporting into a single application for product and engineering teams.

## Table of Contents

- [What B-Board Solves](#what-b-board-solves)
- [Latest Feature Highlights](#latest-feature-highlights)
- [Core Features](#core-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Database & Data Management](#database--data-management)
- [Running, Building, and Testing](#running-building-and-testing)
- [Deployment Guide](#deployment-guide)
  - [Option A: Render (recommended)](#option-a-render-recommended)
  - [Option B: Any Node host (manual)](#option-b-any-node-host-manual)
  - [Option C: Docker-style deployment notes](#option-c-docker-style-deployment-notes)
- [Post-Deployment Validation Checklist](#post-deployment-validation-checklist)
- [Troubleshooting](#troubleshooting)

## What B-Board Solves

B-Board gives software teams one place to:

- manage backlog and sprint execution,
- collaborate during standups and grooming,
- connect QA activity with delivery,
- track release readiness through build records, and
- review delivery performance through dashboards and trends.

## Latest Feature Highlights

### Proactive Sprint Guidance & Forecasting (newest)

B-Board now includes a richer **Sprint Health + Guidance** experience in reporting:

- **Sprint health scoring and risk forecasting** to make delivery risk visible before sprint close.
- **Predictive delivery and capacity modeling** based on recent execution signals.
- **Proactive guidance suggestions** with recommendation categories and confidence to support intervention planning.
- **Capacity balancing signals** to identify overloaded and idle contributors early.

### Release Builds Management

Release Builds Management remains available and includes:

- Build records by project/environment/status with planned and deployed timestamps.
- Linked issues for auditable release content.
- Per-project build key uniqueness and destructive-action guardrails.
- Sprint-aware build visibility for builds touching sprint issues.
- Role-aware management access for admins/PMs with read-focused contributor/viewer experience.

For QA validation scenarios, see `QA_CHECKLIST.md`.

## Core Features

- **Backlog, sprint, and board workflows** with drag-and-drop prioritization.
- **Standups and summaries** with blockers and progress capture.
- **AI-assisted workflows** for standup drafting and backlog grooming (optional via API keys).
- **QA toolkit** and sprint-aware quality visibility.
- **Release build tracking** with issue linkage and environment status.
- **Reporting suite** for velocity, cycle/delivery insights, sprint health scoring, risk forecasting, proactive guidance, blocker trends, and adoption.
- **Research backlog** for discovery and decision tracking.
- **Team and role management** with access controls and audit-friendly behavior.
- **Email automation** for invites, standup summaries, and contact workflows.
- **Light/dark theming** and keyboard-friendly interactions.

## Technology Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS, Radix UI.
- **Backend**: Next.js API routes, Prisma ORM, JWT auth.
- **Database**: PostgreSQL.
- **AI/LLM integrations (optional)**: OpenAI-compatible APIs.
- **Charts and analytics**: Recharts.
- **Testing**: Vitest + Testing Library.

## Project Structure

```text
.
├─ src/                     # App routes, API handlers, UI components, domain logic
├─ prisma/
│  ├─ schema.prisma         # Data model
│  ├─ seed.ts               # Main seed data
│  └─ seedBuilds.ts         # Optional release build seed data
├─ scripts/
│  ├─ render-deploy.mjs     # Render deployment helper
│  ├─ check-placeholders.mjs
│  └─ dedupe-testexecutions.mjs
├─ render.yaml              # Render service blueprint
├─ QA_CHECKLIST.md          # QA flows, especially build management checks
└─ README.md
```

## Prerequisites

- **Node.js**: 18+
- **npm**: version bundled with your Node install
- **PostgreSQL**: local or managed
- **Optional**: OpenAI/OpenAI-compatible API keys for AI features

## Local Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create local environment file**
   ```bash
   cp .env.example .env
   ```
3. **Set required variables** in `.env` (at minimum `DATABASE_URL` and `JWT_SECRET`).
4. **Prepare the database**
   ```bash
   npx prisma migrate dev
   ```
   If you are iterating quickly against a non-production DB, `npx prisma db push` can also be used.
5. **Optional seed data**
   ```bash
   npm run seed
   ```
   For release-build focused QA data:
   ```bash
   npm run seed:builds
   ```
6. **Run the app**
   ```bash
   npm run dev
   ```
7. Open `http://localhost:3000`.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes (all envs except static analysis) | PostgreSQL connection string used by Prisma. |
| `JWT_SECRET` | Yes | Secret for signing/verifying auth tokens. Use a long random value. |
| `APP_URL` | Yes (production) | Canonical public URL used in generated links (e.g., invites). |
| `PORT` | No | Runtime port for `next start` (defaults to 3000). |
| `HOMEPAGE_ENABLED` | No | `1` to expose marketing homepage at `/`; default redirects `/` to login flow. |
| `OPENAI_API_KEY` | No | Enables standup AI drafting. |
| `AI_API_KEY` | No | Enables backlog grooming AI suggestions via OpenAI-compatible APIs. |
| `AI_BASE_URL` | No | Base URL override for OpenAI-compatible providers. |
| `AI_MODEL_DEFAULT` | No | Default model for backlog grooming (defaults to `gpt-4o-mini`). |
| `SMTP_HOST` | Recommended for email features | SMTP host for invites/contact/summary mail. |
| `SMTP_PORT` | Recommended for email features | SMTP port (usually 587 or 465). |
| `SMTP_USER` | Recommended for email features | SMTP username. |
| `SMTP_PASS` | Recommended for email features | SMTP password/token. |
| `SMTP_FROM` | Recommended for email features | Sender identity (e.g., `B Board <no-reply@yourdomain.com>`). |
| `CONTACT_TO` | Optional | Destination inbox for contact submissions. |

> Tip: Keep `.env` out of source control. Use your host's secret manager in production.

## Database & Data Management

- **Schema**: `prisma/schema.prisma`
- **Generate Prisma Client** (also runs on `postinstall`):
  ```bash
  npx prisma generate
  ```
- **Apply migrations (preferred for production)**:
  ```bash
  npx prisma migrate deploy
  ```
- **Development migration workflow**:
  ```bash
  npx prisma migrate dev
  ```
- **Seed baseline data**:
  ```bash
  npm run seed
  ```
- **Seed build-management QA data**:
  ```bash
  npm run seed:builds
  ```

## Running, Building, and Testing

- Development:
  ```bash
  npm run dev
  ```
- Production build:
  ```bash
  npm run build
  ```
- Start production server:
  ```bash
  npm start
  ```
- Run tests:
  ```bash
  npm test
  ```
- Lint:
  ```bash
  npm run lint
  ```
- Type-check:
  ```bash
  npm run typecheck
  ```

## Deployment Guide

### Option A: Render (recommended)

This repo includes `render.yaml` and a deployment script (`npm run render:deploy`) designed for Render.

1. Push the repository to GitHub/GitLab.
2. Create a new **Web Service** in Render and point it to this repo.
3. Let Render detect/use `render.yaml`.
4. Provision a PostgreSQL database in Render.
5. Set environment variables (`DATABASE_URL`, `JWT_SECRET`, `APP_URL`, and optional email/AI vars).
6. Deploy. The provided deploy flow runs Prisma generate + schema sync before app build.

**Production-safe recommendation:**
- Prefer migration-based deploys (`npx prisma migrate deploy`) for long-lived environments.
- If desired, adjust `render.yaml` / deploy script accordingly.

### Option B: Any Node host (manual)

Use this path for platforms like Railway, Fly.io, DigitalOcean App Platform, EC2, or your own VM.

1. Provision PostgreSQL and collect `DATABASE_URL`.
2. On deploy machine/container:
   ```bash
   npm ci
   npm run build
   npx prisma migrate deploy
   npm start
   ```
3. Configure host environment variables:
   - Required: `DATABASE_URL`, `JWT_SECRET`, `APP_URL`
   - Optional: AI and SMTP variables
4. Ensure the runtime port expected by your host maps to `PORT`.
5. Put TLS and domain routing in front of the app (host-managed or reverse proxy).

### Option C: Docker-style deployment notes

If you containerize B-Board:

- Build image with Node 18+.
- Run `npm ci`, `npm run build` during image build.
- Run `npx prisma migrate deploy` at startup (entrypoint or release phase).
- Pass secrets at runtime (not baked into image).
- Expose port `3000` (or your configured `PORT`).

## Post-Deployment Validation Checklist

After each deploy, validate:

- Authentication/login works.
- Projects and board views load.
- Build management pages load and can create/edit/link issues (role permitting).
- Key reports render.
- Email actions succeed (if SMTP configured).
- AI actions return successful responses (if AI keys configured).
- No Prisma migration drift errors in logs.

For build-specific regression flow details, use `QA_CHECKLIST.md`.

## Troubleshooting

- **`PrismaClientInitializationError` / DB connection failures**
  - Verify `DATABASE_URL`, DB firewall rules, and SSL requirements from provider.
- **Build succeeds but app errors at runtime**
  - Ensure environment variables are present in the runtime service (not only build stage).
- **Invite URLs incorrect**
  - Set `APP_URL` to the public HTTPS domain.
- **AI features not available**
  - Confirm `OPENAI_API_KEY` and/or `AI_*` variables are set correctly.
- **Email not sending**
  - Check SMTP credentials, sender policy (SPF/DKIM), and provider logs.

---

If you are extending B-Board, start with `prisma/schema.prisma` and the `src/` routes/components for your target domain area, then update this README to keep onboarding accurate.
