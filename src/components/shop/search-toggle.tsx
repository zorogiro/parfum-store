"use client";

import { useEffect, useRef, useState } from "react";
import Form from "next/form";
import { Search, X } from "lucide-react";
import { t } from "@/lib/strings";

const s = t.shop.header;

/** Search icon in the header; opens a full-width search row under it. */
export function SearchToggle() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="header-search"
        aria-label={s.search}
        className="hover:bg-muted focus-visible:ring-ring/50 flex size-10 items-center justify-center rounded-lg outline-none focus-visible:ring-3"
      >
        <Search className="size-5" aria-hidden />
      </button>
      {open && (
        <div
          id="header-search"
          className="bg-background absolute inset-x-0 top-full z-30 border-b shadow-sm"
        >
          <Form
            action="/search"
            role="search"
            className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            <input
              ref={inputRef}
              name="q"
              type="search"
              maxLength={100}
              autoComplete="off"
              enterKeyHint="search"
              placeholder={s.searchPlaceholder}
              aria-label={s.search}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-base outline-none focus-visible:ring-3"
            />
            <button
              type="submit"
              aria-label={s.searchSubmit}
              className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
            >
              <Search className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={s.closeSearch}
              className="hover:bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg"
            >
              <X className="size-4" aria-hidden />
            </button>
          </Form>
        </div>
      )}
    </>
  );
}
