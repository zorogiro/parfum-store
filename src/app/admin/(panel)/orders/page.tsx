import Form from "next/form";
import Link from "next/link";
import { Download } from "lucide-react";
import { cn } from "cn";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTND } from "@/lib/money";
import { buildOrdersHref, parseOrderFilters } from "@/lib/order-filters";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import { t } from "@/lib/strings";
import { formatTunisDateTime } from "@/lib/tunis-time";
import { requireAdmin } from "@/server/auth";
import { getOrderList, getStatusCounts } from "@/server/orders-queries";

export const metadata = { title: t.admin.orders.title };

const s = t.admin.orders;

export default async function Page({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();

  const filters = parseOrderFilters(await searchParams);
  const [{ orders, total, page, pageCount }, { all, counts }] = await Promise.all([
    getOrderList(filters),
    getStatusCounts(filters),
  ]);

  const hasFilters = filters.statuses.length > 0 || filters.q || filters.from || filters.to;
  const tabs = [
    {
      key: "all",
      label: s.allStatuses,
      count: all,
      href: buildOrdersHref(filters, { statuses: [] }),
      active: filters.statuses.length === 0,
    },
    ...ORDER_STATUSES.map((status) => ({
      key: status,
      label: STATUS_LABELS[status],
      count: counts[status],
      href: buildOrdersHref(filters, { statuses: [status] }),
      active: filters.statuses.length === 1 && filters.statuses[0] === status,
    })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{s.title}</h1>
        <a
          href={buildOrdersHref(filters, { page: 1 }, "/admin/orders/export")}
          className={buttonVariants({ variant: "outline" })}
          title={s.exportHint}
        >
          <Download />
          {s.export}
        </a>
      </div>

      <nav aria-label={s.statusTabs} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "hover:bg-muted flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              tab.active && "bg-foreground text-background hover:bg-foreground",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "text-xs tabular-nums",
                tab.active ? "opacity-80" : "text-muted-foreground",
              )}
            >
              {tab.count}
            </span>
          </Link>
        ))}
      </nav>

      <Form
        action="/admin/orders"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]"
      >
        {filters.statuses.length > 0 && (
          <input type="hidden" name="status" value={filters.statuses.join(",")} />
        )}
        <Input name="q" defaultValue={filters.q} placeholder={s.search} aria-label={s.search} />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground w-6 shrink-0">{s.from}</span>
          <Input type="date" name="from" defaultValue={filters.from ?? ""} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground w-6 shrink-0">{s.to}</span>
          <Input type="date" name="to" defaultValue={filters.to ?? ""} />
        </label>
        <div className="flex gap-2">
          <Button type="submit">{s.filter}</Button>
          {hasFilters && (
            <Link href="/admin/orders" className={buttonVariants({ variant: "outline" })}>
              {s.reset}
            </Link>
          )}
        </div>
      </Form>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">{s.empty}</p>
      ) : (
        <>
          {/* Phone width: one card per order. */}
          <ul className="space-y-2 md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className={cn(
                    "hover:bg-muted/50 block rounded-lg border p-3",
                    o.status === "PENDING" &&
                      "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{o.number}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 truncate text-sm">{o.customerName}</p>
                  <p className="text-muted-foreground text-xs">
                    {o.governorate} · {formatTunisDateTime(o.createdAt)}
                  </p>
                  <p className="mt-1 text-sm font-medium">{formatTND(o.total)}</p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.columns.number}</TableHead>
                  <TableHead>{s.columns.date}</TableHead>
                  <TableHead>{s.columns.customer}</TableHead>
                  <TableHead>{s.columns.governorate}</TableHead>
                  <TableHead className="text-right">{s.columns.total}</TableHead>
                  <TableHead>{s.columns.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow
                    key={o.id}
                    className={cn(
                      o.status === "PENDING" &&
                        "bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-500/10 dark:hover:bg-amber-500/15",
                    )}
                  >
                    <TableCell className="font-medium whitespace-nowrap">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {o.number}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTunisDateTime(o.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {o.customerName}
                      </Link>
                    </TableCell>
                    <TableCell>{o.governorate}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatTND(o.total)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          {total} {s.results} · {s.page} {page} {s.of} {pageCount}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={buildOrdersHref(filters, { page: page - 1 })}
              className={buttonVariants({ variant: "outline" })}
            >
              {s.previous}
            </Link>
          ) : (
            <Button variant="outline" disabled>
              {s.previous}
            </Button>
          )}
          {page < pageCount ? (
            <Link
              href={buildOrdersHref(filters, { page: page + 1 })}
              className={buttonVariants({ variant: "outline" })}
            >
              {s.next}
            </Link>
          ) : (
            <Button variant="outline" disabled>
              {s.next}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
