import { ShippingForm } from "@/components/admin/shipping-form";
import { parseThresholdSetting } from "@/lib/cart-details";
import { db } from "@/lib/db";
import { toTNDInputValue } from "@/lib/money";
import { t } from "@/lib/strings";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: t.admin.nav.shipping };

export default async function Page() {
  await requireAdmin();

  const zones = await db.shippingZone.findMany({
    select: { id: true, governorate: true, fee: true },
  });
  zones.sort((a, b) => a.governorate.localeCompare(b.governorate, "fr"));
  const setting = await db.setting.findUnique({ where: { key: "freeShippingThreshold" } });
  const threshold = parseThresholdSetting(setting?.value);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t.admin.shipping.title}</h1>
      <ShippingForm
        zones={zones.map((z) => ({
          id: z.id,
          governorate: z.governorate,
          fee: toTNDInputValue(z.fee),
        }))}
        threshold={threshold === null ? "" : toTNDInputValue(threshold)}
      />
    </div>
  );
}
