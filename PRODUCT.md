# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript, PostgreSQL + Prisma, Tailwind CSS, Framer Motion, grammY (Telegram bot). Explicitly chosen by the user (not delegated) after being offered this and one alternative (SvelteKit).

## Users

A single school/university class group (~20-40 students, split into two subgroups "A" and "B" for some classes). Three roles:
- **Superadmin** - the group's organizer (the user building this app). Registers every member, has full control.
- **Admin ("староста" / class monitor)** - trusted member with most management permissions, appointed later by the superadmin.
- **Member** - the rest of the class. Reads everything, self-reports simple task completion, contributes homework notes, likes things, and may or may not be individually permitted to post in the Memories feed (a per-person flag, independent of role).

Everyone accesses this primarily on their phone, often between or during classes.

## Product Purpose

Replaces the scattered mix of group chats, verbal announcements, and paper duty rosters that a school class normally relies on, with one shared, phone-first source of truth for the group: who's on duty today, what's due, who's paid into the current collection, what the schedule is (including the numerator/denominator alternating-week system), and shared photo memories of the group. Success is the class actually checking it instead of asking "what did I miss" in a chat.

## Positioning

Unlike a generic group chat (where anything important scrolls away in minutes) or a generic shared spreadsheet (which nobody opens on a phone between classes), this is purpose-built around exactly this class's real mechanics: Telegram-native identity (the messaging app the class already lives in, used only to prove "this phone number is really this person" - no separate password to remember), the school's specific numerator/denominator schedule cycle, a two-subgroup (A/B) timetable split with shared classes spanning both, and duty rosters as first-class data rather than a photo of a paper sheet.

## Operating Context

- Phone-first, used standing in a hallway or sitting in class; the web app deliberately renders as a fixed phone-width column even on a desktop browser rather than reflowing wide.
- Telegram is the class's existing communication tool - login rides on a Telegram bot conversation (share contact to prove your phone number), not a new app to install or a password to create.
- Ukrainian is the interface language throughout (UI copy, bot replies).
- Real money changes hands for small group collections (e.g. a gift for a teacher) and is tracked per-person by whoever manages it.
- The academic schedule alternates between two week types ("чисельник" / numerator and "знаменник" / denominator), a standard Ukrainian secondary/higher-ed pattern, affecting both the class schedule and duty rosters.

## Capabilities and Constraints

- Auth: admin pre-registers each member by phone + full name; the member's own action is a single "Authorize via Telegram" button, which hands off to a Telegram bot conversation for contact sharing and phone-number matching. No separate password.
- Tasks/Reminders: generic to-do items members self-mark done, plus a Fundraiser sub-type where an admin/starosta (not the member) records each person's payment status (paid, paid with a note, or unpaid-by-default) in a per-task roster.
- News: admin-authored announcements, likeable, sorted with the temporally nearest upcoming item at the top.
- Schedule: the most complex surface. Day-by-day navigation (weekday strip + calendar jump), a two-column A/B group split with classes shared by both groups spanning the full width, cafeteria and board-duty rosters, up to four class slots per day (subject/teacher/room, deliberately terse text), and a homework panel per class slot where any member can add/edit-own/delete-own (or admin delete-any) entries, sorted by like count. All recurring data (duty, class templates) is entered once per (weekday, week-parity) pair with the ability to override a single concrete date.
- Memories: an X/Twitter-shaped feed of text + photos (PNG/JPG only, validated by file signature, no video) for people individually flagged as allowed to post, likeable.
- Account: refresh avatar from the linked Telegram account, light/dark theme toggle, logout.
- Constraint: the whole UI is phone-width-constrained at every viewport size by explicit user instruction, not just "mobile-first responsive" - there is no wide-desktop layout variant anywhere in this product.
- Constraint: ~20-40 total users. Feeds fetch-all-and-sort rather than paginate, except the photo-heavy Memories feed which paginates.
- Terminology (Ukrainian, used verbatim in the UI): "чергові" (duty/on-duty people), "пара" (a class period), "ДЗ" (homework), "чисельник"/"знаменник" (numerator/denominator week), "здано" (submitted/paid).
- Local dev runs the same build three times on three ports (one per role) with a dev-only Telegram-bypass login; this never ships in the production build.
- Eventual deployment target: a single Oracle Cloud VM under the domain `2025-3.pp.ua`.

## Brand Commitments

None established. No existing name beyond the class code implied by the domain (`2025-3`, read as "class of 2025, group 3"), no logo, no palette. Free to establish via new-work.

## Evidence on Hand

None. Greenfield project, no existing content, copy, or visual assets to preserve. Do not fabricate testimonials, sample people, or sample data beyond clearly-fake seed/placeholder fixtures.

## Product Principles

1. Phone-first is not a breakpoint, it is the only viewport: every screen must work and look intentional at ~390-430px, because that is the only width that will ever actually render for a real user.
2. Identity rides on Telegram, trust rides on the admin: the phone-number match is the sole gate, and failure always routes back to a human (the admin/starosta), never a dead end.
3. Recurring data beats one-off data entry: anything that repeats by weekday and week-parity (duty, class schedule) is modeled and entered once, with per-date overrides as the exception, not the rule.
4. Self-report where trust is fine, admin-record where money is real: task completion is self-toggled, but fundraiser payment status is only ever set by whoever is actually collecting the money.
5. Quiet by default, terse by design: subject names, teacher names, and room numbers carry the information; the UI does not add explanatory text the students do not need.

## Accessibility & Inclusion

No product-specific requirement established beyond the general web baseline (WCAG AA contrast, honoring `prefers-reduced-motion`, dark and light mode both fully supported).
