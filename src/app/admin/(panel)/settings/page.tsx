import { t } from "@/lib/strings";

export const metadata = { title: t.admin.nav.settings };

export default function Page() {
  return <h1 className="text-2xl font-semibold">{t.admin.nav.settings}</h1>;
}
