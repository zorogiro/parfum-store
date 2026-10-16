"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";
import "./globals.css";

/**
 * Last resort: replaces the root layout when it fails itself, so it renders its own <html> and
 * uses plain elements (no providers, no fonts). No message or stack trace is shown.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center p-4 font-sans">
        <div role="alert" className="mx-auto max-w-md space-y-3 text-center">
          <h1 className="text-2xl font-semibold">{t.errors.title}</h1>
          <p className="text-neutral-600">{t.errors.text}</p>
          {error.digest ? (
            <p className="text-xs text-neutral-600">
              {format(t.errors.reference, { digest: error.digest })}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={reset}
              className="h-10 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
            >
              {t.errors.retry}
            </button>
            {/* A plain <a>: next/link needs the router, which may be what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-10 items-center rounded-md border border-neutral-300 px-4 text-sm font-medium"
            >
              {t.errors.home}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
