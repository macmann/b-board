# Sample Node.js Project

This is a minimal starter template for a Node.js application.

## Run App

```bash
npm install
npm run build
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed.

## Prisma production configuration

- Prisma reads `DATABASE_URL` from the environment for connecting to your Render Postgres database.
- Use `npx prisma migrate deploy` to apply migrations in production instead of `npx prisma migrate dev`.
