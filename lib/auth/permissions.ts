import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { User } from "@/lib/generated/prisma/client";

/** Server Component guard: must be logged in. Redirects guests to /login. */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/** Server Component guard: must be the fixed superadmin. */
export async function requireSuperAdmin(): Promise<User> {
  const user = await requireAuth();
  if (!user.isSuperAdmin) {
    redirect("/tasks");
  }
  return user;
}

type ApiGuardResult = { user: User; error?: undefined } | { user?: undefined; error: NextResponse };

/** Route Handler guard - returns a union instead of throwing/redirecting. */
export async function requireAuthApi(): Promise<ApiGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  }
  return { user };
}

export async function requireSuperAdminApi(): Promise<ApiGuardResult> {
  const check = await requireAuthApi();
  if (check.error) return check;
  if (!check.user.isSuperAdmin) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return check;
}
