# Forever (לעולם) Memorial — Implementation Plan

## Tech Stack
- **Framework:** Next.js (App Router) + TypeScript
- **Auth:** NextAuth.js (Google + email magic link)
- **DB:** Postgres with Prisma ORM
- **Storage:** AWS S3 (presigned uploads/signed URLs)
- **Email:** AWS SES
- **Local Dev:** Docker Compose (Postgres + MinIO)
- **i18n:** next-intl (UI only, English + Hebrew/RTL)

---

## Phase 1: Project Scaffolding & Infrastructure [COMPLETE]
- Next.js project with TypeScript, Tailwind CSS, App Router
- Docker Compose: Postgres 16 + MinIO
- Prisma schema with all models
- Environment configuration
- Base layout shell (Header, Footer, landing page)

## Phase 2: Authentication & User Management [COMPLETE]
- NextAuth.js with Google OAuth + Email (magic link) providers
- Prisma adapter for user/session storage
- Sign-in/register page
- User profile edit (name, avatar)
- Account deletion with cascade warning

## Phase 3: Memorial Pages — CRUD & Display [COMPLETE]
- Memorial creation form (name, date of death required)
- Friendly URL slugs: `/memorial/[id]-[slugified-name]`
- Memorial view page with all sections
- Memorial edit mode (owner-only)
- User dashboard: list memorials, create, delete
- Eulogy CRUD (add/edit/remove/reorder)
- SEO: metadata, Open Graph, structured data

## Phase 4: Image Gallery & S3 Integration [COMPLETE]
- S3 presigned URL generation API routes
- Image upload component (drag-and-drop, 5MB limit)
- Album management (default album auto-created)
- Gallery view with album sections
- 100-image limit per memorial
- Memorial picture upload through same S3 flow

## Phase 5: Memory Submission & Review Workflow [COMPLETE]
- Memory submission form (name, withhold option, relation, text, images)
- Review queue in dashboard (pending memories grouped by memorial)
- Review actions: Accept, Edit, Ignore, Return (with message)
- "Ignored memories" toggle in review list
- Return flow: email with link, submitter edits, resubmit, back in queue
- Accepted memories displayed on memorial page (chronological)
- Page owner can edit accepted memories in edit mode

## Phase 6: Search [COMPLETE]
- `pg_trgm` extension + GIN trigram index on memorial name
- Search API with ILIKE/trigram similarity
- Typeahead component (debounced, suggestions: "Name (place of death)")
- Search results page (name, picture, place/date of death)
- Persistent search bar in header
- Landing page with hero, search, recent memorials grid

## Phase 7: Internationalization (English + Hebrew) [COMPLETE]
- `next-intl` with locale routing (`/en/...`, `/he/...`)
- Extract UI strings to message files
- Language picker in header
- RTL CSS support (Tailwind RTL plugin or logical properties)

## Phase 8: Admin Capabilities
- Admin seeded via `ADMIN_EMAIL` environment variable
- Admin guards on API routes
- Admin-only UI controls: disable page, remove memories
- Ban/disable user capability
- Disabled memorials show notification message

## Phase 9: Email Notifications
- AWS SES integration (local dev: console logging or Mailhog)
- Email templates: memory accepted, returned (with edit link), new submission
- Notification triggers on memory status changes

## Phase 10: Polish & Deployment Readiness
- Responsive design pass (mobile + desktop)
- Loading states, error boundaries, toast notifications
- Rate limiting on API routes
- Production environment config docs
- Performance: memorial pages < 2s load time
- Accessibility pass (semantic HTML, ARIA, keyboard nav)
