import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/strings";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">{t.shop.notFound.title}</h1>
      <p className="text-muted-foreground">{t.shop.notFound.text}</p>
      <Link href="/" className={buttonVariants({ size: "lg", className: "mt-2 h-10 px-4" })}>
        {t.shop.listing.backHome}
      </Link>
    </div>
  );
}
