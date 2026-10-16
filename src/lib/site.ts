/** Absolute base URL used for canonical links and Open Graph (set NEXT_PUBLIC_SITE_URL in production). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

/** Replace the empty URLs with the real accounts; entries with an empty url render as plain text. */
export const SOCIAL_LINKS = [
  { key: "facebook", url: "" },
  { key: "instagram", url: "" },
  { key: "whatsapp", url: "" },
] as const;

export const LEGAL_LINKS = [
  { key: "terms", href: "/conditions-generales" },
  { key: "privacy", href: "/confidentialite" },
  { key: "returns", href: "/retours" },
] as const;
