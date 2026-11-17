# L-23 LIFE: a class group web app

[Українською](README.uk.md)

A phone-first web app for one school class group: the schedule, who is on duty and shared photos,
in one place instead of a group chat where everything scrolls away. Signing in is optional: guests can read
Projects and the Schedule, and members sign in through a Telegram bot by sharing their contact, so
nobody has a password to remember. The interface is in Ukrainian.

It was built for a single class of roughly 20-40 people, and its data model follows that class's
real routine rather than trying to be a general school platform.

## What it does

- **Schedule.** Day-by-day view with a weekday strip and a calendar jump. Supports the alternating
  numerator/denominator weeks («чисельник» / «знаменник»), two subgroups (A and B) with shared
  classes spanning both, and up to four class periods a day. Recurring classes are entered once
  per weekday and week type, with per-date overrides.
- **Duty.** Cafeteria and board duty, assigned per date in a month editor and shown on the day it
  applies. Next to each name the editor shows how many turns that person has had in total, counted
  across every month in the database (not just the open one), so turns can be spread evenly.
  Several people can fill the same month at once: each tick is saved on its own, so one editor
  never erases names another editor just added.
- **Projects (Проєкти).** Topics with materials: PDF files, PPTX files (converted to PDF with
  LibreOffice) and ready slides. Anyone can read them, including guests; members add and remove
  materials. Each material has a public page at `/m/<token>` that opens in an in-app viewer with a
  presenter mode (fullscreen, PDF.js). Uploads are checked by file signature. Project and material
  pages are served with `noindex, nofollow, noarchive`, so search engines skip them.
- **Memories.** A feed of text and photos (PNG/JPG, checked by file signature) for members who are
  allowed to post.
- **Accounts and roles.** Superadmin, admin (class monitor) with per-person permissions (assigning
  duty, posting in Memories), and member. The superadmin registers members by phone number and
  name. The profile shows the member's avatar if one was saved earlier, and the superadmin has an
  audit log of created and deleted posts.

The layout is deliberately a fixed phone-width column at every screen size. The interface is dark
only, with one green accent for everyone. The web app manifest lets people add the site to their
home screen.

## Stack

- [Next.js](https://nextjs.org/) 16 (App Router) + TypeScript, React 19
- PostgreSQL + [Prisma](https://www.prisma.io/) 7 (with `@prisma/adapter-pg`)
- Tailwind CSS 4, Framer Motion, Vaul (bottom sheets), Phosphor icons
- [grammY](https://grammy.dev/) for the Telegram login bot
- `sharp` for image processing, `zod` for validation

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
   | `UPLOADS_DIR` | Optional: where avatars and photos are stored. Defaults to `public/uploads`. |
   | `PUBLIC_BASE_URL` | Public site address without a trailing slash, for example `https://2025-3.pp.ua`. Used to build public `/m/<token>` links and the «Відкрити в Microsoft» button, because Microsoft fetches the file from this address. |
   | `MATERIALS_DIR` | Where Projects files (PDF, PPTX, converted slides) are stored. Keep it outside `public/`, outside `.next/standalone` and not inside `UPLOADS_DIR`. Empty means `storage/materials` in development. **Required in production**: without it uploads and material pages return `503 storage_not_configured`. |
   | `SOFFICE_PATH` | Path to LibreOffice's `soffice`, used to convert PPTX to PDF. Defaults to `/usr/bin/soffice`. |
   | `CONVERSION_TIMEOUT_MS` | Optional: time limit for one conversion in milliseconds (default 120000). |
   | `CONVERTER_SANDBOX` | `bwrap` (default when empty) runs every conversion inside bubblewrap, see [PPTX conversion sandbox](#pptx-conversion-sandbox). `off` runs LibreOffice unsandboxed: development only, logs a loud warning, refused in production. |
   | `BWRAP_PATH` | Path to `bwrap`. Defaults to `/usr/bin/bwrap`. |
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
   - `localhost:8091`: guest (no auto-login; the dev picker of test users is in the Profile tab)

   `npm run dev:one` starts a single server on port 3000, which is quicker when you don't need all
   three roles.

PPTX uploads need LibreOffice and bubblewrap installed on the machine that runs the app (`soffice`
and `bwrap`, or `SOFFICE_PATH` and `BWRAP_PATH`). PDF uploads work without them. In production set
`MATERIALS_DIR` to a persistent directory outside the build output. On a development machine without
bubblewrap, set `CONVERTER_SANDBOX=off`.

### PPTX conversion sandbox

Uploaded PPTX files are untrusted, and the converted PDF is public. A crafted deck can link images,
media or OLE objects to `file:///…` or `http://…` targets, and LibreOffice fetches them while it
converts: local files (the app's `.env`, anything the app user can read) or cloud metadata
(`http://169.254.169.254/`) would end up in the public PDF. Three layers stop this:

1. `lib/server/pptxSafety.ts` inspects the zip before conversion and refuses external
   relationships other than hyperlinks, `file:`/`smb:`/UNC/absolute targets, linked OLE, `r:link`
   that does not point inside the package, DTDs, nested packages with the same problems, zip bombs
   (10 000 entries, 512 MB uncompressed) and malformed zips. A refused file gets
   `conversionStatus = FAILED` with `conversionError = unsafe_pptx:<reason>`. The original stays
   downloadable and «Відкрити в Microsoft» still works.
2. `lib/server/converterSandbox.ts` runs `soffice` inside bubblewrap: no network (all namespaces
   unshared), read-only `/usr` plus `/etc/fonts`, `/etc/ld.so.cache` and `/etc/libreoffice`, a
   private `/tmp`, and one writable bind: the job's own directory (a copy of the input, the output
   and a fresh LibreOffice profile). The app directory, its `.env`, `/home`, `/etc/passwd` and other
   materials do not exist inside. If `bwrap` is missing or its self-test fails, conversions fail;
   they never fall back to running unsandboxed.
3. The child gets only `PATH`, `HOME`, `LANG`, `LC_ALL` and `TMPDIR` (no `DATABASE_URL`, no
   `TELEGRAM_*`). The 120 s timeout kills the whole process tree.

Production setup (Ubuntu 24.04):

```bash
sudo apt install bubblewrap libreoffice-impress-nogui fonts-crosextra-carlito fonts-crosextra-caladea fonts-liberation2 fonts-dejavu
```

Ubuntu 24.04 restricts unprivileged user namespaces through AppArmor
(`kernel.apparmor_restrict_unprivileged_userns = 1`), and bubblewrap needs one. Check it as the
service user:

```bash
sudo -u <service-user> bwrap --unshare-all --die-with-parent --new-session \
  --ro-bind /usr /usr --symlink usr/bin /bin --symlink usr/lib /lib --symlink usr/lib64 /lib64 \
  --proc /proc --dev /dev --tmpfs /tmp -- /usr/bin/sh -c 'cat /proc/net/dev; echo BWRAP_OK'
```

`BWRAP_OK` after a table that lists only `lo` means it works. An error such as `bwrap: setting up
uid map: Permission denied` or `bwrap: loopback: Failed RTM_NEWADDR` means AppArmor blocks it. Allow
user namespaces for bwrap only (not system-wide):

```bash
sudo tee /etc/apparmor.d/bwrap <<'EOF'
abi <abi/4.0>,
include <tunables/global>

profile bwrap /usr/bin/bwrap flags=(unconfined) {
  userns,

  include if exists <local/bwrap>
}
EOF
sudo apparmor_parser -r /etc/apparmor.d/bwrap
```

Then run the check again. If the systemd unit sets `RestrictNamespaces=`, allow at least
`user mnt pid net ipc uts cgroup`. After a restart the app logs either
`[convert] sandbox ready: /usr/bin/bwrap, no network, …` or `[convert] SANDBOX NOT AVAILABLE (…)`.
Items that failed while the sandbox was broken can be retried with
`UPDATE "ProjectMaterial" SET "conversionStatus"='PENDING', "conversionAttempts"=0, "conversionError"=NULL WHERE kind='PPTX' AND "conversionError" LIKE 'sandbox_%';`
and a restart.

Other scripts: `npm run build`, `npm start`, `npm run bot` (the bot alone), `npm run lint`. The
production build uses `output: "standalone"`.

## Project structure

```
app/
  login/               redirects to /account (login lives in the Profile tab)
  (app)/projects/      topics and materials (public read, member write)
  (app)/schedule/      day view, plus admin editors for classes, duty and settings
  (app)/memories/      photo feed
  (app)/account/       profile, member management, audit log
  api/                 route handlers for every feature above
  uploads/[...path]/   serves uploaded files
  m/[token]/           public material page, viewer and raw file route
  pdfjs/               serves the PDF.js assets for the viewer
instrumentation.ts     starts the PPTX conversion queue on server boot
bot/                   grammY bot: /start and the shared-contact login check
components/            schedule, shared UI (bottom sheet, like button) and the app shell
  viewer/              PDF viewer and presenter
lib/
  auth/                sessions, phone normalisation, permissions, dev login
  schedule/            week parity, date ranges, resolving templates and overrides
  server/              data access per feature, audit log; projects.ts, materialStorage.ts,
                       fileSniff.ts, conversionQueue.ts, pptxSafety.ts, converterSandbox.ts,
                       publicUrl.ts for Projects
prisma/
  schema.prisma        data model
  migrations/          SQL migrations
  seed.ts              three fake test accounts for local development
  seed.production.ts   first superadmin for a fresh production database (reads env vars)
public/                emblem, retired service worker (it unregisters old installs)
```

`PRODUCT.md` describes the users, roles and product principles in more detail.

## License

[MIT](LICENSE)
