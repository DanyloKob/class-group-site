import { getCurrentUser } from "@/lib/auth/session";
import { PhoneFrame } from "@/components/shell/PhoneFrame";
import { BottomNav } from "@/components/shell/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <PhoneFrame>
      <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      <BottomNav isLoggedIn={Boolean(user)} />
    </PhoneFrame>
  );
}
