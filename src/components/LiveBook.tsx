'use client'
// src/components/LiveBook.tsx
//
// Le livre qui s'écrit — pupitre de la session Focus.
// Pendant que l'étudiant révise une fiche, un livre ouvert se remplit
// d'encre en temps réel : 1 ligne ≈ 20 s, 10 lignes par double page.
// Le temps de travail devient de la matière visible (même ressort que les
// apps de voyage : l'avion avance pendant que tu travailles).
//
// Le composant est AUTONOME : il gère son propre chrono (remonté via la
// `key` du parent à chaque changement de fiche). Aucune logique de données.
// La fermeture + le vol vers l'étagère sont gérés côté Focus (ghost),
// pour survivre au changement de fiche qui remonte ce composant.

import { useEffect, useState } from 'react'

const SECONDS_PER_LINE = 20
const LINES_PER_SPREAD = 10  // 5 par page

// Longueurs de lignes variées (fraction de la largeur de colonne) pour un
// rendu manuscrit. Déterministe : même motif à chaque page.
const LINE_FRACTIONS = [0.96, 0.88, 0.93, 0.78, 0.9, 0.95, 0.85, 0.92, 0.7, 0.94]

type LiveBookProps = {
  /** Nom de la fiche en cours (titre du livre en écriture). */
  lessonName: string
  /** Classe CSS du conteneur (positionnement par le parent). */
  className?: string
}

export default function LiveBook({ lessonName, className }: LiveBookProps) {
  const [startTs] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsedS = Math.max(0, Math.floor((now - startTs) / 1000))
  const totalLines = Math.floor(elapsedS / SECONDS_PER_LINE)
  const spread = Math.floor(totalLines / LINES_PER_SPREAD)
  const lineInSpread = totalLines % LINES_PER_SPREAD
  const lineProgress = (elapsedS % SECONDS_PER_LINE) / SECONDS_PER_LINE

  const mm = Math.floor(elapsedS / 60)
  const ss = elapsedS % 60

  // Géométrie du livre ouvert (viewBox 0 0 320 150)
  const PAGE_L_X = 26, PAGE_R_X = 170, COL_W = 124
  const ROW_Y0 = 38, ROW_H = 17

  // Position de la plume : au bout de la ligne en cours d'écriture.
  const curIsRight = lineInSpread >= 5
  const curRow = curIsRight ? lineInSpread - 5 : lineInSpread
  const curX0 = curIsRight ? PAGE_R_X : PAGE_L_X
  const curFull = COL_W * LINE_FRACTIONS[lineInSpread]
  const quillX = curX0 + curFull * lineProgress
  const quillY = ROW_Y0 + curRow * ROW_H

  return (
    <div className={`lb-desk ${className ?? ''}`} aria-hidden="true">
      <div className="lb-head">
        <span className="lb-kicker">En cours d&apos;écriture</span>
        <span className="lb-timer">{mm}:{ss.toString().padStart(2, '0')}</span>
      </div>
      <div className="lb-title" title={lessonName}>{lessonName}</div>

      <svg viewBox="0 0 320 150" className="lb-svg">
        {/* Ombre portée du livre sur le pupitre */}
        <ellipse cx="160" cy="142" rx="140" ry="7" fill="rgba(0,0,0,0.35)" />

        {/* Couvertures (débordent des pages) */}
        <path d="M 14 28 L 14 134 Q 87 142 160 136 Q 233 142 306 134 L 306 28 Q 233 20 160 26 Q 87 20 14 28 Z"
          fill="#22344A" stroke="#101E32" strokeWidth="1.2" />

        {/* Pages — deux feuillets crème froide avec léger bombé */}
        <path d="M 22 32 Q 90 24 158 30 L 158 130 Q 90 136 22 128 Z" fill="#E4ECF4" />
        <path d="M 162 30 Q 230 24 298 32 L 298 128 Q 230 136 162 130 Z" fill="#DCE6F0" />
        {/* Épaisseur des pages (tranche) */}
        <path d="M 22 128 Q 90 136 158 130 L 158 133 Q 90 139 22 131 Z" fill="#B8C8D8" />
        <path d="M 162 130 Q 230 136 298 128 L 298 131 Q 230 139 162 133 Z" fill="#B0C0D2" />
        {/* Reliure centrale */}
        <path d="M 158 30 Q 160 80 158 130 L 162 130 Q 160 80 162 30 Z" fill="#8FA8BE" />

        {/* Lignes d'encre déjà écrites + ligne en cours */}
        {LINE_FRACTIONS.map((frac, i) => {
          const isRight = i >= 5
          const row = isRight ? i - 5 : i
          const x0 = isRight ? PAGE_R_X : PAGE_L_X
          const y = ROW_Y0 + row * ROW_H
          const full = COL_W * frac
          let w = 0
          if (i < lineInSpread) w = full
          else if (i === lineInSpread) w = full * lineProgress
          if (w <= 0) return null
          return (
            <g key={`${spread}-${i}`}>
              <rect x={x0} y={y} width={w} height="2.1" rx="1" fill="#2A4A66" opacity="0.85" />
              {/* hampes d'écriture : petites variations au-dessus de la ligne */}
              <rect x={x0 + w * 0.18} y={y - 2.4} width="1.4" height="2.4" fill="#2A4A66" opacity="0.55" />
              {w > 30 && <rect x={x0 + w * 0.55} y={y - 2.0} width="1.2" height="2.0" fill="#2A4A66" opacity="0.5" />}
              {w > 60 && <rect x={x0 + w * 0.82} y={y - 2.6} width="1.3" height="2.6" fill="#2A4A66" opacity="0.55" />}
            </g>
          )
        })}

        {/* Plume au bout de la ligne en cours */}
        <g className="lb-quill" transform={`translate(${quillX.toFixed(1)} ${quillY.toFixed(1)})`}>
          <path d="M 0 0 Q 3 -8 1 -20 Q 8 -26 13 -23 Q 7 -14 4 -4 Z" fill="#C8DCEC" stroke="#7FB0D4" strokeWidth="0.6" />
          <path d="M 1 -20 L 2.5 -25 L 0.5 -26 Z" fill="#16243A" />
          <circle cx="0.4" cy="0.8" r="0.9" fill="#2A4A66" />
        </g>

        {/* Numéro de page (coin bas des pages) */}
        <text x="38" y="124" fontFamily="var(--font-bricolage), serif" fontSize="7" fill="#7E96AE" fontStyle="italic">
          {spread * 2 + 1}
        </text>
        <text x="284" y="124" textAnchor="end" fontFamily="var(--font-bricolage), serif" fontSize="7" fill="#7E96AE" fontStyle="italic">
          {spread * 2 + 2}
        </text>
      </svg>

      <div className="lb-foot">
        <span className="lb-foot-pages">
          {totalLines} ligne{totalLines > 1 ? 's' : ''} · double page {spread + 1}
        </span>
        <span className="lb-foot-hint">Note la fiche pour ranger le livre</span>
      </div>
    </div>
  )
}
