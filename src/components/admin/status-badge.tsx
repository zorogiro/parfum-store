import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASSES, STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";

export function StatusBadge({
  status,
  className,
}: {
  status: OrderStatusValue;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn(STATUS_BADGE_CLASSES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
