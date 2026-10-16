import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { t } from "@/lib/strings";
import { logoutAction } from "@/server/login-action";
import { requireAdmin } from "@/server/auth";

async function AdminShell({ children }: { children: React.ReactNode }) {
  // Defense in depth: the proxy already guards /admin, but never rely on it alone.
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-muted/40 flex shrink-0 flex-col gap-3 border-b p-3 md:w-60 md:gap-6 md:border-r md:border-b-0 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="px-1 text-sm font-semibold md:px-3">{t.admin.title}</p>
          <form action={logoutAction} className="md:hidden">
            <Button type="submit" variant="outline" size="sm">
              {t.admin.logout}
            </Button>
          </form>
        </div>
        <SidebarNav />
        <form action={logoutAction} className="mt-auto hidden space-y-2 md:block">
          <p className="text-muted-foreground truncate px-3 text-xs" title={admin.email}>
            {admin.email}
          </p>
          <Button type="submit" variant="outline" className="w-full">
            {t.admin.logout}
          </Button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      <Toaster richColors position="top-right" />
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
