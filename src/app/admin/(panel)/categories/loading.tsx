import { t } from "@/lib/strings";

export default function Loading() {
  return (
    <p className="text-muted-foreground text-sm" role="status">
      {t.common.loading}
    </p>
  );
}
