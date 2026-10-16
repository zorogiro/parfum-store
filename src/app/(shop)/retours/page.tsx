import type { Metadata } from "next";
import { LegalPage } from "@/components/shop/legal-page";
import { t } from "@/lib/strings";

const content = t.legalPages.returns;

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  alternates: { canonical: "/retours" },
  openGraph: { title: content.title, description: content.description, url: "/retours" },
};

export default function Page() {
  return <LegalPage content={content} />;
}
