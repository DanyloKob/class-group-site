import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/auth/session";
import { getTopicDetail } from "@/lib/server/projects";
import { AddMaterialButton } from "@/app/(app)/projects/_components/AddMaterialButton";
import { DeleteTopicButton } from "@/app/(app)/projects/_components/DeleteTopicButton";
import { MaterialRow } from "@/app/(app)/projects/_components/MaterialRow";
import { dueLabel } from "@/app/(app)/projects/_lib/format";

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const user = await getCurrentUser();
  const topic = await getTopicDetail(topicId, user ? { id: user.id, isSuperAdmin: user.isSuperAdmin } : null);
  if (!topic) notFound();

  const due = dueLabel(topic.dueDate);
  // Newest first, regardless of what the data layer returns.
  const materials = [...topic.materials].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 px-5 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <Link
            href="/projects"
            aria-label="До списку тем"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-transform active:scale-90"
          >
            <CaretLeft size={20} />
          </Link>
          <div className="flex items-center gap-1">
            {topic.canDelete && <DeleteTopicButton topicId={topic.id} />}
            {user && <AddMaterialButton topicId={topic.id} />}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="break-words text-xl font-semibold leading-snug tracking-tight">{topic.title}</h1>
          <div className="flex items-center gap-2 text-xs">
            {topic.subject && (
              <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] text-ink-muted">
                {topic.subject}
              </span>
            )}
            <span className={due.urgent && !topic.isPast ? "font-medium text-accent" : "text-ink-muted"}>{due.text}</span>
          </div>
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-8 text-center">
          <p className="text-sm text-ink-muted">Матеріалів поки немає.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto px-5 pb-6">
          {materials.map((material) => (
            <MaterialRow key={material.id} material={material} />
          ))}
        </div>
      )}
    </div>
  );
}
