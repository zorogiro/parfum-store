/**
 * All user-facing UI text lives here (French). Keep keys stable so an Arabic
 * dictionary can be added later and selected by locale.
 */
export const fr = {
  site: {
    name: "Parfum Store",
    description: "Parfums, vêtements et accessoires, livrés partout en Tunisie.",
  },
  common: {
    addToCart: "Ajouter au panier",
    outOfStock: "Épuisé",
    loading: "Chargement…",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
  },
  payment: {
    cashOnDelivery: "Paiement à la livraison",
  },
} as const;

export type Strings = typeof fr;

export const t: Strings = fr;
