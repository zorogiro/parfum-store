import { SettingsForm } from "@/components/admin/settings-form";
import { db } from "@/lib/db";
import { t } from "@/lib/strings";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: t.admin.nav.settings };

export default async function Page() {
  await requireAdmin();

  const rows = await db.setting.findMany({
    where: { key: { in: ["storePhone", "notificationEmail"] } },
  });
  const value = (key: string) => rows.find((r) => r.key === key)?.value ?? "";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t.admin.settings.title}</h1>
      <section className="space-y-4 rounded-lg border p-4">
        <h2 className="font-semibold">{t.admin.settings.storeTitle}</h2>
        <SettingsForm
          storePhone={value("storePhone")}
          notificationEmail={value("notificationEmail")}
        />
      </section>
    </div>
  );
}
