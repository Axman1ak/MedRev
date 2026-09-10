// src/lib/theme.ts
//
// Le thème choisi par l'étudiante, et son application à la page.
//
// POURQUOI CE FICHIER EXISTE
// --------------------------
// Le thème n'était posé que par la page Réglages : elle seule lisait
// localStorage et écrivait data-theme sur <html>. En arrivant sur n'importe
// quelle autre page, l'attribut n'existait pas, donc le site s'affichait en
// clair même pour quelqu'un qui avait choisi le sombre. Il repassait en sombre
// dès qu'on ouvrait Réglages, sans rien toucher, et le restait jusqu'au
// rechargement suivant. C'est exactement ce que décrivait le retour.
//
// Le choix vit maintenant ici, et le script d'amorçage de src/app/layout.tsx
// l'applique avant le premier affichage, sur toutes les pages.
//
// ATTENTION · ce fichier et le script d'amorçage du layout font le même
// travail ; un script en ligne ne peut rien importer. Si tu changes la clé de
// stockage ou les couleurs, change les deux.

export type ThemeId = 'light' | 'dark'

/** Clé de stockage. Identique dans le script d'amorçage du layout. */
export const THEME_KEY = 'medrev-theme'

/**
 * Le fond de l'application dans chaque thème, repris de --bg-app
 * (src/app/globals.css). Safari sur iPhone teinte ses barres du haut et du bas
 * avec cette valeur.
 */
export const THEME_BG: Record<ThemeId, string> = {
  light: '#FAFAF7',
  dark: '#0A111E',
}

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'light'
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    // Navigation privée, stockage bloqué : on retombe sur le clair.
    return 'light'
  }
}

/**
 * Applique le thème à la page entière.
 *
 * Les trois choses vont ensemble :
 *   · data-theme  → les couleurs de l'application (globals.css)
 *   · color-scheme → les contrôles natifs (barres de défilement, champs)
 *   · theme-color  → les barres de Safari sur iPhone
 *
 * theme-color était déclaré avec un `media: prefers-color-scheme`, c'est-à-dire
 * suivant le réglage du TÉLÉPHONE. Or le thème de MedRev est un choix manuel,
 * indépendant du téléphone : quelqu'un en sombre dans MedRev sur un iPhone
 * réglé en clair gardait des barres claires autour d'un écran sombre. On écrase
 * donc les deux balises avec la couleur réellement affichée.
 */
export function applyTheme(t: ThemeId): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', t)
  root.style.colorScheme = t
  const metas = document.querySelectorAll('meta[name="theme-color"]')
  if (metas.length === 0) {
    const m = document.createElement('meta')
    m.setAttribute('name', 'theme-color')
    m.setAttribute('content', THEME_BG[t])
    document.head.appendChild(m)
    return
  }
  metas.forEach(m => m.setAttribute('content', THEME_BG[t]))
}

/** Enregistre le choix et l'applique dans la foulée. */
export function setTheme(t: ThemeId): void {
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    // Le choix ne survivra pas à la fermeture, mais la page suit quand même.
  }
  applyTheme(t)
}
