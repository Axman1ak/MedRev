// src/lib/subjectColors.ts
// Couleurs de matière partagées. Source de vérité unique pour que le dashboard,
// les stats et la page Fiches affichent EXACTEMENT les mêmes couleurs d'icônes.
//
// Règle (héritée de la page Fiches) : si toutes les matières ont la même couleur
// en base (signe que le picker n'a jamais été utilisé : le défaut est le rouge
// SUBJ_COLORS[0]), on bascule sur la palette par index pour obtenir des couleurs
// distinctes. Sinon on respecte la couleur choisie.

export const SUBJ_COLORS = [
  '#C75050', '#5B8ED4', '#8D6BB0', '#A06840',
  '#C47B2B', '#3A8F8A', '#7AA56B', '#D9B24A',
]

// La couleur d'une matière ne dépend que de sa place dans SON semestre
// (ordre de création). Avant, elle dépendait de la liste passée : la vue
// « Année », la session de travail (toutes les matières, sans tri) et la vue
// S1 donnaient des couleurs différentes à la même matière.
type Sys = { id: string; color?: string | null; semestre?: number | null; created_at?: string | null }

export function buildSubjectColorMap(systems: Sys[]): Map<string, string> {
  const map = new Map<string, string>()
  const groups = new Map<string, Sys[]>()
  systems.forEach(s => {
    const k = String(s.semestre ?? '')
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(s)
  })
  groups.forEach(list => {
    const sorted = [...list].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    const distinct = new Set(sorted.map(s => s.color).filter((c): c is string => Boolean(c)))
    const allSame = distinct.size <= 1 && sorted.length > 1
    sorted.forEach((s, idx) => {
      map.set(s.id, allSame ? SUBJ_COLORS[idx % SUBJ_COLORS.length] : (s.color || SUBJ_COLORS[idx % SUBJ_COLORS.length]))
    })
  })
  return map
}
