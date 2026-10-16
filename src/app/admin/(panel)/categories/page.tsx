import { t } from "@/lib/strings";

export const metadata = { title: t.admin.nav.categories };

export default function Page() {
  return <h1 className="text-2xl font-semibold">{t.admin.nav.categories}</h1>;
}
