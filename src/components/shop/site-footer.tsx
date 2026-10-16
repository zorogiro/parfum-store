import { Suspense } from "react";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Phone } from "lucide-react";
import { LEGAL_LINKS, SOCIAL_LINKS } from "@/lib/site";
import { t } from "@/lib/strings";
import { getStorePhone } from "@/server/storefront";

const s = t.shop.footer;

/** Keeps digits and a leading + so the tel: link works whatever the stored formatting. */
function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

async function FooterPhone() {
  const phone = await getStorePhone();
  if (!phone) return <p className="text-muted-foreground text-sm">{s.phoneMissing}</p>;
  return (
    <a
      href={telHref(phone)}
      className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
    >
      <Phone className="size-4" aria-hidden />
      <span dir="ltr">{phone}</span>
    </a>
  );
}

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="bg-muted/40 mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="space-y-3">
          <p className="text-lg font-semibold">{t.site.name}</p>
          <p className="text-muted-foreground text-sm">{t.site.description}</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">{s.contact}</h2>
          <p className="text-muted-foreground text-sm">{s.callUs}</p>
          <Suspense fallback={<div className="bg-muted h-5 w-32 animate-pulse rounded" />}>
            <FooterPhone />
          </Suspense>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
            {SOCIAL_LINKS.map(({ key, url }) => (
              <li key={key}>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {s.social[key]}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{s.social[key]}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label={s.info} className="space-y-3">
          <h2 className="text-sm font-semibold">{s.info}</h2>
          <ul className="space-y-2 text-sm">
            {LEGAL_LINKS.map(({ key, href }) => (
              <li key={key}>
                <Link
                  href={href}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {t.shop.legal[key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="text-muted-foreground border-t py-4 text-center text-xs">
        ©{" "}
        <Suspense fallback={null}>
          <CurrentYear />
        </Suspense>{" "}
        {t.site.name}. {s.rights}
      </div>
    </footer>
  );
}
