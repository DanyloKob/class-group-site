import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowSquareOut, DownloadSimple, FilePdf, LinkSimple, PresentationChart } from "@phosphor-icons/react/dist/ssr";
import { PhoneFrame } from "@/components/shell/PhoneFrame";
import { ConversionWaiter } from "@/components/viewer/ConversionWaiter";
import { getCurrentUser } from "@/lib/auth/session";
import { getMaterialByToken, isValidMaterialToken } from "@/lib/server/projects";
import { getPublicBaseUrl, microsoftViewerUrl, rawFileUrl } from "@/lib/server/publicUrl";

type Params = { params: Promise<{ token: string }> };

const dateFormatter = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Kyiv",
});

async function loadMaterial(token: string) {
  if (!isValidMaterialToken(token)) return null;
  const user = await getCurrentUser();
  return getMaterialByToken(token, user ? { id: user.id, isSuperAdmin: user.isSuperAdmin } : null);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const material = await loadMaterial(token);
  return {
    title: material?.fileName || "Посилання",
    referrer: "no-referrer",
    robots: { index: false, follow: false },
  };
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1).replace(".", ",")} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Display only: «…/wiki/Київ» instead of «…/wiki/%D0%9A…». The href stays the stored, encoded URL. */
function readableUrl(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

const primaryBtn =
  "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98]";
const secondaryBtn =
  "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-surface-elevated px-5 py-3 text-sm text-ink transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98]";

export default async function MaterialPage({ params }: Params) {
  const { token } = await params;
  const material = await loadMaterial(token);
  if (!material) notFound();

  const isPptx = material.kind === "PPTX";
  const status = material.conversionStatus;
  const kindIcon =
    material.kind === "LINK" ? <LinkSimple size={22} /> : material.kind === "PDF" ? <FilePdf size={22} /> : <PresentationChart size={22} />;

  const originalName = material.kind === "PDF" ? "original.pdf" : "original.pptx";
  const downloadHref = `${rawFileUrl(token, originalName)}?download=1`;
  const microsoftHref = isPptx
    ? microsoftViewerUrl(`${await getPublicBaseUrl()}${rawFileUrl(token, "original.pptx")}`)
    : null;

  return (
    <PhoneFrame>
      <main className="flex-1 overflow-y-auto px-5 pb-10 pt-5">
        <Link
          href={`/projects/${material.topic.id}`}
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted active:scale-[0.98]"
        >
          <ArrowLeft size={16} />
          <span className="line-clamp-1">Проєкти · {material.topic.title}</span>
        </Link>

        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent">{kindIcon}</div>
          <div className="min-w-0">
            <h1 className="break-words text-lg font-semibold leading-snug tracking-tight">
              {material.fileName ?? "Посилання"}
            </h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              {material.authorName} · {dateFormatter.format(new Date(material.createdAt))}
              {material.fileSize ? ` · ${formatSize(material.fileSize)}` : ""}
            </p>
          </div>
        </div>

        {material.text && <p className="mb-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{material.text}</p>}

        {material.kind === "LINK" && material.url && (
          <a
            href={material.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="block rounded-2xl bg-surface p-4 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98]"
          >
            <span className="block truncate text-base font-semibold">{hostnameOf(material.url)}</span>
            <span className="mt-1 block truncate text-xs text-ink-muted">{readableUrl(material.url)}</span>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-accent">
              Перейти за посиланням
              <ArrowSquareOut size={16} />
            </span>
          </a>
        )}

        {material.kind === "PDF" && (
          <div className="flex gap-2">
            <Link href={`/m/${token}/view`} className={primaryBtn}>
              Відкрити
            </Link>
            <a href={downloadHref} className={secondaryBtn}>
              <DownloadSimple size={18} />
              Завантажити
            </a>
          </div>
        )}

        {isPptx && (
          <div className="flex flex-col gap-3">
            {status === "READY" && (
              <Link href={`/m/${token}/view`} className={`${primaryBtn} flex-none`}>
                Відкрити
              </Link>
            )}
            {status === "PENDING" && <ConversionWaiter token={token} />}
            {status === "FAILED" && (
              <p className="rounded-2xl bg-surface p-4 text-sm text-ink">
                Не вдалося підготувати перегляд. Можна завантажити файл або відкрити в Microsoft.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <a href={downloadHref} className={`${secondaryBtn} flex-none`}>
                <DownloadSimple size={18} />
                Завантажити оригінал
              </a>
              {microsoftHref && (
                <a href={microsoftHref} target="_blank" rel="noopener noreferrer" className={`${secondaryBtn} flex-none`}>
                  <ArrowSquareOut size={18} />
                  Відкрити в Microsoft
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </PhoneFrame>
  );
}
