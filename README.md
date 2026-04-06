# Forever (לעולם)

A memorial website where families can create lasting tribute pages for loved ones. Visitors can share memories, photos, and eulogies — all collected in one place.

## Features

- **Legacy pages** — Create a page with a life story (with rich text: bold, italic, H2/H3 headings), burial details, memorial projects & charities, external links, photos, and eulogies
- **Page navigation** — Sticky section nav auto-appears on scroll with a pinned "Share a Memory" CTA; only sections with content are shown
- **Hebrew date (Yahrzeit)** — Automatically displays the Hebrew calendar date of passing alongside the Gregorian date; supports after-sunset adjustment
- **Yahrzeit calendar** — One-click download of the next 15 yahrzeit dates as an `.ics` calendar import (Apple Calendar, Google Calendar, Outlook) or a printable PDF
- **QR code poster** — Download a printable A4 PDF poster with a QR code linking to the memorial page, for use at shiva or condolence visits so guests can submit their own memories
- **Feed** — Authenticated users land on a personalized feed showing recent accepted memories from pages they own or follow, plus the latest legacy pages; submitting a memory auto-follows that page
- **Follow legacy pages** — Logged-in users can follow any legacy page they don't own; followed pages appear in the dashboard for easy access
- **Memory submissions** — Anyone with an account can submit memories with photos or videos; the page owner reviews and approves them
- **Photo & video galleries** — Organized into drag-and-drop albums with lightbox viewing; supports MP4/WebM/MOV video uploads alongside images, keyboard navigation, mobile swipe gestures, and a loading indicator
- **Eulogies** — Add, edit, and reorder eulogies with speaker attribution; import text directly from a Word (.docx) file
- **Search** — Fuzzy name search powered by PostgreSQL `pg_trgm`
- **Admin panel** — Manage all memorials and users, ban/unban, enable/disable
- **Email notifications** — Owners are notified of new submissions; submitters are notified of review decisions
- **i18n** — Full English and Hebrew support with RTL layout (via `next-intl`)
- **Auth** — Google OAuth and magic link email sign-in (via Auth.js v5)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL 16 + Prisma 7 (driver adapter) |
| Auth | Auth.js v5 (NextAuth) — JWT strategy |
| Storage | S3-compatible (AWS S3 or MinIO for dev) |
| Email | Nodemailer SMTP (SES, Mailhog, or any SMTP server) |
| Styling | Tailwind CSS v4 |
| i18n | next-intl (English + Hebrew with RTL) |
| PDF generation | pdfkit (server-side, yahrzeit calendar + QR poster) |

## Project Structure

```
src/
├── app/
│   ├── [locale]/              # Locale-scoped pages
│   │   ├── auth/signin/       # Sign-in page
│   │   ├── dashboard/         # User dashboard + admin panel
│   │   │   ├── admin/         # Admin: manage memorials & users
│   │   │   └── create/        # Create new memorial
│   │   ├── feed/              # Feed page (authenticated home)
│   │   ├── memorial/[slug]/   # Public memorial page
│   │   │   └── edit/          # Edit memorial (owner only)
│   │   └── search/            # Search results
│   ├── api/                   # API routes
│   │   ├── admin/             # Admin endpoints
│   │   ├── feed/              # Feed API: activity + latest legacy pages
│   │   ├── memorials/[id]/    # Memorial CRUD, albums, images, eulogies, memories, links, follow
│   │   ├── search/            # Fuzzy search
│   │   ├── user/              # Profile, submissions, follows, account deletion
│   │   └── health/            # Health check
│   ├── global-error.tsx       # Root error boundary
│   └── globals.css            # Tailwind theme + custom utilities
├── components/
│   ├── ui/                    # Design system: Button, Card, Toast, SearchBar, etc.
│   └── memorial/              # Memorial-specific: GalleryView, Lightbox, ScrollableRow
├── generated/prisma/          # Prisma generated client
├── i18n/                      # next-intl config & navigation helpers
├── lib/                       # Server utilities: auth, prisma, s3, email, rate-limit, admin
└── messages/                  # Translation files (en.json, he.json)
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose

### 1. Clone and install

```bash
git clone <repo-url>
cd forever-memorial
npm install
```

### 2. Start local services

Docker Compose provides PostgreSQL (port 5433), MinIO (ports 9000/9001), and Mailhog (ports 1025/8025):

```bash
docker compose up -d
```

### 3. Configure environment

```bash
cp .env.example .env
```

The defaults work for local development out of the box. You'll need to fill in:

- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (optional, for OAuth)
- `ADMIN_EMAIL` — your email to get admin access on first sign-in

### 4. Set up the database

```bash
npx prisma migrate dev
```

Enable the `pg_trgm` extension for fuzzy search (run once against your database):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local service UIs

| Service | URL |
|---------|-----|
| App | [http://localhost:3000](http://localhost:3000) |
| MinIO Console | [http://localhost:9001](http://localhost:9001) (minioadmin / minioadmin) |
| Mailhog | [http://localhost:8025](http://localhost:8025) |

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `S3_BUCKET` | Yes | S3 bucket name for uploads |
| `S3_ENDPOINT` | Dev only | MinIO endpoint (omit for real S3) |
| `AUTH_SECRET` | Yes | Auth.js session secret |
| `AUTH_URL` | Yes | App URL (e.g. `https://yourdomain.com`) |
| `EMAIL_SERVER` | Production | SMTP connection string |
| `FROM_EMAIL` | Yes | Sender email address |
| `EMAIL_CUSTOM_HEADER` | No | Custom header injected into every email (e.g. `"X-SES-CONFIGURATION-SET: smtp-logging"`) |
| `ADMIN_EMAIL` | Yes | Auto-promoted to admin on sign-in; supports comma-separated list for multiple admins |

## Deployment

The app is designed for Vercel with a managed PostgreSQL provider (Neon, Supabase, etc.) and AWS S3.

1. Set all production environment variables in Vercel
2. The `postinstall` script runs `prisma generate` automatically during build
3. SSL is auto-enabled for the database connection in production
4. `EMAIL_SERVER` must be set in production (no Mailhog fallback)

### Health check

`GET /api/health` returns `200` with DB connectivity status.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run all unit tests (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run test:e2e` | Run E2E tests (Playwright, requires dev server + Docker) |
| `npx prisma migrate dev` | Run database migrations |
| `npx prisma studio` | Open Prisma Studio (DB browser) |

## License

This app is covered by the MIT license. Homepage [Tree of Life](https://stock.adobe.com/il/images/medium-shot-tree-of-life-with-roots-doves-butterflies-in-pastel-colors-on-white-background/1024544078) hero image licensed from [suchetpong @ Adobe](https://stock.adobe.com/il/contributor/212217662/suchetpong?load_type=author&prev_url=detail)

## Coding

The coding in the app was done by Claude Code.