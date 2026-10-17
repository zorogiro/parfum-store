import { formatTND } from "@/lib/money";
import { SITE_URL } from "@/lib/site";
import { t } from "@/lib/strings";
import { format } from "@/lib/utils";
import type { OrderLineView } from "@/lib/checkout-types";

/**
 * Pure email templates (no DB, no network). Every piece of user-provided text goes through
 * escapeHtml before it is placed in the HTML body.
 */
export type OrderEmailData = {
  number: string;
  customerName: string;
  phone: string;
  email?: string;
  governorate: string;
  city: string;
  address: string;
  notes?: string;
  items: OrderLineView[];
  subtotal: number;
  shippingFee: number;
  total: number;
};

export type EmailContent = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Headers must be a single line. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

const e = t.email;

function itemsTable(items: OrderLineView[]): string {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(i.productName)}<br><span style="color:#666;font-size:13px">${escapeHtml(i.variantLabel)}</span></td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">×${i.quantity}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${escapeHtml(formatTND(i.unitPrice * i.quantity))}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px">${rows}</table>`;
}

function totalsBlock(
  data: OrderEmailData,
  labels: { subtotal: string; shipping: string; total: string; free: string },
): string {
  const shipping = data.shippingFee === 0 ? labels.free : formatTND(data.shippingFee);
  return (
    `<p style="margin:12px 0 0;font-size:14px;text-align:right">${escapeHtml(labels.subtotal)} : ${escapeHtml(formatTND(data.subtotal))}<br>` +
    `${escapeHtml(labels.shipping)} : ${escapeHtml(shipping)}<br>` +
    `<strong style="font-size:16px">${escapeHtml(labels.total)} : ${escapeHtml(formatTND(data.total))}</strong></p>`
  );
}

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#222"><div style="max-width:560px;margin:0 auto;background:#fff;padding:24px"><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}</div></body></html>`;
}

function textItems(items: OrderLineView[]): string {
  return items
    .map(
      (i) =>
        `- ${i.productName} (${i.variantLabel}) x${i.quantity} : ${formatTND(i.unitPrice * i.quantity)}`,
    )
    .join("\n");
}

/** Notification sent to the store owner (contains the full order details). */
export function buildMerchantEmail(data: OrderEmailData): EmailContent {
  const s = e.merchant;
  const none = s.none;
  const heading = format(s.heading, { number: data.number });
  const lines: [string, string][] = [
    [s.name, data.customerName],
    [s.phone, data.phone],
    [s.email, data.email ?? none],
    [s.address, `${data.address}, ${data.city}, ${data.governorate}`],
    [s.notes, data.notes ?? none],
  ];
  const customerHtml = lines
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 8px;color:#666;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 8px">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const html = layout(
    heading,
    `<h2 style="font-size:15px;margin:16px 0 4px">${escapeHtml(s.customer)}</h2>` +
      `<table role="presentation" cellspacing="0" cellpadding="0" style="font-size:14px">${customerHtml}</table>` +
      `<h2 style="font-size:15px;margin:16px 0 4px">${escapeHtml(s.items)}</h2>` +
      itemsTable(data.items) +
      totalsBlock(data, { ...s, free: s.free }) +
      `<p style="margin:12px 0 0;font-size:13px;color:#666">${escapeHtml(s.payment)}</p>`,
  );

  const text = [
    heading,
    "",
    ...lines.map(([label, value]) => `${label} : ${value}`),
    "",
    textItems(data.items),
    "",
    `${s.subtotal} : ${formatTND(data.subtotal)}`,
    `${s.shipping} : ${data.shippingFee === 0 ? s.free : formatTND(data.shippingFee)}`,
    `${s.total} : ${formatTND(data.total)}`,
  ].join("\n");

  return {
    subject: oneLine(format(s.subject, { number: data.number, total: formatTND(data.total) })),
    html,
    text,
  };
}

/** Confirmation sent to the customer (only when they gave an email). */
export function buildCustomerEmail(data: OrderEmailData): EmailContent {
  const s = e.customer;
  const trackUrl = `${SITE_URL}/suivi`;
  const html = layout(
    s.heading,
    `<p style="font-size:14px">${escapeHtml(format(s.intro, { number: data.number }))}</p>` +
      `<h2 style="font-size:15px;margin:16px 0 4px">${escapeHtml(s.items)}</h2>` +
      itemsTable(data.items) +
      totalsBlock(data, s) +
      `<h2 style="font-size:15px;margin:16px 0 4px">${escapeHtml(s.deliveryTo)}</h2>` +
      `<p style="font-size:14px;margin:0">${escapeHtml(data.customerName)}<br>${escapeHtml(data.address)}<br>${escapeHtml(data.city)}, ${escapeHtml(data.governorate)}</p>` +
      `<p style="font-size:14px">${escapeHtml(s.payment)}</p>` +
      `<p style="font-size:14px"><a href="${escapeHtml(trackUrl)}">${escapeHtml(s.track)}</a></p>` +
      `<p style="font-size:13px;color:#444"><strong>${escapeHtml(s.notYou)}</strong></p>` +
      `<p style="font-size:12px;color:#666">${escapeHtml(format(s.footer, { site: t.site.name }))}</p>`,
  );

  const text = [
    s.heading,
    "",
    format(s.intro, { number: data.number }),
    "",
    textItems(data.items),
    "",
    `${s.subtotal} : ${formatTND(data.subtotal)}`,
    `${s.shipping} : ${data.shippingFee === 0 ? s.free : formatTND(data.shippingFee)}`,
    `${s.total} : ${formatTND(data.total)}`,
    "",
    s.payment,
    `${s.track} : ${trackUrl}`,
    "",
    s.notYou,
  ].join("\n");

  return { subject: oneLine(format(s.subject, { number: data.number })), html, text };
}
