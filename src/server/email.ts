import "server-only";
import { Resend } from "resend";
import { buildCustomerEmail, buildMerchantEmail, type OrderEmailData } from "@/lib/order-email";
import { db } from "@/lib/db";
import { customerEmailLimiter } from "./rate-limiters";

const DEFAULT_FROM = "onboarding@resend.dev";
const SEND_TIMEOUT_MS = 8000;

/** Never log recipients, names or addresses: only the kind of failure. */
function logFailure(kind: string, error: unknown) {
  const name = error instanceof Error ? error.name : "unknown";
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? String((error as { statusCode: unknown }).statusCode)
      : "";
  console.error(`[email] ${kind} failed (${name}${status ? ` ${status}` : ""})`);
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("TimeoutError")), SEND_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function getNotificationEmail(): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: "notificationEmail" } });
  return row?.value.trim() || null;
}

/**
 * Sends the merchant notification and (when the customer gave an email) the confirmation.
 * NEVER throws: an email problem must not fail or roll back an order. Call it from `after()`
 * so it does not delay the response.
 */
export async function sendOrderEmails(data: OrderEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not set, order emails skipped");
    return;
  }
  const from = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;
  const resend = new Resend(apiKey);

  const send = async (kind: string, to: string, content: ReturnType<typeof buildMerchantEmail>) => {
    try {
      const { error } = await withTimeout(
        resend.emails.send({
          from,
          to,
          subject: content.subject,
          html: content.html,
          text: content.text,
        }),
      );
      if (error) logFailure(kind, error);
    } catch (error) {
      logFailure(kind, error);
    }
  };

  let merchantTo: string | null = null;
  try {
    merchantTo = await getNotificationEmail();
  } catch (error) {
    logFailure("notification setting lookup", error);
  }

  // The customer address is whatever was typed at checkout: cap confirmations per address so the
  // shop cannot be used to mail-bomb someone. The merchant notification is never limited.
  let sendCustomer = false;
  if (data.email) {
    sendCustomer = await customerEmailLimiter.consume(data.email.trim().toLowerCase());
    if (!sendCustomer) console.error("[email] customer confirmation skipped (rate limited)");
  }

  await Promise.all([
    merchantTo
      ? send("merchant notification", merchantTo, buildMerchantEmail(data))
      : Promise.resolve(console.error("[email] notificationEmail setting is empty, skipped")),
    sendCustomer && data.email
      ? send("customer confirmation", data.email, buildCustomerEmail(data))
      : Promise.resolve(),
  ]);
}
