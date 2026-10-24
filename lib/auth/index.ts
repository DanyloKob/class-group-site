export { normalizePhone } from "@/lib/auth/phone";
export {
  SESSION_COOKIE,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getCurrentUser,
  destroyCurrentSession,
} from "@/lib/auth/session";
export { requireAuth, requireSuperAdmin, requireAuthApi, requireSuperAdminApi } from "@/lib/auth/permissions";
