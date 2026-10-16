import Link from "next/link";
import { Banknote, RotateCcw, Truck } from "lucide-react";
import { t } from "@/lib/strings";

const s = t.shop.product.info;

export function ProductInfoBlock() {
  return (
    <section aria-label={s.title} className="bg-muted/40 space-y-4 rounded-xl border p-4">
      <div className="flex gap-3">
        <Banknote className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-medium">{s.cod.title}</p>
          <p className="text-muted-foreground text-sm">{s.cod.text}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <Truck className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-medium">{s.delivery.title}</p>
          <p className="text-muted-foreground text-sm">{s.delivery.text}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <RotateCcw className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-medium">{s.returns.title}</p>
          <Link
            href="/retours"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            {s.returns.link}
          </Link>
        </div>
      </div>
    </section>
  );
}
