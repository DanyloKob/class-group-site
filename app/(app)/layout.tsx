import { requireAuth } from "@/lib/auth/permissions";
import { PhoneFrame } from "@/components/shell/PhoneFrame";
import { BottomNav } from "@/components/shell/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  return (
    <PhoneFrame>
      <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      <BottomNav />
    </PhoneFrame>
  );
}
