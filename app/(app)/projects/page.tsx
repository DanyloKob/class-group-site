import Link from "next/link";
import { BookOpenText, Paperclip } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/auth/session";
import { getTopicList, type TopicListItem } from "@/lib/server/projects";
import { parseDateParam, todayInKyiv } from "@/lib/schedule/parity";
import { sortByNearestDate } from "@/lib/sortByNearestDate";
import { CreateTopicButton } from "@/app/(app)/projects/_components/CreateTopicButton";
import { dueLabel } from "@/app/(app)/projects/_lib/format";

function TopicCard({ topic }: { topic: TopicListItem }) {
  const due = dueLabel(topic.dueDate);
  const muted = topic.isPast;
  return (
    <Link
      href={`/projects/${topic.id}`}
      className={`flex flex-col gap-2 rounded-2xl bg-surface p-3.5 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] ${
        muted ? "opacity-70" : ""
      }`}
    >
      <p className="line-clamp-2 text-[15px] font-medium leading-snug">{topic.title}</p>
      <div className="flex items-center gap-2 text-xs">
        {topic.subject && (
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] text-ink-muted">{topic.subject}</span>
        )}
        <span className={due.urgent && !muted ? "font-medium text-accent" : "text-ink-muted"}>{due.text}</span>
        <span className="ml-auto flex items-center gap-1 text-ink-muted">
          <Paperclip size={14} />
          {topic.materialCount}
        </span>
      </div>
    </Link>
  );
}

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  const topics = await getTopicList(user ? { id: user.id, isSuperAdmin: user.isSuperAdmin } : null);

  const now = parseDateParam(todayInKyiv());
  const sorted = sortByNearestDate(
    topics,
    (t) => parseDateParam(t.dueDate),
    () => now,
    now,
  );
  const upcoming = sorted.filter((t) => !t.isPast);
  const past = sorted.filter((t) => t.isPast);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-2 pt-6">
        <h1 className="text-xl font-semibold tracking-tight">Проєкти</h1>
        {user && <CreateTopicButton />}
      </div>

      {topics.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <BookOpenText size={32} className="text-ink-muted" />
          <p className="text-sm text-ink-muted">
            Тем поки немає.
            {user && (
              <>
                <br />
                Додайте першу кнопкою +
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto px-5 pb-6">
          {upcoming.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
          {past.length > 0 && (
            <div className="flex items-center gap-3 pb-1 pt-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">Минулі</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
          {past.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}

      {!user && (
        <p className="px-5 pb-6 pt-2 text-center text-xs text-ink-muted">
          <Link href="/account" className="underline underline-offset-2">
            Щоб додати тему, увійдіть у профілі.
          </Link>
        </p>
      )}
    </div>
  );
}
