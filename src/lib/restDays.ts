// src/lib/restDays.ts
//
// Jours sans révision (réglage du profil, colonne profiles.rest_days).
// Beaucoup de P1 ne révisent pas le dimanche (TD, famille) : une révision qui
// tombe un jour de repos passe au jour suivant qui n'en est pas un.
// J+0 (le jour où l'on apprend le cours) n'est jamais déplacé.
//
// La liste est gardée en mémoire et dans le navigateur pour que tous les
// écrans calculent les mêmes dates sans attendre le profil ; la barre
// latérale la met à jour à partir du profil au chargement.

import { toDateStr } from '@/types'

const KEY = 'medrev-rest-days'
let cache: number[] | null = null

function clean(v: unknown): number[] {
  return Array.isArray(v) ? Array.from(new Set(v.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6))).sort() : []
}

export function getRestDays(): number[] {
  if (cache) return cache
  if (typeof window === 'undefined') return []
  try { cache = clean(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch { cache = [] }
  return cache
}

/** Met à jour la liste locale ; renvoie true si elle a changé. */
export function setRestDaysLocal(days: unknown): boolean {
  const next = clean(days)
  const prev = getRestDays()
  cache = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* navigation privée */ }
  return prev.join(',') !== next.join(',')
}

/** Date de révision : learnDate + offset jours, décalée après les jours de repos. */
export function reviewDate(learnDate: string, offset: number): string {
  const d = new Date(learnDate + 'T12:00:00')
  d.setDate(d.getDate() + offset)
  if (offset > 0) {
    const rest = getRestDays()
    if (rest.length > 0 && rest.length < 7) {
      for (let k = 0; k < 7 && rest.includes(d.getDay()); k++) d.setDate(d.getDate() + 1)
    }
  }
  return toDateStr(d)
}

export const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
