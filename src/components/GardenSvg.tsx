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
        const c = FLOWER_COLORS[el.variant ?? 'red']
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <line x1={0} y1={0} x2={0} y2={-22} stroke="#5E8954" strokeWidth={1.6} />
            <ellipse cx={0} cy={-22} rx={5} ry={3} fill={c} transform="rotate(-30 0 -22)" />
            <ellipse cx={0} cy={-22} rx={5} ry={3} fill={c} transform="rotate(30 0 -22)" />
            <ellipse cx={0} cy={-25} rx={4} ry={2.5} fill={c} />
            <circle cx={0} cy={-23} r={1.6} fill="#FBD56B" />
          </g>
        )
      }
      case 'sunflower': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <line x1={0} y1={0} x2={-6} y2={-32} stroke="#5E8954" strokeWidth={2.2} />
            <line x1={-6} y1={-32} x2={-12} y2={-50} stroke="#5E8954" strokeWidth={1.7} />
            <line x1={-6} y1={-32} x2={0} y2={-48} stroke="#5E8954" strokeWidth={1.7} />
            <line x1={-6} y1={-32} x2={-2} y2={-58} stroke="#5E8954" strokeWidth={1.7} />
            <ellipse cx={-12} cy={-52} rx={6} ry={4} fill="#FBD56B" />
            <ellipse cx={0} cy={-50} rx={6} ry={4} fill="#FBD56B" />
            <ellipse cx={-2} cy={-60} rx={6} ry={4} fill="#FBD56B" />
            <circle cx={-12} cy={-52} r={2} fill="#A8741E" />
            <circle cx={0} cy={-50} r={2} fill="#A8741E" />
            <circle cx={-2} cy={-60} r={2} fill="#A8741E" />
          </g>
        )
      }
      case 'tulip': {
        const c = FLOWER_COLORS[el.variant ?? 'red']
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <line x1={0} y1={0} x2={0} y2={-30} stroke="#5E8954" strokeWidth={2} />
            <line x1={0} y1={-12} x2={-7} y2={-22} stroke="#5E8954" strokeWidth={1.2} />
            <line x1={0} y1={-12} x2={7} y2={-22} stroke="#5E8954" strokeWidth={1.2} />
            <ellipse cx={0} cy={-32} rx={4.5} ry={7} fill={c} />
            <circle cx={0} cy={-30} r={1.4} fill="#FBD56B" />
          </g>
        )
      }
      case 'mushroom': {
        const isRed = el.variant !== 'orange'
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={0} rx={14} ry={10} fill={isRed ? '#C75050' : '#C58040'} />
            <ellipse cx={0} cy={-3} rx={6} ry={2} fill="rgba(255,255,255,0.35)" />
            <ellipse cx={-5} cy={-4} rx={3} ry={2} fill="rgba(255,255,255,0.5)" />
            <rect x={-3} y={-2} width={6} height={10} rx={1.5} fill="#FFFFFF" opacity={0.85} />
          </g>
        )
      }
      case 'butterfly': {
        const [body, wing] = BUTTERFLY_COLORS[el.variant ?? 'amber']
        const flapDelay = (idx % 7) * 50
        return (
          <g key={k} transform={`translate(${el.x} ${el.y}) rotate(-15)`}>
            <g className="focus-butterfly-wings" style={{ animationDelay: `${flapDelay}ms` }}>
              <ellipse cx={-7} cy={-2} rx={9} ry={6} fill={body} opacity={0.95} />
              <ellipse cx={7}  cy={-2} rx={9} ry={6} fill={body} opacity={0.95} />
              <ellipse cx={-6} cy={-3} rx={4} ry={2} fill={wing} />
              <ellipse cx={6}  cy={-3} rx={4} ry={2} fill={wing} />
            </g>
            <line x1={0} y1={-4} x2={0} y2={4} stroke="#3D2C20" strokeWidth={1.5} />
          </g>
        )
      }
      case 'rabbit': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={14} rx={22} ry={5} fill="rgba(0,0,0,0.18)" />
            <ellipse cx={0} cy={0}  rx={18} ry={14} fill="#D8C4A8" />
            <ellipse cx={-3} cy={-2} rx={12} ry={9} fill="#E8D4B8" />
            <ellipse cx={14} cy={-3} rx={9} ry={7} fill="#D8C4A8" />
            <ellipse cx={11} cy={-4} rx={5} ry={4} fill="#E8D4B8" />
            <ellipse cx={-12} cy={-12} rx={4} ry={9} fill="#D8C4A8" />
            <ellipse cx={-6}  cy={-13} rx={4} ry={9} fill="#D8C4A8" />
            <ellipse cx={-12} cy={-14} rx={2} ry={6} fill="#F0DCC0" />
            <ellipse cx={-6}  cy={-15} rx={2} ry={6} fill="#F0DCC0" />
            <circle cx={14} cy={-5} r={1.5} fill="#1A1A0F" />
            <circle cx={14} cy={-5} r={0.5} fill="white" />
            <ellipse cx={18} cy={-1} rx={1.5} ry={1} fill="#C75050" />
            <path d="M-18 8 Q-22 6 -23 10 Q-20 12 -16 10" fill="#D8C4A8" />
          </g>
        )
      }
      case 'squirrel': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={0} rx={14} ry={8} fill="#7C5A3A" />
            <ellipse cx={-3} cy={-1} rx={9} ry={6} fill="#9C7B5A" />
            <ellipse cx={-7} cy={0} rx={6} ry={6} fill="#7C5A3A" />
            <ellipse cx={-9} cy={-1} rx={2.5} ry={2.5} fill="#9C7B5A" />
            <circle cx={-9} cy={-2} r={0.8} fill="#1A1A0F" />
            <ellipse cx={-9} cy={0} rx={0.7} ry={0.5} fill="#1A1A0F" />
            <path d="M-7 -3 L-9 -7 M-5 -3 L-6 -7" stroke="#7C5A3A" strokeWidth={1.2} fill="none" />
            <path d="M12 -2 Q22 -10 26 0 Q20 0 12 1 Z" fill="#9C7B5A" />
            <path d="M14 -1 Q20 -7 24 -1" stroke="#7C5A3A" strokeWidth={0.8} fill="none" />
          </g>
        )
      }
      case 'owl': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={0} rx={20} ry={10} fill="#3D2C20" />
            <ellipse cx={-3} cy={-2} rx={12} ry={8} fill="#5A4438" />
            <circle cx={-7} cy={-3} r={2} fill="white" />
            <circle cx={-7} cy={-3} r={1} fill="#1A1A0F" />
            <path d="M-12 -3 L-17 -5 L-14 -1 Z" fill="#E08B3C" />
            <path d="M5 -2 Q14 -10 22 -4 Q14 0 5 -1 Z" fill="#5A4438" />
            <path d="M-2 8 L-2 14" stroke="#3D2C20" strokeWidth={1.5} />
            <path d="M2 8 L2 14" stroke="#3D2C20" strokeWidth={1.5} />
          </g>
        )
      }
      case 'deer': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`} opacity={0.95}>
            <ellipse cx={0} cy={6} rx={35} ry={5} fill="rgba(0,0,0,0.22)" />
            <ellipse cx={0} cy={-6} rx={25} ry={14} fill="#A8755A" />
            <ellipse cx={-2} cy={-8} rx={20} ry={11} fill="#C49080" />
            <path d="M-22 -3 Q-30 0 -28 6 Q-22 6 -20 4" fill="#A8755A" />
            <ellipse cx={22} cy={-12} rx={11} ry={14} fill="#A8755A" />
            <ellipse cx={22} cy={-14} rx={8} ry={10} fill="#C49080" />
            <path d="M22 -25 L18 -38 M22 -25 L26 -38 M22 -25 L19 -36 M22 -25 L25 -36" stroke="#FFFFFF" strokeWidth={1.4} fill="none" strokeLinecap="round" />
            <path d="M19 -38 L17 -42 M26 -38 L28 -42" stroke="#FFFFFF" strokeWidth={1.2} fill="none" strokeLinecap="round" />
            <circle cx={20} cy={-12} r={1.2} fill="#1A1A0F" />
            <ellipse cx={28} cy={-9} rx={1.5} ry={1} fill="#1A1A0F" />
            <line x1={-20} y1={6} x2={-20} y2={14} stroke="#A8755A" strokeWidth={2.5} strokeLinecap="round" />
            <line x1={-12} y1={6} x2={-12} y2={14} stroke="#A8755A" strokeWidth={2.5} strokeLinecap="round" />
            <line x1={12} y1={2} x2={12} y2={14} stroke="#A8755A" strokeWidth={2.5} strokeLinecap="round" />
            <line x1={20} y1={2} x2={20} y2={14} stroke="#A8755A" strokeWidth={2.5} strokeLinecap="round" />
          </g>
        )
      }
      case 'fox': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={6} rx={20} ry={4} fill="rgba(0,0,0,0.2)" />
            <ellipse cx={0} cy={-2} rx={16} ry={9} fill="#C75A2A" />
            <ellipse cx={-3} cy={-3} rx={11} ry={6} fill="#E07840" />
            <path d="M14 -4 L24 -10 L26 -2 L20 0 Z" fill="#C75A2A" />
            <path d="M-14 -3 L-18 -10 L-13 -10 Z" fill="#C75A2A" />
            <path d="M-10 -3 L-14 -8 L-9 -8 Z" fill="#C75A2A" />
            <ellipse cx={20} cy={-6} rx={3} ry={2} fill="#FFFFFF" />
            <circle cx={22} cy={-5} r={0.8} fill="#1A1A0F" />
            <path d="M14 4 Q26 10 32 4 Q34 -6 28 -8 Q22 -2 18 6 Z" fill="#C75A2A" />
            <path d="M28 -6 Q32 -2 30 2" stroke="#FFFFFF" strokeWidth={1} fill="none" />
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
        <radialGradient id="sungod" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFEFB8" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#F8D880" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#F8D880" stopOpacity="0" />
        </radialGradient>
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
        <pattern id="bark" width="10" height="20" patternUnits="userSpaceOnUse">
          <path d="M2 0 Q1 10 3 20 M7 0 Q9 10 6 20" stroke="#1F1410" strokeWidth="0.8" fill="none" opacity="0.6" />
        </pattern>
      </defs>

      {/* CIEL */}
      <rect width="1600" height="1000" fill="url(#sky)" />

      {/* SOLEIL */}
      {isDaytime && (
        <g>
          <circle cx={sunX} cy={sunY} r={240} fill="url(#sungod)" />
          <circle cx={sunX} cy={sunY} r={90}  fill="#FFE5A0" opacity={0.95} />
          <circle cx={sunX} cy={sunY} r={64}  fill="#FDF4D5" />
        </g>
      )}

      {/* LUNE */}
      {isNight && (
        <g>
          <circle cx={moonX} cy={moonY} r={140} fill="#E5E8F0" opacity={0.12} />
          <circle cx={moonX} cy={moonY} r={56}  fill="#F5F2E0" opacity={0.95} />
          <circle cx={moonX} cy={moonY} r={48}  fill="#FFFEF8" />
          <circle cx={moonX - 14} cy={moonY - 8}  r={5} fill="rgba(180,180,200,0.35)" />
          <circle cx={moonX + 10} cy={moonY + 6}  r={6} fill="rgba(180,180,200,0.32)" />
          <circle cx={moonX + 4}  cy={moonY - 14} r={3} fill="rgba(180,180,200,0.28)" />
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

      {/* ARBRE CENTRAL */}
      <g transform={`translate(${HERO_TRUNK_X} ${HERO_GROUND_Y})`}>
        <ellipse cx={0} cy={-8} rx={64} ry={16} fill="rgba(0,0,0,0.22)" />

        <g style={{
          transform: `scale(${0.15 + treeProgress * 0.85})`,
          transformOrigin: '0px 0px',
        }}>
          <path d="M -22 0 Q -26 -90 -18 -180 Q -12 -270 -10 -360 Q -8 -420 -6 -460 L 6 -460 Q 8 -420 10 -360 Q 12 -270 18 -180 Q 26 -90 22 0 Z" fill="url(#trunkbody)" />
          <path d="M -22 0 Q -26 -90 -18 -180 Q -12 -270 -10 -360 Q -8 -420 -6 -460 L 6 -460 Q 8 -420 10 -360 Q 12 -270 18 -180 Q 26 -90 22 0 Z" fill="url(#bark)" opacity={0.55} />
          <path d="M -14 -30 Q -18 -130 -12 -240 Q -8 -340 -7 -420" stroke="rgba(255,255,255,0.16)" strokeWidth={3} fill="none" />
          <ellipse cx={-9}  cy={-110} rx={6} ry={9} fill="#1F1410" opacity={0.65} />
          <ellipse cx={11}  cy={-220} rx={5} ry={7} fill="#1F1410" opacity={0.6} />
          <ellipse cx={-12} cy={-330} rx={4} ry={6} fill="#1F1410" opacity={0.55} />
        </g>

        <g stroke="#3D2C20" strokeLinecap="round" fill="none">
          {HERO_BRANCHES.map((b, i) => {
            if (treeProgress < b.threshold) return null
            const fadeT = Math.max(0, Math.min(1, (treeProgress - b.threshold) / 0.06))
            return (
              <g key={`branch-${i}`} style={{ opacity: fadeT }}>
                <path d={b.thickPath} strokeWidth={22} />
                <path d={b.innerPath} strokeWidth={14} stroke="#5A4031" />
                {(b.subPaths ?? []).map((sp, j) => (
                  <path key={`sb-${j}`} d={sp} strokeWidth={9} />
                ))}
              </g>
            )
          })}
        </g>

        <g>
          {HERO_FOLIAGE.map((cluster, i) => {
            if (treeProgress < cluster.threshold) return null
            const fadeT = Math.max(0, Math.min(1, (treeProgress - cluster.threshold) / 0.08))
            return (
              <g key={`fol-${i}`} style={{ opacity: fadeT }}>
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

      {/* Arc du soleil (trace pointillée) */}
      <g>
        <path d="M0 70 Q400 100 800 80 Q1200 60 1600 75" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round" fill="none" strokeDasharray="2 6" />
      </g>
    </svg>
  )
}
