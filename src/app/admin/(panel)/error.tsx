"use client";

import { ErrorState } from "@/components/shared/error-state";

/** Keeps the admin sidebar when a page fails. */
export default function AdminError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState {...props} variant="admin" />;
}
