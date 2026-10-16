/** Pure helpers (no secrets, safe for client and server) for product image uploads. */

export const PRODUCT_IMAGE_FOLDER = "store/products";
export const MAX_PRODUCT_IMAGES = 8;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Sent (and signed) with every upload so Cloudinary rejects other formats too. */
export const ALLOWED_IMAGE_FORMATS = "jpg,png,webp";

const PUBLIC_ID_PATTERN = new RegExp(`^${PRODUCT_IMAGE_FOLDER}/[A-Za-z0-9_-]{1,100}$`);

/** True only for ids directly inside our product folder (no traversal, no sub-folders). */
export function isProductImagePublicId(publicId: string): boolean {
  return PUBLIC_ID_PATTERN.test(publicId);
}

/**
 * True when `url` is a plain delivery URL of `publicId` in OUR Cloudinary cloud:
 * https://res.cloudinary.com/<cloud>/image/upload/[v123/]<publicId>[.ext]
 * Anything else (other hosts, other clouds, transformations, query strings) is refused.
 */
export function isProductImageUrl(url: string, cloudName: string, publicId: string): boolean {
  if (!cloudName || !isProductImagePublicId(publicId)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.host !== "res.cloudinary.com") return false;
  if (parsed.search || parsed.hash || parsed.username || parsed.password) return false;

  const prefix = `/${cloudName}/image/upload/`;
  if (!parsed.pathname.startsWith(prefix)) return false;
  const rest = parsed.pathname.slice(prefix.length).replace(/^v\d+\//, "");
  return rest === publicId || new RegExp(`^${publicId}\\.[a-z0-9]{2,5}$`).test(rest);
}
