# B-Board

B-Board is a lightweight agile board for software teams that brings sprints, epics, drag-and-drop prioritization, and role-based workflows into a single Next.js application. It ships with a PostgreSQL + Prisma data model, seed data for demos, and ready-to-use deployment automation.

## Feature Highlights

- **Backlog, sprints, and kanban**: Plan epics, sprints, and product backlogs with drag-and-drop ordering and WIP-aware board columns.
- **Standups + summaries**: Capture yesterday/today/blockers, link issues/research items, and generate AI drafts plus team summaries.
- **AI backlog grooming**: Pull AI suggestions for issue quality, sizing risks, and better acceptance criteria.
- **QA toolkit**: Test case management with a Sprint 360 view that links coverage to active work.
- **Release builds**: Track planned/deployed builds, environments, and linked issue rollups.
- **Reporting suite**: Delivery health, velocity, cycle time, user adoption, blocker aggregation, and orphaned-work insights.
- **Research backlog**: Maintain discovery items, decisions, and observations alongside delivery work.
- **Team management**: Invite members, assign project roles, and log audit history on key actions.
- **Security + auth**: JWT-based auth with bcrypt password hashing and role-aware access controls.
- **Email automation**: Configurable providers for invite emails, standup recap delivery, and contact form handling.
- **Theming + UX**: Light/dark themes, markdown rendering, and fast keyboard-friendly workflows.
- **Developer tooling**: TypeScript-first setup, Vitest tests, Prisma migrations, and seed utilities for quick onboarding.

## Architecture

- **Frontend**: Next.js 16 with React 19, Tailwind CSS, Radix UI dialogs, markdown support via `react-markdown` + `remark-gfm`, and drag-and-drop via DnD Kit.
- **Backend**: Next.js API routes with JWT auth, Prisma as the ORM, and PostgreSQL as the primary data store.
- **Data & analytics**: Recharts for velocity/burndown visuals, CSV import for Jira issues, and history tracking in the database.

## Prerequisites

- Node.js 18+ (Next.js 16 requires Node 18 or newer)
- PostgreSQL database (local or hosted)
- OpenAI API keys if you want AI standup drafts/backlog grooming (optional)

## Quick Start

1. **Clone and install**
   ```bash
   npm install
   ```
2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   - Set `JWT_SECRET` to a strong secret.
   - Set `DATABASE_URL` to your PostgreSQL connection string.
   - Optionally set `OPENAI_API_KEY` for AI standup drafts and `AI_API_KEY` for backlog grooming suggestions.
   - Set `APP_URL` in production to generate invite links.
3. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```
4. **(Optional) Seed demo data**
   ```bash
   npm run seed
   ```
5. **Start the app in development**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000 to explore the board.

## Production Build & Start

```bash
npm run build
npm start
```

The `start` script runs `next start` only. If you want demo data in production, run `npm run seed` separately after migrations.

## Deployment on Render

This repository includes a `render.yaml` for one-click deployment.

1. Push your code to a repository accessible by Render.
2. Create a new Web Service on Render and import the repo (the bundled `render.yaml` uses `npm run render:deploy`).
3. Provision a Render PostgreSQL database and wire `DATABASE_URL` (Render can inject this automatically).
4. Add required environment variables (see below), including `JWT_SECRET` and `APP_URL`.
5. `render:deploy` runs Prisma generate + `prisma db push --accept-data-loss` before building. If you prefer migrations, swap it for `npx prisma migrate deploy` in `render.yaml`.

## Environment Variables

| Variable | Description |
| --- | --- |
| `PORT` | Port for the Next.js server (default: 3000). |
| `JWT_SECRET` | Secret used to sign and verify authentication tokens. **Required**. |
| `DATABASE_URL` | Connection string for the PostgreSQL database used by Prisma. **Required in deployed environments**. |
| `APP_URL` | Canonical app URL used in invite links; **required in production**. |
| `HOMEPAGE_ENABLED` | Set to `1` to serve the marketing homepage at `/`. Set to `0` (or leave unset) to redirect `/` to `/login`. Default: disabled. |
| `OPENAI_API_KEY` | OpenAI key enabling AI standup drafts (standup assistant). Optional. |
| `AI_API_KEY` | OpenAI-compatible key for AI backlog grooming suggestions. Optional. |
| `AI_BASE_URL` | Override the OpenAI-compatible base URL for AI backlog grooming (e.g., Azure/OpenAI proxy). Optional. |
| `AI_MODEL_DEFAULT` | Default model name for AI backlog grooming (defaults to `gpt-4o-mini`). Optional. |
| `SMTP_HOST` | SMTP server host for outbound emails (contact form + invites + standup summaries). |
| `SMTP_PORT` | SMTP server port (e.g., 587 or 465). |
| `SMTP_USER` | SMTP username/credential. |
| `SMTP_PASS` | SMTP password/credential. |
| `SMTP_FROM` | From email for contact replies (e.g., `B Board <no-reply@bboard.site>`). |
| `CONTACT_TO` | Destination for contact form submissions (defaults to `admin@bboard.site`). |

For local development, create a `.env` file with these values. In production (e.g., Render), configure the same variables through your hosting provider's environment settings.

## Useful Scripts

- `npm run dev` – Start the Next.js dev server.
- `npm run build` – Build the production bundle.
- `npm start` – Start the production server (run migrations separately).
- `npm run seed` – Seed the database with demo data.
- `npm test` – Run the Vitest suite.

## Testing

Run the automated test suite (Vitest) with:

```bash
npm test
```
