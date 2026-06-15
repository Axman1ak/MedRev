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

export function buildSubjectColorMap(
  systems: { id: string; color?: string | null }[]
): Map<string, string> {
  const map = new Map<string, string>()
  const distinct = new Set(
    systems.map(s => s.color).filter((c): c is string => Boolean(c))
  )
  const allSame = distinct.size <= 1 && systems.length > 1
  systems.forEach((s, idx) => {
    const c = allSame
      ? SUBJ_COLORS[idx % SUBJ_COLORS.length]
      : (s.color || SUBJ_COLORS[idx % SUBJ_COLORS.length])
    map.set(s.id, c)
  })
  return map
}
