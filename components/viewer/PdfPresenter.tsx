"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut, CornersIn, CornersOut, DownloadSimple } from "@phosphor-icons/react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";

type Props = {
  src: string;
  title: string;
  backHref: string;
  downloadHref: string;
  microsoftHref?: string;
};

type Pending = { promise: Promise<HTMLCanvasElement | null>; task: RenderTask | null };

const MAX_PIXELS = 16e6; // iOS canvas ceiling
const TOOLBAR_HIDE_MS = 2500;
const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "l", "j", "n"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "h", "k", "p"]);

function freeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

export function PdfPresenter({ src, title, backHref, downloadHref, microsoftHref }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const docRef = useRef<PDFDocumentProxy | null>(null);
  const cacheRef = useRef(new Map<number, HTMLCanvasElement>());
  const pendingRef = useRef(new Map<number, Pending>());
  const boxRef = useRef({ w: 0, h: 0 });
  const genRef = useRef(0);
  const pageRef = useRef(1);
  const totalRef = useRef(0);
  const shownRef = useRef(0);
  const fsEnabledRef = useRef(false);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [black, setBlack] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsAvailable, setFsAvailable] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

  const renderPage = useCallback((n: number): Promise<HTMLCanvasElement | null> => {
    const doc = docRef.current;
    const cached = cacheRef.current.get(n);
    if (cached) return Promise.resolve(cached);
    const existing = pendingRef.current.get(n);
    if (existing) return existing.promise;
    if (!doc || n < 1 || n > totalRef.current || boxRef.current.w === 0) return Promise.resolve(null);

    const gen = genRef.current;
    const entry: Pending = { promise: Promise.resolve(null), task: null };
    entry.promise = (async () => {
      const pdfPage = await doc.getPage(n);
      const base = pdfPage.getViewport({ scale: 1 });
      const { w, h } = boxRef.current;
      const fit = Math.min(w / base.width, h / base.height);
      let scale = fit * Math.min(window.devicePixelRatio || 1, 2);
      if (base.width * base.height * scale * scale > MAX_PIXELS) {
        scale = Math.sqrt(MAX_PIXELS / (base.width * base.height));
      }
      const viewport = pdfPage.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      canvas.style.width = `${Math.floor(base.width * fit)}px`;
      canvas.style.height = `${Math.floor(base.height * fit)}px`;
      canvas.style.display = "block";
      const task = pdfPage.render({ canvas, viewport, background: "#ffffff" });
      entry.task = task;
      await task.promise;
      pdfPage.cleanup();
      if (gen !== genRef.current) {
        freeCanvas(canvas);
        return null;
      }
      cacheRef.current.set(n, canvas);
      return canvas;
    })()
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "RenderingCancelledException") return null;
        // A failed neighbour is not fatal; the current page reports its own failure in show().
        throw error;
      })
      .finally(() => {
        if (pendingRef.current.get(n) === entry) pendingRef.current.delete(n);
      });
    pendingRef.current.set(n, entry);
    return entry.promise;
  }, []);

  const show = useCallback(
    async (n: number) => {
      shownRef.current = n;
      let canvas: HTMLCanvasElement | null = null;
      try {
        canvas = await renderPage(n);
      } catch {
        if (shownRef.current === n) setFailed(true);
        return;
      }
      if (shownRef.current !== n || !canvas || !hostRef.current) return;
      hostRef.current.replaceChildren(canvas);
      setReady(true);

      // Warm neighbours, drop everything else.
      const total = totalRef.current;
      void renderPage(n + 1).catch(() => {});
      void renderPage(n - 1).catch(() => {});
      if (n + 2 <= total) void docRef.current?.getPage(n + 2).catch(() => {});
      for (const [key, c] of cacheRef.current) {
        if (Math.abs(key - n) > 1) {
          freeCanvas(c);
          cacheRef.current.delete(key);
        }
      }
      for (const [key, entry] of pendingRef.current) {
        if (Math.abs(key - n) > 1) entry.task?.cancel();
      }
    },
    [renderPage],
  );

  const go = useCallback(
    (target: number) => {
      const n = Math.min(Math.max(target, 1), totalRef.current);
      if (totalRef.current === 0) return;
      setBlack(false);
      if (n === pageRef.current && shownRef.current === n) return;
      pageRef.current = n;
      setPage(n);
      void show(n);
    },
    [show],
  );

  const toggleFullscreen = useCallback(() => {
    if (!fsEnabledRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void rootRef.current?.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    }
  }, []);

  // Load the document.
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    const cache = cacheRef.current;
    const pending = pendingRef.current;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        if (cancelled) return;
        task = pdfjs.getDocument({
          url: src,
          disableAutoFetch: true,
          disableStream: true,
          rangeChunkSize: 524288,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          wasmUrl: "/pdfjs/wasm/",
          iccUrl: "/pdfjs/iccs/",
        });
        task.onProgress = ({ loaded, total: size }: { loaded: number; total: number }) => {
          if (!cancelled && size > 0) setProgress(Math.min(loaded / size, 1));
        };
        const doc = await task.promise;
        if (cancelled) {
          void task?.destroy();
          return;
        }
        if (doc.numPages < 1) {
          setFailed(true);
          return;
        }
        docRef.current = doc;
        totalRef.current = doc.numPages;
        setTotal(doc.numPages);
        // If the stage was measured before the document arrived, draw now.
        if (boxRef.current.w > 0) void show(pageRef.current);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      void task?.destroy();
      docRef.current = null;
      totalRef.current = 0;
      genRef.current += 1;
      for (const entry of pending.values()) entry.task?.cancel();
      pending.clear();
      for (const c of cache.values()) freeCanvas(c);
      cache.clear();
    };
  }, [src, show]);

  // Measure the stage and re-render on resize (debounced).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const apply = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (w === 0 || h === 0) return;
      if (w === boxRef.current.w && h === boxRef.current.h) return;
      boxRef.current = { w, h };
      genRef.current += 1;
      for (const entry of pendingRef.current.values()) entry.task?.cancel();
      pendingRef.current.clear();
      for (const c of cacheRef.current.values()) freeCanvas(c);
      cacheRef.current.clear();
      if (docRef.current) void show(pageRef.current);
    };

    apply();
    const observer = new ResizeObserver(() => {
      if (boxRef.current.w === 0) {
        apply();
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(apply, 150);
    });
    observer.observe(stage);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [show]);

  // No page scrollbars while presenting.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev[0];
      body.style.overflow = prev[1];
    };
  }, []);

  // Fullscreen state.
  useEffect(() => {
    fsEnabledRef.current = !!document.fullscreenEnabled;
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    const raf = requestAnimationFrame(() => setFsAvailable(fsEnabledRef.current));
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("fullscreenchange", sync);
    };
  }, []);

  // Screen wake lock while visible.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== "visible" || !navigator.wakeLock) return;
        const next = await navigator.wakeLock.request("screen");
        if (disposed) void next.release().catch(() => {});
        else lock = next;
      } catch {
        // Not allowed or unsupported: ignore.
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, []);

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = e.key;

      // Let a focused toolbar control keep its own Space and Enter.
      if ((key === " " || key === "Enter") && target?.closest("a, button")) return;

      if (key === " " && e.shiftKey) {
        e.preventDefault();
        go(pageRef.current - 1);
      } else if (NEXT_KEYS.has(key)) {
        e.preventDefault();
        go(pageRef.current + 1);
      } else if (PREV_KEYS.has(key)) {
        e.preventDefault();
        go(pageRef.current - 1);
      } else if (key === "Home") {
        e.preventDefault();
        go(1);
      } else if (key === "End") {
        e.preventDefault();
        go(totalRef.current);
      } else if (key === "f" || key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (key === "b" || key === "B" || key === ".") {
        e.preventDefault();
        setBlack((v) => !v);
      } else if (key === "Escape") {
        setBlack(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleFullscreen]);

  // Toolbar auto-hide.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wake = useCallback(() => {
    setUiVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiVisible(false), TOOLBAR_HIDE_MS);
  }, []);
  useEffect(() => {
    hideTimer.current = setTimeout(() => setUiVisible(false), TOOLBAR_HIDE_MS);
    return () => clearTimeout(hideTimer.current);
  }, []);

  // Pointer: tap / click zones and swipes.
  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-toolbar]")) {
      start.current = null;
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      go(pageRef.current + (dx < 0 ? 1 : -1));
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const rect = stageRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : e.clientX;
      const width = rect?.width || window.innerWidth;
      go(pageRef.current + (x < width / 3 ? -1 : 1));
    }
  };

  const blurAfter = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.blur();

  const btn =
    "flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-ink transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-surface-elevated active:scale-95 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none";

  if (failed) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center text-ink">
        <p className="text-base">Не вдалося відкрити файл.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <a href={downloadHref} className="rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-accent-ink active:scale-[0.98]">
            Завантажити
          </a>
          <Link href={backHref} className="rounded-2xl bg-surface px-5 py-3 text-sm text-ink active:scale-[0.98]">
            Назад
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={title}
      className="fixed inset-0 select-none overflow-hidden bg-black text-ink"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (start.current = null)}
      onMouseMove={wake}
      onTouchStart={wake}
    >
      <div
        ref={stageRef}
        className="absolute inset-0 overflow-hidden"
        style={{ touchAction: "none", cursor: uiVisible ? "default" : "none" }}
      >
        <div ref={hostRef} className="absolute inset-0 flex items-center justify-center" />
      </div>

      {!ready && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-white/10">
          <div className="h-full bg-accent" style={{ width: `${Math.max(progress, 0.04) * 100}%` }} />
        </div>
      )}

      {black && <div className="absolute inset-0 bg-black" />}

      <div
        data-toolbar
        className={`absolute bottom-4 left-1/2 flex w-max max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-full bg-surface/80 p-1 backdrop-blur-md transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
          uiVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Link href={backHref} onClick={blurAfter} aria-label="Назад" className={btn}>
          <ArrowLeft size={20} />
        </Link>
        <div className="whitespace-nowrap px-3 text-sm tabular-nums text-ink" aria-live="polite">
          <span aria-hidden="true">
            {total > 0 ? `${page} / ${total}` : "…"}
          </span>
          <span className="sr-only">{total > 0 ? `Слайд ${page} з ${total}` : "Завантаження"}</span>
        </div>
        {fsAvailable && (
          <button
            type="button"
            onClick={(e) => {
              toggleFullscreen();
              blurAfter(e);
            }}
            aria-label={fullscreen ? "Вийти з повного екрана" : "На весь екран"}
            className={btn}
          >
            {fullscreen ? <CornersIn size={20} /> : <CornersOut size={20} />}
          </button>
        )}
        <a href={downloadHref} onClick={blurAfter} aria-label="Завантажити" className={btn}>
          <DownloadSimple size={20} />
        </a>
        {microsoftHref && (
          <a
            href={microsoftHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={blurAfter}
            aria-label="Відкрити в Microsoft"
            className={btn}
          >
            <ArrowSquareOut size={20} />
          </a>
        )}
      </div>
    </div>
  );
}
