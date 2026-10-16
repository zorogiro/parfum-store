import { Label } from "@/components/ui/label";
import { cn } from "cn";

export function Field({
  label,
  htmlFor,
  error,
  help,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  help?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : help ? (
        <p className="text-muted-foreground text-xs">{help}</p>
      ) : null}
    </div>
  );
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
