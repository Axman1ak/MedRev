// src/lib/matchFiles.ts
//
// Rattachement automatique de fichiers déposés en vrac aux fiches existantes,
// par le nom.
//
// POURQUOI
// --------
// Pour qu'une fiche produise des QCM, il faut que son cours y soit attaché.
// Aujourd'hui ça se fait fiche par fiche, dans une modale. Un étudiant qui a
// saisi 100 fiches ne fera jamais 100 allers-retours : sur la base de prod,
// 330 fiches sur 380 n'ont aucun cours, et celles qui en ont un produisent des
// QCM dans 8 cas sur 10. Le goulot est là, pas ailleurs.
//
// Les étudiants nomment leurs fichiers comme leurs cours (« 03 - Thorax.pdf »,
// « biochimie_glucides.pdf »), donc le nom suffit à proposer un rattachement.
//
// PRINCIPE : on PROPOSE, l'étudiant VALIDE. Aucun rattachement automatique
// silencieux. Un mauvais rattachement enverrait le mauvais cours à la
// génération de QCM, et la question fausse qui en sortirait coûterait plus
// cher que les quelques secondes de relecture qu'on demande.

/** Mots qui n'aident pas à distinguer deux cours et polluent la comparaison. */
const MOTS_VIDES = new Set([
  'cours', 'poly', 'polycopie', 'chap', 'chapitre', 'ue', 'cm', 'td', 'tp',
  'fiche', 'notes', 'final', 'version', 'def', 'copie', 'scan', 'part', 'partie',
  'semestre', 's1', 's2', 'pdf',
])

/**
 * Ramène un nom de fichier ou de fiche à ses mots significatifs.
 * « 03 - Thorax_osteologie (v2).pdf » → ['thorax', 'osteologie', 'v2']
 */
export function tokenize(raw: string): string[] {
  const sansExt = raw.replace(/\.[a-z0-9]{1,5}$/i, '')
  const normalise = sansExt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-.()[\]{}'"/\\,;:!?]+/g, ' ')
    // Numérotation de tête : « 03 », « 3) », « 3. », « n°3 »
    .replace(/^\s*(n\s*°\s*)?\d{1,3}\s*[).\-]?\s+/, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalise
    .split(' ')
    .filter(t => t.length > 1 && !MOTS_VIDES.has(t))
}

/**
 * Score de ressemblance entre deux noms, dans [0, 1].
 *
 * Jaccard sur les mots, plus un bonus quand l'un contient l'autre en entier
 * (« thorax » dans « thorax osteologie »), ce que Jaccard seul sous-estime
 * alors que c'est le cas le plus fréquent : le fichier porte le nom du cours
 * plus une précision.
 */
export function score(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.length === 0 || tb.length === 0) return 0

  const sa = new Set(ta)
  const sb = new Set(tb)
  let commun = 0
  sa.forEach(t => { if (sb.has(t)) commun++ })
  if (commun === 0) return 0

  const union = new Set([...ta, ...tb]).size
  const jaccard = commun / union

  // Inclusion complète du plus court dans le plus long.
  const plusCourt = sa.size <= sb.size ? sa : sb
  const plusLong = sa.size <= sb.size ? sb : sa
  let inclus = true
  plusCourt.forEach(t => { if (!plusLong.has(t)) inclus = false })

  return inclus ? Math.min(1, jaccard + 0.35) : jaccard
}

/**
 * En dessous de ce score, on ne propose rien et on laisse l'étudiant choisir.
 * Calé bas volontairement : une proposition visible et corrigeable en un clic
 * est plus utile qu'une liste vide, tant que rien n'est validé tout seul.
 */
export const SEUIL = 0.3

export interface Candidat { id: string; nom: string }
export interface Proposition<T> {
  fichier: T
  /** id de la fiche proposée, ou null si rien d'assez proche. */
  cibleId: string | null
  score: number
}

/**
 * Associe chaque fichier à au plus une fiche, et chaque fiche à au plus un
 * fichier. On traite les paires par score décroissant : la meilleure
 * correspondance de tout le lot est fixée en premier, ce qui évite qu'un
 * fichier médiocre réserve une fiche qu'un autre réclamait à juste titre.
 */
export function proposerRattachements<T>(
  fichiers: T[],
  nomDe: (f: T) => string,
  candidats: Candidat[],
): Proposition<T>[] {
  const paires: { i: number; id: string; s: number }[] = []
  fichiers.forEach((f, i) => {
    candidats.forEach(c => {
      const s = score(nomDe(f), c.nom)
      if (s >= SEUIL) paires.push({ i, id: c.id, s })
    })
  })
  paires.sort((x, y) => y.s - x.s)

  const prisFichier = new Set<number>()
  const prisCible = new Set<string>()
  const retenu = new Map<number, { id: string; s: number }>()

  for (const p of paires) {
    if (prisFichier.has(p.i) || prisCible.has(p.id)) continue
    prisFichier.add(p.i)
    prisCible.add(p.id)
    retenu.set(p.i, { id: p.id, s: p.s })
  }

  return fichiers.map((f, i) => {
    const r = retenu.get(i)
    return { fichier: f, cibleId: r?.id ?? null, score: r?.s ?? 0 }
  })
}
