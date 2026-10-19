// src/lib/site.ts
//
// L'adresse officielle du site, celle que Google doit retenir.
// medrev.fr redirige déjà vers www.medrev.fr (réglage Vercel), donc c'est
// www.medrev.fr qui fait foi partout : balises, sitemap, robots.
//
// Écrite en dur exprès : avant, ces fichiers lisaient une variable
// d'environnement avec med-rev-eight.vercel.app par défaut, et Google
// indexait les deux adresses comme deux sites différents.
export const SITE_URL = 'https://www.medrev.fr'

// Les comptes MedRev sur les réseaux (Instagram, TikTok, LinkedIn…).
// Google s'en sert pour comprendre que ces comptes et le site sont la même
// marque. Ajouter chaque adresse complète ici dès qu'un compte existe, ex. :
//   'https://www.instagram.com/medrev.fr/'
export const SOCIAL_PROFILES: string[] = []
