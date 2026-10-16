import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackingForm } from "@/components/shop/tracking-form";
import { t } from "@/lib/strings";

const s = t.shop.tracking;

export const metadata: Metadata = {
  title: s.metaTitle,
  robots: { index: false, follow: false },
};

async function Prefill({ searchParams }: PageProps<"/suivi">) {
  const raw = await searchParams;
  const number = Array.isArray(raw.number) ? raw.number[0] : raw.number;
  return <TrackingForm initialNumber={(number ?? "").slice(0, 40)} />;
}

export default function TrackingPage(props: PageProps<"/suivi">) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
        <p className="text-muted-foreground text-sm">{s.intro}</p>
      </div>
      <Suspense fallback={<TrackingForm initialNumber="" />}>
        <Prefill {...props} />
      </Suspense>
    </div>
  );
}
