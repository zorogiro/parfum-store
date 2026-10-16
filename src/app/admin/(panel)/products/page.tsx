import Form from "next/form";
import Link from "next/link";
import { ImageIcon, Plus } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
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
import { NativeSelect } from "@/components/admin/field";
import { DeleteButton } from "@/components/admin/delete-button";
import { ToggleActiveButton } from "@/components/admin/toggle-active-button";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatTND } from "@/lib/money";
import { t } from "@/lib/strings";
import { PRODUCT_TYPES, type ProductTypeValue } from "@/lib/validators/product";
import { requireAdmin } from "@/server/auth";
import { getCategoryOptions } from "@/server/category-options";
import { deleteProduct } from "@/server/products";

export const metadata = { title: t.admin.products.title };

const s = t.admin.products;
const PAGE_SIZE = 20;

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function Page({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();

  const params = await searchParams;
  const q = first(params.q).slice(0, 100);
  const category = first(params.category);
  const type = PRODUCT_TYPES.find((v) => v === first(params.type));
  const status = first(params.status);
  const requestedPage = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const categoryIds = category
    ? [
        category,
        ...(
          await db.category.findMany({ where: { parentId: category }, select: { id: true } })
        ).map((c) => c.id),
      ]
    : null;

  const where: Prisma.ProductWhereInput = {
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
      ],
    }),
    ...(categoryIds && { categoryId: { in: categoryIds } }),
    ...(type && { type }),
    ...(status === "active" && { isActive: true }),
    ...(status === "inactive" && { isActive: false }),
  };

  const [total, categories] = await Promise.all([
    db.product.count({ where }),
    getCategoryOptions(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const products = await db.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      brand: true,
      type: true,
      isActive: true,
      category: { select: { name: true } },
      variants: { select: { price: true, stock: true } },
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
    },
  });

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (category) next.set("category", category);
    if (type) next.set("type", type);
    if (status) next.set("status", status);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{s.title}</h1>
        <Link href="/admin/products/new" className={buttonVariants()}>
          <Plus />
          {s.new}
        </Link>
      </div>

      <Form
        action="/admin/products"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
      >
        <Input name="q" defaultValue={q} placeholder={s.search} aria-label={s.search} />
        <NativeSelect name="category" defaultValue={category} aria-label={s.fields.category}>
          <option value="">{s.allCategories}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="type" defaultValue={type ?? ""} aria-label={s.fields.type}>
          <option value="">{s.allTypes}</option>
          {PRODUCT_TYPES.map((v) => (
            <option key={v} value={v}>
              {s.types[v]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status} aria-label={s.columns.status}>
          <option value="">{s.allStatuses}</option>
          <option value="active">{s.active}</option>
          <option value="inactive">{s.inactive}</option>
        </NativeSelect>
        <div className="flex gap-2">
          <Button type="submit">{s.filter}</Button>
          <Link href="/admin/products" className={buttonVariants({ variant: "outline" })}>
            {s.reset}
          </Link>
        </div>
      </Form>

      {products.length === 0 ? (
        <p className="text-muted-foreground text-sm">{s.empty}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{s.columns.image}</TableHead>
                <TableHead>{s.columns.name}</TableHead>
                <TableHead>{s.columns.category}</TableHead>
                <TableHead>{s.columns.type}</TableHead>
                <TableHead>{s.columns.price}</TableHead>
                <TableHead>{s.columns.stock}</TableHead>
                <TableHead>{s.columns.status}</TableHead>
                <TableHead className="text-right">{s.columns.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const prices = p.variants.map((v) => v.price);
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.images[0] ? (
                        <Image
                          src={p.images[0].url}
                          alt={p.name}
                          width={40}
                          height={40}
                          className="size-10 rounded-md object-cover"
                        />
                      ) : (
                        <div
                          className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md"
                          title={s.imagePlaceholder}
                        >
                          <ImageIcon className="size-4" aria-label={s.imagePlaceholder} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {[p.brand, `${p.variants.length} ${s.variantsCount}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </TableCell>
                    <TableCell>{p.category.name}</TableCell>
                    <TableCell>{s.types[p.type as ProductTypeValue]}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {prices.length === 0
                        ? "—"
                        : min === max
                          ? formatTND(min)
                          : `${formatTND(min)} – ${formatTND(max)}`}
                    </TableCell>
                    <TableCell>{stock}</TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "secondary" : "outline"}>
                        {p.isActive ? s.active : s.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          {t.admin.edit}
                        </Link>
                        <ToggleActiveButton id={p.id} isActive={p.isActive} />
                        <DeleteButton
                          action={deleteProduct.bind(null, p.id)}
                          title={s.deleteTitle}
                          description={s.deleteDescription}
                          itemName={p.name}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          {total} {s.results} · {s.page} {page} {s.of} {pageCount}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline" })}>
              {s.previous}
            </Link>
          ) : (
            <Button variant="outline" disabled>
              {s.previous}
            </Button>
          )}
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className={buttonVariants({ variant: "outline" })}>
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
