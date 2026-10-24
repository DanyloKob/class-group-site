import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const ENTITY_LABEL: Record<string, string> = {
  News: "Новина",
  Task: "Завдання",
  Homework: "ДЗ",
  MemoryPost: "Спогад",
};

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) redirect("/account");

  const entries = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { firstName: true, lastName: true } } },
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 px-5 pb-2 pt-6">
        <Link href="/account" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-lg font-semibold">Дії</h1>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
          <p className="text-sm text-ink-muted">Поки що немає жодної дії.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5 pb-6">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 rounded-2xl bg-surface p-3.5">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  entry.action === "CREATE" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                }`}
              >
                {entry.action === "CREATE" ? <Plus size={14} weight="bold" /> : <Trash size={14} weight="bold" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">
                    {entry.actor.lastName} {entry.actor.firstName}
                  </span>{" "}
                  <span className="text-ink-muted">
                    {entry.action === "CREATE" ? "створив(ла)" : "видалив(ла)"} {ENTITY_LABEL[entry.entityType] ?? entry.entityType}
                  </span>
                </p>
                <p className="truncate text-xs text-ink-muted">{entry.summary}</p>
              </div>
              <span className="shrink-0 text-[11px] text-ink-muted">
                {new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
                  entry.createdAt,
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
