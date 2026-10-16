"use client";

import Image from "next/image";
import { useCallback, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn, format } from "@/lib/utils";
import { t } from "@/lib/strings";

const s = t.shop.product.gallery;

type GalleryImage = { id: string; url: string };

const SWIPE_DISTANCE = 50;

/**
 * Horizontal swipe on touch/pen. Vertical drags are left to the browser (touch-action: pan-y) so
 * the page still scrolls. Returns pointer handlers and whether the last gesture was a swipe, so
 * the click that follows can be ignored (`consumeSwipe`).
 */
function useSwipe(onPrev: () => void, onNext: () => void, enabled = true) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  return {
    /** True once after a swipe, so the click fired at the end of the gesture can be ignored. */
    consumeSwipe() {
      const was = swiped.current;
      swiped.current = false;
      return was;
    },
    handlers: {
      onPointerDown(e: PointerEvent) {
        if (!enabled || e.pointerType === "mouse") return;
        swiped.current = false;
        start.current = { x: e.clientX, y: e.clientY };
      },
      onPointerUp(e: PointerEvent) {
        const origin = start.current;
        start.current = null;
        if (!origin) return;
        const dx = e.clientX - origin.x;
        const dy = e.clientY - origin.y;
        if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
          swiped.current = true;
          if (dx < 0) onNext();
          else onPrev();
        }
      },
      onPointerCancel() {
        start.current = null;
      },
    },
  };
}

function NavButton({
  direction,
  onClick,
  className,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  className?: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? s.previous : s.next}
      className={cn(
        "bg-background/80 hover:bg-background focus-visible:ring-ring/50 absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm outline-none focus-visible:ring-3",
        direction === "prev" ? "left-2" : "right-2",
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const count = images.length;

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + count) % count);
      setZoomed(false);
    },
    [count],
  );
  const prev = useCallback(() => go(-1), [go]);
  const next = useCallback(() => go(1), [go]);

  const main = useSwipe(prev, next, count > 1);
  const lightbox = useSwipe(prev, next, count > 1 && !zoomed);

  if (count === 0) {
    return (
      <div
        role="img"
        aria-label={s.noImage}
        className="bg-muted text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl"
      >
        <ImageIcon className="size-12" aria-hidden />
        <span className="text-sm">{s.noImage}</span>
      </div>
    );
  }

  const current = images[index];
  const alt = (i: number) =>
    count === 1 ? name : format(s.imageOf, { name, index: i + 1, count });

  function onKeyDown(e: React.KeyboardEvent) {
    if (count < 2) return;
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  }

  function toggleZoom(e: React.MouseEvent<HTMLDivElement>) {
    if (lightbox.consumeSwipe()) return;
    if (!zoomed) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setOrigin(`${x}% ${y}%`);
    }
    setZoomed((z) => !z);
  }

  return (
    <div className="space-y-3" role="group" aria-label={s.label} onKeyDown={onKeyDown}>
      <div
        className="bg-muted relative aspect-square touch-pan-y overflow-hidden rounded-xl"
        {...main.handlers}
      >
        <button
          type="button"
          onClick={() => {
            if (main.consumeSwipe()) return;
            setOpen(true);
          }}
          aria-label={s.open}
          className="focus-visible:ring-ring/50 absolute inset-0 cursor-zoom-in outline-none focus-visible:ring-3"
        >
          <Image
            key={current.id}
            src={current.url}
            alt={alt(index)}
            fill
            priority={index === 0}
            sizes="(min-width: 1024px) 36rem, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
            draggable={false}
          />
        </button>
        {count > 1 && (
          <>
            <NavButton direction="prev" onClick={prev} className="hidden sm:flex" />
            <NavButton direction="next" onClick={next} className="hidden sm:flex" />
            <span
              aria-hidden
              className="bg-background/80 absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-xs sm:hidden"
            >
              {format(s.counter, { index: index + 1, count })}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {images.map((image, i) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIndex(i);
                  setZoomed(false);
                }}
                aria-label={format(s.thumbnail, { index: i + 1 })}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "bg-muted focus-visible:ring-ring/50 relative block size-16 overflow-hidden rounded-lg border-2 outline-none focus-visible:ring-3 sm:size-20",
                  i === index
                    ? "border-primary"
                    : "border-transparent opacity-80 hover:opacity-100",
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  draggable={false}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setZoomed(false);
        }}
      >
        <DialogContent
          showCloseButton
          onKeyDown={onKeyDown}
          className="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none bg-black/95 p-0 text-white ring-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">{name}</DialogTitle>
          <div
            className={cn(
              "relative h-full w-full touch-pan-y overflow-hidden",
              zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
            )}
            onClick={toggleZoom}
            {...lightbox.handlers}
          >
            <Image
              key={current.id}
              src={current.url}
              alt={alt(index)}
              fill
              sizes="100vw"
              className="object-contain transition-transform duration-200"
              style={{ transform: zoomed ? "scale(2.2)" : "scale(1)", transformOrigin: origin }}
              draggable={false}
            />
          </div>
          {count > 1 && (
            <>
              <NavButton direction="prev" onClick={prev} className="text-foreground" />
              <NavButton direction="next" onClick={next} className="text-foreground" />
            </>
          )}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {count > 1 && (
              <span className="rounded-full bg-black/60 px-3 py-1 text-sm">
                {format(s.counter, { index: index + 1, count })}
              </span>
            )}
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              aria-label={zoomed ? s.zoomOut : s.zoomIn}
              className="focus-visible:ring-ring/50 flex size-10 items-center justify-center rounded-full bg-black/60 outline-none focus-visible:ring-3"
            >
              {zoomed ? (
                <ZoomOut className="size-5" aria-hidden />
              ) : (
                <ZoomIn className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
