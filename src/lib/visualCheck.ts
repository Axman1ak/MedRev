// src/lib/visualCheck.ts
//
// Décider si une figure désignée par l'IA peut servir de support à une
// question — et, si elle est mal cadrée, la recadrer.
//
// POURQUOI CE FICHIER EXISTE
// --------------------------
// Mesuré sur un test réel : un poly d'histologie de 24 pages, six questions
// illustrées demandées à Gemini.
//
//   · les 6 pages citées étaient exactes ;
//   · les 6 cadres tombaient sur la bonne figure ;
//   · Gemini a affirmé 6 fois sur 6 que la réponse n'était pas lisible dans
//     son cadre. En découpant les images, c'était faux 2 fois.
//
// Un cadre contenait « (rouge) : les cellules sont tassées les unes contre »
// pour une question dont la bonne réponse est « ses cellules sont tassées les
// unes contre les autres ». Un autre contenait « des noyaux mais qui ne sont
// pas au même niveau » pour une réponse « des noyaux à différents niveaux ».
//
// Conclusion : le modèle sait LOCALISER, il ne sait pas s'AUTO-ÉVALUER. On ne
// lui demande donc plus son avis. On lit le texte réellement contenu dans la
// zone, et on tranche nous-mêmes.
//
// Ce fichier ne contient que la logique pure, testable sans PDF. L'extraction
// du texte d'une zone vit dans src/lib/pdfRegion.ts, côté serveur.

/** Cadre en coordonnées normalisées 0-1000 : [y0, x0, y1, x1]. */
export type VisualBox = [number, number, number, number]

/** Un rectangle de la page, en coordonnées normalisées 0-1000. */
export type Cadre = { y0: number; y1: number; x0: number; x1: number }

/** Un bloc de texte trouvé dans la page, en coordonnées normalisées. */
export type BlocTexte = Cadre & { texte: string }

/** Mots vides : présents partout, les compter fausserait la comparaison. */
const VIDES = new Set([
  'avec', 'sans', 'dans', 'pour', 'leur', 'leurs', 'elle', 'elles', 'cette',
  'celui', 'celle', 'ceux', 'sont', 'est', 'une', 'les', 'des', 'aux', 'par',
  'sur', 'sous', 'entre', 'plus', 'moins', 'tous', 'tout', 'toute', 'toutes',
  'que', 'qui', 'quoi', 'dont', 'mais', 'donc', 'puis', 'ainsi', 'alors',
  'autre', 'autres', 'meme', 'memes', 'etre', 'avoir', 'fait', 'faire',
  'niveau', 'type', 'types', 'exemple', 'ici', 'voir', 'suivantes', 'propositions',
])

export function normaliser(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mots porteurs de sens : au moins 4 lettres, hors mots vides. */
export function motsPorteurs(t: string): string[] {
  return Array.from(new Set(
    normaliser(t).split(' ').filter(m => m.length >= 4 && !VIDES.has(m))
  ))
}

/**
 * La réponse est-elle écrite dans ce texte ?
 *
 * Seuil à 0,6 : sur le test réel il attrape le cas recopié mot pour mot
 * (recouvrement 100 %) sans toucher aux cadres sains, où le recouvrement
 * plafonne à 0,29 — des mots de domaine qui reviennent fatalement
 * (« cellules », « noyaux »).
 */
export function reponseLisible(texte: string, bonnesReponses: string[], seuil = 0.6): boolean {
  const zone = normaliser(texte)
  if (!zone) return false
  return bonnesReponses.some(rep => {
    const mots = motsPorteurs(rep)
    if (mots.length < 2) return false
    return mots.filter(m => zone.includes(m)).length / mots.length >= seuil
  })
}

/** Un cadre est-il exploitable ? Trop grand, il ne recadre rien. */
export function boxValide(box: unknown): box is VisualBox {
  if (!Array.isArray(box) || box.length !== 4) return false
  const [y0, x0, y1, x1] = box as number[]
  if (![y0, x0, y1, x1].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000)) return false
  if (y1 - y0 < 25 || x1 - x0 < 25) return false
  const aire = ((y1 - y0) * (x1 - x0)) / 1e6
  return aire <= 0.7
}

/**
 * Un bloc de texte tombe-t-il vraiment DANS le cadre ?
 *
 * Le recouvrement est rapporté au plus petit des deux (la ligne ou le cadre),
 * jamais à la seule largeur de la ligne. Sans ça, une phrase de pleine largeur
 * qui traverse un cadre étroit passe pour « dehors » : c'est exactement ce qui
 * laissait la légende de la figure 2 visible alors qu'elle donnait la réponse.
 * Et une ligne qui ne fait qu'effleurer le cadre reste écartée.
 */
function dansLeCadre(b: Cadre, box: VisualBox, seuil = 0.4): boolean {
  const [y0, x0, y1, x1] = box
  const rx = Math.max(0, Math.min(b.x1, x1) - Math.max(b.x0, x0))
  const ry = Math.max(0, Math.min(b.y1, y1) - Math.max(b.y0, y0))
  if (rx <= 0 || ry <= 0) return false
  const minX = Math.max(1, Math.min(b.x1 - b.x0, x1 - x0))
  const minY = Math.max(1, Math.min(b.y1 - b.y0, y1 - y0))
  return rx / minX >= seuil && ry / minY >= seuil
}

/** Le plus grand intervalle de [min, max] que n'occupe aucun segment. */
function plusGrandVide(segments: [number, number][], min: number, max: number): [number, number] {
  if (segments.length === 0) return [min, max]
  const tri = segments.slice().sort((a, b) => a[0] - b[0])
  const fusion: [number, number][] = []
  for (const s of tri) {
    const dernier = fusion[fusion.length - 1]
    if (dernier && s[0] <= dernier[1]) dernier[1] = Math.max(dernier[1], s[1])
    else fusion.push([s[0], s[1]])
  }
  let curseur = min
  let meilleur: [number, number] = [min, min]
  for (const [a, b] of fusion) {
    if (a - curseur > meilleur[1] - meilleur[0]) meilleur = [curseur, a]
    curseur = Math.max(curseur, b)
  }
  if (max - curseur > meilleur[1] - meilleur[0]) meilleur = [curseur, max]
  return meilleur
}

/** Une passe de rognage sur un axe : on garde la plus grande bande sans texte. */
function rognerAxe(box: VisualBox, blocs: BlocTexte[], axe: 'y' | 'x'): VisualBox {
  const [y0, x0, y1, x1] = box
  const dedans = blocs.filter(b => dansLeCadre(b, box))
  if (dedans.length === 0) return box
  // Marge de 4 unités autour de chaque ligne : on ne veut pas raser une
  // ascendante ou un jambage resté hors de la boîte mesurée.
  if (axe === 'y') {
    const seg = dedans.map(b => [Math.max(y0, b.y0) - 4, Math.min(y1, b.y1) + 4] as [number, number])
    const [a, b] = plusGrandVide(seg, y0, y1)
    return [a, x0, b, x1]
  }
  const seg = dedans.map(b => [Math.max(x0, b.x0) - 4, Math.min(x1, b.x1) + 4] as [number, number])
  const [a, b] = plusGrandVide(seg, x0, x1)
  return [y0, a, y1, b]
}

const aire = (b: VisualBox) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1])

/** Tolérance : une image dépassant d'une unité du cadre est considérée dedans. */
const MARGE = 2

function imageEntiere(img: Cadre, box: VisualBox): boolean {
  return img.y0 >= box[0] - MARGE && img.x0 >= box[1] - MARGE
    && img.y1 <= box[2] + MARGE && img.x1 <= box[3] + MARGE
}

/** Enveloppe exacte d'un groupe de rectangles. */
function enveloppe(rs: Cadre[]): VisualBox {
  return [
    Math.min(...rs.map(r => r.y0)),
    Math.min(...rs.map(r => r.x0)),
    Math.max(...rs.map(r => r.y1)),
    Math.max(...rs.map(r => r.x1)),
  ]
}

/**
 * Ajoute un peu d'air autour de la figure — mais jamais jusqu'au texte.
 *
 * Une légende est souvent collée sous l'image (« Ex : glandes mammaires en
 * lactation »). Une marge fixe de 8 unités suffisait à l'attraper, et toute la
 * suite partait en vrille : du texte dans la zone, donc une découpe, donc une
 * figure coupée, donc une question qui perd son image. Ici chaque bord grandit
 * de ce qu'il peut, et s'arrête à quelques unités de la première ligne rencontrée. Cette garde
 * est volontairement large : la boîte d'une ligne est mesurée sur sa ligne de
 * base, elle sous-estime les jambages.
 */
function aerer(box: VisualBox, blocs: BlocTexte[], max = 8, garde = 5): VisualBox {
  const [y0, x0, y1, x1] = box
  const chevauche = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) > Math.max(a0, b0)
  let haut = max, bas = max, gauche = max, droite = max
  for (const b of blocs) {
    // De quel côté est cette ligne ? On la situe par son milieu : une légende
    // dont le haut mord d'une unité sur le bas de l'image est en dessous, pas
    // dedans — et c'est bien elle qu'il ne faut pas laisser entrer.
    const my = (b.y0 + b.y1) / 2
    const mx = (b.x0 + b.x1) / 2
    if (chevauche(b.x0, b.x1, x0 - max, x1 + max)) {
      if (my <= y0) haut = Math.min(haut, Math.max(0, y0 - b.y1 - garde))
      if (my >= y1) bas = Math.min(bas, Math.max(0, b.y0 - y1 - garde))
    }
    if (chevauche(b.y0, b.y1, y0 - max, y1 + max)) {
      if (mx <= x0) gauche = Math.min(gauche, Math.max(0, x0 - b.x1 - garde))
      if (mx >= x1) droite = Math.min(droite, Math.max(0, b.x0 - x1 - garde))
    }
  }
  return [y0 - haut, x0 - gauche, y1 + bas, x1 + droite]
}

/**
 * Rogne le cadre pour ne garder que la figure, sans texte autour.
 *
 * DEUX RÉGIMES, selon ce que la page contient.
 *
 * 1. La page a de vraies images — le cas normal d'un poly, où tout est collé
 *    depuis Word. On sait alors exactement où elles sont. Le cadre de l'IA
 *    sert à désigner LAQUELLE, pas à en fixer les bords : on repart de
 *    l'image elle-même, quitte à déborder un peu du cadre proposé. Mesuré sur
 *    le poly d'histologie : un cadre s'arrêtait 7 unités avant le bas de son
 *    schéma, ce qui faisait jeter une figure parfaitement bonne.
 *
 *    S'il reste du texte dans cette enveloppe, on la découpe — et la règle qui
 *    tranche entre deux découpes n'est pas la surface gardée mais le nombre
 *    d'images gardées ENTIÈRES : montrer la moitié d'un schéma est pire que
 *    montrer une figure de moins. Sur une page où deux figures voisinaient
 *    avec un paragraphe à droite, la découpe en hauteur coupait le schéma par
 *    le milieu ; avec cette règle la découpe se fait en largeur et le schéma
 *    sort entier.
 *
 * 2. Pas d'image détectée (figure vectorielle, page de texte). On retombe sur
 *    la recherche de la plus grande zone sans texte, et on exige qu'il en
 *    reste au moins 35 % : en dessous, la zone était surtout du texte et il
 *    n'y avait pas vraiment de figure à montrer.
 *
 * Renvoie null quand il ne reste rien de montrable.
 */
export function rognerSurFigure(
  box: VisualBox,
  blocs: BlocTexte[],
  images: Cadre[] = [],
  aireMiniRatio = 0.35,
): VisualBox | null {
  // Les images que l'IA visait : celles qui tombent vraiment dans son cadre.
  const visees = images.filter(img => dansLeCadre(img, box, 0.3))

  let choisi: VisualBox

  if (visees.length > 0) {
    // On repart des figures, pas du cadre proposé.
    const depart = enveloppe(visees)
    if (blocs.filter(b => dansLeCadre(b, depart)).length === 0) {
      choisi = aerer(depart, blocs)
    } else {
      // Du texte s'est glissé entre les figures : il faut découper. On essaie
      // les deux ordres — en hauteur puis en largeur, et l'inverse.
      const candidats: VisualBox[] = []
      for (const ordre of [['y', 'x'], ['x', 'y']] as const) {
        let c = depart
        for (const axe of ordre) c = rognerAxe(c, blocs, axe)
        candidats.push(c)
      }
      let meilleur = candidats[0]
      let meilleurScore = -1
      for (const c of candidats) {
        const score = visees
          .filter(img => imageEntiere(img, c))
          .reduce((t, i) => t + (i.y1 - i.y0) * (i.x1 - i.x0), 0)
        // À égalité d'images entières, on préfère la plus grande zone.
        if (score > meilleurScore || (score === meilleurScore && aire(c) > aire(meilleur))) {
          meilleur = c
          meilleurScore = score
        }
      }
      const gardees = visees.filter(img => imageEntiere(img, meilleur))
      // Aucune figure ne survit entière : on ne montre pas un schéma tronqué.
      if (gardees.length === 0) return null
      // On resserre sur les figures gardées : plus de grands blancs, et le
      // texte qui traînait autour disparaît par construction.
      choisi = aerer(enveloppe(gardees), blocs)
    }
  } else {
    const candidats: VisualBox[] = []
    for (const ordre of [['y', 'x'], ['x', 'y']] as const) {
      let c = box
      for (const axe of ordre) c = rognerAxe(c, blocs, axe)
      candidats.push(c)
    }
    choisi = candidats.reduce((a, b) => (aire(b) > aire(a) ? b : a))
    if (aire(choisi) < aire(box) * aireMiniRatio) return null
  }

  // Jamais hors de la page.
  choisi = [
    Math.max(0, choisi[0]), Math.max(0, choisi[1]),
    Math.min(1000, choisi[2]), Math.min(1000, choisi[3]),
  ]
  if (choisi[2] - choisi[0] < 30 || choisi[3] - choisi[1] < 30) return null
  return choisi
}
