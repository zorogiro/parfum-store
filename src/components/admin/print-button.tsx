"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/strings";

/** Hidden when printing. */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer />
      {t.admin.orders.print.button}
    </Button>
  );
}
