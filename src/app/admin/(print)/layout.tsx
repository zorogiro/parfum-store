import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";

/** Bare layout for printable admin pages: no sidebar, no navigation chrome. */
async function PrintShell({ children }: { children: React.ReactNode }) {
  // Defense in depth: the proxy already guards /admin, but never rely on it alone.
  await requireAdmin();
  return <div className="bg-white text-black">{children}</div>;
}

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <PrintShell>{children}</PrintShell>
    </Suspense>
  );
}
