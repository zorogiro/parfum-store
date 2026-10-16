import { t } from "@/lib/strings";

export const metadata = { title: t.admin.nav.orders };

export default function Page() {
  return <h1 className="text-2xl font-semibold">{t.admin.nav.orders}</h1>;
}
