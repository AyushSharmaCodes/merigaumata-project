# ecommerce-fullstack

## Overview

`ecommerce-fullstack` is a **full‑stack e‑commerce platform** built with a modern JavaScript stack:
- **Frontend** – Vite + React (TypeScript) UI that follows a premium, glass‑morphism design. It includes a public **Contact** page, a **Shop** page, product listings, an **Admin Portal** for managing content, and a fully‑styled **Office Hours** feature.
- **Backend** – Express.js API server that talks to **Supabase** (PostgreSQL) for data storage, authentication, and file storage. The backend provides CRUD endpoints for products, orders, events, blogs, gallery items, and a dedicated **Contact‑Info** API (addresses, phones, emails, office hours).
- **Database** – Supabase (PostgreSQL) with Row‑Level Security (RLS) policies. Migrations are stored in `backend/migrations/` and can be applied via the Supabase SQL editor.

The project demonstrates how to combine a fast Vite dev environment with a server‑side API that uses the **service‑role** key for privileged operations while still allowing public read‑only access.

---

## Features

- **Product catalogue** – browse, filter and view product details.
- **Shopping cart & checkout** – client‑side cart with mock checkout flow.
- **Admin portal** – manage products, categories, events, blogs, gallery, carousel, FAQs, social media links, and **Contact Management** (addresses, phones, emails, office hours).
- **Office Hours** – a new feature allowing admins to create, edit, bulk‑update and delete weekly office hours; displayed dynamically on the public Contact page.
- **Email notifications** – OTP, order confirmations, shipping updates using **Resend**.
- **Image upload** – transactional uploads to Supabase storage for products, events, blogs, etc.
- **Responsive design** – mobile‑first layout with dark‑mode ready components.
- **Environment‑based configuration** – `.env` for backend (Supabase keys, ports) and Vite env variables for the frontend.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite, React, TypeScript, Tailwind‑like utility CSS (custom), **lucide‑react** icons |
| Backend | Node.js, Express, Supabase JS client |
| Database | Supabase (PostgreSQL) |
| Email | Resend (transactional email service) |
| Dev Tools | Nodemon, ESLint, Prettier |

---

## Project Structure

```
ecommerce-fullstack/
├─ backend/                # Express API
│   ├─ config/            # Supabase client config
│   ├─ migrations/        # SQL migration files
│   ├─ routes/            # API route definitions
│   ├─ services/          # Business logic (email, OTP, etc.)
│   ├─ server.js          # Entry point
│   └─ .env               # Environment variables (not committed)
├─ frontend/               # Vite React app
│   ├─ src/
│   │   ├─ pages/        # Next‑style page components (Contact.tsx, Shop.tsx…)
│   │   ├─ components/   # UI components (cards, forms, OfficeHoursSection…)
│   │   ├─ services/      # API client wrappers (contact‑info.service.ts)
│   │   └─ types/         # TypeScript interfaces
│   ├─ public/            # Static assets
│   └─ vite.config.ts     # Vite configuration (path alias @)
├─ .gitignore
├─ README.md               # <‑‑ you are editing this file
└─ package.json            # monorepo scripts (frontend & backend share deps)
```

---

## Prerequisites

- **Node.js** (v20+) – ensure `node -v` >= 20.
- **npm** (v9+) – `npm -v`.
- **Supabase account** – a project with a PostgreSQL database.
- **Resend account** – for sending transactional emails (optional for dev).

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your‑username/ecommerce-fullstack.git
cd ecommerce-fullstack
```

### 2. Install dependencies (both frontend & backend)

```bash
# From the root – installs everything (workspaces)
npm install
```

### 3. Configure the backend

Create a `.env` file in `backend/` (copy from `.env.example` if it exists):

```dotenv
# .env (backend)
SUPABASE_URL=https://<your‑project>.supabase.co
SUPABASE_ANON_KEY=your‑anon‑key
SUPABASE_SERVICE_ROLE_KEY=your‑service‑role‑key
# Optional – email service
RESEND_API_KEY=your‑resend‑api‑key
FROM_EMAIL=your‑from‑address@example.com
APP_NAME=Your App
PORT=5001   # default; can be changed
```

> **Note** – The `SUPABASE_SERVICE_ROLE_KEY` gives the backend full access (bypasses RLS). Never expose this key to the client.

### 4. Run database migrations

Open the Supabase SQL editor and paste the contents of `backend/migrations/*.sql` (e.g., `migration-contact-info.sql`, `migration-office-hours.sql`, etc.). Execute them to create the required tables and triggers.

### 5. Configure the frontend

Vite reads environment variables prefixed with `VITE_`. Create a `.env` in `frontend/` if you need to override the default dev server URL:

```dotenv
VITE_BACKEND_URL=http://localhost:5001
VITE_FRONTEND_URL=http://localhost:5173
```

### 6. Start the development servers

#### Backend

```bash
cd backend
npm run dev   # nodemon watches files and restarts automatically
```

The server will attempt to bind to `PORT` (default 5001). If the port is already in use, the custom start‑up logic will automatically try the next free port (up to 10 attempts).

#### Frontend

```bash
cd frontend
npm run dev   # Vite dev server (default http://localhost:5173)
```

You should now see two terminals:
- **Backend** listening on `http://localhost:5001` (or the next free port).
- **Frontend** at `http://localhost:5173`.

Open the frontend URL in a browser – the shop and contact pages will load. The admin portal is reachable at `http://localhost:5173/admin` (or the route you defined).

---

## API Overview (Backend)

All routes are prefixed with `/api/`.

| Resource | Endpoints | Description |
|----------|-----------|-------------|
| **Auth** | `POST /auth/login`, `POST /auth/register` | JWT‑based authentication (uses Supabase auth). |
| **Products** | `GET /products`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id` | CRUD for product catalog. |
| **Categories** | `GET /categories`, `POST /categories` … | Manage product categories. |
| **Orders** | `GET /orders`, `POST /orders` … | Simple order flow (mock payment). |
| **Contact‑Info** | `GET /contact-info`, `PUT /address`, `POST /phones`, `PUT /phones/:id`, `DELETE /phones/:id`, `POST /emails`, `PUT /emails/:id`, `DELETE /emails/:id`, `POST /office-hours`, `PUT /office-hours/:id`, `DELETE /office-hours/:id` | All contact‑related data, including the **Office Hours** feature. |
| **Gallery** | `GET /gallery-items`, `POST /gallery-items` … | Image/video gallery management. |
| **Email** | Service functions (OTP, order confirmations) – called internally by routes. |

All **admin‑only** routes expect a valid session or a service‑role key; public routes (e.g., fetching office hours) are exposed via RLS policies.

---

## Frontend Highlights

- **Contact Page (`pages/Contact.tsx`)** – pulls address, phones, emails, and office hours from `/api/contact-info`. Office hours are rendered dynamically using the `OfficeHoursSection` component.
- **Admin Portal (`pages/admin/ContactManagement.tsx`)** – uses `contactInfoService` to CRUD office hours. Bulk‑edit UI lets admins apply the same schedule to multiple days.
- **Service Layer (`services/contact-info.service.ts`)** – TypeScript wrapper around the backend API, exposing methods like `getAll`, `addOfficeHours`, `updateOfficeHours`, `deleteOfficeHours`.
- **Design System** – UI components (`Card`, `Button`, `Input`, `Switch`, `Checkbox`) live in `frontend/components/ui/` and follow a premium glass‑morphism style.

---

## Common Development Tasks

| Task | Command |
|------|---------|
| Install all deps | `npm install` |
| Run backend | `cd backend && npm run dev` |
| Run frontend | `cd frontend && npm run dev` |
| Lint & format | `npm run lint` / `npm run format` |
| Reset DB (drop tables) | Use Supabase dashboard → **SQL** → `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` then re‑run migrations. |
| Kill stray processes (port conflicts) | `lsof -i :5001 -t | xargs kill -9` (replace port as needed) |

---

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/awesome‑feature`).
3. Make your changes and ensure linting passes.
4. Open a Pull Request describing the changes.
5. Follow the **code‑style** guidelines (Prettier, ESLint) and write unit tests where applicable.

---

## License

This project is licensed under the **MIT License** – see the `LICENSE` file for details.

---

## Acknowledgements

- **Supabase** – for providing a fully‑managed PostgreSQL database with instant APIs.
- **Resend** – for simple transactional email integration.
- **Lucide‑react** – for clean, open‑source icons.
- The open‑source community for the countless utilities that make this stack possible.

---

*Happy hacking!*
