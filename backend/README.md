# Society Management API

Express API for the society portal. It uses PostgreSQL, Prisma migrations, password hashing, short-lived JWT access tokens, and rotating database-backed refresh sessions.

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Local setup

1. Create a PostgreSQL database named `society_management`.
2. Replace the placeholder values in `.env` (or copy `.env.example` to `.env`).
   - Use a unique random `JWT_ACCESS_SECRET` with at least 32 characters.
   - Use a unique strong `SUPER_ADMIN_PASSWORD`.
   - Set `DATABASE_URL` to the connection string used by the running API.
   - Set `DIRECT_URL` to a direct or session-pooler PostgreSQL connection for Prisma migrations.
   - Set `FRONTEND_ORIGINS` to the exact browser origin(s) that may call this API.
3. Install dependencies with `npm install`.
4. Apply the included initial schema with `npm run db:migrate`.
5. Create the first Super Admin with `npm run db:seed`.
6. Start the API with `npm run dev`. The health check is `GET /api/health`.

For production, run `npm run db:generate`, `npm run db:migrate`, and then `npm start`. Do not deploy the local `.env`; configure the variables in the hosting provider's secret/environment settings.

## Authentication

- `POST /api/auth/login` takes `{ "email": "...", "password": "..." }`. It returns a short-lived access token and stores the rotating refresh token in an HttpOnly cookie.
- Send the access token as `Authorization: Bearer <accessToken>`.
- `POST /api/auth/refresh` rotates the refresh cookie and returns a new access token.
- `POST /api/auth/logout` revokes the current refresh session. `POST /api/auth/logout-all` revokes all sessions for the authenticated account.
- `GET /api/auth/sessions` lists active sessions; `DELETE /api/auth/sessions/:sessionId` revokes one of the account's own sessions.
- `GET /api/auth/me` returns the authenticated user. `POST /api/auth/change-password` accepts `{ "currentPassword": "...", "newPassword": "..." }` and revokes existing sessions.
- Admin password resets and account deactivation also revoke the target user's sessions.

For a frontend hosted on a different site, set `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, configure the exact frontend origin, and use HTTPS. Keep refresh tokens out of JavaScript storage.

## Society scoping and roles

- Super Admin endpoints that operate on one society accept `X-Society-Id: <uuid>`. Super Admin can list societies and users across societies.
- Admins and residents are always scoped to their assigned society. They cannot select another tenant with headers or query parameters.
- Admins manage residents, maintenance, finance records, and complaints within their society. Residents can read their own bills, request payment acceptance, create/read their own complaints, and close their own open/in-progress complaints.
- Societies and accounts are deactivated rather than physically removed. This preserves records and revokes access.

## API summary

All responses are JSON except `204 No Content` operations. Errors use `{ "error": { "code": "...", "message": "...", "details"?: ... } }`. Role names, statuses, and payment method values in API payloads use the frontend's display values (for example `admin`, `in progress`, `UPI`).

Route modules are grouped under `src/routes/<domain>/`. Each `index.js` declares the endpoints and middleware, while its `controllers.js` exports the request-handler functions imported by that index.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login`, `/refresh`, `/logout`, `/logout-all`, `/change-password`; `GET /api/auth/me`, `/sessions`; `DELETE /api/auth/sessions/:sessionId` |
| Societies | `GET/POST /api/societies`; `GET/PATCH/DELETE /api/societies/:societyId`; `GET /api/societies/current`; `PATCH /api/societies/current/finance-visibility` |
| Users | `GET/POST /api/users`; `PATCH /api/users/me`; `PATCH /api/users/:userId`; `PATCH /api/users/:userId/access`; `PUT /api/users/:userId/password`; `DELETE /api/users/:userId` |
| Maintenance | `GET /api/maintenance/bills?year=YYYY`, `/api/maintenance/bills/:billId`; `POST /api/maintenance/schedule`; payment request, mark-paid, accept-request, revert, and payment-history endpoints under `/api/maintenance/bills/:billId` |
| Finances | `GET /api/finances/balance`, `/monthly?year=YYYY`, `/statement?month=YYYY-MM`, `/transactions?month=YYYY-MM`, `/transactions/:transactionId`; `POST /api/finances/transactions`; `PATCH/DELETE /api/finances/transactions/:transactionId` |
| Complaints | `GET/POST /api/complaints`; `GET /api/complaints/:complaintId`; `PATCH /api/complaints/:complaintId/status`; `DELETE /api/complaints/:complaintId` |

Maintenance bills are generated idempotently for all twelve months of the current year at API startup, hourly after a year rollover, when the bill list is requested, and when a resident is added. Paid bills and bills with pending payment requests are protected from amount changes. Payment acceptance, bill updates, receipts, reversals, finance changes, society creation, and password/session changes use database transactions where multiple writes must succeed together.

## Database migrations

The Prisma schema is in `prisma/schema.prisma`. Committed SQL migrations are in `prisma/migrations`; do not edit production schema directly. Make schema changes, generate a migration in development with `npm run db:migrate:dev -- --name <description>`, and deploy committed migrations with `npm run db:migrate`.

## Frontend integration

The Vite frontend calls this API for authentication and society data. Set
`VITE_API_BASE_URL=http://localhost:4000/api` in the frontend's local environment
and allow `http://localhost:3000` in `FRONTEND_ORIGINS`. The frontend keeps the
short-lived access token in memory and relies on the HttpOnly refresh cookie;
business records are stored in PostgreSQL, not browser local storage.

The initial `npm run db:seed` creates only the Super Admin configured by
`SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`. Sign in with that account, then
create a society and its first chairperson from the portal.

To create the Amardeep Apartment demo society and its 28 resident accounts,
run `npm run db:seed:amardeep` after applying the database migrations. Each
resident uses the password `Pass@123`; the demo seeder is blocked when
`NODE_ENV=production`.
