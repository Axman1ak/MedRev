// Ordre des fiches du jour, partagé par le tableau de bord, la fenêtre
// « Voir plus » et la session de travail : l'étudiant choisit un tri une
// fois, il retrouve le même ordre partout.
import type { System, Lesson } from '@/types'

export type TodaySort = 'retard' | 'subject' | 'j'

export const TODAY_SORT_LABELS: Record<TodaySort, string> = {
  retard: "Retards d'abord",
  subject: 'Par matière',
  j: 'Par palier J',
}

const KEY = 'medrev-today-sort'
const EVT = 'medrev-today-sort'

export function getTodaySort(): TodaySort {
  try {
    const v = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null
    if (v === 'retard' || v === 'subject' || v === 'j') return v
  } catch { /* stockage bloqué */ }
  return 'retard'
}

export function setTodaySort(v: TodaySort) {
  try { localStorage.setItem(KEY, v) } catch { /* stockage bloqué */ }
  try { window.dispatchEvent(new CustomEvent(EVT, { detail: v })) } catch { /* rien */ }
}

export function onTodaySortChange(cb: (v: TodaySort) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent<TodaySort>).detail)
  window.addEventListener(EVT, h)
  return () => window.removeEventListener(EVT, h)
}

type Sortable = { lesson: Lesson; due: { stepIndex: number; status: string; overdueDays: number } }

export function sortToday<T extends Sortable>(
  list: T[],
  mode: TodaySort,
  systems: System[],
  schedOf: (id: string | null | undefined) => number[],
): T[] {
  const jOf = (x: T) => schedOf(x.lesson.system_id)[x.due.stepIndex] ?? 0
  const lateOf = (x: T) => (x.due.status === 'missed' ? x.due.overdueDays : 0)
  const nameOf = (x: T) => systems.find(s => s.id === x.lesson.system_id)?.name ?? ''
  return [...list].sort((a, b) => {
    if (mode === 'subject') {
      const c = nameOf(a).localeCompare(nameOf(b), 'fr')
      if (c !== 0) return c
      return lateOf(b) - lateOf(a) || jOf(a) - jOf(b)
    }
    if (mode === 'j') return jOf(a) - jOf(b) || lateOf(b) - lateOf(a)
    // retards d'abord (les plus en retard en tête), puis palier J croissant
    return lateOf(b) - lateOf(a) || jOf(a) - jOf(b)
  })
}
