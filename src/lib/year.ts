// src/lib/year.ts
//
// Année d'études courante. Ajouté 2026-08 pour permettre de passer de P1 à P2
// sans rien perdre : chaque matière (table systems) porte l'année où elle a été
// créée, et le profil porte l'année qu'on regarde en ce moment
// (profiles.current_year).
//
// Principe : on ne supprime JAMAIS rien. Changer d'année ne fait que déplacer
// la fenêtre de lecture. Revenir sur l'année précédente dans les Réglages
// retrouve toutes les matières, fiches, QCM, paliers et statistiques intacts.
//
// Les fiches (table lessons) n'ont pas de colonne year : elles héritent de
// l'année de leur matière via system_id. Une seule source de vérité, aucun
// risque de désynchronisation.

import type { System, Lesson } from '@/types'

export interface YearOption {
  id: string
  label: string
  /** Nom officiel du cursus, affiché en second pour lever l'ambiguïté. */
  hint: string
}

// Cursus médecine français après la réforme : PASS/LAS puis DFGSM puis DFASM.
// On garde les libellés courts que les étudiants emploient réellement (P2, D1)
// et on rappelle le nom officiel à côté.
export const YEARS: YearOption[] = [
  { id: 'P1', label: 'P1', hint: 'PASS ou LAS · première année' },
  { id: 'P2', label: 'P2', hint: 'DFGSM2 · deuxième année' },
  { id: 'P3', label: 'P3', hint: 'DFGSM3 · troisième année' },
  { id: 'D1', label: 'D1', hint: 'DFASM1 · quatrième année' },
  { id: 'D2', label: 'D2', hint: 'DFASM2 · cinquième année' },
  { id: 'D3', label: 'D3', hint: 'DFASM3 · sixième année' },
]

/** Année par défaut. Doit rester alignée sur le DEFAULT de la migration SQL. */
export const DEFAULT_YEAR = 'P1'

/**
 * Ramène n'importe quelle valeur à une année connue.
 * Couvre les colonnes absentes d'un SELECT partiel, les comptes créés avant la
 * migration, et toute valeur inattendue venant de la base.
 */
export function normalizeYear(value: unknown): string {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return YEARS.some(y => y.id === v) ? v : DEFAULT_YEAR
}

/** Libellé court d'une année, pour l'afficher dans l'interface. */
export function yearLabel(id: string): string {
  const y = YEARS.find(o => o.id === normalizeYear(id))
  return y ? y.label : DEFAULT_YEAR
}

/** Nom officiel du cursus, pour les infobulles et les textes explicatifs. */
export function yearHint(id: string): string {
  const y = YEARS.find(o => o.id === normalizeYear(id))
  return y ? y.hint : ''
}

/**
 * Restreint un jeu matières + fiches à une seule année.
 *
 * Les fiches sont gardées si et seulement si leur matière l'est. Une fiche
 * orpheline (matière supprimée, system_id qui ne correspond à rien) est écartée,
 * ce qui est le comportement voulu : elle n'est de toute façon affichable nulle
 * part puisque tous les écrans ont besoin du nom et de la couleur de sa matière.
 */
export function scopeToYear(
  systems: System[],
  lessons: Lesson[],
  year: string,
): { systems: System[]; lessons: Lesson[] } {
  const target = normalizeYear(year)
  const kept = systems.filter(s => normalizeYear((s as { year?: unknown }).year) === target)
  const ids = new Set(kept.map(s => s.id))
  return { systems: kept, lessons: lessons.filter(l => ids.has(l.system_id)) }
}

/** Ne garde que les matières d'une année. Pour les écrans sans fiches. */
export function systemsOfYear(systems: System[], year: string): System[] {
  const target = normalizeYear(year)
  return systems.filter(s => normalizeYear((s as { year?: unknown }).year) === target)
}
