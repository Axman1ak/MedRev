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
