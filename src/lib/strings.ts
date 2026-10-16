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
  admin: {
    title: "Administration",
    login: {
      title: "Connexion administrateur",
      email: "Email",
      password: "Mot de passe",
      submit: "Se connecter",
      submitting: "Connexion…",
      invalid: "Email ou mot de passe incorrect",
      rateLimited: "Trop de tentatives. Réessayez dans quelques minutes.",
    },
    logout: "Déconnexion",
    nav: {
      dashboard: "Tableau de bord",
      products: "Produits",
      categories: "Catégories",
      orders: "Commandes",
      shipping: "Livraison",
      settings: "Paramètres",
    },
  },
  payment: {
    cashOnDelivery: "Paiement à la livraison",
  },
} as const;

export type Strings = typeof fr;

export const t: Strings = fr;
