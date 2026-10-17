"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/strings";
import { ADMIN_NOTE_MAX } from "@/lib/validators/admin-orders";
import { updateAdminNote } from "@/server/orders";

const s = t.admin.orders.adminNote;

export function OrderAdminNote({ orderId, initial }: { orderId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const result = await updateAdminNote(orderId, value);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="admin-note">{s.title}</Label>
      <Textarea
        id="admin-note"
        value={value}
        maxLength={ADMIN_NOTE_MAX}
        placeholder={s.placeholder}
        onChange={(event) => setValue(event.target.value)}
        disabled={pending}
      />
      <p className="text-muted-foreground text-xs">{s.help}</p>
      <Button type="button" onClick={save} disabled={pending || value === initial}>
        {pending ? t.admin.saving : s.save}
      </Button>
    </div>
  );
}
