import type { Prisma } from "@/generated/prisma/client";

/** Formats a sequence value as an order number, e.g. 123 -> "ORD-000123". */
export function formatOrderNumber(sequence: number | bigint): string {
  return `ORD-${sequence.toString().padStart(6, "0")}`;
}

/**
 * Returns the next order number. Backed by the `order_number_seq` Postgres
 * sequence, so concurrent orders never get the same number. Call it inside the
 * same transaction that creates the order (pass the transaction client).
 */
export async function nextOrderNumber(
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
): Promise<string> {
  const rows = await client.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`;
  return formatOrderNumber(rows[0].n);
}
