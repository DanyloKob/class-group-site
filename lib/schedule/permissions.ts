import { canModerateHomework } from "@/lib/permissions";

export { canManageDuty, canManageScheduleSettings, canOpenScheduleAdmin } from "@/lib/permissions";

type HomeworkLike = { authorId: string };
type CurrentUser = { id: string; isSuperAdmin: boolean; canManageSchedule: boolean };

// Edit is always self-only, even for the superadmin or a homework moderator -
// only the author's own wording can be changed. Delete adds moderators.
// Liking your own entry is blocked because likes drive the sort order here
// (more likes = higher), unlike News/Memories where self-liking is harmless.
export function canEditHomework(user: CurrentUser, homework: HomeworkLike): boolean {
  return user.id === homework.authorId;
}

export function canDeleteHomework(user: CurrentUser, homework: HomeworkLike): boolean {
  return user.id === homework.authorId || canModerateHomework(user);
}

export function canLikeHomework(user: CurrentUser, homework: HomeworkLike): boolean {
  return user.id !== homework.authorId;
}
