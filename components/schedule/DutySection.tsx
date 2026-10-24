import { ForkKnife, PencilSimpleLine } from "@phosphor-icons/react/dist/ssr";

type DutyPerson = { personId: string; personName: string };

/** A duty with nobody assigned renders nothing at all rather than a "—" row:
 * meals only happen on some days, so an empty cafeteria line every other day
 * would be noise, not information. */
function DutyRow({
  icon,
  label,
  people,
}: {
  icon: React.ReactNode;
  label: string;
  people: DutyPerson[];
}) {
  if (people.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5">
      <span className="mt-px shrink-0 text-ink-muted">{icon}</span>
      <span className="shrink-0 text-xs text-ink-muted">{label}</span>
      <span className="flex-1 text-xs font-medium leading-relaxed">
        {people.map((p) => p.personName).join(" · ")}
      </span>
    </div>
  );
}

export function DutySection({
  cafeteria,
  board,
}: {
  cafeteria: DutyPerson[];
  board: DutyPerson[];
}) {
  if (cafeteria.length === 0 && board.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-5">
      <DutyRow icon={<ForkKnife size={15} />} label="Їдальня:" people={cafeteria} />
      <DutyRow icon={<PencilSimpleLine size={15} />} label="Дошка:" people={board} />
    </div>
  );
}
