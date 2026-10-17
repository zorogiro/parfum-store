/** Contact links for an order's customer phone (stored as "+216XXXXXXXX"). Pure module. */

/** Digits only, with the country code: "+216 22 123 456" -> "21622123456". */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function telHref(phone: string): string {
  return `tel:+${phoneDigits(phone)}`;
}

/** wa.me link; the optional prefilled message is URL-encoded. */
export function whatsappHref(phone: string, message?: string): string {
  const base = `https://wa.me/${phoneDigits(phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
