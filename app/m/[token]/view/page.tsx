import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowSquareOut, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { ConversionWaiter } from "@/components/viewer/ConversionWaiter";
import { PdfPresenter } from "@/components/viewer/PdfPresenter";
import { getCurrentUser } from "@/lib/auth/session";
import { getMaterialByToken, isValidMaterialToken } from "@/lib/server/projects";
import { getPublicBaseUrl, microsoftViewerUrl, rawFileUrl } from "@/lib/server/publicUrl";

type Params = { params: Promise<{ token: string }> };

async function loadMaterial(token: string) {
  if (!isValidMaterialToken(token)) return null;
  const user = await getCurrentUser();
  return getMaterialByToken(token, user ? { id: user.id, isSuperAdmin: user.isSuperAdmin } : null);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const material = await loadMaterial(token);
  return {
    title: material?.fileName || "Перегляд",
    referrer: "no-referrer",
    robots: { index: false, follow: false },
  };
}

export default async function ViewPage({ params }: Params) {
  const { token } = await params;
  const material = await loadMaterial(token);
  if (!material) notFound();
  if (material.kind === "LINK") redirect(`/m/${token}`);

  const title = material.fileName ?? "Перегляд";
  const backHref = `/m/${token}`;
  const originalName = material.kind === "PDF" ? "original.pdf" : "original.pptx";
  const downloadHref = `${rawFileUrl(token, originalName)}?download=1`;

  if (material.kind === "PDF" || material.conversionStatus === "READY") {
    const microsoftHref =
      material.kind === "PPTX"
        ? microsoftViewerUrl(`${await getPublicBaseUrl()}${rawFileUrl(token, "original.pptx")}`)
        : undefined;
    return (
      <PdfPresenter
        src={rawFileUrl(token, material.kind === "PDF" ? "original.pdf" : "slides.pdf")}
        title={title}
        backHref={backHref}
        downloadHref={downloadHref}
        microsoftHref={microsoftHref}
      />
    );
  }

  const microsoftHref = microsoftViewerUrl(`${await getPublicBaseUrl()}${rawFileUrl(token, "original.pptx")}`);
  const btn =
    "flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface-elevated px-5 py-3 text-sm text-ink active:scale-[0.98]";

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-black px-5 text-ink">
      <div className="flex w-full max-w-sm flex-col gap-3">
        {material.conversionStatus === "PENDING" ? (
          <ConversionWaiter token={token} />
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm">
            Не вдалося підготувати перегляд. Можна завантажити файл або відкрити в Microsoft.
          </p>
        )}
        <a href={downloadHref} className={btn}>
          <DownloadSimple size={18} />
          Завантажити оригінал
        </a>
        <a href={microsoftHref} target="_blank" rel="noopener noreferrer" className={btn}>
          <ArrowSquareOut size={18} />
          Відкрити в Microsoft
        </a>
        <Link href={backHref} className="py-2 text-center text-sm text-ink-muted">
          Назад
        </Link>
      </div>
    </div>
  );
}
