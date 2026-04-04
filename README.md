# ecommerce-fullstack

Production-oriented ecommerce platform with a React/Vite frontend and an Express/Supabase backend.

## Stack

- Frontend: Vite, React, TypeScript, TanStack Query, Zustand
- Backend: Express, Supabase JS, Node cron, Pino
- Database: Supabase Postgres with SQL migrations in [backend/migrations](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/migrations)
- Payments: Razorpay
- Email: MailerSend or SMTP
- Observability: Pino logs, optional New Relic

## Monorepo Layout

- [frontend](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/frontend): customer app and admin UI
- [backend](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend): API, background jobs, payment/webhook flows
- [backend/routes](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/routes): HTTP endpoints
- [backend/services](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/services): business logic
- [backend/tests](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/tests): focused backend tests

## Local Setup

Use Node.js 24 LTS for local development, CI, and deployment. The repo is pinned with [.nvmrc](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/.nvmrc) and [.node-version](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/.node-version).

1. Install dependencies in each app.

```bash
cd backend && npm install
cd ../frontend && npm install
```

2. Create env files from examples.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Start both apps.

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

## Environment

Backend env lives in [backend/.env.example](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/.env.example) and production defaults in [backend/.env.production.example](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/.env.production.example).
For a deployment-ready secret template that mirrors the current app shape, use [backend/.env.go-live.template](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/.env.go-live.template).

Important backend variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `JWT_SECRET`
- `FRONTEND_URL`
- `BACKEND_URL`
- `ALLOWED_ORIGINS`
- `TRUST_PROXY`
- `AUTH_COOKIE_SAMESITE`
- `AUTH_COOKIE_SECURE`
- `CRON_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `EMAIL_PROVIDER`

Email provider notes:

- Supported values are `ses`, `smtp`, and `console`.

SES and SMTP setup:

- For `EMAIL_PROVIDER=ses`, set `AWS_SES_REGION`, `AWS_SES_FROM_EMAIL`, and AWS credentials if you are not using role-based auth.
- By default, the app renders emails using the custom codebase templates and sends them through SES. Set `AWS_SES_USE_MANAGED_TEMPLATES=true` only if you explicitly want SES-managed templates.
- Optional SES hardening vars: `AWS_SES_CONFIGURATION_SET`, `AWS_SES_IDENTITY_ARN`, and `AWS_SES_FEEDBACK_FORWARDING_EMAIL`.
- For monitoring with SES configuration sets, also set `AWS_SES_EVENT_TYPES`, `AWS_SES_EVENTBRIDGE_ENABLED`, `AWS_SES_EVENTBRIDGE_BUS_ARN`, `AWS_SES_SNS_ENABLED`, and `AWS_SES_SNS_TOPIC_ARN` as needed.
- For `EMAIL_PROVIDER=smtp`, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and sender fields.

SES monitoring helper:

- Runtime mail sends automatically attach `AWS_SES_CONFIGURATION_SET` when configured, regardless of whether rendering uses app templates or SES-managed templates.
- To create/update the configuration set and event destinations from env, run `cd backend && npm run ses:setup-config-set`.

Frontend env lives in [frontend/.env.example](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/frontend/.env.example) and [frontend/.env.production.example](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/frontend/.env.production.example).

Important frontend variables:

- `VITE_FRONTEND_URL`
- `VITE_BACKEND_URL`
- `VITE_APP_NAME`
- `VITE_APP_TITLE`
- `VITE_APP_DESCRIPTION`
- `VITE_APP_CANONICAL_URL`
- `VITE_TWITTER_HANDLE`
- `VITE_RAZORPAY_CHECKOUT_URL`

## Backend Route Map

All backend routes are under `/api`.

Core commerce:

- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/categories`
- `GET /api/cart`
- `POST /api/cart`
- `POST /api/checkout/create-payment-order`
- `POST /api/checkout/verify-payment`
- `GET /api/orders`
- `GET /api/orders/:id`
- `PUT /api/orders/:id/status`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/sync-refunds`
- `POST /api/returns/request`

Auth and profile:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/profile`
- `PUT /api/profile`
- `POST /api/profile/change-password`

Content and public data:

- `GET /api/public/site-content`
- `GET /api/public/homepage`
- `GET /api/about`
- `GET /api/blogs`
- `GET /api/events`
- `GET /api/testimonials`
- `GET /api/contact-info`
- `GET /api/social-media`
- `GET /api/bank-details`
- `GET /api/gallery-items`
- `GET /api/carousel-slides`
- `GET /api/faqs`
- `GET /api/policies/:type`

Admin and operations:

- `GET /api/admin/jobs`
- `GET /api/admin/jobs/:id`
- `POST /api/admin/jobs/:id/retry`
- `POST /api/admin/jobs/:id/process`
- `GET /api/cron/scheduler-status`
- `GET /api/cron/email-stats`
- `GET /api/cron/invoice-stats`
- `GET /api/cron/orphan-stats`
- `POST /api/cron/email-retry`
- `POST /api/cron/invoice-retry`
- `POST /api/cron/refund-reconciliation`
- `POST /api/cron/orphan-sweeper`
- `POST /api/cron/event-cancellations`
- `POST /api/cron/account-deletions`

Health:

- `GET /api/health/live`
- `GET /api/health`
- `GET /api/health/ready`
- `GET /api/cron/health`

## Frontend Behavior

- The shared footer now uses a single public bootstrap call: `GET /api/public/site-content`
- The home page now uses a single public bootstrap call: `GET /api/public/homepage`
- Auth tokens are kept in memory plus HttpOnly-cookie session flow; localStorage is kept to low-sensitivity preferences such as language and currency, while short-lived UI caches now stay in sessionStorage
- Currency and language are sent back to the API using request headers so pricing/content can be localized server-side

## Data Integrity and Concurrency Notes

- Order status changes use optimistic concurrency checks on current status before updating
- Inventory decrements/restores use database RPCs for atomic operations
- Checkout and payment verification already use idempotency headers on sensitive client POSTs
- Refund, invoice, account deletion, and event cancellation flows have retry/reconciliation jobs
- Orphan payment sweeps and refund reconciliation are exposed through cron endpoints and the jobs dashboard

## Health Monitoring

`GET /api/health/live`

- Process liveness only
- Use for container liveness probes

`GET /api/health`

- Returns overall status, timestamp, uptime, database probe result, and scheduler state
- Returns `503` when the app is degraded

`GET /api/health/ready`

- Readiness-oriented response
- Returns `503` if the database probe fails

Recommended alerts:

- API health or readiness non-200
- Elevated 5xx rate
- Failed webhook verification
- Stale background jobs in `/api/admin/jobs`
- Rising orphan payment count from `/api/cron/orphan-stats`

## Single Instance Today, Load Balancer Tomorrow

Current safe single-instance setup:

- One backend node
- `ENABLE_INTERNAL_SCHEDULER=true`
- `ENABLE_RESERVATION_CLEANUP=true`

Recommended multi-instance setup:

- Multiple stateless web nodes behind a load balancer
- Exactly one worker node with:
  - `ENABLE_INTERNAL_SCHEDULER=true`
  - `ENABLE_RESERVATION_CLEANUP=true`
- All web nodes should set both flags to `false`
- Set `TRUST_PROXY=true` on nodes behind a reverse proxy or load balancer so client IPs, secure cookies, and protocol detection work correctly
- Use sticky sessions only if you introduce server-local auth state; this project currently behaves like a stateless API and does not require stickiness
- Terminate TLS at the load balancer or ingress
- Forward `X-Forwarded-For` and `X-Forwarded-Proto`
- Keep cron triggers external or pointed only at the worker node

This avoids duplicate schedulers, duplicate cleanup runs, and double-processing of sensitive jobs.

## Security Checklist

- Keep `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, payment secrets, SMTP credentials, and cron secret only on the backend
- Do not commit `.env` files
- Restrict `ALLOWED_ORIGINS` to known frontend domains
- Terminate HTTPS with a valid certificate in every non-local environment
- Set secure cookie flags at the proxy/app layer in production
- Protect admin and cron routes with role checks or `CRON_SECRET`
- Rotate Razorpay, SMTP, MailerSend, and JWT secrets regularly
- Review Supabase RLS and storage policies after every schema/storage change

## Deployment

### Backend

1. Provision a Node 24 LTS runtime.
2. Set production env using [backend/.env.production.example](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/.env.production.example).
3. Apply SQL migrations from [backend/migrations](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/migrations).
4. Start the API with `npm start`.
5. Wire health checks to `/api/health/live` and `/api/health/ready`.
6. If deploying behind a proxy or load balancer, set `TRUST_PROXY=true`.
7. If deploying multiple instances, choose one dedicated worker node for scheduler duties.

### Frontend

1. Set production env using [frontend/.env.production.example](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/frontend/.env.production.example).
2. Build with `npm run build`.
3. Serve [frontend/dist](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/frontend/dist) from a CDN, Nginx, or static host.
4. Route all SPA paths to `index.html`.
5. If frontend and backend are on different origins, set `VITE_BACKEND_URL` to the backend public origin.
6. If frontend and backend share the same origin behind a reverse proxy, leave `VITE_BACKEND_URL` unset and keep `VITE_USE_SAME_ORIGIN_API=true`.

### Reverse Proxy / TLS

Recommended proxy responsibilities:

- HTTPS certificate termination
- Gzip/Brotli compression
- Static asset caching for frontend bundles
- Forwarded headers to backend
- `TRUST_PROXY=true` on backend nodes behind the proxy
- Optional request size limits aligned with backend upload limits

For live certificate, WAF, and load-balancer validation, use the environment checklist in [docs/PRODUCTION_READINESS.md](/Users/ayush/Developer/Projects/Personal-Projects/antigravity-project/ecommerce-fullstack/docs/PRODUCTION_READINESS.md). Local code review can prepare the app for that setup, but it cannot prove a real edge deployment is configured correctly without the deployed hostname and infrastructure.

## Verification

Frontend:

```bash
cd frontend && npm run build
```

Backend:

```bash
cd backend && npm test -- --runInBand cron-auth.test.js upload-route-auth.test.js product-service.test.js
```

## Current Known Follow-Ups

- Frontend bundles are still large in a few routes and locale chunks; Vite reports chunk-size warnings during production build
- The repo still contains several maintenance/debug scripts in `backend/` that should be reviewed before a production release if they are no longer used operationally
- For full production hardening, add WAF/rate-limit rules at the edge, automated secret scanning in CI, and database backup/restore drills
