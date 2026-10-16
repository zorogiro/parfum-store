import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  title,
  text,
  actionLabel,
  actionHref,
}: {
  title: string;
  text?: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
      <PackageSearch className="text-muted-foreground size-10" aria-hidden />
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="text-muted-foreground max-w-md text-sm">{text}</p>}
      <Link
        href={actionHref}
        className={buttonVariants({ size: "lg", className: "mt-2 h-10 px-4" })}
      >
        {actionLabel}
      </Link>
    </div>
  );
}
