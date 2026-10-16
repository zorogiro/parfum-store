import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatTND } from "@/lib/money";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";
import { requireAdmin } from "@/server/auth";
import { getDashboardStats } from "@/server/dashboard";

export const metadata = { title: t.admin.nav.dashboard };

const s = t.admin.dashboard;

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}

export default async function Page() {
  await requireAdmin();
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t.admin.nav.dashboard}</h1>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label={s.today} value={String(stats.ordersToday)} />
        <Link
          href="/admin/orders?status=PENDING"
          className="hover:bg-muted/50 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10"
        >
          <p className="text-muted-foreground text-sm">{s.pending}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.pending}</p>
          <p className="mt-1 text-xs underline">{s.pendingLink}</p>
        </Link>
        <StatCard label={s.revenue} value={formatTND(stats.revenue)} hint={s.revenueHelp} />
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <div>
          <h2 className="font-semibold">{s.lowStock}</h2>
          <p className="text-muted-foreground text-sm">{s.lowStockHelp}</p>
        </div>
        {stats.lowStock.length === 0 ? (
          <p className="text-muted-foreground text-sm">{s.lowStockEmpty}</p>
        ) : (
          <ul className="divide-y">
            {stats.lowStock.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                <Link
                  href={`/admin/products/${v.product.id}/edit`}
                  className="min-w-0 hover:underline"
                >
                  <p className="truncate font-medium">{v.product.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {v.label} · {v.sku}
                  </p>
                </Link>
                <Badge variant={v.stock === 0 ? "destructive" : "secondary"}>
                  {v.stock === 0 ? s.outOfStock : format(s.stockLeft, { count: v.stock })}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
