"use client";

import { ErrorState } from "@/components/shared/error-state";

/** Fallback for any route without a closer error boundary. */
export default function RootError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState {...props} />;
}
