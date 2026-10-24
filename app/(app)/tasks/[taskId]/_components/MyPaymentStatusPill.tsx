import { CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";

const LABEL: Record<"UNPAID" | "PAID" | "PAID_WITH_NOTE", string> = {
  UNPAID: "Ще не здано",
  PAID: "Здано",
  PAID_WITH_NOTE: "Здано",
};

export function MyPaymentStatusPill({ status, note }: { status: "UNPAID" | "PAID" | "PAID_WITH_NOTE"; note: string | null }) {
  const paid = status !== "UNPAID";
  return (
    <div className={`flex items-center gap-2 rounded-2xl p-4 ${paid ? "bg-success/15" : "bg-surface"}`}>
      {paid ? (
        <CheckCircle size={20} weight="fill" className="text-success" />
      ) : (
        <Circle size={20} className="text-ink-muted" />
      )}
      <div>
        <p className={`text-sm font-medium ${paid ? "text-success" : ""}`}>{LABEL[status]}</p>
        {note && <p className="text-xs text-ink-muted">{note}</p>}
      </div>
    </div>
  );
}
