import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { t } from "@/lib/strings";

type LegalContent = {
  title: string;
  sections: readonly { heading: string; body: string }[];
};

/** Static text page. Edit the copy in `legalPages` in src/lib/strings.ts. */
export function LegalPage({ content }: { content: LegalContent }) {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Breadcrumbs items={[{ label: content.title }]} />
      <h1 className="text-2xl font-semibold sm:text-3xl">{content.title}</h1>
      <p className="bg-muted text-muted-foreground rounded-lg px-4 py-3 text-sm">
        {t.legalPages.placeholderNotice}
      </p>
      <p className="text-muted-foreground text-sm">{t.legalPages.updated}</p>
      {content.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          <p className="text-muted-foreground leading-relaxed">{section.body}</p>
        </section>
      ))}
    </article>
  );
}
