import "server-only";
import path from "node:path";

/**
 * In production this MUST point outside .next/standalone - that directory
 * is wiped and recreated wholesale on every deploy (see deploy notes), so
 * anything written under process.cwd()-relative "public/uploads" there
 * would silently vanish on the next rebuild. Falls back to the plain
 * project-relative path for local dev, where no such wipe ever happens.
 */
export const UPLOADS_BASE_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
