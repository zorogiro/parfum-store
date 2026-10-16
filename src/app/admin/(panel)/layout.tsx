import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { t } from "@/lib/strings";
import { logoutAction } from "@/server/login-action";
import { requireAdmin } from "@/server/auth";

async function AdminShell({ children }: { children: React.ReactNode }) {
  // Defense in depth: the proxy already guards /admin, but never rely on it alone.
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <aside className="bg-muted/40 flex w-60 shrink-0 flex-col gap-6 border-r p-4">
        <p className="px-3 text-sm font-semibold">{t.admin.title}</p>
        <SidebarNav />
        <form action={logoutAction} className="mt-auto space-y-2">
          <p className="text-muted-foreground truncate px-3 text-xs" title={admin.email}>
            {admin.email}
          </p>
          <Button type="submit" variant="outline" className="w-full">
            {t.admin.logout}
          </Button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
