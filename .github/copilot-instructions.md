# Project conventions

- This is a React and Express TypeScript monorepo.
- The React app is in `client/`; the API and Prisma schema are in `server/`.
- Keep authentication in HTTP-only cookies and enforce RBAC on server routes.
- Use Zod validation for mutation request bodies.
- Record complaint status changes in `StatusHistory`.
- Keep demo credentials and seed data in `server/prisma/seed.ts`.
- Run `npm run build` before finalizing changes.
