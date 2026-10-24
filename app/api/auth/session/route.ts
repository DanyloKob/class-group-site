import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { serializeBigInts } from "@/lib/serialize";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? serializeBigInts(user) : null });
}
