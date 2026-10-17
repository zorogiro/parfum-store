/** Reference data shared by the dev seed (prisma/seed.ts) and the production seed. */

/** Default shipping fee per governorate, in millimes (8 TND). */
export const DEFAULT_FEE = 8000;

export const GOVERNORATES = [
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kébili",
  "Le Kef",
  "Mahdia",
  "La Manouba",
  "Médenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
];

export const CATEGORIES = [
  {
    name: "Parfums",
    slug: "parfums",
    children: [
      { name: "Parfums Homme", slug: "parfums-homme" },
      { name: "Parfums Femme", slug: "parfums-femme" },
    ],
  },
  {
    name: "Vêtements",
    slug: "vetements",
    children: [
      { name: "Vêtements Homme", slug: "vetements-homme" },
      { name: "Vêtements Femme", slug: "vetements-femme" },
    ],
  },
  {
    name: "Accessoires",
    slug: "accessoires",
    children: [
      { name: "Sacs", slug: "sacs" },
      { name: "Montres", slug: "montres" },
    ],
  },
];
