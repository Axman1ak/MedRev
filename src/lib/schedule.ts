// src/lib/schedule.ts
// Planning de révision (paliers « J ») désormais personnalisable PAR MATIÈRE.
// Stocké dans systems.schedule (jsonb : tableau de décalages en jours depuis
// learn_date). Si absent/invalide, on retombe sur le planning standard.
// « Tout recalculer » : on lit le planning en direct sur la matière, donc un
// changement de planning reprogramme automatiquement toutes ses fiches.

export const DEFAULT_J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

// Presets proposés dans l'éditeur de paliers.
export const SCHEDULE_PRESETS: { id: string; label: string; days: number[] }[] = [
  { id: 'leger',    label: 'Léger',    days: [0, 3, 7, 21, 45, 90] },
  { id: 'standard', label: 'Standard', days: [...DEFAULT_J] },
  { id: 'intensif', label: 'Intensif', days: [0, 1, 2, 4, 7, 11, 16, 23, 32, 45, 60, 80, 100, 120] },
]

// Renvoie le planning d'une matière (ou le défaut). Tableau trié, dédupliqué,
// entiers >= 0. Toujours non vide.
export function scheduleOf(system?: { schedule?: number[] | null } | null): number[] {
  const s = system?.schedule
  if (Array.isArray(s)) {
    const clean = Array.from(
      new Set(
        s.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0)
         .map(n => Math.round(n))
      )
    ).sort((a, b) => a - b)
    if (clean.length > 0) return clean
  }
  return DEFAULT_J
}

// Construit un resolver system_id -> planning à partir de la liste des matières.
// À utiliser dans les fonctions qui itèrent sur des fiches sans avoir la matière
// sous la main.
export function makeScheduleResolver(
  systems: { id: string; schedule?: number[] | null }[]
): (systemId: string | null | undefined) => number[] {
  const map = new Map<string, number[]>()
  for (const s of systems) map.set(s.id, scheduleOf(s))
  return (systemId) => (systemId ? map.get(systemId) ?? DEFAULT_J : DEFAULT_J)
}

// Normalise une saisie utilisateur (depuis l'éditeur) avant sauvegarde.
export function normalizeSchedule(days: number[]): number[] {
  return scheduleOf({ schedule: days })
}
