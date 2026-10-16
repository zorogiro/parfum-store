"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/admin/field";
import { slugify } from "@/lib/slug";
import { t } from "@/lib/strings";
import { createCategory, updateCategory } from "@/server/categories";

const s = t.admin.categories;

type CategoryValues = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
};

export function CategoryForm({
  category,
  parents,
  hasChildren = false,
}: {
  category?: CategoryValues;
  /** Root categories that can be chosen as parent (never the category itself). */
  parents: { id: string; name: string }[];
  /** A category with subcategories can't be nested under another one. */
  hasChildren?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [position, setPosition] = useState(String(category?.position ?? 0));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const payload = { name, slug, parentId: parentId || null, position };
      const result = category
        ? await updateCategory(category.id, payload)
        : await createCategory(payload);
      if (result.ok) {
        toast.success(result.message);
        router.push("/admin/categories");
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5" noValidate>
      <Field label={s.fields.name} htmlFor="name" error={errors.name}>
        <Input
          id="name"
          value={name}
          required
          aria-invalid={Boolean(errors.name)}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field label={s.fields.slug} htmlFor="slug" error={errors.slug} help={s.fields.slugHelp}>
        <Input
          id="slug"
          value={slug}
          aria-invalid={Boolean(errors.slug)}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
      </Field>
      <Field label={s.fields.parent} htmlFor="parentId" error={errors.parentId}>
        <NativeSelect
          id="parentId"
          value={parentId}
          disabled={hasChildren}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">{s.fields.noParent}</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label={s.fields.position}
        htmlFor="position"
        error={errors.position}
        help={s.fields.positionHelp}
      >
        <Input
          id="position"
          type="number"
          min={0}
          step={1}
          value={position}
          aria-invalid={Boolean(errors.position)}
          onChange={(e) => setPosition(e.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t.admin.saving : t.common.save}
        </Button>
        <Link href="/admin/categories" className={buttonVariants({ variant: "outline" })}>
          {t.common.cancel}
        </Link>
      </div>
    </form>
  );
}
