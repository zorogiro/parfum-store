"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/strings";
import { setProductActive } from "@/server/products";

export function ToggleActiveButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setProductActive(id, !isActive);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      {isActive ? t.admin.products.disable : t.admin.products.enable}
    </Button>
  );
}
