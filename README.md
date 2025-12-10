# B-Board

B-Board is a lightweight agile board that supports sprints, epics, and issue tracking with drag-and-drop prioritization.

## Features

- Project and sprint management with role-based access control for administrators, product owners, developers, and QA contributors.
- Issue lifecycle tracking across TODO, IN_PROGRESS, IN_REVIEW, and DONE, including assignees, epics, and story points.
- Drag-and-drop backlog ordering within sprints, with persisted positions per status column.
- Commenting and history tracking for key issue fields such as status, assignee, sprint, and story points.
- Prisma-backed PostgreSQL data model with seed utilities for quick setup.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Set environment variables**
   - Copy `.env.example` to `.env`.
   - Set `JWT_SECRET` to a secure value.
   - Provide `DATABASE_URL` for your PostgreSQL instance.
   - Optionally set `PORT` (defaults to 3000).
3. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```
4. **(Optional) Seed sample data**
   ```bash
   npm run seed
   ```
5. **Build and start the app**
   ```bash
   npm run build
   npm start
   ```
   The start script runs the seed step automatically before launching `next start`.

## Deploying on Render

This repository includes a `render.yaml` for one-click deployment.

1. Push your code to a repository accessible by Render.
2. Create a new Web Service on Render and import the repo.
3. Set environment variables in the Render dashboard (see below), including `DATABASE_URL` pointing to a Render PostgreSQL database and `JWT_SECRET`.
4. Render will install dependencies and run the build step. Ensure migrations are applied via `npx prisma migrate deploy` during deployment.

## Environment Variables

| Variable | Description |
| --- | --- |
| `PORT` | Port for the Next.js server (default: 3000). |
| `JWT_SECRET` | Secret used to sign and verify authentication tokens. **Required**. |
| `DATABASE_URL` | Connection string for the PostgreSQL database used by Prisma. **Required in deployed environments**. |

For local development, create a `.env` file with these values. In production (e.g., Render), configure the same variables through your hosting provider's environment settings.

## Testing

Run the automated test suite (Vitest) with:

```bash
npm test
```
