import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isDevLoginEnabled } from "@/lib/auth/dev-login";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/tasks");
  }

  if (isDevLoginEnabled() && process.env.DEV_LOGIN_AUTO_PHONE) {
    redirect("/api/auth/dev-login/auto");
  }

  redirect("/login");
}
