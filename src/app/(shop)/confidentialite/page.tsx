import type { Metadata } from "next";
import { LegalPage } from "@/components/shop/legal-page";
import { t } from "@/lib/strings";

const content = t.legalPages.privacy;

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  alternates: { canonical: "/confidentialite" },
  openGraph: { title: content.title, description: content.description, url: "/confidentialite" },
};

export default function Page() {
  return <LegalPage content={content} />;
}
