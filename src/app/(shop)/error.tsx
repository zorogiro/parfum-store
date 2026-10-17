"use client";

import { ErrorState } from "@/components/shared/error-state";

/** Keeps the storefront header and footer when a page fails. */
export default function ShopError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState {...props} />;
}
