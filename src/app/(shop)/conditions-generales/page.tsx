import type { Metadata } from "next";
import { LegalPage } from "@/components/shop/legal-page";
import { t } from "@/lib/strings";

const content = t.legalPages.terms;

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  alternates: { canonical: "/conditions-generales" },
  openGraph: {
    title: content.title,
    description: content.description,
    url: "/conditions-generales",
  },
};

export default function Page() {
  return <LegalPage content={content} />;
}
