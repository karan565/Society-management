# GharMandal

A React and Material UI society-management portal with three access panels:

- **Super Admin** — developer access; can create societies, appoint chairpersons, and add committee admins and residents.
- **Admin** — committee roles such as chairperson, secretary, or cashier; can add residents and manage maintenance.
- **Resident** — can view their profile, pending bills, payment history, paid receipts, shared expenses, and their own complaints and suggestions.

The Super Admin can create multiple societies, appoint each society's first chairperson, and switch between society workspaces. Society users, bills, expenses, and requests are scoped to their society.

## Run locally

The frontend runs on port `3000`. If `VITE_API_BASE_URL` is not set, the API
base URL defaults to `http://localhost:4000/api`, matching the backend's
default port. The app name is configured with `APP_NAME` in `.env`.

```sh
npm install
npm run start
```

For local development, set `VITE_API_BASE_URL` in `frontend/.env.local` if the
backend is running somewhere other than `http://localhost:4000/api`.

The backend must be running separately. From `backend`, configure `.env`, then
run `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, and
`npm run dev`. The seed command creates the Super Admin using
`SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in the backend environment.
Sign in with those credentials, then create a society and its first chairperson.

The frontend loads society data and sends sign-in, user, maintenance, finance,
payment, and complaint actions to the backend API. Admins can set maintenance,
record payments, and download receipts; residents can submit payment details
and review their bills. Access tokens are kept in memory, and refresh sessions
use an HttpOnly cookie.

Admins can also record and update expenses, choose through one society-wide setting whether all expense details are visible to residents, and see the available fund (maintenance collected minus all recorded expenses). Residents always see the available fund, but can only view expense details when the society-wide setting is enabled; they cannot edit financial records. Residents can file complaints or suggestions; admins can set their status to in progress, rejected, closed, or completed.

## Cloudflare Pages deployment

Deploy the `frontend` folder as a separate Cloudflare Pages project:

- Build command: `npm run build`
- Build output directory: `dist`
- App name environment variable: `APP_NAME=GharMandal`
- Production environment variable: `VITE_API_BASE_URL=https://<your-api-host>/api`

The frontend is served from `/` (no `/free` path prefix), and `public/_redirects`
supports client-side routes such as `/pages/login` on refresh. The production
build fails if `VITE_API_BASE_URL` is missing. Set the backend's
`FRONTEND_ORIGINS` to the exact deployed frontend origin. The backend must be
deployed separately; Cloudflare Pages only hosts this static frontend.

## Local data and security

Business data and account credentials are managed by the backend and database;
the frontend no longer uses local storage for them. The portal is only as safe
as its backend deployment: configure HTTPS, secure cookies, a strong JWT secret,
database backups, and the correct CORS origins before using real resident or
payment information.
