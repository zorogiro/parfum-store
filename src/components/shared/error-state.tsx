"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { reportClientError } from "@/lib/report-error";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  /** "admin" uses the admin wording and links back to the dashboard. */
  variant?: "shop" | "admin";
};

/**
 * Friendly French error state shared by the error boundaries. It never renders `error.message`
 * or a stack trace (in production Next.js already strips them; in development they stay in the
 * console). The digest is an opaque hash that matches the server log entry.
 */
export function ErrorState({ error, reset, variant = "shop" }: Props) {
  useEffect(() => {
    // Console only: the message is not shown to the visitor.
    console.error(error);
    reportClientError(error);
  }, [error]);

  const admin = variant === "admin";
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center"
    >
      <h1 className="text-2xl font-semibold">{admin ? t.errors.admin.title : t.errors.title}</h1>
      <p className="text-muted-foreground">{admin ? t.errors.admin.text : t.errors.text}</p>
      {error.digest ? (
        <p className="text-muted-foreground text-xs">
          {format(t.errors.reference, { digest: error.digest })}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className={buttonVariants({ size: "lg", className: "h-10 px-4" })}
        >
          {t.errors.retry}
        </button>
        <Link
          href={admin ? "/admin" : "/"}
          className={buttonVariants({ variant: "outline", size: "lg", className: "h-10 px-4" })}
        >
          {admin ? t.errors.admin.back : t.errors.home}
        </Link>
      </div>
    </div>
  );
}
