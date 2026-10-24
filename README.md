# L-23 LIFE: a class group web app

[Українською](README.uk.md)

A phone-first web app for one school class group: the schedule, who is on duty, homework, tasks and
small money collections, news and shared photos, in one place instead of a group chat where
everything scrolls away. Members sign in through a Telegram bot by sharing their contact, so
nobody has a password to remember. The interface is in Ukrainian.

It was built for a single class of roughly 20-40 people, and its data model follows that class's
real routine rather than trying to be a general school platform.

## What it does

- **Schedule.** Day-by-day view with a weekday strip and a calendar jump. Supports the alternating
  numerator/denominator weeks («чисельник» / «знаменник»), two subgroups (A and B) with shared
  classes spanning both, and up to four class periods a day. Recurring classes and duty rosters are
  entered once per weekday and week type, with per-date overrides.
- **Duty.** Cafeteria and board duty rosters as data, shown on the day they apply.
- **Homework.** Each class period has a homework panel where any member can add entries and edit or
  delete their own; entries are sorted by likes.
- **Tasks.** Plain to-dos that members mark done themselves, and fundraisers where only the person
  collecting the money records who has paid.
- **News.** Announcements from admins, with likes and pinning, nearest upcoming item first.
- **Memories.** A feed of text and photos (PNG/JPG, checked by file signature) for members who are
  allowed to post.
- **Accounts and roles.** Superadmin, admin (class monitor) with per-person permissions, and member.
  The superadmin registers members by phone number and name. Avatars can be pulled from Telegram,
  there is a light/dark theme and an accent colour, an audit log of created and deleted posts, and web push
  notifications (the app installs as a PWA, which iOS requires for push).

The layout is deliberately a fixed phone-width column at every screen size.

## Stack

- [Next.js](https://nextjs.org/) 16 (App Router) + TypeScript, React 19
- PostgreSQL + [Prisma](https://www.prisma.io/) 7 (with `@prisma/adapter-pg`)
- Tailwind CSS 4, Framer Motion, Vaul (bottom sheets), Phosphor icons
- [grammY](https://grammy.dev/) for the Telegram login bot
- `web-push` for notifications, `sharp` for image processing, `zod` for validation

## Running locally

Requirements: Node.js, npm, and a PostgreSQL 16 server (the commands below use Podman; Docker works
the same way).

1. Start Postgres once:
   ```bash
   podman run -d --name classgroup-postgres -p 5432:5432 \
     -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=classgroup \
     -v classgroup-pgdata:/var/lib/postgresql/data \
     docker.io/library/postgres:16-alpine
   ```
2. Copy the environment file and fill it in:
   ```bash
   cp .env.example .env
   ```
   | Variable | What it is |
   | --- | --- |
   | `DATABASE_URL` | Postgres connection string. The default matches the container above. |
   | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | Your bot from [@BotFather](https://t.me/BotFather). Can stay empty: the dev login and the rest of the app work without it. |
   | `DEV_LOGIN_ENABLED` | `"true"` enables the dev login that bypasses Telegram. It is also disabled by any production build. |
   | `DEV_LOGIN_AUTO_PHONE` | Optional: auto-login as the seeded user with this phone. |
   | `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push keys: `npx web-push generate-vapid-keys`. The two public keys hold the same value. |
   | `UPLOADS_DIR` | Optional: where avatars and photos are stored. Defaults to `public/uploads`. |
   | `SEED_SUPERADMIN_*` | Only for `prisma/seed.production.ts`, which creates the first superadmin in a fresh production database. |
3. Install dependencies, create the schema and seed three test accounts:
   ```bash
   npm install
   npx prisma migrate dev --config prisma7.config.ts
   npx prisma generate --config prisma7.config.ts
   npx prisma db seed --config prisma7.config.ts
   ```
   The Prisma config lives in `prisma7.config.ts`, and the client is generated into
   `lib/generated/prisma` (not committed).
4. Start everything:
   ```bash
   npm run dev
   ```
   This runs the same app on three ports, one per role, plus the bot process:
   - `localhost:8080`: superadmin (auto-login)
   - `localhost:8090`: admin (auto-login)
   - `localhost:8091`: guest (login screen with a dev picker of test users)

   `npm run dev:one` starts a single server on port 3000, which is quicker when you don't need all
   three roles.

Other scripts: `npm run build`, `npm start`, `npm run bot` (the bot alone), `npm run lint`. The
production build uses `output: "standalone"`.

## Project structure

```
app/
  (auth)/login/        login page: Telegram button and the dev login picker
  (app)/schedule/      day view, plus admin editors for classes, duty and settings
  (app)/tasks/         tasks and fundraisers
  (app)/news/          announcements
  (app)/memories/      photo feed
  (app)/account/       profile, notifications, member management, audit log
  api/                 route handlers for every feature above
  uploads/[...path]/   serves uploaded files
bot/                   grammY bot: /start and the shared-contact login check
components/            schedule, shared UI (bottom sheet, like button) and the app shell
lib/
  auth/                sessions, phone normalisation, permissions, dev login
  schedule/            week parity, date ranges, resolving templates and overrides
  server/              data access per feature, push notifications, audit log
  telegram/            Bot API client used by the web process
prisma/
  schema.prisma        data model
  migrations/          SQL migrations
  seed.ts              three fake test accounts for local development
  seed.production.ts   first superadmin for a fresh production database (reads env vars)
public/                emblem, service worker
proxy.ts               gives /login visitors the nonce cookie that binds a Telegram login to their browser
```

`PRODUCT.md` describes the users, roles and product principles in more detail.

## License

[MIT](LICENSE)
