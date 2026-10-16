"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS, restoresStock, type OrderStatusValue } from "@/lib/order-status";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";
import { NOTE_MAX } from "@/lib/validators/admin-orders";
import { changeOrderStatus } from "@/server/orders";

const s = t.admin.orders.statusPanel;

/**
 * Buttons for the allowed transitions only (the server enforces them again). Each one opens a
 * confirm dialog with an optional note; cancelling or returning warns that stock is restored.
 */
export function OrderStatusPanel({
  orderId,
  number,
  status,
  allowed,
}: {
  orderId: string;
  number: string;
  status: OrderStatusValue;
  allowed: OrderStatusValue[];
}) {
  const [target, setTarget] = useState<OrderStatusValue | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function close() {
    setTarget(null);
    setNote("");
  }

  function confirm() {
    if (!target) return;
    startTransition(async () => {
      const result = await changeOrderStatus(orderId, target, note);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      close();
      router.refresh();
    });
  }

  if (allowed.length === 0) {
    return <p className="text-muted-foreground text-sm">{s.final}</p>;
  }

  const destructive = (to: OrderStatusValue) => to === "CANCELLED" || to === "RETURNED";

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
        {allowed.map((to) => (
          <Button
            key={to}
            type="button"
            variant={destructive(to) ? "destructive" : "default"}
            className="h-10 sm:h-9"
            onClick={() => setTarget(to)}
          >
            {s.actions[to as keyof typeof s.actions]}
          </Button>
        ))}
      </div>

      <AlertDialog open={target !== null} onOpenChange={(open) => !open && !pending && close()}>
        <AlertDialogContent>
          {target && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {format(s.confirmTitle, { status: STATUS_LABELS[target] })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {format(s.confirmDescription, {
                    number,
                    from: STATUS_LABELS[status],
                    to: STATUS_LABELS[target],
                  })}
                  {restoresStock(target) && (
                    <>
                      {" "}
                      <strong>{s.restoreStock}</strong>
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="status-note">{s.note}</Label>
                <Textarea
                  id="status-note"
                  value={note}
                  maxLength={NOTE_MAX}
                  placeholder={s.notePlaceholder}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={pending}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>{t.common.cancel}</AlertDialogCancel>
                <Button
                  type="button"
                  variant={destructive(target) ? "destructive" : "default"}
                  disabled={pending}
                  onClick={confirm}
                >
                  {pending ? s.applying : s.confirm}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
