import { Prisma } from "@/generated/prisma/client";

/**
 * Server-side error logging that cannot leak data: it writes only the error kind (and the Prisma
 * error code), never the message, the query, its parameters or any value from the request.
 */
export function logServerError(where: string, error: unknown) {
  const name = error instanceof Error ? error.name : "unknown";
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? ` ${error.code}` : "";
  console.error(`[${where}] failed (${name}${code})`);
}
