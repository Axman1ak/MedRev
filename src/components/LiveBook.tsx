'use client'
// src/components/LiveBook.tsx
//
// Le livre qui s'écrit — pièce maîtresse de la session Focus.
// v4 "geste complet" :
// - coverColor : la couverture prend la couleur de la matière en cours.
// - stamp : quand l'étudiant note, l'empreinte de cire s'imprime sur la
//   page droite (0-450 ms), puis la page droite se rabat et le livre se
//   compacte (450-850 ms) — la page Focus enchaîne avec l'envol du ghost.
// L'écriture est rendue en "mots" manuscrits déterministes (1 ligne ≈ 20 s,
// 10 lignes par double page). Composant AUTONOME : chrono interne, remonté
// via la `key` du parent à chaque fiche. Aucune logique de données.

import { useEffect, useState } from 'react'

const SECONDS_PER_LINE = 20
const LINES_PER_SPREAD = 10  // 5 par page

// Longueur utile de chaque ligne (fraction de colonne) — marge irrégulière.
const LINE_FRACTIONS = [0.97, 0.9, 0.94, 0.8, 0.92, 0.96, 0.86, 0.93, 0.72, 0.95]
// Largeurs de "mots" (px viewBox), cyclées avec un décalage par ligne.
const WORD_WIDTHS = [16, 9, 22, 12, 7, 18, 10, 14, 8, 20, 11, 15]
// Micro-décalages verticaux par mot (écriture humaine).
const WORD_JITTER = [0, -0.5, 0.4, -0.3, 0.6, 0, -0.6, 0.3, -0.4, 0.5, -0.2, 0.2]
const WORD_GAP = 5

type Word = { x: number; y: number; w: number; o: number }

// Construit les mots d'une ligne, déterministe via (spread, lineIdx).
// targetLen < fullLen → ligne en cours d'écriture (dernier mot tronqué).
function lineWords(x0: number, y: number, fullLen: number, targetLen: number, seed: number): Word[] {
  const out: Word[] = []
  let cursor = 0
  let i = seed % WORD_WIDTHS.length
  while (cursor < fullLen && cursor < targetLen) {
    const w = WORD_WIDTHS[i % WORD_WIDTHS.length]
    const jitter = WORD_JITTER[i % WORD_JITTER.length]
    const remainFull = fullLen - cursor
    const remainTarget = targetLen - cursor
    const drawn = Math.min(w, remainFull, remainTarget)
    if (drawn > 1.5) {
      out.push({
        x: x0 + cursor,
        y: y + jitter,
        w: drawn,
        o: 0.72 + (i % 3) * 0.09,
      })
    }
    cursor += w + WORD_GAP
    i++
  }
  return out
}

type LiveBookProps = {
  /** Nom de la fiche en cours (titre du livre en écriture). */
  lessonName: string
  /** Classe CSS du conteneur (positionnement par le parent). */
  className?: string
  /** Couleur de la matière : teinte la couverture (et le ghost côté parent). */
  coverColor?: string
  /** Cérémonie de notation en cours : empreinte de cire puis fermeture. */
  stamp?: { score: number; color: string } | null
}

// Géométrie (viewBox 0 0 520 270)
const PAGE_L_X = 64, PAGE_R_X = 276, COL_W = 178
const ROW_Y0 = 64, ROW_H = 27

export default function LiveBook({ lessonName, className, coverColor, stamp }: LiveBookProps) {
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

  // Plume : au bout de la ligne en cours d'écriture.
  const curIsRight = lineInSpread >= 5
  const curRow = curIsRight ? lineInSpread - 5 : lineInSpread
  const curX0 = curIsRight ? PAGE_R_X : PAGE_L_X
  const curFull = COL_W * LINE_FRACTIONS[lineInSpread]
  const quillX = curX0 + curFull * lineProgress
  const quillY = ROW_Y0 + curRow * ROW_H

  const cover = coverColor || '#1B2C40'

  // Mots d'une moitié de page (left = lignes 0-4, right = 5-9).
  const renderHalf = (right: boolean) => (
    LINE_FRACTIONS.map((frac, i) => {
      if ((i >= 5) !== right) return null
      const row = right ? i - 5 : i
      const x0 = right ? PAGE_R_X : PAGE_L_X
      const y = ROW_Y0 + row * ROW_H
      const full = COL_W * frac
      let target = 0
      if (i < lineInSpread) target = full
      else if (i === lineInSpread) target = full * lineProgress
      if (target <= 0) return null
      const words = lineWords(x0, y, full, target, i * 3 + spread)
      return (
        <g key={`${spread}-${i}`}>
          {words.map((wd, k) => (
            <rect key={k} x={wd.x} y={wd.y} width={wd.w} height="2.8" rx="1.4" opacity={wd.o} />
          ))}
        </g>
      )
    })
  )

  return (
    <div className={`lb-scene ${className ?? ''}`} aria-hidden="true">
      {/* Typo flottante au-dessus du livre — pas de boîte */}
      <div className="lb-meta">
        <div className="lb-meta-left">
          <span className="lb-meta-kicker">En cours d&apos;écriture</span>
          <span className="lb-meta-title" title={lessonName}>{lessonName}</span>
        </div>
        <span className="lb-meta-timer">{mm}:{ss.toString().padStart(2, '0')}</span>
      </div>

      <svg viewBox="0 0 520 270" className="lb-svg">
        {/* Ombre du livre sur le bureau */}
        <ellipse cx="260" cy="252" rx="226" ry="11" fill="rgba(2, 8, 16, 0.55)" />

        <g className={`lb-book${stamp ? ' lb-book-closing' : ''}`}>
          {/* Couverture — teintée matière, assombrie pour rester nocturne */}
          <path d="M 32 44 L 32 236 Q 146 250 260 240 Q 374 250 488 236 L 488 44 Q 374 30 260 40 Q 146 30 32 44 Z"
            fill={cover} stroke="#0C1828" strokeWidth="1.6" />
          <path d="M 32 44 L 32 236 Q 146 250 260 240 Q 374 250 488 236 L 488 44 Q 374 30 260 40 Q 146 30 32 44 Z"
            fill="rgba(8, 16, 28, 0.42)" stroke="rgba(127,176,212,0.28)" strokeWidth="0.8" />
          {/* Coins argentés */}
          <path d="M 32 44 L 58 41 L 32 70 Z" fill="#7FB0D4" opacity="0.85" />
          <path d="M 488 44 L 462 41 L 488 70 Z" fill="#7FB0D4" opacity="0.85" />
          <path d="M 32 236 L 58 239 L 32 210 Z" fill="#7FB0D4" opacity="0.85" />
          <path d="M 488 236 L 462 239 L 488 210 Z" fill="#7FB0D4" opacity="0.85" />

          {/* Moitié GAUCHE */}
          <path d="M 40 48 Q 150 36 258 46 L 258 234 Q 150 244 40 232 Z" fill="#9FB4C8" />
          <g stroke="rgba(20,40,60,0.25)" strokeWidth="0.7" fill="none">
            <path d="M 42 226 Q 150 238 257 228" />
            <path d="M 43 230 Q 150 241 256 231" />
          </g>
          <path d="M 48 52 Q 152 40 256 50 L 256 226 Q 152 236 48 224 Z" fill="#E9EFF5" />
          <path d="M 48 52 Q 152 40 256 50 L 256 80 Q 152 68 48 82 Z" fill="rgba(255,255,255,0.35)" />
          <g fill="#2E5570">{renderHalf(false)}</g>
          <text x="66" y="218" fontFamily="var(--font-bricolage), serif" fontSize="10" fill="#8AA2B6" fontStyle="italic">
            {spread * 2 + 1}
          </text>

          {/* Creux central */}
          <path d="M 256 50 Q 260 138 256 226 L 264 226 Q 260 138 264 50 Z" fill="#A9BCCE" />
          <path d="M 252 51 Q 256 138 252 225 L 256 226 Q 260 138 256 50 Z" fill="rgba(80,110,140,0.25)" />

          {/* Moitié DROITE — groupe repliable (se rabat à la fermeture) */}
          <g className="lb-right">
            <path d="M 262 46 Q 370 36 480 48 L 480 232 Q 370 244 262 234 Z" fill="#97ACC0" />
            <g stroke="rgba(20,40,60,0.25)" strokeWidth="0.7" fill="none">
              <path d="M 263 228 Q 370 238 478 226" />
              <path d="M 264 231 Q 370 241 477 230" />
            </g>
            <path d="M 264 50 Q 368 40 472 52 L 472 224 Q 368 236 264 226 Z" fill="#E2EAF2" />
            <path d="M 264 50 Q 260 138 264 226 L 268 225 Q 264 138 268 51 Z" fill="rgba(80,110,140,0.18)" />
            <g fill="#2E5570">{renderHalf(true)}</g>
            <text x="452" y="218" textAnchor="end" fontFamily="var(--font-bricolage), serif" fontSize="10" fill="#8AA2B6" fontStyle="italic">
              {spread * 2 + 2}
            </text>
            {/* Ruban marque-page */}
            <path d="M 268 226 L 268 252 L 274 246 L 280 252 L 280 225 Z" fill="#B23048" />
            <path d="M 268 226 L 268 232 L 280 231 L 280 225 Z" fill="rgba(0,0,0,0.25)" />

            {/* EMPREINTE DE CIRE — s'imprime sur la page droite à la notation */}
            {stamp && (
              <g className="lb-stamp" transform="translate(368 140)">
                <circle className="lb-stamp-ring" r="26" fill="none" stroke={stamp.color} strokeWidth="2" />
                <g className="lb-stamp-wax">
                  {/* cire au bord irrégulier */}
                  <path
                    d="M 0 -26 Q 14 -25 21 -15 Q 28 -6 24 6 Q 21 17 10 23 Q 0 28 -11 23 Q -22 17 -25 5 Q -27 -7 -20 -16 Q -13 -25 0 -26 Z"
                    fill={stamp.color}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth="1"
                  />
                  <path d="M -14 -14 Q -4 -20 8 -16 Q 0 -12 -8 -10 Z" fill="rgba(255,255,255,0.28)" />
                  <circle r="16" fill="none" stroke="rgba(8,14,24,0.4)" strokeWidth="1.2" />
                  <text y="7" textAnchor="middle" fontFamily="var(--font-bricolage), serif" fontSize="19" fontWeight="700" fill="rgba(8,14,24,0.6)">
                    {stamp.score}
                  </text>
                </g>
              </g>
            )}
          </g>

          {/* Plume — rangée pendant la cérémonie */}
          {!stamp && (
            <g className="lb-quill" transform={`translate(${quillX.toFixed(1)} ${quillY.toFixed(1)})`}>
              <path d="M 0 0 Q 5 -14 2 -34 Q 14 -44 22 -39 Q 12 -24 7 -7 Z" fill="#C8DCEC" stroke="#7FB0D4" strokeWidth="0.9" />
              <path d="M 2 -34 L 4.5 -42 L 1 -44 Z" fill="#16243A" />
              <circle cx="0.6" cy="1.2" r="1.3" fill="#2E5570" />
            </g>
          )}
        </g>
      </svg>

      <div className="lb-under">
        <span className="lb-under-pages">
          double page {spread + 1} · {totalLines} ligne{totalLines > 1 ? 's' : ''} écrite{totalLines > 1 ? 's' : ''}
        </span>
        <span className="lb-under-hint">Appose un sceau pour ranger ce livre dans ta bibliothèque</span>
      </div>
    </div>
  )
}
