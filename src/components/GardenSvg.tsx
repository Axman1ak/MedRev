// src/components/GardenSvg.tsx
// Rendu visuel COMPLET du jardin (ciel + soleil/lune + montagnes + arbre central + éléments).
// Utilisé sur la page Focus (zone hero) ET sur le Dashboard (mini-jardin).
//
// viewBox 1600x1000 — le scale est géré par le container.
// preserveAspectRatio="xMidYMax slice" → on garde le sol visible et on crop sur les côtés.
//
// Self-contained : les @keyframes nécessaires (nuages, ailes papillon, étoiles)
// sont injectées via <style> inline pour que le composant fonctionne partout
// (dashboard inclus, sans devoir importer focus-styles.css).

import type { CSSProperties } from 'react'

// ============ TYPES PARTAGÉS ============
export type GardenKind =
  | 'flower' | 'sunflower' | 'tulip' | 'mushroom'
  | 'butterfly' | 'rabbit' | 'squirrel' | 'owl' | 'deer' | 'fox'
  | 'pond' | 'sapling' | 'log'

export type GardenElement = {
  kind: GardenKind
  x: number
  y: number
  variant?: string
}

// ============ VITESSE DU CYCLE JOUR/NUIT ============
// timeMultiplier = 72 → 24h simulées en 20 minutes réelles (1h ≈ 50s).
// Source unique : importé par /dashboard (mini-jardin) ET /focus (jardin hero)
// pour que les deux cyclent à la même vitesse.
//
// Pour ralentir/accélérer : changer cette valeur uniquement ici.
//   - 24 → cycle 1h
//   - 72 → cycle 20min  ← actuel
//   - 144 → cycle 10min
//   - 288 → cycle 5min
export const GARDEN_TIME_MULTIPLIER = 72

// Tick recommandé pour un mouvement fluide du soleil/lune. À 100ms, on a
// 10fps de re-render — imperceptible à l'œil mais coût React négligeable
// puisque le SVG est sans state interne.
export const GARDEN_TICK_MS = 100

// ============ CIEL : interpolation horaire ============
type SkyColors = { top: string; upMid: string; loMid: string; bottom: string }

const SKY_KEYFRAMES: Array<{ hour: number } & SkyColors> = [
  { hour: 0,    top: '#0E1828', upMid: '#1A2438', loMid: '#2A3450', bottom: '#1A2438' },
  { hour: 5,    top: '#1F2A4A', upMid: '#3D3A6A', loMid: '#7A4F6A', bottom: '#9A5E68' },
  { hour: 6.5,  top: '#7AA0B8', upMid: '#E8B89C', loMid: '#F0B58C', bottom: '#E5A07C' },
  { hour: 9,    top: '#7AA0B8', upMid: '#B0CCD8', loMid: '#E5D5B0', bottom: '#D8C492' },
  { hour: 13,   top: '#5E94C0', upMid: '#9DC4D8', loMid: '#D5E0C0', bottom: '#C8DCB0' },
  { hour: 17,   top: '#7AA0B8', upMid: '#E5C088', loMid: '#F0B888', bottom: '#D89070' },
  { hour: 18.5, top: '#5A5078', upMid: '#E89A4F', loMid: '#F0CC95', bottom: '#D49080' },
  { hour: 20,   top: '#3A3A60', upMid: '#5A4A7A', loMid: '#7A5A6A', bottom: '#5A4860' },
  { hour: 22,   top: '#1A2438', upMid: '#2A3450', loMid: '#3A4868', bottom: '#2A3450' },
  { hour: 24,   top: '#0E1828', upMid: '#1A2438', loMid: '#2A3450', bottom: '#1A2438' },
]

function lerpHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

function skyAtHour(hour: number): SkyColors {
  const h = ((hour % 24) + 24) % 24
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    const a = SKY_KEYFRAMES[i], b = SKY_KEYFRAMES[i + 1]
    if (h >= a.hour && h < b.hour) {
      const t = (h - a.hour) / (b.hour - a.hour)
      return {
        top: lerpHex(a.top, b.top, t),
        upMid: lerpHex(a.upMid, b.upMid, t),
        loMid: lerpHex(a.loMid, b.loMid, t),
        bottom: lerpHex(a.bottom, b.bottom, t),
      }
    }
  }
  return SKY_KEYFRAMES[0]
}

// ============ COULEURS ÉLÉMENTS ============
const FLOWER_COLORS: Record<string, string> = {
  red: '#C75050', yellow: '#FBD56B', pink: '#F4B5C9',
  orange: '#E89A4F', purple: '#9C68B0', white: '#FFE5DD',
}
const BUTTERFLY_COLORS: Record<string, [string, string]> = {
  amber: ['#E89A4F', '#FBD56B'],
  blue:  ['#7AA8E0', '#A8C8E8'],
  purple:['#9C68B0', '#D5B0E0'],
}

// ============ ARBRE CENTRAL : branches & feuillage ============
type HeroBranch = {
  threshold: number
  thickPath: string
  innerPath: string
  subPaths?: string[]
}

const HERO_BRANCHES: HeroBranch[] = [
  {
    threshold: 0.18,
    thickPath: 'M -12 -180 Q -90 -210 -180 -200 Q -235 -195 -270 -185',
    innerPath: 'M -12 -180 Q -90 -210 -180 -200 Q -235 -195 -270 -185',
    subPaths: ['M -180 -200 Q -220 -240 -260 -250', 'M -220 -195 Q -260 -180 -300 -160', 'M -180 -200 Q -180 -160 -195 -130'],
  },
  {
    threshold: 0.34,
    thickPath: 'M 14 -250 Q 90 -240 180 -210 Q 240 -185 280 -160',
    innerPath: 'M 14 -250 Q 90 -240 180 -210 Q 240 -185 280 -160',
    subPaths: ['M 180 -210 Q 235 -255 280 -290', 'M 240 -185 Q 295 -195 340 -195', 'M 250 -180 Q 260 -130 280 -90'],
  },
  {
    threshold: 0.50,
    thickPath: 'M -10 -340 Q -70 -360 -150 -345 Q -200 -335 -240 -320',
    innerPath: 'M -10 -340 Q -70 -360 -150 -345 Q -200 -335 -240 -320',
    subPaths: ['M -150 -345 Q -185 -395 -210 -440', 'M -200 -335 Q -260 -355 -300 -360'],
  },
  {
    threshold: 0.66,
    thickPath: 'M 11 -400 Q 70 -420 150 -440 Q 200 -455 240 -465',
    innerPath: 'M 11 -400 Q 70 -420 150 -440 Q 200 -455 240 -465',
    subPaths: ['M 150 -440 Q 190 -480 220 -510', 'M 210 -460 Q 260 -475 295 -490'],
  },
  {
    threshold: 0.82,
    thickPath: 'M 0 -460 Q -30 -510 -85 -540 Q -130 -565 -160 -575',
    innerPath: 'M 0 -460 Q -30 -510 -85 -540 Q -130 -565 -160 -575',
    subPaths: ['M -85 -540 Q -95 -580 -110 -610', 'M 0 -460 Q 40 -490 80 -540', 'M 80 -540 Q 120 -555 160 -560'],
  },
]

type FoliageCluster = {
  threshold: number
  back: { cx: number; cy: number; rx: number; ry: number; fill: string }[]
  mid: { cx: number; cy: number; rx: number; ry: number }[]
  front: { cx: number; cy: number; rx: number; ry: number }[]
}

const HERO_FOLIAGE: FoliageCluster[] = [
  {
    threshold: 0.18,
    back: [
      { cx: -220, cy: -200, rx: 84, ry: 68, fill: '#2F4438' },
      { cx: -260, cy: -180, rx: 64, ry: 52, fill: '#3F5E4A' },
      { cx: -280, cy: -220, rx: 58, ry: 46, fill: '#3F5E4A' },
      { cx: -200, cy: -160, rx: 52, ry: 44, fill: '#4A6E55' },
      { cx: -300, cy: -160, rx: 46, ry: 40, fill: '#3F5E4A' },
    ],
    mid: [
      { cx: -205, cy: -205, rx: 70, ry: 54 },
      { cx: -245, cy: -185, rx: 52, ry: 42 },
      { cx: -265, cy: -225, rx: 46, ry: 36 },
      { cx: -185, cy: -165, rx: 42, ry: 34 },
    ],
    front: [
      { cx: -195, cy: -215, rx: 40, ry: 30 },
      { cx: -235, cy: -200, rx: 32, ry: 24 },
      { cx: -265, cy: -235, rx: 28, ry: 22 },
    ],
  },
  {
    threshold: 0.34,
    back: [
      { cx: 220, cy: -220, rx: 98, ry: 78, fill: '#2F4438' },
      { cx: 280, cy: -180, rx: 74, ry: 58, fill: '#3F5E4A' },
      { cx: 280, cy: -260, rx: 64, ry: 52, fill: '#4A6E55' },
      { cx: 340, cy: -220, rx: 56, ry: 46, fill: '#3F5E4A' },
      { cx: 200, cy: -160, rx: 54, ry: 46, fill: '#4A6E55' },
    ],
    mid: [
      { cx: 225, cy: -225, rx: 80, ry: 62 },
      { cx: 285, cy: -185, rx: 60, ry: 48 },
      { cx: 285, cy: -265, rx: 52, ry: 42 },
      { cx: 345, cy: -225, rx: 46, ry: 38 },
      { cx: 205, cy: -165, rx: 44, ry: 36 },
    ],
    front: [
      { cx: 215, cy: -235, rx: 48, ry: 36 },
      { cx: 275, cy: -200, rx: 36, ry: 28 },
      { cx: 280, cy: -275, rx: 32, ry: 24 },
      { cx: 345, cy: -235, rx: 28, ry: 22 },
    ],
  },
  {
    threshold: 0.50,
    back: [
      { cx: -200, cy: -360, rx: 92, ry: 72, fill: '#2F4438' },
      { cx: -260, cy: -340, rx: 66, ry: 56, fill: '#3F5E4A' },
      { cx: -260, cy: -400, rx: 58, ry: 48, fill: '#4A6E55' },
      { cx: -310, cy: -360, rx: 52, ry: 44, fill: '#3F5E4A' },
    ],
    mid: [
      { cx: -185, cy: -365, rx: 76, ry: 58 },
      { cx: -245, cy: -345, rx: 54, ry: 44 },
      { cx: -245, cy: -405, rx: 48, ry: 38 },
      { cx: -295, cy: -365, rx: 42, ry: 34 },
    ],
    front: [
      { cx: -175, cy: -375, rx: 44, ry: 32 },
      { cx: -235, cy: -355, rx: 32, ry: 26 },
      { cx: -245, cy: -415, rx: 28, ry: 22 },
    ],
  },
  {
    threshold: 0.66,
    back: [
      { cx: 220, cy: -460, rx: 88, ry: 72, fill: '#2F4438' },
      { cx: 280, cy: -490, rx: 62, ry: 54, fill: '#3F5E4A' },
      { cx: 270, cy: -440, rx: 58, ry: 48, fill: '#4A6E55' },
      { cx: 180, cy: -510, rx: 54, ry: 46, fill: '#3F5E4A' },
    ],
    mid: [
      { cx: 225, cy: -465, rx: 72, ry: 58 },
      { cx: 285, cy: -495, rx: 50, ry: 44 },
      { cx: 275, cy: -445, rx: 46, ry: 40 },
      { cx: 185, cy: -515, rx: 44, ry: 36 },
    ],
    front: [
      { cx: 215, cy: -475, rx: 42, ry: 32 },
      { cx: 285, cy: -505, rx: 30, ry: 24 },
      { cx: 275, cy: -455, rx: 28, ry: 22 },
    ],
  },
  {
    threshold: 0.82,
    back: [
      { cx: -130, cy: -580, rx: 74, ry: 62, fill: '#2F4438' },
      { cx: -170, cy: -610, rx: 54, ry: 46, fill: '#4A6E55' },
      { cx: -90, cy: -620, rx: 50, ry: 42, fill: '#3F5E4A' },
      { cx: 80, cy: -560, rx: 64, ry: 54, fill: '#3F5E4A' },
      { cx: 140, cy: -580, rx: 50, ry: 44, fill: '#4A6E55' },
    ],
    mid: [
      { cx: -115, cy: -585, rx: 60, ry: 50 },
      { cx: -155, cy: -615, rx: 44, ry: 38 },
      { cx: -75, cy: -625, rx: 40, ry: 34 },
      { cx: 95, cy: -565, rx: 52, ry: 44 },
      { cx: 155, cy: -585, rx: 42, ry: 36 },
    ],
    front: [
      { cx: -105, cy: -595, rx: 36, ry: 28 },
      { cx: -155, cy: -625, rx: 26, ry: 22 },
      { cx: 105, cy: -575, rx: 32, ry: 26 },
    ],
  },
]

const HERO_TRUNK_X = 440
const HERO_GROUND_Y = 750

// ============ PROPS ============
type GardenSvgProps = {
  elements: GardenElement[]
  /** Temps cumulé (ms) — détermine la maturité de l'arbre central. */
  elapsedMs: number
  /** Temps cumulé pour atteindre la pleine maturité (typiquement 100h). */
  timeToFullMs: number
  /** Heure courante en ms (pour le cycle jour/nuit). Default: Date.now() au render. */
  nowMs?: number
  /** Si true, l'arbre est au max + bloom au sommet (utilisé sur l'écran bilan focus). */
  forceFull?: boolean
  /** Classe CSS à apposer sur le <svg>. */
  className?: string
  style?: CSSProperties
  /** Inclure les @keyframes inline (true par défaut, à false sur la page focus
   *  qui charge déjà focus-styles.css avec les keyframes équivalentes). */
  injectStyles?: boolean
  /** viewBox du SVG. Default '0 0 1600 1000' (vue large, arbre à 27.5% horizontal).
   *  Pour centrer l'arbre, passer '40 0 800 1000' (le mini-jardin dashboard). */
  viewBox?: string
  /** Vitesse du cycle jour/nuit. 1 = temps réel (24h cycle). 240 = 24h en 6min.
   *  Utilisé sur le mini-jardin pour que l'étudiant voie passer la nuit même
   *  pendant des sessions de jour. */
  timeMultiplier?: number
  /** Burst de particules dorées (utilisé sur le focus à chaque notation).
   *  ts incrémenté pour re-déclencher l'animation CSS focus-particle-fly. */
  particleBurst?: { ts: number; x?: number; y?: number } | null
}

// ============ COMPOSANT ============
export default function GardenSvg({
  elements,
  elapsedMs,
  timeToFullMs,
  nowMs,
  forceFull = false,
  className,
  style,
  injectStyles = true,
  viewBox = '0 0 1600 1000',
  timeMultiplier = 1,
  particleBurst = null,
}: GardenSvgProps) {
  const treeProgress = forceFull ? 1 : Math.max(0, Math.min(1, elapsedMs / timeToFullMs))

  // Cycle jour/nuit. Avec timeMultiplier=1, l'heure simulée = heure réelle.
  // Avec timeMultiplier>1, le cycle s'accélère (24h en 24h/timeMultiplier).
  // Ex: timeMultiplier=240 → 24h simulées en 6min réelles.
  const realMs = nowMs ?? Date.now()
  const hour = timeMultiplier === 1
    ? (() => {
        const d = new Date(realMs)
        return d.getHours() + d.getMinutes() / 60
      })()
    : (((realMs / 3_600_000) * timeMultiplier) % 24 + 24) % 24
  const sky = skyAtHour(hour)

  const isDaytime = hour >= 6 && hour <= 19
  const sunArcT = isDaytime ? (hour - 6) / 13 : -1
  const sunX = 200 + sunArcT * 1200
  const sunY = 440 - Math.sin(Math.max(0, sunArcT) * Math.PI) * 220

  const moonHourAdj = hour < 6 ? hour + 24 : hour
  const isNight = hour >= 19 || hour < 6
  const moonArcT = isNight ? (moonHourAdj - 19) / 11 : -1
  const moonX = 200 + moonArcT * 1200
  const moonY = 440 - Math.sin(Math.max(0, moonArcT) * Math.PI) * 220

  let starsOpacity = 0
  if (hour < 5 || hour > 22) starsOpacity = 1
  else if (hour >= 20 && hour <= 22) starsOpacity = (hour - 20) / 2
  else if (hour >= 5 && hour < 7) starsOpacity = (7 - hour) / 2

  const unlocked = elements

  // Rendu d'un élément (switch sur kind)
  function renderEl(el: GardenElement, idx: number) {
    const k = `el-${idx}`
    switch (el.kind) {
      case 'flower': {
        // 5 pétales en éventail + tige courbée + petite feuille latérale.
        // Centre avec pistil et highlight pour la profondeur.
        const c = FLOWER_COLORS[el.variant ?? 'red']
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            {/* Tige courbée */}
            <path d="M 0 0 Q -1.5 -10 -0.5 -22" stroke="#5E8954" strokeWidth={1.6} fill="none" strokeLinecap="round" />
            {/* Petite feuille sur la tige */}
            <path d="M -0.8 -12 Q -7 -14 -8 -10 Q -4 -9 -0.8 -10 Z" fill="#5E8954" />
            <path d="M -0.8 -11.5 Q -5 -12.5 -7 -10.5" stroke="#3F5E4A" strokeWidth={0.4} fill="none" />
            {/* 5 pétales en arrière-plan (rotation à 72°) */}
            {[0, 72, 144, 216, 288].map(a => (
              <ellipse key={a} cx={0} cy={-26} rx={3.2} ry={4.5}
                       fill={c}
                       transform={`rotate(${a} 0 -22)`} />
            ))}
            {/* 5 pétales avant (plus petits, plus clairs) pour donner du relief */}
            {[36, 108, 180, 252, 324].map(a => (
              <ellipse key={a} cx={0} cy={-24} rx={2.2} ry={3}
                       fill={c} opacity={0.85}
                       transform={`rotate(${a} 0 -22)`} />
            ))}
            {/* Centre */}
            <circle cx={0} cy={-22} r={1.8} fill="#A8741E" />
            <circle cx={-0.5} cy={-22.5} r={0.6} fill="#FBD56B" />
          </g>
        )
      }
      case 'sunflower': {
        // 12 pétales disposés en cercle + cœur brun avec pattern de graines.
        const RAY = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            {/* Tige droite */}
            <path d="M 0 0 Q -1 -15 -2 -32" stroke="#5E8954" strokeWidth={2.2} fill="none" strokeLinecap="round" />
            {/* Feuille longue */}
            <path d="M -1.5 -16 Q -10 -22 -13 -14 Q -7 -12 -1.5 -14 Z" fill="#5E8954" />
            <path d="M -1.5 -15.5 Q -7 -19 -11 -15" stroke="#3F5E4A" strokeWidth={0.5} fill="none" />
            {/* Pétales (12 en couronne) */}
            <g transform="translate(-2 -36)">
              {RAY.map(a => (
                <ellipse key={a} cx={0} cy={-9} rx={3} ry={5.5}
                         fill="#FBD56B"
                         transform={`rotate(${a})`} />
              ))}
              {/* Pétales avant plus clairs */}
              {RAY.filter((_, i) => i % 2 === 0).map(a => (
                <ellipse key={`b-${a}`} cx={0} cy={-9} rx={2} ry={4.5}
                         fill="#FFE598"
                         transform={`rotate(${a})`} />
              ))}
              {/* Centre brun */}
              <circle cx={0} cy={0} r={5.5} fill="url(#sunflowerCenter)" />
              {/* Pattern de graines (petits points concentriques) */}
              <circle cx={0} cy={0} r={1} fill="#3D2418" />
              <circle cx={2} cy={0.5} r={0.6} fill="#3D2418" />
              <circle cx={-2} cy={0.5} r={0.6} fill="#3D2418" />
              <circle cx={0} cy={-2} r={0.6} fill="#3D2418" />
              <circle cx={1.5} cy={2} r={0.5} fill="#3D2418" />
              <circle cx={-1.5} cy={2} r={0.5} fill="#3D2418" />
              <circle cx={3} cy={-1.5} r={0.5} fill="#3D2418" />
              <circle cx={-3} cy={-1.5} r={0.5} fill="#3D2418" />
            </g>
          </g>
        )
      }
      case 'tulip': {
        // Forme classique : 3 pétales fermés en coupe, gradient pour le volume.
        const c = FLOWER_COLORS[el.variant ?? 'red']
        const cDark = el.variant === 'yellow' ? '#D8A53A' : el.variant === 'white' ? '#D8C4B8' : '#7A2A2A'
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            {/* Tige */}
            <path d="M 0 0 Q -0.5 -16 0 -32" stroke="#5E8954" strokeWidth={2} fill="none" strokeLinecap="round" />
            {/* Feuille longue effilée */}
            <path d="M 0 -14 Q -10 -20 -13 -8 Q -8 -6 0 -10 Z" fill="#5E8954" />
            <path d="M 0 -13.5 Q -7 -16 -11 -10" stroke="#3F5E4A" strokeWidth={0.4} fill="none" />
            {/* Pétale arrière */}
            <path d="M -5 -32 Q -5 -42 0 -44 Q 5 -42 5 -32 Q 0 -28 -5 -32 Z" fill={cDark} />
            {/* Pétale milieu (le plus clair) */}
            <path d="M -3.5 -32 Q -3.5 -41 0 -43 Q 3.5 -41 3.5 -32 Q 0 -29 -3.5 -32 Z" fill={c} />
            {/* Pétale avant (subtle highlight) */}
            <path d="M -2 -32 Q -2 -39 0 -41 Q 2 -39 2 -32 Q 0 -30 -2 -32 Z" fill={c} opacity={0.7} />
            {/* Reflet brillant */}
            <ellipse cx={-1.5} cy={-38} rx={0.8} ry={2} fill="rgba(255,255,255,0.4)" />
          </g>
        )
      }
      case 'mushroom': {
        // Style amanite : chapeau dôme avec gradient + pois blancs, pied épais, lamelles.
        const isRed = el.variant !== 'orange'
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            {/* Ombre au sol */}
            <ellipse cx={0} cy={9} rx={9} ry={2} fill="rgba(0,0,0,0.18)" />
            {/* Pied (stipe) */}
            <path d="M -3 8 Q -4 0 -3 -2 L 3 -2 Q 4 0 3 8 Z" fill="url(#mushroomStem)" />
            {/* Anneau (volve) */}
            <ellipse cx={0} cy={-1.5} rx={4.5} ry={1} fill="#E8DCB8" />
            {/* Lamelles sous le chapeau (suggérées) */}
            <ellipse cx={0} cy={-2.5} rx={9} ry={1.5} fill="#5A4438" opacity={0.4} />
            {/* Chapeau dôme */}
            <path d="M -11 -3 Q -11 -14 0 -14 Q 11 -14 11 -3 Q 8 -1 0 -1 Q -8 -1 -11 -3 Z"
                  fill={isRed ? 'url(#mushroomCapRed)' : 'url(#mushroomCapOrange)'} />
            {/* Pois blancs (amanite) */}
            <circle cx={-5} cy={-7} r={1.6} fill="rgba(255,255,255,0.95)" />
            <circle cx={3} cy={-9} r={1.3} fill="rgba(255,255,255,0.92)" />
            <circle cx={6} cy={-5} r={1.1} fill="rgba(255,255,255,0.9)" />
            <circle cx={-2} cy={-11} r={1} fill="rgba(255,255,255,0.88)" />
            {/* Highlight sur le chapeau */}
            <ellipse cx={-3} cy={-10} rx={5} ry={2.2} fill="rgba(255,255,255,0.3)" />
          </g>
        )
      }
      case 'butterfly': {
        // 4 ailes en path Bézier (sup + inf, gauche + droite), motifs sur chaque aile,
        // antennes courbes avec petits bulbes, corps fuselé.
        const [body, wing] = BUTTERFLY_COLORS[el.variant ?? 'amber']
        const flapDelay = (idx % 7) * 50
        return (
          <g key={k} transform={`translate(${el.x} ${el.y}) rotate(-15)`}>
            <g className="focus-butterfly-wings" style={{ animationDelay: `${flapDelay}ms` }}>
              {/* Aile gauche supérieure */}
              <path d="M 0 -1 Q -10 -10 -14 -4 Q -13 2 -2 2 Z" fill={body} />
              {/* Aile gauche inférieure */}
              <path d="M -2 2 Q -11 6 -8 12 Q -3 10 -1 4 Z" fill={body} opacity={0.92} />
              {/* Aile droite supérieure */}
              <path d="M 0 -1 Q 10 -10 14 -4 Q 13 2 2 2 Z" fill={body} />
              {/* Aile droite inférieure */}
              <path d="M 2 2 Q 11 6 8 12 Q 3 10 1 4 Z" fill={body} opacity={0.92} />
              {/* Motifs sur ailes supérieures (cercles plus clairs) */}
              <circle cx={-8} cy={-3} r={2.2} fill={wing} />
              <circle cx={8}  cy={-3} r={2.2} fill={wing} />
              <circle cx={-8} cy={-3} r={1} fill="rgba(255,255,255,0.5)" />
              <circle cx={8}  cy={-3} r={1} fill="rgba(255,255,255,0.5)" />
              {/* Petits points sur ailes inférieures */}
              <circle cx={-6} cy={7} r={0.8} fill={wing} />
              <circle cx={6}  cy={7} r={0.8} fill={wing} />
            </g>
            {/* Corps fuselé */}
            <ellipse cx={0} cy={1} rx={1} ry={4.5} fill="#3D2C20" />
            <circle cx={0} cy={-3.5} r={1.1} fill="#3D2C20" />
            {/* Antennes courbes avec bulbes */}
            <path d="M -0.5 -4.5 Q -2 -7 -3 -10" stroke="#3D2C20" strokeWidth={0.7} fill="none" strokeLinecap="round" />
            <path d="M 0.5 -4.5 Q 2 -7 3 -10" stroke="#3D2C20" strokeWidth={0.7} fill="none" strokeLinecap="round" />
            <circle cx={-3} cy={-10} r={0.7} fill="#3D2C20" />
            <circle cx={3}  cy={-10} r={0.7} fill="#3D2C20" />
          </g>
        )
      }
      case 'rabbit': {
        // Lapin avec corps + tête organiques, oreilles longues courbes, yeux brillants,
        // moustaches, queue cotton ball blanche.
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            {/* Ombre au sol */}
            <ellipse cx={0} cy={14} rx={22} ry={4} fill="rgba(0,0,0,0.22)" />
            {/* Corps (path arrondi) */}
            <path d="M -16 6 Q -18 -10 -8 -12 Q 4 -14 14 -8 Q 22 0 18 10 Q 8 14 -8 14 Q -16 12 -16 6 Z"
                  fill="url(#rabbitBody)" />
            {/* Ventre clair */}
            <path d="M -10 6 Q -10 0 -2 -2 Q 8 -2 14 4 Q 14 10 6 12 Q -6 12 -10 6 Z"
                  fill="url(#rabbitBelly)" opacity={0.7} />
            {/* Tête */}
            <ellipse cx={14} cy={-3} rx={10} ry={8} fill="url(#rabbitBody)" />
            <ellipse cx={16} cy={0} rx={6} ry={5} fill="url(#rabbitBelly)" opacity={0.6} />
            {/* Oreille gauche (longue, courbée) */}
            <path d="M 7 -10 Q 4 -22 8 -25 Q 12 -22 11 -10 Z" fill="url(#rabbitBody)" />
            <path d="M 8 -11 Q 7 -20 9 -22 Q 10 -19 10 -12 Z" fill="rgba(244,181,201,0.55)" />
            {/* Oreille droite */}
            <path d="M 14 -10 Q 13 -23 18 -25 Q 21 -22 17 -10 Z" fill="url(#rabbitBody)" />
            <path d="M 15 -11 Q 15 -21 17 -22 Q 18 -19 17 -12 Z" fill="rgba(244,181,201,0.55)" />
            {/* Œil brillant */}
            <ellipse cx={18} cy={-4} rx={1.6} ry={2} fill="#1A1A0F" />
            <circle cx={18.5} cy={-4.8} r={0.6} fill="white" />
            {/* Petit nez triangulaire */}
            <path d="M 22 -1 Q 23.5 0 22 0.8 Q 20.5 0 22 -1 Z" fill="#C75050" />
            {/* Bouche */}
            <path d="M 22 1 Q 21 2 20 1.8" stroke="#5A3A28" strokeWidth={0.4} fill="none" />
            {/* Moustaches */}
            <line x1={20} y1={0.5} x2={26} y2={0} stroke="#5A4438" strokeWidth={0.3} />
            <line x1={20} y1={1.5} x2={26} y2={2} stroke="#5A4438" strokeWidth={0.3} />
            <line x1={20} y1={-0.5} x2={26} y2={-1.5} stroke="#5A4438" strokeWidth={0.3} />
            {/* Queue cotton ball */}
            <circle cx={-17} cy={2} r={4} fill="#FFFAF0" />
            <circle cx={-17} cy={1.5} r={2.5} fill="rgba(255,255,255,0.7)" />
            {/* Patte avant visible */}
            <ellipse cx={8} cy={12} rx={3} ry={2} fill="#A89578" />
          </g>
        )
      }
      case 'squirrel': {
        // Petit corps, queue plumeuse en S majestueuse, oreilles pointues,
        // gros yeux brillants, petites pattes.
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            {/* Ombre */}
            <ellipse cx={-2} cy={9} rx={14} ry={2.5} fill="rgba(0,0,0,0.2)" />
            {/* Queue plumeuse en S derrière */}
            <path d="M 12 -2 Q 26 -8 30 4 Q 26 10 18 8 Q 22 0 18 -4 Q 16 -1 12 -1 Z"
                  fill="url(#squirrelBody)" />
            <path d="M 16 -2 Q 24 -6 26 2 Q 22 0 18 -2" fill="rgba(255,220,180,0.35)" />
            {/* Corps */}
            <path d="M -10 4 Q -12 -6 -4 -8 Q 6 -8 12 -2 Q 12 6 4 8 Q -8 9 -10 4 Z"
                  fill="url(#squirrelBody)" />
            {/* Ventre clair */}
            <ellipse cx={-2} cy={4} rx={6} ry={3} fill="rgba(240,210,170,0.6)" />
            {/* Tête */}
            <ellipse cx={-9} cy={-2} rx={5} ry={4.5} fill="url(#squirrelBody)" />
            <ellipse cx={-10} cy={0} rx={3} ry={2.5} fill="rgba(240,210,170,0.5)" />
            {/* Oreilles pointues touffues */}
            <path d="M -10 -6 L -12 -10 L -8 -7 Z" fill="#5A3818" />
            <path d="M -7 -5 L -8 -9 L -5 -7 Z" fill="#5A3818" />
            {/* Œil brillant */}
            <ellipse cx={-11} cy={-2} rx={1} ry={1.2} fill="#1A1A0F" />
            <circle cx={-11.3} cy={-2.5} r={0.4} fill="white" />
            {/* Museau et nez */}
            <ellipse cx={-13} cy={-0.5} rx={1.5} ry={1.2} fill="rgba(255,240,220,0.7)" />
            <circle cx={-13.5} cy={-0.5} r={0.5} fill="#3D2418" />
            {/* Pattes avant (qui tient quelque chose) */}
            <path d="M -8 4 Q -10 7 -7 8" stroke="#5A3818" strokeWidth={1.2} fill="none" strokeLinecap="round" />
            <path d="M -5 4 Q -3 7 -6 8" stroke="#5A3818" strokeWidth={1.2} fill="none" strokeLinecap="round" />
            {/* Petit gland tenu */}
            <ellipse cx={-7} cy={3} rx={1.2} ry={1.5} fill="#9C6E2A" />
            <ellipse cx={-7} cy={2.2} rx={1.2} ry={0.5} fill="#5A3818" />
          </g>
        )
      }
      case 'owl': {
        // Hibou rond avec énormes yeux ronds, plumes texturées sur la poitrine,
        // ailes repliées, bec triangulaire, petites serres.
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            {/* Ombre sur la branche */}
            <ellipse cx={0} cy={11} rx={14} ry={2} fill="rgba(0,0,0,0.25)" />
            {/* Corps rond */}
            <path d="M -14 5 Q -16 -8 -8 -12 Q 0 -14 8 -12 Q 16 -8 14 5 Q 10 11 0 12 Q -10 11 -14 5 Z"
                  fill="url(#owlBody)" />
            {/* Ventre + plumes en V (texture) */}
            <path d="M -10 3 Q -10 -6 -3 -8 Q 5 -8 10 0 Q 8 8 0 9 Q -8 8 -10 3 Z"
                  fill="url(#owlBelly)" />
            <path d="M -6 -2 Q -4 0 -2 -2 M 2 -2 Q 4 0 6 -2 M -4 2 Q -2 4 0 2 M 0 2 Q 2 4 4 2 M -6 6 Q -4 8 -2 6 M 2 6 Q 4 8 6 6"
                  stroke="#5A4438" strokeWidth={0.5} fill="none" />
            {/* Disques faciaux (autour des yeux) */}
            <circle cx={-5} cy={-5} r={4.5} fill="#A88A6A" />
            <circle cx={5}  cy={-5} r={4.5} fill="#A88A6A" />
            {/* Yeux énormes */}
            <circle cx={-5} cy={-5} r={2.8} fill="#FFFEF0" />
            <circle cx={5}  cy={-5} r={2.8} fill="#FFFEF0" />
            <circle cx={-5} cy={-5} r={1.8} fill="#3A2418" />
            <circle cx={5}  cy={-5} r={1.8} fill="#3A2418" />
            {/* Reflets pupilles */}
            <circle cx={-4.4} cy={-5.6} r={0.6} fill="white" />
            <circle cx={5.6}  cy={-5.6} r={0.6} fill="white" />
            {/* Bec triangulaire */}
            <path d="M -1.5 -2 L 0 1 L 1.5 -2 Z" fill="#E08B3C" />
            {/* Sourcils (plumes au-dessus des yeux) */}
            <path d="M -8 -8 Q -5 -10 -2 -8" stroke="#3D2C20" strokeWidth={0.8} fill="none" />
            <path d="M 2 -8 Q 5 -10 8 -8" stroke="#3D2C20" strokeWidth={0.8} fill="none" />
            {/* Aile repliée */}
            <path d="M 8 -2 Q 14 0 12 8" stroke="#3A2C20" strokeWidth={1.2} fill="none" />
            {/* Serres */}
            <path d="M -2 11 L -3 13 M -1 11 L -1 13.5 M 0 11 L 1 13" stroke="#9C7B3A" strokeWidth={0.8} strokeLinecap="round" />
            <path d="M 2 11 L 3 13 M 1 11 L 1 13.5 M 0 11 L -1 13" stroke="#9C7B3A" strokeWidth={0.8} strokeLinecap="round" />
          </g>
        )
      }
      case 'deer': {
        // Cerf majestueux avec cou élancé, bois ramifiés, taches blanches sur le dos,
        // queue blanche, gradient sur le corps.
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`} opacity={0.96}>
            {/* Ombre */}
            <ellipse cx={0} cy={8} rx={32} ry={4} fill="rgba(0,0,0,0.22)" />
            {/* Corps */}
            <path d="M -22 -3 Q -24 -14 -10 -16 Q 6 -16 18 -8 Q 22 0 18 6 Q -2 8 -22 6 Q -24 0 -22 -3 Z"
                  fill="url(#deerBody)" />
            {/* Ventre clair */}
            <path d="M -16 0 Q -14 4 -4 5 Q 8 5 14 2 Q 12 6 0 7 Q -16 7 -16 0 Z" fill="rgba(248,220,200,0.7)" />
            {/* Taches blanches dos (faon) */}
            <circle cx={-10} cy={-10} r={1.5} fill="rgba(255,255,255,0.6)" />
            <circle cx={-2} cy={-12} r={1.3} fill="rgba(255,255,255,0.6)" />
            <circle cx={6} cy={-10} r={1.5} fill="rgba(255,255,255,0.6)" />
            <circle cx={12} cy={-7} r={1.2} fill="rgba(255,255,255,0.5)" />
            {/* Cou et tête */}
            <path d="M 18 -8 Q 24 -14 25 -22 Q 30 -22 32 -14 Q 34 -8 28 -4 Q 22 -2 18 -4 Z"
                  fill="url(#deerBody)" />
            {/* Museau */}
            <ellipse cx={32} cy={-12} rx={3.5} ry={2.5} fill="#5A3818" />
            <circle cx={33} cy={-13} r={0.8} fill="#1A1A0F" />
            {/* Œil brillant */}
            <ellipse cx={28} cy={-15} rx={1.2} ry={1.5} fill="#1A1A0F" />
            <circle cx={28.5} cy={-15.6} r={0.4} fill="white" />
            {/* Oreilles */}
            <path d="M 22 -22 Q 21 -28 24 -27 Q 26 -24 25 -20 Z" fill="url(#deerBody)" />
            <path d="M 23 -23 Q 23 -26 24 -25" fill="rgba(255,210,180,0.6)" />
            {/* Bois ramifiés (style arbre) */}
            <path d="M 24 -22 Q 22 -32 20 -38 M 22 -32 L 18 -36 M 22 -32 L 25 -38"
                  stroke="#8C6A48" strokeWidth={1.4} fill="none" strokeLinecap="round" />
            <path d="M 27 -22 Q 28 -32 30 -38 M 28 -32 L 26 -38 M 28 -32 L 32 -36"
                  stroke="#8C6A48" strokeWidth={1.4} fill="none" strokeLinecap="round" />
            {/* Pattes fines */}
            <path d="M -18 6 L -19 14" stroke="#5A3818" strokeWidth={2} strokeLinecap="round" />
            <path d="M -10 6 L -11 14" stroke="#5A3818" strokeWidth={2} strokeLinecap="round" />
            <path d="M 8 4 L 10 14" stroke="#5A3818" strokeWidth={2} strokeLinecap="round" />
            <path d="M 16 4 L 18 14" stroke="#5A3818" strokeWidth={2} strokeLinecap="round" />
            {/* Sabots */}
            <ellipse cx={-19} cy={14} rx={1.2} ry={0.8} fill="#1A1A0F" />
            <ellipse cx={-11} cy={14} rx={1.2} ry={0.8} fill="#1A1A0F" />
            <ellipse cx={10} cy={14} rx={1.2} ry={0.8} fill="#1A1A0F" />
            <ellipse cx={18} cy={14} rx={1.2} ry={0.8} fill="#1A1A0F" />
            {/* Queue blanche dressée */}
            <ellipse cx={-22} cy={-6} rx={2} ry={4} fill="#FFFAF0" />
          </g>
        )
      }
      case 'fox': {
        // Renard avec corps orange dégradé, museau blanc, queue épaisse à bout blanc,
        // oreilles pointues, yeux brillants, pattes noires.
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            {/* Ombre */}
            <ellipse cx={0} cy={8} rx={22} ry={3.5} fill="rgba(0,0,0,0.22)" />
            {/* Queue épaisse derrière (avant le corps pour que body chevauche) */}
            <path d="M 12 0 Q 26 -4 32 4 Q 28 12 18 10 Q 14 6 12 4 Z" fill="url(#foxBody)" />
            {/* Bout de queue blanc */}
            <path d="M 28 0 Q 33 0 32 6 Q 28 8 26 4 Z" fill="url(#foxBelly)" />
            {/* Corps */}
            <path d="M -16 4 Q -18 -8 -8 -10 Q 6 -10 14 -4 Q 18 4 12 8 Q -4 9 -16 8 Q -18 6 -16 4 Z"
                  fill="url(#foxBody)" />
            {/* Poitrail blanc */}
            <path d="M -10 4 Q -8 0 -2 -2 Q 6 -1 10 4 Q 6 8 -2 8 Q -10 8 -10 4 Z" fill="url(#foxBelly)" opacity={0.85} />
            {/* Tête triangulaire */}
            <path d="M 14 -4 Q 22 -8 26 -2 Q 26 4 18 6 Q 14 4 14 -4 Z" fill="url(#foxBody)" />
            {/* Menton blanc */}
            <path d="M 18 0 Q 22 1 24 3 Q 22 5 18 4 Z" fill="url(#foxBelly)" />
            {/* Oreilles pointues (intérieur foncé) */}
            <path d="M 14 -4 L 12 -12 L 18 -7 Z" fill="url(#foxBody)" />
            <path d="M 14 -4 L 13 -10 L 16 -6 Z" fill="#3A1810" />
            <path d="M 22 -6 L 22 -13 L 26 -8 Z" fill="url(#foxBody)" />
            <path d="M 22 -6 L 22 -11 L 25 -7 Z" fill="#3A1810" />
            {/* Œil amande brillant */}
            <ellipse cx={20} cy={-2} rx={1.5} ry={1.2} fill="#1A1A0F" />
            <circle cx={20.4} cy={-2.4} r={0.4} fill="white" />
            {/* Petit nez triangulaire noir */}
            <path d="M 25 1 L 26.5 2 L 25 3 Z" fill="#1A1A0F" />
            {/* Moustaches */}
            <line x1={24} y1={2} x2={28} y2={1.5} stroke="#3D2418" strokeWidth={0.3} />
            <line x1={24} y1={3} x2={28} y2={3.5} stroke="#3D2418" strokeWidth={0.3} />
            {/* Pattes */}
            <path d="M -10 8 L -11 13" stroke="#3A1810" strokeWidth={2.2} strokeLinecap="round" />
            <path d="M -2 8 L -3 13" stroke="#3A1810" strokeWidth={2.2} strokeLinecap="round" />
            <path d="M 6 7 L 7 13" stroke="#3A1810" strokeWidth={2.2} strokeLinecap="round" />
            <path d="M 12 7 L 13 13" stroke="#3A1810" strokeWidth={2.2} strokeLinecap="round" />
          </g>
        )
      }
      case 'pond': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={50} rx={220} ry={55} fill="rgba(255,255,255,0.32)" />
            <ellipse cx={0} cy={40} rx={200} ry={45} fill="url(#pondGrad)" />
            <ellipse cx={0} cy={30} rx={190} ry={38} fill="url(#pondHi)" />
            <path d="M-160 28 Q-100 20 -40 28 M40 30 Q100 22 160 30" stroke="rgba(255,255,255,0.4)" strokeWidth={1.2} fill="none" />
            <g transform="translate(-110,28)">
              <ellipse cx={0} cy={0} rx={18} ry={6} fill="#5E8954" />
              <ellipse cx={-2} cy={-1} rx={14} ry={4} fill="#7AA56B" />
              <ellipse cx={-2} cy={-2} rx={3} ry={2} fill="#F4B5C9" />
              <circle cx={-2} cy={-2} r={0.8} fill="#FBD56B" />
            </g>
            <g transform="translate(80,40)">
              <ellipse cx={0} cy={0} rx={22} ry={7} fill="#5E8954" />
              <ellipse cx={2} cy={-1} rx={18} ry={5} fill="#7AA56B" />
              <ellipse cx={3} cy={-3} rx={3.5} ry={2.5} fill="#FFE5DD" />
              <circle cx={3} cy={-3} r={1} fill="#FBD56B" />
            </g>
            <g transform="translate(140,55)">
              <ellipse cx={0} cy={0} rx={14} ry={5} fill="#5E8954" />
              <ellipse cx={-1} cy={-1} rx={11} ry={3.5} fill="#7AA56B" />
            </g>
            <g transform="translate(-180,15)">
              <line x1={0} y1={0} x2={0}  y2={-40} stroke="#5E8954" strokeWidth={2} />
              <line x1={-3} y1={-2} x2={-5} y2={-30} stroke="#5E8954" strokeWidth={2} />
              <line x1={3}  y1={-2} x2={5}  y2={-32} stroke="#5E8954" strokeWidth={2} />
              <ellipse cx={0}  cy={-42} rx={4} ry={10} fill="#9C7B3A" />
              <ellipse cx={-5} cy={-32} rx={3} ry={7}  fill="#9C7B3A" />
              <ellipse cx={5}  cy={-34} rx={3} ry={8}  fill="#9C7B3A" />
            </g>
            <g transform="translate(-50,52)">
              <ellipse cx={0} cy={0} rx={9} ry={6} fill="#5E8954" />
              <ellipse cx={-3} cy={-2} rx={3} ry={2.5} fill="#7AA56B" />
              <circle cx={-3} cy={-3} r={1.5} fill="#1A1A0F" />
              <circle cx={3}  cy={-3} r={1.5} fill="#1A1A0F" />
              <circle cx={-3} cy={-3} r={0.5} fill="white" />
              <circle cx={3}  cy={-3} r={0.5} fill="white" />
            </g>
          </g>
        )
      }
      case 'sapling': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={4} rx={18} ry={4} fill="rgba(0,0,0,0.18)" />
            <line x1={0} y1={0} x2={0} y2={-30} stroke="#5A4031" strokeWidth={2.5} strokeLinecap="round" />
            <ellipse cx={0} cy={-32} rx={20} ry={14} fill="#3F5E4A" />
            <ellipse cx={-6} cy={-28} rx={12} ry={9} fill="#4A6E55" />
            <ellipse cx={6}  cy={-30} rx={11} ry={9} fill="#5E8954" />
            <ellipse cx={-2} cy={-36} rx={9} ry={7}  fill="url(#bushHi)" />
          </g>
        )
      }
      case 'log': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`} opacity={0.95}>
            <ellipse cx={0}  cy={0} rx={32} ry={14} fill="#7C5A3A" />
            <ellipse cx={-2} cy={-3} rx={22} ry={10} fill="#8C6A48" />
            <path d="M28 -2 Q42 -8 48 -10 L46 0 L36 4 Z" fill="#7C5A3A" />
            <ellipse cx={-30} cy={2} rx={3} ry={6} fill="#FFFFFF" />
            <line x1={-12} y1={14} x2={-13} y2={32} stroke="#7C5A3A" strokeWidth={3} strokeLinecap="round" />
            <line x1={-2}  y1={14} x2={-3}  y2={32} stroke="#7C5A3A" strokeWidth={3} strokeLinecap="round" />
            <line x1={20}  y1={12} x2={22}  y2={32} stroke="#7C5A3A" strokeWidth={3} strokeLinecap="round" />
            <line x1={10}  y1={12} x2={12}  y2={32} stroke="#7C5A3A" strokeWidth={3} strokeLinecap="round" />
          </g>
        )
      }
      default:
        return null
    }
  }

  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={style}
      role="img"
      preserveAspectRatio="xMidYMax slice"
    >
      <title>Jardin de session</title>

      {/* Keyframes self-contained pour les animations (cloud drift, wing flap, star twinkle).
          Sur la page focus, focus-styles.css définit déjà les mêmes — la duplication est inoffensive. */}
      {injectStyles && (
        <style>{`
          @keyframes focus-cloud-drift { from { transform: translateX(-200px); } to { transform: translateX(1800px); } }
          @keyframes focus-wing-flap { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.55); } }
          @keyframes focus-star-twinkle { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
          .focus-cloud { animation: focus-cloud-drift linear infinite; }
          .focus-cloud-1 { animation-duration: 90s;  animation-delay: 0s; }
          .focus-cloud-2 { animation-duration: 110s; animation-delay: -28s; }
          .focus-cloud-3 { animation-duration: 75s;  animation-delay: -50s; }
          .focus-cloud-4 { animation-duration: 130s; animation-delay: -10s; }
          .focus-butterfly-wings { transform-box: fill-box; transform-origin: center center; animation: focus-wing-flap 0.42s ease-in-out infinite; }
          .focus-star { animation: focus-star-twinkle 3.5s ease-in-out infinite; }
        `}</style>
      )}

      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={sky.top} />
          <stop offset="35%"  stopColor={sky.upMid} />
          <stop offset="70%"  stopColor={sky.loMid} />
          <stop offset="100%" stopColor={sky.bottom} />
        </linearGradient>

        {/* ===== SOLEIL & LUNE ===== */}
        <radialGradient id="sunHaloOuter" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFEFB8" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#F8B855" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#F8B855" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sunHaloInner" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFEFB8" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#F8D880" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F8D880" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sunDisc" cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFEF8" />
          <stop offset="50%" stopColor="#FFE5A0" />
          <stop offset="100%" stopColor="#F0BC60" />
        </radialGradient>
        <radialGradient id="moonHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E5E8F0" stopOpacity="0.28" />
          <stop offset="60%" stopColor="#E5E8F0" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#E5E8F0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moonDisc" cx="32%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFEF8" />
          <stop offset="55%" stopColor="#F0EDD8" />
          <stop offset="100%" stopColor="#C8C4B0" />
        </radialGradient>

        {/* ===== SOL & ARBRE CENTRAL ===== */}
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8C088" />
          <stop offset="60%" stopColor="#86A56A" />
          <stop offset="100%" stopColor="#6B8A52" />
        </linearGradient>
        <linearGradient id="trunkbody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2D1F15" />
          <stop offset="40%" stopColor="#5A4031" />
          <stop offset="55%" stopColor="#6B4C3A" />
          <stop offset="100%" stopColor="#2D1F15" />
        </linearGradient>
        <radialGradient id="foliageMid" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#7AA56B" />
          <stop offset="100%" stopColor="#5E8954" />
        </radialGradient>
        <radialGradient id="foliageFront" cx="35%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#A8C088" />
          <stop offset="100%" stopColor="#7AA56B" />
        </radialGradient>
        <pattern id="bark" width="10" height="20" patternUnits="userSpaceOnUse">
          <path d="M2 0 Q1 10 3 20 M7 0 Q9 10 6 20" stroke="#1F1410" strokeWidth="0.8" fill="none" opacity="0.6" />
        </pattern>

        {/* ===== ÉTANG ===== */}
        <radialGradient id="pondGrad" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#A8CDD8" />
          <stop offset="60%" stopColor="#6E9AAA" />
          <stop offset="100%" stopColor="#4A7585" />
        </radialGradient>
        <linearGradient id="pondHi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id="bushHi" cx="35%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#9DBC78" />
          <stop offset="100%" stopColor="#6F8D52" />
        </radialGradient>

        {/* ===== ANIMAUX (corps avec volume) ===== */}
        <radialGradient id="rabbitBody" cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#F0DCC0" />
          <stop offset="100%" stopColor="#A89578" />
        </radialGradient>
        <radialGradient id="rabbitBelly" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#FFFAF0" />
          <stop offset="100%" stopColor="#E5D4B8" />
        </radialGradient>
        <radialGradient id="foxBody" cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#E8804A" />
          <stop offset="100%" stopColor="#A03818" />
        </radialGradient>
        <radialGradient id="foxBelly" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F0E4D0" />
        </radialGradient>
        <radialGradient id="deerBody" cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#D8A088" />
          <stop offset="100%" stopColor="#7A5240" />
        </radialGradient>
        <radialGradient id="owlBody" cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#7A5E48" />
          <stop offset="100%" stopColor="#3A2C20" />
        </radialGradient>
        <radialGradient id="owlBelly" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#C8A480" />
          <stop offset="100%" stopColor="#8A6B50" />
        </radialGradient>
        <radialGradient id="squirrelBody" cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#A88058" />
          <stop offset="100%" stopColor="#5A3818" />
        </radialGradient>

        {/* ===== FLEURS & CHAMPIGNONS ===== */}
        <radialGradient id="mushroomCapRed" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#E07060" />
          <stop offset="100%" stopColor="#9C2828" />
        </radialGradient>
        <radialGradient id="mushroomCapOrange" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#F0A858" />
          <stop offset="100%" stopColor="#A85820" />
        </radialGradient>
        <radialGradient id="mushroomStem" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFFEF0" />
          <stop offset="100%" stopColor="#D8C8A8" />
        </radialGradient>
        <radialGradient id="sunflowerCenter" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#9C6E2A" />
          <stop offset="100%" stopColor="#5A3818" />
        </radialGradient>
      </defs>

      {/* CIEL */}
      <rect width="1600" height="1000" fill="url(#sky)" />

      {/* SOLEIL — disque + halo + couronne de rayons subtils */}
      {isDaytime && (
        <g>
          {/* Halo très diffus */}
          <circle cx={sunX} cy={sunY} r={300} fill="url(#sunHaloOuter)" />
          {/* Halo intermédiaire chaud */}
          <circle cx={sunX} cy={sunY} r={170} fill="url(#sunHaloInner)" />
          {/* Couronne de rayons (12 rayons régulièrement espacés) */}
          <g transform={`translate(${sunX} ${sunY})`}>
            {[0,30,60,90,120,150,180,210,240,270,300,330].map((a, i) => (
              <line
                key={i}
                x1={0} y1={-105} x2={0} y2={-128}
                stroke="rgba(255,235,180,0.55)"
                strokeWidth={i % 2 === 0 ? 5 : 3}
                strokeLinecap="round"
                transform={`rotate(${a})`}
              />
            ))}
          </g>
          {/* Disque solaire avec gradient (highlight en haut-gauche) */}
          <circle cx={sunX} cy={sunY} r={86} fill="url(#sunDisc)" />
          {/* Highlight discret */}
          <ellipse cx={sunX - 28} cy={sunY - 30} rx={32} ry={20} fill="rgba(255,255,255,0.35)" />
        </g>
      )}

      {/* LUNE — disque texturé + halo + plusieurs cratères variés */}
      {isNight && (
        <g>
          {/* Halo extérieur */}
          <circle cx={moonX} cy={moonY} r={160} fill="url(#moonHalo)" />
          {/* Lueur proche */}
          <circle cx={moonX} cy={moonY} r={78} fill="rgba(255,255,250,0.18)" />
          {/* Disque lunaire (gradient pour donner un côté ombré) */}
          <circle cx={moonX} cy={moonY} r={56} fill="url(#moonDisc)" />
          {/* Cratères variés (tailles, opacités) */}
          <ellipse cx={moonX - 18} cy={moonY - 12} rx={7} ry={6} fill="rgba(160,160,180,0.42)" />
          <ellipse cx={moonX + 14} cy={moonY + 8}  rx={9} ry={7} fill="rgba(160,160,180,0.38)" />
          <ellipse cx={moonX + 6}  cy={moonY - 18} rx={4} ry={3} fill="rgba(160,160,180,0.32)" />
          <ellipse cx={moonX - 10} cy={moonY + 16} rx={5} ry={4} fill="rgba(160,160,180,0.34)" />
          <ellipse cx={moonX + 22} cy={moonY - 4}  rx={3} ry={2.5} fill="rgba(160,160,180,0.28)" />
          <ellipse cx={moonX - 24} cy={moonY + 4}  rx={3.5} ry={3} fill="rgba(160,160,180,0.3)" />
          <circle cx={moonX + 18}  cy={moonY + 22} r={2} fill="rgba(160,160,180,0.24)" />
          <circle cx={moonX - 5}   cy={moonY + 24} r={1.8} fill="rgba(160,160,180,0.22)" />
          {/* Highlight lunaire (côté éclairé) */}
          <ellipse cx={moonX - 18} cy={moonY - 22} rx={20} ry={12} fill="rgba(255,255,255,0.32)" />
        </g>
      )}

      {/* ÉTOILES */}
      {starsOpacity > 0 && (
        <g opacity={starsOpacity}>
          {[
            { x: 120,  y: 80,  r: 1.4 }, { x: 280, y: 140, r: 1.6 },
            { x: 460,  y: 60,  r: 1.2 }, { x: 640, y: 180, r: 1.8 },
            { x: 820,  y: 100, r: 1.3 }, { x: 1000, y: 50, r: 1.5 },
            { x: 1180, y: 170, r: 1.4 }, { x: 1340, y: 90, r: 1.7 },
            { x: 1480, y: 200, r: 1.2 }, { x: 200, y: 220, r: 1.3 },
            { x: 380,  y: 280, r: 1.5 }, { x: 580, y: 310, r: 1.2 },
            { x: 760,  y: 240, r: 1.4 }, { x: 940, y: 290, r: 1.6 },
            { x: 1120, y: 330, r: 1.3 }, { x: 1280, y: 260, r: 1.5 },
            { x: 1440, y: 320, r: 1.4 },
          ].map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFEF0"
                    className="focus-star" style={{ animationDelay: `${(i % 5) * 0.6}s` }} />
          ))}
        </g>
      )}

      {/* NUAGES */}
      <g className="focus-cloud focus-cloud-1">
        <ellipse cx={220} cy={180} rx={58} ry={5} fill="white" opacity={0.45} />
        <ellipse cx={250} cy={170} rx={35} ry={4} fill="white" opacity={0.5} />
      </g>
      <g className="focus-cloud focus-cloud-2">
        <ellipse cx={780} cy={140} rx={50} ry={4} fill="white" opacity={0.4} />
        <ellipse cx={810} cy={148} rx={28} ry={3} fill="white" opacity={0.35} />
      </g>
      <g className="focus-cloud focus-cloud-3">
        <ellipse cx={1430} cy={160} rx={42} ry={4} fill="white" opacity={0.45} />
        <ellipse cx={1460} cy={168} rx={24} ry={3} fill="white" opacity={0.4} />
      </g>
      <g className="focus-cloud focus-cloud-4">
        <ellipse cx={520} cy={100} rx={36} ry={3} fill="white" opacity={0.35} />
      </g>

      {/* OISEAUX */}
      <g opacity={0.7}>
        <path d="M780 200 Q790 195 800 200 L795 205 Z" fill="#3D2C20" />
        <path d="M810 230 Q820 225 830 230 L825 235 Z" fill="#3D2C20" />
        <path d="M860 220 Q870 215 880 220 L875 225 Z" fill="#3D2C20" />
        <path d="M920 210 Q930 205 940 210 L935 215 Z" fill="#3D2C20" />
      </g>

      {/* MONTAGNES & forêt lointaine */}
      <path d="M0 600 Q200 540 380 580 Q540 615 700 575 Q840 540 1000 590 Q1180 640 1380 580 Q1500 545 1600 590 L1600 700 L0 700 Z" fill="#9DB3C8" opacity={0.55} />
      <path d="M0 640 Q150 590 320 620 Q500 660 680 615 Q820 580 980 625 Q1150 670 1320 620 Q1450 590 1600 625 L1600 720 L0 720 Z" fill="#7E9890" opacity={0.7} />
      <path d="M0 690 Q120 660 260 690 Q420 720 580 685 Q740 660 900 695 Q1080 730 1260 690 Q1400 660 1600 690 L1600 750 L0 750 Z" fill="#5E8059" />

      {/* ARBRES SECONDAIRES */}
      <g>
        <g transform="translate(80,720)">
          <ellipse cx={0}   cy={-95}  rx={40} ry={50} fill="#3F5E4A" />
          <ellipse cx={-18} cy={-80}  rx={28} ry={34} fill="#3F5E4A" />
          <ellipse cx={22}  cy={-72}  rx={30} ry={36} fill="#4A6E55" />
          <ellipse cx={-5}  cy={-100} rx={22} ry={28} fill="#5E8954" />
          <path d="M0 0 L-3 -50 L-5 -85 L0 -100 L5 -85 L3 -50 Z" fill="#2D1F15" />
        </g>
        <g transform="translate(180,725)">
          <ellipse cx={0}   cy={-72} rx={26} ry={32} fill="#3F5E4A" />
          <ellipse cx={-10} cy={-58} rx={18} ry={22} fill="#4A6E55" />
          <path d="M0 0 L-2 -35 L0 -75 L2 -35 Z" fill="#2D1F15" />
        </g>
        <g transform="translate(1280,728)">
          <ellipse cx={0}  cy={-58} rx={22} ry={28} fill="#4A6E55" />
          <path d="M0 0 L-2 -28 L0 -60 L2 -28 Z" fill="#2D1F15" />
        </g>
        <g transform="translate(1450,720)">
          <ellipse cx={0}   cy={-105} rx={44} ry={54} fill="#3F5E4A" />
          <ellipse cx={-22} cy={-85}  rx={30} ry={36} fill="#3F5E4A" />
          <ellipse cx={24}  cy={-80}  rx={32} ry={38} fill="#4A6E55" />
          <ellipse cx={-3}  cy={-115} rx={24} ry={30} fill="#5E8954" />
          <path d="M0 0 L-3 -55 L-5 -95 L0 -110 L5 -95 L3 -55 Z" fill="#2D1F15" />
        </g>
      </g>

      {/* SOL */}
      <rect x={0} y={730} width={1600} height={270} fill="url(#grass)" />

      {/* SENTIER subtil */}
      <path d="M380 990 Q500 920 700 900 Q920 880 1100 920 Q1280 950 1500 970 L1600 1000 L0 1000 L0 980 Q120 970 380 990 Z" fill="rgba(196,123,43,0.18)" opacity={0.5} />

      {/* ÉLÉMENTS DE FOND (étang, log, sapling, deer) AVANT l'arbre */}
      {unlocked.filter(e => e.kind === 'pond' || e.kind === 'log' || e.kind === 'sapling' || e.kind === 'deer').map(renderEl)}

      {/* ARBRE CENTRAL — Croissance organique progressive.
          Phases interpolées en continu pour que tout fluide :
          - 0.00 → 0.04 : seedling (2 cotyledons + tige fine)
          - 0.04 → 0.18 : jeune pousse (tronc fin qui grandit en hauteur)
          - 0.18 → 0.50 : adolescent (branches basses + feuillage qui se densifie)
          - 0.50 → 1.00 : mature (canopée luxuriante)
          La hauteur ET la largeur du tronc sont calculées dynamiquement (pas
          juste un scale uniforme), ce qui donne l'impression d'un vrai arbre. */}
      <g transform={`translate(${HERO_TRUNK_X} ${HERO_GROUND_Y})`}>
        {/* Ombre au sol qui s'étend avec l'arbre */}
        <ellipse cx={0} cy={-2}
                 rx={18 + treeProgress * 100}
                 ry={4 + treeProgress * 16}
                 fill="rgba(0,0,0,0.22)" />

        {/* === SEEDLING === Petit pousse visible avant le tronc.
            Fade out entre 0.06 et 0.10 quand le tronc prend le relais. */}
        {treeProgress < 0.10 && (() => {
          const sFade = Math.max(0, Math.min(1, (0.10 - treeProgress) / 0.04))
          // Tige qui grandit légèrement avec treeProgress
          const stemH = 14 + treeProgress * 60
          return (
            <g style={{ opacity: sFade }}>
              <path d={`M 0 0 Q -0.8 ${-stemH * 0.5} -0.3 ${-stemH}`}
                    stroke="#5E8954" strokeWidth={1.6} fill="none" strokeLinecap="round" />
              {/* 2 cotyledons opposés */}
              <ellipse cx={-4} cy={-stemH * 0.7} rx={4.5} ry={2} fill="#7AA56B"
                       transform={`rotate(-25 -4 ${-stemH * 0.7})`} />
              <ellipse cx={4} cy={-stemH * 0.7} rx={4.5} ry={2} fill="#7AA56B"
                       transform={`rotate(25 4 ${-stemH * 0.7})`} />
              <ellipse cx={-4.5} cy={-stemH * 0.7 - 0.3} rx={2} ry={0.8} fill="rgba(255,255,255,0.3)"
                       transform={`rotate(-25 -4.5 ${-stemH * 0.7 - 0.3})`} />
              {/* Petite feuille au sommet */}
              <ellipse cx={0} cy={-stemH - 2} rx={3} ry={4} fill="#5E8954" />
              <ellipse cx={-0.5} cy={-stemH - 3} rx={1} ry={1.5} fill="rgba(255,255,255,0.3)" />
            </g>
          )
        })()}

        {/* === TRONC === Hauteur et largeur interpolées en continu.
            Apparition progressive entre 0.04 et 0.10, suit ensuite treeProgress. */}
        {treeProgress > 0.04 && (() => {
          const tFade = Math.min(1, (treeProgress - 0.04) / 0.06)
          // Hauteur du tronc : grandit de 60px (mini) à 460px (mature)
          const trunkH = 60 + treeProgress * 400
          // Largeur de la base (épaisse) et du sommet (effilée)
          const baseW = 5 + treeProgress * 19
          const topW = 2 + treeProgress * 5
          // Un point de contrôle légèrement décalé pour donner une courbure naturelle
          const sway = treeProgress * 4
          // Path Bézier qui s'incurve doucement
          const trunkPath = `
            M ${-baseW} 0
            Q ${-baseW - 1 + sway} ${-trunkH * 0.3} ${-(baseW + topW) / 2 + sway} ${-trunkH * 0.55}
            Q ${-(topW + 1) + sway} ${-trunkH * 0.8} ${-topW + sway * 0.5} ${-trunkH}
            L ${topW + sway * 0.5} ${-trunkH}
            Q ${(topW + 1) + sway} ${-trunkH * 0.8} ${(baseW + topW) / 2 + sway} ${-trunkH * 0.55}
            Q ${baseW + 1 + sway} ${-trunkH * 0.3} ${baseW} 0
            Z
          `.replace(/\s+/g, ' ').trim()
          // Courbe centrale (highlight)
          const trunkHighlight = `M ${-baseW * 0.3} 0 Q ${-baseW * 0.2 + sway} ${-trunkH * 0.5} ${-topW * 0.4 + sway * 0.5} ${-trunkH * 0.95}`

          return (
            <g style={{ opacity: tFade }}>
              <path d={trunkPath} fill="url(#trunkbody)" />
              <path d={trunkPath} fill="url(#bark)" opacity={0.5} />
              <path d={trunkHighlight} stroke="rgba(255,255,255,0.16)" strokeWidth={Math.max(1, 3 * treeProgress)} fill="none" />
              {/* Marques d'écorce (visibles à partir de 0.30) */}
              {treeProgress > 0.25 && (() => {
                const knotFade = Math.min(1, (treeProgress - 0.25) / 0.15)
                return (
                  <g style={{ opacity: knotFade }}>
                    <ellipse cx={-baseW * 0.45} cy={-trunkH * 0.22} rx={3.5} ry={6} fill="#1F1410" opacity={0.6} />
                    <ellipse cx={baseW * 0.45} cy={-trunkH * 0.55} rx={3} ry={5} fill="#1F1410" opacity={0.55} />
                    <ellipse cx={-baseW * 0.4} cy={-trunkH * 0.78} rx={2.5} ry={4} fill="#1F1410" opacity={0.5} />
                  </g>
                )
              })()}
              {/* Petites racines apparentes au sol (à partir de 0.40) */}
              {treeProgress > 0.40 && (() => {
                const rFade = Math.min(1, (treeProgress - 0.40) / 0.15)
                return (
                  <g style={{ opacity: rFade }}>
                    <path d={`M ${-baseW} 0 Q ${-baseW - 14} 1 ${-baseW - 22} 4`} stroke="#3D2418" strokeWidth={5} fill="none" strokeLinecap="round" />
                    <path d={`M ${baseW} 0 Q ${baseW + 14} 1 ${baseW + 22} 4`} stroke="#3D2418" strokeWidth={5} fill="none" strokeLinecap="round" />
                    <path d={`M ${-baseW * 0.5} 0 Q ${-baseW * 0.5} 3 ${-baseW * 0.7} 5`} stroke="#3D2418" strokeWidth={3} fill="none" strokeLinecap="round" />
                    <path d={`M ${baseW * 0.5} 0 Q ${baseW * 0.5} 3 ${baseW * 0.7} 5`} stroke="#3D2418" strokeWidth={3} fill="none" strokeLinecap="round" />
                  </g>
                )
              })()}
            </g>
          )
        })()}

        {/* === BRANCHES === Apparition progressive avec un effet "grow" :
            chaque branche démarre à un scale réduit et grandit à mesure que treeProgress
            augmente. La plage de fade est large (0.18) pour des transitions douces. */}
        <g stroke="#3D2C20" strokeLinecap="round" fill="none">
          {HERO_BRANCHES.map((b, i) => {
            const fadeT = Math.max(0, Math.min(1, (treeProgress - b.threshold) / 0.18))
            if (fadeT <= 0) return null
            // Effet de croissance : la branche grandit depuis 0.4× à 1×
            const growScale = 0.4 + fadeT * 0.6
            // Origin approximative au point d'attache (variable selon la branche)
            const originY = -200 - i * 80
            return (
              <g key={`branch-${i}`}
                 style={{
                   opacity: fadeT,
                   transform: `scale(${growScale})`,
                   transformOrigin: `0px ${originY}px`,
                 }}>
                <path d={b.thickPath} strokeWidth={22} />
                <path d={b.innerPath} strokeWidth={14} stroke="#5A4031" />
                {(b.subPaths ?? []).map((sp, j) => (
                  <path key={`sb-${j}`} d={sp} strokeWidth={9} />
                ))}
              </g>
            )
          })}
        </g>

        {/* === FEUILLAGE === Apparition progressive avec scale + fade.
            Plage de fade très large (0.22) pour que ça se densifie petit à petit. */}
        <g>
          {HERO_FOLIAGE.map((cluster, i) => {
            const fadeT = Math.max(0, Math.min(1, (treeProgress - cluster.threshold) / 0.22))
            if (fadeT <= 0) return null
            const growScale = 0.45 + fadeT * 0.55
            const originX = cluster.back[0]?.cx ?? 0
            const originY = cluster.back[0]?.cy ?? 0
            return (
              <g key={`fol-${i}`}
                 style={{
                   opacity: fadeT,
                   transform: `scale(${growScale})`,
                   transformOrigin: `${originX}px ${originY}px`,
                 }}>
                {cluster.back.map((e, j) => (
                  <ellipse key={`b-${j}`} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill={e.fill} />
                ))}
                {cluster.mid.map((e, j) => (
                  <ellipse key={`m-${j}`} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="url(#foliageMid)" />
                ))}
                {cluster.front.map((e, j) => (
                  <ellipse key={`f-${j}`} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="url(#foliageFront)" />
                ))}
              </g>
            )
          })}
        </g>

        {/* === Petites feuilles décoratives entre les branches (mature) === */}
        {treeProgress > 0.20 && (() => {
          const lFade = Math.min(1, (treeProgress - 0.20) / 0.15)
          return (
            <g style={{ opacity: lFade }}>
              <ellipse cx={-280} cy={-260} rx={5} ry={3} fill="#7AA56B" transform="rotate(-30 -280 -260)" />
              <ellipse cx={-320} cy={-170} rx={4} ry={2.5} fill="#5E8954" transform="rotate(15 -320 -170)" />
              <ellipse cx={290} cy={-300} rx={5} ry={3} fill="#7AA56B" transform="rotate(40 290 -300)" />
              <ellipse cx={350} cy={-200} rx={4} ry={2.5} fill="#5E8954" transform="rotate(-20 350 -200)" />
              {treeProgress > 0.45 && (
                <>
                  <ellipse cx={-230} cy={-440} rx={5} ry={3} fill="#A8C088" transform="rotate(-25 -230 -440)" />
                  <ellipse cx={250} cy={-490} rx={5} ry={3} fill="#A8C088" transform="rotate(35 250 -490)" />
                  <ellipse cx={-100} cy={-600} rx={5} ry={3} fill="#7AA56B" transform="rotate(-15 -100 -600)" />
                  <ellipse cx={130} cy={-580} rx={5} ry={3} fill="#7AA56B" transform="rotate(20 130 -580)" />
                </>
              )}
            </g>
          )
        })()}

        {forceFull && (
          <g>
            <circle cx={0} cy={-470} r={26} fill="#FFE5DD" opacity={0.6} />
            <ellipse cx={-6} cy={-476} rx={6} ry={4.5} fill="#F4B5C9" />
            <ellipse cx={6}  cy={-476} rx={6} ry={4.5} fill="#F4B5C9" />
            <ellipse cx={-6} cy={-466} rx={6} ry={4.5} fill="#F4B5C9" />
            <ellipse cx={6}  cy={-466} rx={6} ry={4.5} fill="#F4B5C9" />
            <circle cx={0} cy={-471} r={3} fill="#FBD56B" />
          </g>
        )}
      </g>

      {/* ÉLÉMENTS FOREGROUND (fleurs, animaux, papillons, etc.) APRÈS l'arbre */}
      {unlocked.filter(e => e.kind !== 'pond' && e.kind !== 'log' && e.kind !== 'sapling' && e.kind !== 'deer').map(renderEl)}

      {/* PARTICULES dorées (burst à la notation focus). Optionnel — uniquement
          rendu si particleBurst est passé (focus). Animations CSS via classes
          focus-particle-burst et focus-particle (cf. focus-styles.css). */}
      {particleBurst && (() => {
        const px = particleBurst.x ?? 800
        const py = particleBurst.y ?? 500
        const angles = [0, 45, 90, 135, 180, 225, 270, 315]
        return (
          <g key={`burst-${particleBurst.ts}`} className="focus-particle-burst">
            {angles.map((a, i) => {
              const rad = (a * Math.PI) / 180
              const dx = Math.cos(rad) * 38
              const dy = Math.sin(rad) * 38
              return (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={4}
                  fill="#FBD56B"
                  className="focus-particle"
                  style={{
                    animationDelay: `${i * 25}ms`,
                    ['--px-dx' as string]: `${dx}px`,
                    ['--px-dy' as string]: `${dy}px`,
                  } as CSSProperties}
                />
              )
            })}
          </g>
        )
      })()}

      {/* Arc du soleil (trace pointillée) */}
      <g>
        <path d="M0 70 Q400 100 800 80 Q1200 60 1600 75" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round" fill="none" strokeDasharray="2 6" />
      </g>
    </svg>
  )
}
