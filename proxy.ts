import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_NONCE_COOKIE, loginNonceCookieOptions, newLoginNonce } from "@/lib/auth/loginNonce";

/**
 * Gives the browser a login nonce before the login page renders. The page
 * mints its Telegram link during render (see app/(auth)/login/page.tsx) and
 * cannot set cookies there, so the nonce is set here and also written into
 * the forwarded request, which lets that same render read it.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(LOGIN_NONCE_COOKIE)?.value) return NextResponse.next();

  const nonce = newLoginNonce();
  const headers = new Headers(request.headers);
  const cookie = headers.get("cookie");
  headers.set("cookie", `${cookie ? `${cookie}; ` : ""}${LOGIN_NONCE_COOKIE}=${nonce}`);

  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(LOGIN_NONCE_COOKIE, nonce, loginNonceCookieOptions);
  return response;
}

export const config = {
  matcher: ["/login"],
};
