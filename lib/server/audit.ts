import "server-only";
import { prisma } from "@/lib/db";

export type AuditEntityType = "News" | "Task" | "Homework" | "MemoryPost";

/**
 * Fire-and-forget by design: a logging failure must never break the real
 * mutation it's describing. The row itself already records who created it
 * (authorId/createdById) - this only exists to keep that trail after a
 * DELETE removes the row it would otherwise live on.
 */
export async function logAudit(
  actorId: string,
  action: "CREATE" | "DELETE",
  entityType: AuditEntityType,
  summary: string,
) {
  try {
    await prisma.auditLog.create({ data: { actorId, action, entityType, summary: summary.slice(0, 200) } });
  } catch (error) {
    console.error("[audit] failed to log entry", { actorId, action, entityType, error });
  }
}
