# B-Board

B-Board is a lightweight agile board for software teams that brings sprints, epics, drag-and-drop prioritization, and role-based workflows into a single Next.js application. It ships with a PostgreSQL + Prisma data model, seed data for demos, and ready-to-use deployment automation.

## Feature Highlights

- **Work planning**: Create projects, epics, and sprints with roles for administrators, product owners, developers, and QA contributors.
- **Issue lifecycle**: Track items across TODO, IN_PROGRESS, IN_REVIEW, and DONE with assignees, story points, due dates, and epic links.
- **Backlog prioritization**: Drag-and-drop ordering within status columns, with positions persisted per sprint/backlog.
- **Collaboration**: Inline commenting plus history for status, assignee, sprint, and story point changes.
- **Analytics**: Built-in dashboards powered by Recharts for sprint throughput and velocity visibility.
- **Authentication & security**: JWT-based auth with bcrypt password hashing and role-aware access controls.
- **Email notifications**: Nodemailer integration for account and workflow emails.
- **AI-assisted summaries**: OpenAI integration to summarize issues and updates (requires OpenAI API key).
- **Theming**: Light/dark themes with Next Themes and Tailwind CSS typography presets.
- **Developer tooling**: TypeScript-first setup, Vitest tests, Prisma migrations, and seed utilities for quick onboarding.

## Architecture

- **Frontend**: Next.js 16 with React 19, Tailwind CSS, Radix UI dialogs, markdown support via `react-markdown` + `remark-gfm`, and drag-and-drop via DnD Kit.
- **Backend**: Next.js API routes with JWT auth, Prisma as the ORM, and PostgreSQL as the primary data store.
- **Data & analytics**: Recharts for velocity/burndown visuals, CSV import via `csv-parse`, and history tracking in the database.

## Prerequisites

- Node.js 18+ (Next.js 16 requires Node 18 or newer)
- PostgreSQL database (local or hosted)
- An OpenAI API key if you want AI summaries (optional)

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
   - Optionally set `OPENAI_API_KEY` for AI summaries and `PORT` (defaults to 3000).
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

The `start` script seeds the database before launching `next start`, ensuring the app has starter data in fresh environments.

## Deployment on Render

This repository includes a `render.yaml` for one-click deployment.

1. Push your code to a repository accessible by Render.
2. Create a new Web Service on Render and import the repo.
3. Add environment variables in the Render dashboard (see below), including `DATABASE_URL` pointing to a Render PostgreSQL database and `JWT_SECRET`.
4. Render installs dependencies and runs the build step; ensure `npx prisma migrate deploy` runs during deploy to apply migrations.

## Environment Variables

| Variable | Description |
| --- | --- |
| `PORT` | Port for the Next.js server (default: 3000). |
| `JWT_SECRET` | Secret used to sign and verify authentication tokens. **Required**. |
| `DATABASE_URL` | Connection string for the PostgreSQL database used by Prisma. **Required in deployed environments**. |
| `OPENAI_API_KEY` | OpenAI key enabling AI-generated summaries. Optional. |
| `SMTP_HOST` | SMTP server host for outbound emails (contact form + notifications). |
| `SMTP_PORT` | SMTP server port (e.g., 587 or 465). |
| `SMTP_USER` | SMTP username/credential. |
| `SMTP_PASS` | SMTP password/credential. |
| `SMTP_FROM` | From email for contact replies (e.g., `B Board <no-reply@bboard.site>`). |
| `CONTACT_TO` | Destination for contact form submissions (defaults to `admin@bboard.site`). |

For local development, create a `.env` file with these values. In production (e.g., Render), configure the same variables through your hosting provider's environment settings.

## Useful Scripts

- `npm run dev` – Start the Next.js dev server.
- `npm run build` – Build the production bundle.
- `npm start` – Run migrations + seed, then launch the production server.
- `npm run seed` – Seed the database with demo data.
- `npm test` – Run the Vitest suite.

## Testing

Run the automated test suite (Vitest) with:

```bash
npm test
```
