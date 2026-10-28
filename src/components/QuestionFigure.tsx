'use client'
// src/components/QuestionFigure.tsx
//
// La figure du poly qui accompagne une question illustrée.
//
// On ne stocke aucune image : la question porte juste une page et un cadre
// (voir le champ `visual` dans src/types/index.ts), et on redessine la zone
// à la demande depuis le PDF déjà présent dans Storage. Donc rien de nouveau
// à uploader, rien à régénérer si on change le recadrage, et une figure qui
// reste identique au poly de l'étudiante.
//
// Le PDF est téléchargé UNE fois par session et gardé en cache module : une
// session de 20 questions sur la même fiche ne retélécharge pas 20 fois un
// poly de 15 Mo.

import { mediaUrl } from '@/lib/media'
import { useEffect, useRef, useState } from 'react'
import './question-figure.css'

interface Props {
  /** Chemin Storage du poly, ex. `${userId}/${lessonId}/poly.pdf`. */
  pdfPath: string
  /** Index de la page DANS LE FICHIER : 1 = première page. */
  page: number
  /** Cadre normalisé 0-1000, origine en haut à gauche : [y0, x0, y1, x1]. */
  box: [number, number, number, number]
}

// Cache des documents PDF ouverts, par chemin Storage. On garde la promesse :
// deux questions montées en même temps partagent le même téléchargement.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docs = new Map<string, Promise<any>>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ouvrirPdf(chemin: string): Promise<any> {
  const dejaLa = docs.get(chemin)
  if (dejaLa) return dejaLa

  const p = (async () => {
    const signedUrl = await mediaUrl(chemin)
    if (!signedUrl) throw new Error('poly introuvable')

    // Import dynamique : pdf.js pèse lourd, il ne doit pas entrer dans le
    // bundle des pages qui n'affichent jamais de figure.
    // `pdfjs-dist` tout court : c'est le point d'entrée typé du paquet, et il
    // résout vers le build navigateur (build/pdf.mjs).
    const pdfjs = await import('pdfjs-dist')
    // Le worker vient du CDN, à la version EXACTE de la lib empaquetée
    // (pdf.js refuse un worker d'une autre version). C'est volontairement
    // `pdfjs.version` et pas un numéro écrit à la main : le jour où on met
    // pdfjs-dist à jour, l'URL suit toute seule.
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

    return pdfjs.getDocument({ url: signedUrl }).promise
  })()

  // Un échec ne doit pas être mis en cache : la signed URL expire, le réseau
  // tombe — on veut pouvoir réessayer au montage suivant.
  p.catch(() => docs.delete(chemin))
  docs.set(chemin, p)
  return p
}

export default function QuestionFigure({ pdfPath, page, box }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const boiteRef = useRef<HTMLDivElement | null>(null)
  const [etat, setEtat] = useState<'charge' | 'ok' | 'echec'>('charge')

  // `box` est un tableau : il change d'identité à chaque rendu même quand les
  // valeurs sont les mêmes. On dépend donc des quatre nombres.
  const [y0, x0, y1, x1] = box

  useEffect(() => {
    let annule = false
    const canvas = canvasRef.current
    if (!canvas) return

    ;(async () => {
      try {
        const doc = await ouvrirPdf(pdfPath)
        if (annule) return
        if (page < 1 || page > doc.numPages) throw new Error('page hors du poly')

        const pg = await doc.getPage(page)
        if (annule) return

        // Largeur visée : celle du conteneur, en pixels physiques, pour que la
        // figure soit nette sur un écran Retina. Plafonnée pour ne pas
        // rastériser un mur de pixels sur une grande fenêtre.
        const dispo = boiteRef.current?.clientWidth || 560
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const cible = Math.min(dispo * dpr, 1600)

        const base = pg.getViewport({ scale: 1 })
        const largeurCadre = ((x1 - x0) / 1000) * base.width
        const echelle = Math.max(0.4, Math.min(cible / Math.max(1, largeurCadre), 6))

        const vp = pg.getViewport({ scale: echelle })
        const cx = (x0 / 1000) * vp.width
        const cy = (y0 / 1000) * vp.height
        const cw = Math.round(((x1 - x0) / 1000) * vp.width)
        const ch = Math.round(((y1 - y0) / 1000) * vp.height)
        if (cw < 2 || ch < 2) throw new Error('cadre vide')

        canvas.width = cw
        canvas.height = ch
        // Taille d'affichage = taille physique / dpr : on garde la netteté
        // sans doubler la place prise à l'écran.
        canvas.style.width = `${Math.round(cw / dpr)}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas indisponible')
        // Fond blanc : un PDF n'a pas de fond, et un schéma au trait noir sur
        // transparent devient invisible en thème sombre.
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, cw, ch)

        // La translation amène le coin haut-gauche du cadre sur l'origine du
        // canvas : pdf.js dessine la page entière, le canvas n'en garde que
        // la zone qui nous intéresse.
        await pg.render({
          canvasContext: ctx,
          viewport: vp,
          transform: [1, 0, 0, 1, -cx, -cy],
        }).promise
        if (annule) return
        setEtat('ok')
      } catch {
        if (!annule) setEtat('echec')
      }
    })()

    return () => { annule = true }
  }, [pdfPath, page, y0, x0, y1, x1])

  // Un échec silencieux vaut mieux qu'un bloc d'erreur : la question reste
  // lisible, et l'étudiante a le bouton « Voir la source » pour la page entière.
  if (etat === 'echec') return null

  return (
    <figure className={`qfig${etat === 'charge' ? ' qfig-attente' : ''}`} ref={boiteRef}>
      <canvas ref={canvasRef} className="qfig-canvas" aria-label={`Figure du cours, page ${page}`} />
      <figcaption className="qfig-cap">Figure du cours, page {page}</figcaption>
    </figure>
  )
}
