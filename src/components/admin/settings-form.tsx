"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/admin/field";
import { t } from "@/lib/strings";
import { updateSettings } from "@/server/settings";

const s = t.admin.settings;

export function SettingsForm({
  storePhone,
  notificationEmail,
}: {
  storePhone: string;
  notificationEmail: string;
}) {
  const [phone, setPhone] = useState(storePhone);
  const [email, setEmail] = useState(notificationEmail);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateSettings({ storePhone: phone, notificationEmail: email });
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
    <form onSubmit={save} className="max-w-xl space-y-4">
      <Field
        label={s.storePhone}
        htmlFor="storePhone"
        help={s.storePhoneHelp}
        error={errors.storePhone}
      >
        <Input
          id="storePhone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          aria-invalid={!!errors.storePhone}
          disabled={pending}
        />
      </Field>
      <Field
        label={s.notificationEmail}
        htmlFor="notificationEmail"
        help={s.notificationEmailHelp}
        error={errors.notificationEmail}
      >
        <Input
          id="notificationEmail"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={!!errors.notificationEmail}
          disabled={pending}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? t.admin.saving : s.save}
      </Button>
    </form>
  );
}
