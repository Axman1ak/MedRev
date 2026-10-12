// src/lib/pdfRegion.ts
//
// Lire le texte d'une page de PDF avec ses coordonnées, côté serveur.
//
// Sert à vérifier qu'un recadrage d'image ne contient pas la réponse à la
// question (voir src/lib/visualCheck.ts). On utilise la construction
// « legacy » de pdfjs-dist : c'est celle qui tourne sous Node, sans canvas et
// sans worker, donc sans binaire natif — condition pour vivre sur Vercel.

import type { BlocTexte, Cadre } from './visualCheck'

type ItemTexte = { str?: string; width?: number; height?: number; transform?: number[] }

/** Ce qu'on sait d'une page : où est le texte, et où sont les images. */
export type PageLue = { blocs: BlocTexte[]; images: Cadre[] }

// Une image plus petite que ça n'est pas une figure de cours : c'est un logo,
// une puce, un filigrane. On ne recadre jamais dessus.
const TAILLE_MINI_IMAGE = 25

/**
 * Renvoie, pour chaque page demandée, le texte ET les images, en coordonnées
 * normalisées 0-1000 (origine en haut à gauche, comme les cadres de l'IA).
 *
 * Les images viennent de la liste d'opérations de dessin de la page : on suit
 * la matrice courante et on transforme le carré unité à chaque ordre « peins
 * cette image ». C'est ce qui permet de recadrer sur la figure elle-même au
 * lieu de chercher un trou dans le texte.
 *
 * Les pages absentes du PDF sont simplement omises : c'est au code appelant
 * de traiter une page manquante comme « pas d'illustration possible ».
 */
export async function lirePages(
  pdf: ArrayBuffer,
  pages: number[],
): Promise<Map<number, PageLue>> {
  const sortie = new Map<number, PageLue>()
  if (pages.length === 0) return sortie

  // Import dynamique : pdfjs ne doit pas entrer dans le bundle des routes qui
  // n'en ont pas besoin, et son chargement coûte une centaine de ms.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdf),
    // Pas de polices système ni de ressources externes : on ne lit que des
    // positions, et toute requête réseau depuis une fonction serverless est
    // une latence et un risque de plus.
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise

  try {
    for (const num of Array.from(new Set(pages))) {
      if (!Number.isInteger(num) || num < 1 || num > doc.numPages) continue
      const page = await doc.getPage(num)
      const vp = page.getViewport({ scale: 1 })
      const contenu = await page.getTextContent()
      const blocs: BlocTexte[] = []

      for (const brut of contenu.items as ItemTexte[]) {
        const texte = (brut.str ?? '').trim()
        if (!texte || !brut.transform) continue
        // Compose la matrice de la page et celle de l'item : on obtient des
        // coordonnées écran, y vers le bas, rotation de page comprise.
        const m = pdfjs.Util.transform(vp.transform, brut.transform)
        const x0 = (m[4] / vp.width) * 1000
        const x1 = ((m[4] + (brut.width ?? 0)) / vp.width) * 1000
        const y1 = (m[5] / vp.height) * 1000
        const y0 = ((m[5] - (brut.height ?? 10)) / vp.height) * 1000
        blocs.push({ x0, x1, y0, y1, texte })
      }
      // Les images de la page. On rejoue la pile de transformations : sans
      // elle, une image placée dans un groupe sauvegardé atterrit n'importe où.
      const ops = await page.getOperatorList()
      const dessins = new Set<number>([
        pdfjs.OPS.paintImageXObject,
        pdfjs.OPS.paintImageMaskXObject,
        pdfjs.OPS.paintInlineImageXObject,
      ].filter(n => typeof n === 'number'))
      const images: Cadre[] = []
      let ctm = vp.transform.slice()
      const pile: number[][] = []
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i]
        if (fn === pdfjs.OPS.save) pile.push(ctm.slice())
        else if (fn === pdfjs.OPS.restore) ctm = pile.pop() ?? vp.transform.slice()
        else if (fn === pdfjs.OPS.transform) ctm = pdfjs.Util.transform(ctm, ops.argsArray[i] as number[])
        else if (dessins.has(fn)) {
          // L'image remplit le carré unité, posé à l'envers : on transforme
          // les quatre coins et on prend l'enveloppe.
          const coins = ([[0, 0], [1, 0], [0, 1], [1, 1]] as [number, number][])
            .map(pt => pdfjs.Util.applyTransform(pt, ctm))
          const xs = coins.map(c => c[0])
          const ys = coins.map(c => c[1])
          const r: Cadre = {
            x0: (Math.min(...xs) / vp.width) * 1000,
            x1: (Math.max(...xs) / vp.width) * 1000,
            y0: (Math.min(...ys) / vp.height) * 1000,
            y1: (Math.max(...ys) / vp.height) * 1000,
          }
          if (r.x1 - r.x0 >= TAILLE_MINI_IMAGE && r.y1 - r.y0 >= TAILLE_MINI_IMAGE) images.push(r)
        }
      }

      sortie.set(num, { blocs, images })
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }

  return sortie
}

/**
 * Le texte contenu dans un cadre. On compte un bloc quand sa ligne médiane
 * tombe dans le cadre ET qu'au moins la moitié de sa largeur y est : sinon un
 * paragraphe qui effleure le bord par un pixel ferait rejeter une figure
 * parfaitement propre.
 */
export function texteDansCadre(blocs: BlocTexte[], box: [number, number, number, number]): string {
  const [y0, x0, y1, x1] = box
  const dedans: string[] = []
  for (const b of blocs) {
    const cy = (b.y0 + b.y1) / 2
    if (cy < y0 || cy > y1) continue
    // Rapporté au plus petit des deux, comme dans visualCheck : une phrase de
    // pleine largeur qui traverse un cadre étroit est DEDANS.
    const reference = Math.max(1, Math.min(b.x1 - b.x0, x1 - x0))
    const recouvrement = Math.max(0, Math.min(b.x1, x1) - Math.max(b.x0, x0)) / reference
    if (recouvrement >= 0.5) dedans.push(b.texte)
  }
  return dedans.join(' ').replace(/\s+/g, ' ').trim()
}
