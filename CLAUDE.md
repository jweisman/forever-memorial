# CLAUDE.md — Forever (לעולם) Memorial App

This file is automatically loaded by Claude Code at the start of every session.

## What This App Is

A memorial website where families create tribute pages for loved ones. Features: life story, photo galleries, eulogies, and community memory submissions (with owner moderation). Full English/Hebrew i18n with RTL layout.

## Tech Stack

| | |
|--|--|
| Framework | Next.js 16, App Router, React 19 |
| Language | TypeScript |
| Database | PostgreSQL 16 + Prisma 7 (driver adapter) |
| Auth | Auth.js v5 beta (`next-auth@beta`) — JWT strategy |
| Storage | S3-compatible (AWS S3 / MinIO locally) |
| Email | Nodemailer SMTP (`src/lib/email.ts`) |
| Styling | Tailwind CSS v4 (CSS-based config via `@theme inline` in `globals.css`) |
| i18n | next-intl v4 — locales: `en`, `he` (default: `en`) |

## Critical Prisma 7 Facts

Prisma 7 requires a **driver adapter** — there is no `datasourceUrl` on the constructor.

```ts
// src/lib/prisma.ts — the only correct way to instantiate
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
new PrismaClient({ adapter });
```

- Generated client is at `src/generated/prisma/` — import as `@/generated/prisma/client`
- Enums import from `@/generated/prisma/enums`
- `schema.prisma` has NO `url = env(...)` in datasource — DB URL lives only in `prisma.config.ts` (used for migrations) and at runtime via the pool
- Run migrations: `npx prisma migrate dev`
- **Never** use `new PrismaClient({ datasourceUrl: ... })`

## Auth.js v5 Facts

- Config in `src/lib/auth.ts` — exports `{ handlers, auth, signIn, signOut }`
- JWT strategy — token includes `id`, `role`, `disabled`, `checkedAt`
- `checkedAt`: re-checks `disabled`/`role` from DB every 5 minutes (ban enforcement)
- Providers: Google OAuth + Nodemailer magic link
- `ADMIN_EMAIL` env var: user with this email is auto-promoted to `ADMIN` on sign-in
- Pages: `signIn` → `/auth/signin` (locale-prefixed at runtime by next-intl)

## Middleware / Proxy

**The file is `src/proxy.ts`, not `middleware.ts`** (Next.js 16 renamed it).

Auth protection logic:
1. If path has **no locale prefix** (e.g. `/dashboard` from a NextAuth post-login redirect) → pass straight to i18n middleware, don't auth-check yet
2. If path has locale prefix and is under `/dashboard` → call `getToken()` with `secureCookie: isSecure` (critical for production HTTPS where cookie is `__Secure-authjs.session-token`)
3. `getToken()` **cannot** import Prisma — Edge Runtime only

```ts
// Always pass secureCookie based on protocol, not NODE_ENV
const isSecure = request.nextUrl.protocol === "https:";
const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie: isSecure });
```

## i18n Routing

- All pages live under `src/app/[locale]/`
- URLs: `/en/dashboard`, `/he/memorial/[slug]`, etc.
- **Always use `@/i18n/navigation`** for `Link`, `useRouter`, `redirect` — never `next/link` or `next/navigation` directly inside locale pages/components, or non-default locales will break
- Translation files: `src/messages/en.json` and `src/messages/he.json`
- Namespaces match component names (e.g. `"Memorial"`, `"Dashboard"`, `"Admin"`)
- Server components: `getTranslations("Namespace")` | Client components: `useTranslations("Namespace")`
- Adding a new translated string: add the key to **both** `en.json` and `he.json`

## File Structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── auth/signin/        # Sign-in page (magic link + Google)
│   │   ├── dashboard/          # User dashboard (profile, memorials, reviews)
│   │   │   ├── admin/          # Admin panel (memorials + users management)
│   │   │   └── create/         # Create memorial wizard
│   │   ├── memorial/[slug]/    # Public memorial page
│   │   │   └── edit/           # Edit memorial (owner only)
│   │   ├── search/             # Search results
│   │   ├── error.tsx           # Locale-scoped error boundary
│   │   └── not-found.tsx       # 404 page
│   ├── api/
│   │   ├── admin/              # Admin-only endpoints (require ADMIN role)
│   │   ├── eulogies/extract-text/ # POST — extract text from .docx upload (mammoth)
│   │   ├── memorials/[id]/     # Memorial CRUD + albums/images/eulogies/memories
│   │   ├── search/             # Fuzzy search (pg_trgm, word_similarity)
│   │   ├── user/               # Profile update, submissions, account delete
│   │   └── health/             # GET /api/health → DB ping
│   ├── global-error.tsx        # Root error boundary (inline styles only)
│   └── globals.css             # Tailwind @theme, custom CSS, scrollbar-hide
├── components/
│   ├── ui/                     # Button, Card, SearchBar, Toast, MemorialCard, SectionHeading
│   ├── memorial/               # GalleryView, Lightbox, ScrollableRow, EulogyList, etc.
│   └── DisableBodyDrop.tsx     # Prevents browser navigation on accidental file drop (in layout)
├── generated/prisma/           # Prisma generated output (don't edit manually)
├── i18n/
│   ├── routing.ts              # defineRouting({ locales, defaultLocale })
│   └── navigation.ts           # Re-exports Link, useRouter, redirect with locale support
├── lib/
│   ├── auth.ts                 # NextAuth config
│   ├── prisma.ts               # Prisma client singleton (driver adapter)
│   ├── email.ts                # sendNotification() + 4 email templates
│   ├── hebrewDate.ts           # getHebrewDeathDate() — Gregorian → Hebrew calendar string
│   ├── s3.ts / s3-helpers.ts   # S3 presigned URL helpers
│   ├── rate-limit.ts           # In-memory sliding-window rate limiter
│   ├── admin.ts                # requireAdmin() helper for API routes
│   ├── slug.ts                 # Slug generation for memorial URLs
│   └── upload.ts               # Upload orchestration
├── messages/
│   ├── en.json
│   └── he.json
└── proxy.ts                    # Middleware (auth guard + i18n)
```

## Design System

- **Theme**: "Warm & Intimate" — `warm-50` to `warm-900`, `gold-300` to `gold-600`
- **Fonts**: Lora (headings, `font-heading`), Source Sans 3 (body)
- **Color contrast note**: `warm-400` is `#8A7B6B` (darkened for WCAG AA)
- Tailwind v4: config lives in `globals.css` as CSS variables under `@theme inline`, not `tailwind.config.js`
- Toast system: `<ToastProvider>` wraps layout; use `useToast()` hook in client components
- Loading skeletons exist for memorial, dashboard, and search pages (`loading.tsx` files)

## API Route Conventions

- Protected routes call `auth()` from `src/lib/auth.ts` (server-side, has Prisma access)
- Admin routes call `requireAdmin()` from `src/lib/admin.ts`
- Rate limiting: `rateLimit({ key, limit, windowMs })` from `src/lib/rate-limit.ts` — in-memory, per-instance (fine for Vercel)
- Email notifications are fire-and-forget: call `sendNotification(...)` without `await`
- S3 uploads use presigned URLs: client requests URL → uploads directly → calls `/confirm` endpoint

## Database Schema Summary

Models: `User`, `Account`, `Session`, `VerificationToken` (NextAuth), `Memorial`, `Album`, `Image`, `Eulogy`, `Memory`, `MemoryImage`

Key relationships:
- `User` → owns many `Memorial`s
- `Memorial` → has `Album[]`, `Eulogy[]`, `Memory[]`
- `Album` → has `Image[]`
- `Memory` → submitted by `User`, belongs to `Memorial`, has `MemoryImage[]`
- `Memory.status`: `PENDING | ACCEPTED | IGNORED | RETURNED`

Notable `Memorial` fields: `deathAfterSunset Boolean @default(false)` — when true, Hebrew date is calculated as the next day (sunset = start of next Jewish day). See `src/lib/hebrewDate.ts`.

Fuzzy search requires: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (run once per DB). Search uses `word_similarity(query, name) > 0.4` (not `similarity`) to avoid false positives from names that share a common prefix.

## Environment Variables

See `.env.example` for full docs. Required in production:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (SSL handled by provider via connection string) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | Must match deployment domain exactly |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth — optional if only using magic link |
| `EMAIL_SERVER` | SMTP connection string — required in prod, falls back to Mailhog locally |
| `FROM_EMAIL` | Sender address |
| `ADMIN_EMAIL` | Auto-promoted to ADMIN on sign-in |
| `S3_BUCKET` | Upload bucket |
| `S3_ACCESS_KEY/SECRET` | AWS or MinIO credentials |
| `S3_REGION` | e.g. `us-east-1` |
| `S3_ENDPOINT` | Omit for real S3; set to MinIO URL locally |

## Local Development

```bash
docker compose up -d       # Postgres :5433, MinIO :9000/:9001, Mailhog :1025/:8025
cp .env.example .env       # defaults work out of the box
npx prisma migrate dev
npm run dev
```

| Service | URL | Credentials |
|---|---|---|
| App | http://localhost:3000 | — |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| Mailhog (email UI) | http://localhost:8025 | — |

## Deployment (Vercel)

- `postinstall` script runs `prisma generate` automatically during build
- `npm run build` in `package.json` is: `prisma migrate deploy && prisma generate && next build`
- No SSL config needed in `prisma.ts` — managed Postgres providers embed SSL in the connection string
- `EMAIL_SERVER` must be set (no Mailhog fallback in production)
- Health check: `GET /api/health`

## Known Gotchas

1. **`proxy.ts` not `middleware.ts`** — Next.js 16 uses `proxy.ts` as the middleware filename
2. **`secureCookie` in getToken** — Must pass `secureCookie: isSecure` based on `request.nextUrl.protocol`, otherwise the JWT cookie is not found on HTTPS (production cookie name is `__Secure-authjs.session-token`)
3. **No locale prefix on NextAuth redirects** — After login, NextAuth redirects to e.g. `/dashboard` (bare). The proxy must pass these to i18n middleware first, not auth-check them
4. **Prisma in Edge Runtime** — `src/lib/prisma.ts` cannot be imported in `proxy.ts` (Edge Runtime). Use `getToken()` for lightweight auth checks there
5. **`@/i18n/navigation` not `next/link`** — Using `next/link` directly breaks locale-aware navigation for non-default locales
6. **Prisma 7 import paths** — Client: `@/generated/prisma/client`, Enums: `@/generated/prisma/enums`
7. **Rate limiter is per-instance** — In-memory, so limits apply per Vercel function instance, not globally. Acceptable for the current scale
