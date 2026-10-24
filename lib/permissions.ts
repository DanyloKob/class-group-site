/**
 * Flat, per-person permissions - no role hierarchy. isSuperAdmin is the one
 * fixed "owner" switch (never toggled through the member-editing UI) and
 * implicitly grants everything below it; everyone else's abilities are
 * exactly whichever of these independent flags were turned on for them.
 *
 * canPostMemories is the deliberate exception: even the superadmin needs
 * this flag explicitly set to post in Memories (it's set on the superadmin
 * seed account for that reason). This was an explicit, considered choice
 * against an automatic bypass, not an oversight - don't "fix" it to match
 * the other functions.
 *
 * Deliberately free of any import from "@/lib/generated/prisma/client":
 * these functions run in client components too (e.g. MemoryFeed's own
 * moderation check), and even a type-only import from that module has
 * dragged its Node-only runtime into a client bundle before - see the
 * comment in prisma7.config.ts-adjacent code for the incident. Plain
 * inline object types keep this file provably safe in either bundle.
 */

export function canManageTasks(user: { isSuperAdmin: boolean; canManageTasks: boolean }): boolean {
  return user.isSuperAdmin || user.canManageTasks;
}

export function canManageNews(user: { isSuperAdmin: boolean; canManageNews: boolean }): boolean {
  return user.isSuperAdmin || user.canManageNews;
}

/**
 * Deleting someone else's homework entry. NOT schedule administration.
 *
 * The flag behind this is still the `canManageSchedule` column, and the name
 * used to be canManageSchedule too - which is exactly how every holder of the
 * "can write homework" permission ended up able to rewrite the finished duty
 * roster and edit the class timetable. The function is named for what it
 * actually authorises so that mistake can't be made by autocomplete again.
 */
export function canModerateHomework(user: { isSuperAdmin: boolean; canManageSchedule: boolean }): boolean {
  return user.isSuperAdmin || user.canManageSchedule;
}

export function canPostMemories(user: { canPostMemories: boolean }): boolean {
  return user.canPostMemories;
}

/** Assigning who is on duty on which date. Nothing else in /schedule/admin. */
export function canManageDuty(user: { isSuperAdmin: boolean; canManageDuty: boolean }): boolean {
  return user.isSuperAdmin || user.canManageDuty;
}

/**
 * Class timetable, one-off class overrides and the numerator/denominator
 * anchor. Superadmin only, on purpose: there is no grantable flag for it,
 * because a wrong parity anchor silently rewrites what every past and future
 * date resolves to.
 */
export function canManageScheduleSettings(user: { isSuperAdmin: boolean }): boolean {
  return user.isSuperAdmin;
}

/** Whether the gear in the schedule header leads anywhere for this person. */
export function canOpenScheduleAdmin(user: {
  isSuperAdmin: boolean;
  canManageDuty: boolean;
}): boolean {
  return canManageScheduleSettings(user) || canManageDuty(user);
}

type PermissionFlags = {
  isSuperAdmin: boolean;
  canManageTasks: boolean;
  canManageNews: boolean;
  canManageSchedule: boolean;
  canManageDuty: boolean;
  canPostMemories: boolean;
};

/** Short Ukrainian label for a person's flags - used anywhere a role name used to go (account page, dev-login picker). */
export function permissionSummaryLabel(user: PermissionFlags): string {
  if (user.isSuperAdmin) return "супер-адмін";
  const labels = [
    user.canManageTasks && "збори",
    user.canManageNews && "оголошення",
    user.canManageSchedule && "дз",
    user.canManageDuty && "чергові",
    user.canPostMemories && "спогади",
  ].filter((label): label is string => Boolean(label));
  return labels.length > 0 ? labels.join(" · ") : "учасник";
}
