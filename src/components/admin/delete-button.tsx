"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { t } from "@/lib/strings";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Trash button + confirm dialog. `action` is a bound server action. */
export function DeleteButton({
  action,
  title,
  description,
  itemName,
}: {
  action: () => Promise<ActionResult<{ softDisabled?: boolean }>>;
  title: string;
  description: string;
  itemName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`${t.common.delete} ${itemName}`}
      >
        <Trash2 />
        {t.common.delete}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{itemName}</strong>. {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t.common.cancel}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
              {pending ? t.admin.deleting : t.common.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
