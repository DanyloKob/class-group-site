import "server-only";
import { prisma } from "@/lib/db";
import { sortByNearestDate } from "@/lib/sortByNearestDate";

// PaymentStatus (Prisma) only ever covers PAID/PAID_WITH_NOTE - UNPAID is a
// computed, never-persisted third state, so it needs its own explicit type
// rather than relying on `??` to widen the Prisma enum type.
export type FundraiserStatus = "UNPAID" | "PAID" | "PAID_WITH_NOTE";

export async function getTaskFeed(currentUser: { id: string }) {
  const [tasks, totalMembers] = await Promise.all([
    prisma.task.findMany({
      where: { archivedAt: null },
      include: {
        completions: { where: { userId: currentUser.id }, select: { userId: true } },
        entries: { where: { userId: currentUser.id }, select: { status: true, note: true } },
        _count: { select: { completions: true, entries: true } },
      },
    }),
    prisma.user.count(),
  ]);

  const shaped = tasks.map((task) => {
    const base = {
      id: task.id,
      type: task.type,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      progressTotal: totalMembers,
    };
    if (task.type === "PLAIN") {
      return {
        ...base,
        type: "PLAIN" as const,
        progressDone: task._count.completions,
        myDone: task.completions.length > 0,
      };
    }
    return {
      ...base,
      type: "FUNDRAISER" as const,
      progressDone: task._count.entries,
      myStatus: (task.entries[0]?.status ?? "UNPAID") as FundraiserStatus,
      myNote: task.entries[0]?.note ?? null,
    };
  });

  return sortByNearestDate(
    shaped,
    (t) => t.dueDate,
    (t) => t.createdAt,
  );
}

export type TaskFeedItem = Awaited<ReturnType<typeof getTaskFeed>>[number];

export async function getTaskDetail(taskId: string, currentUserId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      completions: { where: { userId: currentUserId } },
      entries: { where: { userId: currentUserId } },
      _count: { select: { completions: true, entries: true } },
    },
  });
  if (!task) return null;

  const totalMembers = await prisma.user.count();

  return {
    id: task.id,
    type: task.type,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    progressTotal: totalMembers,
    progressDone: task.type === "PLAIN" ? task._count.completions : task._count.entries,
    myDone: task.completions.length > 0,
    myStatus: (task.entries[0]?.status ?? "UNPAID") as FundraiserStatus,
    myNote: task.entries[0]?.note ?? null,
  };
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

export async function getFundraiserRoster(taskId: string) {
  const [members, entries] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.fundraiserEntry.findMany({
      where: { taskId },
      include: { recordedBy: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const entryByUserId = new Map(entries.map((e) => [e.userId, e]));

  return members.map((member) => {
    const entry = entryByUserId.get(member.id);
    return {
      userId: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      status: (entry?.status ?? "UNPAID") as FundraiserStatus,
      note: entry?.note ?? null,
      recordedBy: entry?.recordedBy ?? null,
      recordedAt: entry?.recordedAt ?? null,
    };
  });
}

export async function getCompletionRoster(taskId: string) {
  const [members, completions] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.taskCompletion.findMany({ where: { taskId } }),
  ]);

  const doneUserIds = new Set(completions.map((c) => c.userId));

  return members.map((member) => ({
    userId: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    done: doneUserIds.has(member.id),
  }));
}
