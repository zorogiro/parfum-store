"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/admin/field";
import { t } from "@/lib/strings";
import { updateShipping } from "@/server/shipping";

const s = t.admin.shipping;

type Zone = { id: string; governorate: string; fee: string };

/** All governorate fees and the free-shipping threshold, saved together. Values are TND strings. */
export function ShippingForm({ zones, threshold }: { zones: Zone[]; threshold: string }) {
  const [fees, setFees] = useState(() => Object.fromEntries(zones.map((z) => [z.id, z.fee])));
  const [thresholdValue, setThresholdValue] = useState(threshold);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateShipping({
        zones: zones.map((z) => ({ id: z.id, fee: fees[z.id] ?? "" })),
        threshold: thresholdValue,
      });
      if (result.ok) {
        setErrors({});
        toast.success(result.message);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">{s.thresholdTitle}</h2>
        <Field
          label={s.thresholdLabel}
          htmlFor="threshold"
          help={s.thresholdHelp}
          error={errors.threshold}
          className="max-w-sm"
        >
          <Input
            id="threshold"
            inputMode="decimal"
            value={thresholdValue}
            onChange={(event) => setThresholdValue(event.target.value)}
            aria-invalid={!!errors.threshold}
            disabled={pending}
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <div>
          <h2 className="font-semibold">{s.zonesTitle}</h2>
          <p className="text-muted-foreground text-sm">{s.zonesHelp}</p>
        </div>
        {zones.length === 0 ? (
          <p className="text-muted-foreground text-sm">{s.noZones}</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
            {zones.map((zone, index) => {
              const error = errors[`zones.${index}.fee`];
              return (
                <li key={zone.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={`fee-${zone.id}`} className="min-w-0 truncate text-sm">
                      {zone.governorate}
                    </label>
                    <Input
                      id={`fee-${zone.id}`}
                      inputMode="decimal"
                      className="w-28 shrink-0 text-right"
                      value={fees[zone.id] ?? ""}
                      onChange={(event) =>
                        setFees((current) => ({ ...current, [zone.id]: event.target.value }))
                      }
                      aria-label={`${s.fee} – ${zone.governorate}`}
                      aria-invalid={!!error}
                      disabled={pending}
                    />
                  </div>
                  {error && (
                    <p role="alert" className="text-destructive text-xs">
                      {error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? t.admin.saving : s.saveAll}
      </Button>
    </form>
  );
}
