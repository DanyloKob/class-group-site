import "server-only";
import { headers } from "next/headers";

export async function getPublicBaseUrl(): Promise<string> {
  const fromEnv = process.env.PUBLIC_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || "http";
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost").split(",")[0].trim();
  return `${proto}://${host}`;
}

export function microsoftViewerUrl(absoluteFileUrl: string): string {
  return "https://view.officeapps.live.com/op/view.aspx?src=" + encodeURIComponent(absoluteFileUrl);
}

/** Relative URL of the raw file route. */
export function rawFileUrl(
  token: string,
  file: "original.pdf" | "original.pptx" | "slides.pdf",
  download?: boolean,
): string {
  return `/m/${token}/raw/${file}${download ? "?download=1" : ""}`;
}
