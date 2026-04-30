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

import { useMemo, type CSSProperties } from 'react'

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

// ============ TEMPLE D'ASCLÉPIOS : 1500 pièces paramétriques ============
// Le temple se construit pierre par pierre sur 1500h cumulées (1 pièce/h).
// Chaque pièce a un seuil `at` (0..1) et une chaîne SVG. Au render, on
// concatène toutes les pièces où treeProgress >= at et on injecte via
// dangerouslySetInnerHTML — bypass de la réconciliation React pour
// supporter 1500 nodes sans coût à chaque tick du cycle jour/nuit.
//
// Ordre de construction :
//   - Fondations (200) : 3 marches × 30 blocs + joints + inscriptions grecques
//   - Colonnes (400)   : 4 col × (24 tambours + chapiteau + lierre + détails)
//   - Architrave (60)  : 8 blocs + regulae + guttae
//   - Frieze (200)     : 9 triglyphes + 8 métopes sculptées (figures)
//   - Corniche (100)   : blocs + mutules + dentils
//   - Statue d'Asclépios (200) : visible entre les colonnes 2 et 3
//   - Pediment (200)   : raking cornice + tympanum + couronne de laurier + méandre grec
//   - Décorations (140): acroteria + guirlandes + oiseaux + pèlerins + fleurs

export const HERO_TRUNK_X = 440
export const HERO_GROUND_Y = 750

// Cible de complétion : 1500h cumulées d'étude (~ 1 année P1 motivée).
// Importé par le focus et le dashboard pour rester cohérent.
export const GARDEN_TIME_TO_FULL_MS = 1500 * 60 * 60 * 1000

type TemplePiece = { at: number; svg: string }

const TEMPLE_PIECES: TemplePiece[] = (() => {
  const list: TemplePiece[] = []
  const TOTAL = 1500
  let pi = 0
  const addPc = (svg: string) => { list.push({ at: pi / TOTAL, svg }); pi++ }
  const greekChars = ['Α','Σ','Κ','Λ','Η','Π','Ι','Ο','Ν','Ε','Μ','Τ','Δ','Ρ','Φ','Ω','Γ','Β','Θ','Ψ','Ξ','Χ','Υ','Ζ','Λ','Ν','Ε','Α','Σ','Κ']

  // === FOUNDATION (200) ===
  const stepCfg = [
    { y: -10, x0: -260, w: 520, color: '#B5A380' },
    { y: -22, x0: -250, w: 500, color: '#C9B89A' },
    { y: -34, x0: -240, w: 480, color: '#D4C5A8' },
  ]
  for (let s = 0; s < 3; s++) {
    const cfg = stepCfg[s]
    for (let i = 0; i < 30; i++) {
      const sw = cfg.w / 30 + 1
      const x = cfg.x0 + i * (cfg.w / 30)
      addPc(`<rect x="${x.toFixed(1)}" y="${cfg.y}" width="${sw.toFixed(1)}" height="12" fill="${cfg.color}"/>`)
    }
  }
  for (let s = 0; s < 3; s++) {
    const cfg = stepCfg[s]
    addPc(`<rect x="${cfg.x0}" y="${cfg.y}" width="${cfg.w}" height="12" fill="none" stroke="#5C4A35" stroke-width="2.2"/>`)
  }
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 9; i++) {
      const cfg = stepCfg[s]
      const x = cfg.x0 + (i + 1) * (cfg.w / 10)
      addPc(`<line x1="${x.toFixed(1)}" y1="${cfg.y}" x2="${x.toFixed(1)}" y2="${cfg.y + 12}" stroke="#5C4A35" stroke-width="0.8" opacity="0.7"/>`)
    }
  }
  for (let i = 0; i < 30; i++) {
    const stepIdx = i % 3
    const cfg = stepCfg[stepIdx]
    const x = cfg.x0 + 20 + (Math.floor(i / 3) * 50)
    const y = cfg.y + 8
    addPc(`<text x="${x}" y="${y}" font-size="6" fill="#5C4A35" opacity="0.7" font-family="serif">${greekChars[i]}</text>`)
  }
  for (let i = 0; i < 18; i++) {
    const stepIdx = i % 3
    const cfg = stepCfg[stepIdx]
    const x = cfg.x0 + 30 + (i * 27)
    addPc(`<path d="M ${x.toFixed(1)} ${cfg.y + 1} L ${(x + 2).toFixed(1)} ${cfg.y + 5} L ${x.toFixed(1)} ${cfg.y + 9}" stroke="#5C4A35" stroke-width="0.6" fill="none" opacity="0.6"/>`)
  }
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 4; i++) {
      const cfg = stepCfg[s]
      const x = cfg.x0 + 50 + i * 100
      addPc(`<rect x="${x.toFixed(1)}" y="${cfg.y + 9}" width="40" height="3" fill="#9C8A6A" opacity="0.5"/>`)
    }
  }
  addPc(`<path d="M -260 0 L -255 -2 L -260 -4 Z" fill="#9C8A6A"/>`)
  addPc(`<path d="M 260 -2 L 255 -4 L 260 -6 Z" fill="#9C8A6A"/>`)
  addPc(`<path d="M -250 -10 L -246 -14 L -252 -14 Z" fill="#9C8A6A" opacity="0.7"/>`)
  addPc(`<path d="M 250 -10 L 246 -14 L 252 -14 Z" fill="#9C8A6A" opacity="0.7"/>`)
  addPc(`<rect x="-258" y="-2" width="6" height="2" fill="#9C8A6A" opacity="0.6"/>`)
  addPc(`<rect x="252" y="-2" width="6" height="2" fill="#9C8A6A" opacity="0.6"/>`)
  for (let i = 0; i < 5; i++) {
    const x = -240 + i * 120
    addPc(`<path d="M ${x} 0 Q ${x - 2} -3 ${x - 1} -5 M ${x} 0 Q ${x} -4 ${x} -6 M ${x} 0 Q ${x + 2} -3 ${x + 1} -5" stroke="#5E8954" stroke-width="0.8" fill="none" stroke-linecap="round"/>`)
  }
  for (let i = 0; i < 14; i++) {
    const x = -250 + i * 36
    addPc(`<circle cx="${x}" cy="3" r="1.5" fill="#F4B5C9" stroke="#A85040" stroke-width="0.4"/>`)
  }

  // === COLONNES (400, 100/col) ===
  const colXs = [-153, -51, 51, 153]
  for (let c = 0; c < 4; c++) {
    const cx = colXs[c]
    for (let d = 0; d < 24; d++) {
      const yt = -34 - (d + 1) * 9
      const yb = -34 - d * 9
      addPc(`<path d="M ${cx - 17} ${yt} Q ${cx - 18} ${yt + 4.5} ${cx - 17} ${yb} L ${cx + 17} ${yb} Q ${cx + 18} ${yt + 4.5} ${cx + 17} ${yt} Z" fill="#D4C5A8"/>`)
    }
    for (let j = 0; j < 23; j++) {
      const y = -43 - j * 9
      addPc(`<line x1="${cx - 15}" y1="${y}" x2="${cx + 15}" y2="${y}" stroke="#5C4A35" stroke-width="0.5" opacity="0.35"/>`)
    }
    addPc(`<path d="M ${cx + 5} -34 Q ${cx + 5} -150 ${cx + 5} -250 L ${cx + 17} -250 Q ${cx + 18} -150 ${cx + 17} -34 Z" fill="#B5A380" opacity="0.55"/>`)
    addPc(`<path d="M ${cx - 17} -34 Q ${cx - 19} -90 ${cx - 17} -150 Q ${cx - 16} -210 ${cx - 16} -250 L ${cx + 16} -250 Q ${cx + 16} -210 ${cx + 17} -150 Q ${cx + 19} -90 ${cx + 17} -34 Z" fill="none" stroke="#5C4A35" stroke-width="2"/>`)
    for (let f = 0; f < 6; f++) {
      const fx = cx - 13 + f * 5
      addPc(`<line x1="${fx}" y1="-244" x2="${fx}" y2="-44" stroke="#5C4A35" stroke-width="0.8" opacity="0.55"/>`)
    }
    addPc(`<line x1="${cx - 17}" y1="-250" x2="${cx + 17}" y2="-250" stroke="#5C4A35" stroke-width="1.3"/>`)
    addPc(`<line x1="${cx - 17}" y1="-254" x2="${cx + 17}" y2="-254" stroke="#5C4A35" stroke-width="1.3"/>`)
    addPc(`<path d="M ${cx - 20} -256 Q ${cx - 25} -266 ${cx - 17} -272 L ${cx + 17} -272 Q ${cx + 25} -266 ${cx + 20} -256 Z" fill="#D4C5A8" stroke="#5C4A35" stroke-width="2"/>`)
    addPc(`<rect x="${cx - 25}" y="-282" width="50" height="10" fill="#D4C5A8" stroke="#5C4A35" stroke-width="2"/>`)
    addPc(`<rect x="${cx + 14}" y="-282" width="11" height="10" fill="#B5A380" opacity="0.5"/>`)
    addPc(`<line x1="${cx - 25}" y1="-272" x2="${cx + 25}" y2="-272" stroke="#5C4A35" stroke-width="0.6" opacity="0.5"/>`)
    addPc(`<line x1="${cx - 23}" y1="-282" x2="${cx + 23}" y2="-282" stroke="#5C4A35" stroke-width="0.5" opacity="0.4"/>`)
    addPc(`<line x1="${cx - 25}" y1="-280" x2="${cx + 25}" y2="-280" stroke="#5C4A35" stroke-width="0.5" opacity="0.3"/>`)
    const leafSide = (c < 2) ? -1 : 1
    for (let l = 0; l < 12; l++) {
      const ly = -50 - l * 16
      const lx = cx + leafSide * (16 + (l % 3) * 2)
      addPc(`<ellipse cx="${lx.toFixed(1)}" cy="${ly}" rx="3.5" ry="2.5" fill="#5E8954" stroke="#3F5E4A" stroke-width="0.5"/>`)
    }
    for (let i = 0; i < 10; i++) {
      const y = -60 - i * 18
      addPc(`<text x="${cx - 4}" y="${y}" font-size="5" fill="#5C4A35" opacity="0.75" font-family="serif">${greekChars[(c * 7 + i) % greekChars.length]}</text>`)
    }
    for (let fl = 0; fl < 8; fl++) {
      const ly = -55 - fl * 23 - (fl % 2) * 7
      const lx = cx + leafSide * (14 + (fl % 3))
      addPc(`<circle cx="${lx.toFixed(1)}" cy="${ly}" r="2" fill="#F4B5C9" stroke="#A85040" stroke-width="0.4"/>`)
    }
    for (let w = 0; w < 10; w++) {
      const y = -50 - w * 19
      const xOff = (w % 3 - 1) * 8
      addPc(`<path d="M ${cx + xOff} ${y} L ${cx + xOff + 1} ${y - 4} L ${cx + xOff - 1} ${y - 8}" stroke="#9C8A6A" stroke-width="0.5" fill="none" opacity="0.6"/>`)
    }
  }

  // === ARCHITRAVE (60) ===
  for (let i = 0; i < 8; i++) addPc(`<rect x="${-220 + i * 55}" y="-312" width="56" height="30" fill="#D4C5A8"/>`)
  addPc(`<rect x="-220" y="-312" width="440" height="30" fill="none" stroke="#5C4A35" stroke-width="2.2"/>`)
  for (let i = 0; i < 7; i++) {
    const x = -165 + i * 55
    addPc(`<line x1="${x}" y1="-312" x2="${x}" y2="-282" stroke="#5C4A35" stroke-width="0.7" opacity="0.55"/>`)
  }
  for (let i = 0; i < 9; i++) addPc(`<rect x="${-198 + i * 49.5}" y="-285" width="12" height="3" fill="#B5A380"/>`)
  const reguXs = [-194, -153, -102, -51, 0, 51, 102, 153, 194]
  for (let i = 0; i < 9; i++) {
    for (let g = 0; g < 3; g++) {
      addPc(`<circle cx="${reguXs[i] - 4 + g * 4}" cy="-281" r="1" fill="#9C8A6A"/>`)
    }
  }
  for (let i = 0; i < 9; i++) {
    addPc(`<text x="${-200 + i * 50}" y="-295" font-size="6" fill="#5C4A35" opacity="0.75" font-family="serif">${greekChars[i]}</text>`)
  }

  // === FRIEZE (200) ===
  addPc(`<rect x="-220" y="-344" width="440" height="32" fill="#C9B89A"/>`)
  addPc(`<rect x="-220" y="-344" width="440" height="32" fill="none" stroke="#5C4A35" stroke-width="2.2"/>`)
  const triXs = [-194, -153, -102, -51, 0, 51, 102, 153, 194]
  for (let t = 0; t < 9; t++) {
    const x = triXs[t] - 6
    addPc(`<rect x="${x}" y="-343" width="12" height="30" fill="#D4C5A8" stroke="#5C4A35" stroke-width="1.3"/>`)
  }
  for (let t = 0; t < 9; t++) {
    const x = triXs[t] - 6
    addPc(`<line x1="${x + 2}" y1="-341" x2="${x + 2}" y2="-315" stroke="#5C4A35" stroke-width="0.8"/>`)
    addPc(`<line x1="${x + 6}" y1="-341" x2="${x + 6}" y2="-315" stroke="#5C4A35" stroke-width="0.8"/>`)
    addPc(`<line x1="${x + 10}" y1="-341" x2="${x + 10}" y2="-315" stroke="#5C4A35" stroke-width="0.8"/>`)
  }
  const metXs = [-128, -76, -26, 26, 76, 128, -176, 176]
  for (let m = 0; m < 8; m++) {
    const mx = metXs[m]
    addPc(`<ellipse cx="${mx}" cy="-324" rx="3" ry="4" fill="#9C7A4F"/>`)
    addPc(`<rect x="${mx - 2.5}" y="-322" width="5" height="8" fill="#9C7A4F"/>`)
    addPc(`<rect x="${mx - 4}" y="-321" width="2" height="6" fill="#9C7A4F"/>`)
    addPc(`<rect x="${mx + 2}" y="-321" width="2" height="6" fill="#9C7A4F"/>`)
    addPc(`<line x1="${mx + 5}" y1="-330" x2="${mx + 5}" y2="-315" stroke="#5C4A35" stroke-width="0.8"/>`)
    addPc(`<circle cx="${mx - 1}" cy="-326" r="0.5" fill="#3D2818"/>`)
    addPc(`<circle cx="${mx + 1}" cy="-326" r="0.5" fill="#3D2818"/>`)
    addPc(`<rect x="${mx - 3}" y="-315" width="6" height="1.5" fill="#9C7A4F"/>`)
    addPc(`<circle cx="${mx}" cy="-329" r="3.5" fill="none" stroke="#9C8A6A" stroke-width="0.4" opacity="0.5"/>`)
    addPc(`<rect x="${mx - 9}" y="-340" width="18" height="24" fill="none" stroke="#5C4A35" stroke-width="0.5" opacity="0.4"/>`)
  }
  for (let i = 0; i < 9; i++) {
    addPc(`<line x1="-218" y1="${-340 + i * 3.5}" x2="218" y2="${-340 + i * 3.5}" stroke="#B5A380" stroke-width="0.4" opacity="0.4"/>`)
  }
  for (let i = 0; i < 9; i++) {
    const x = -198 + i * 49.5
    addPc(`<text x="${x}" y="-330" font-size="4" fill="#5C4A35" opacity="0.6" font-family="serif">${greekChars[i]}${greekChars[(i + 5) % greekChars.length]}</text>`)
  }
  for (let i = 0; i < 8; i++) {
    addPc(`<line x1="${metXs[i] - 8}" y1="-336" x2="${metXs[i] + 8}" y2="-336" stroke="#5C4A35" stroke-width="0.5" opacity="0.6"/>`)
  }
  for (let m = 0; m < 8; m++) {
    const mx = metXs[m]
    addPc(`<line x1="${mx - 7}" y1="-318" x2="${mx + 7}" y2="-318" stroke="#5C4A35" stroke-width="0.4" opacity="0.5"/>`)
    if (m < 7) {
      addPc(`<line x1="${mx - 5}" y1="-340" x2="${mx + 5}" y2="-340" stroke="#5C4A35" stroke-width="0.4" opacity="0.4"/>`)
      addPc(`<line x1="${mx - 7}" y1="-321" x2="${mx + 7}" y2="-321" stroke="#5C4A35" stroke-width="0.3" opacity="0.4"/>`)
    }
  }

  // === CORNICHE (100) ===
  for (let i = 0; i < 9; i++) addPc(`<rect x="${-230 + i * 51}" y="-354" width="52" height="10" fill="#D4C5A8"/>`)
  addPc(`<rect x="-230" y="-354" width="460" height="10" fill="none" stroke="#5C4A35" stroke-width="2.2"/>`)
  for (let i = 0; i < 9; i++) addPc(`<rect x="${triXs[i] - 7}" y="-348" width="14" height="4" fill="#C9B89A" stroke="#5C4A35" stroke-width="0.8"/>`)
  for (let i = 0; i < 9; i++) {
    for (let g = 0; g < 6; g++) {
      addPc(`<circle cx="${triXs[i] - 5 + g * 2}" cy="-343" r="0.9" fill="#9C8A6A"/>`)
    }
  }
  for (let i = 0; i < 24; i++) addPc(`<rect x="${-220 + i * 18}" y="-358" width="8" height="4" fill="#D4C5A8" stroke="#5C4A35" stroke-width="0.4"/>`)

  // === STATUE D'ASCLÉPIOS (200) ===
  addPc(`<rect x="-25" y="-46" width="50" height="12" fill="#B5A380" stroke="#5C4A35" stroke-width="1.3"/>`)
  addPc(`<rect x="-22" y="-58" width="44" height="12" fill="#C9B89A" stroke="#5C4A35" stroke-width="1.3"/>`)
  addPc(`<rect x="-19" y="-70" width="38" height="12" fill="#D4C5A8" stroke="#5C4A35" stroke-width="1.3"/>`)
  addPc(`<rect x="-25" y="-46" width="50" height="3" fill="#9C8A6A" opacity="0.55"/>`)
  for (let i = 0; i < 12; i++) {
    const x = -22 + i * 4
    addPc(`<text x="${x}" y="-50" font-size="3" fill="#5C4A35" opacity="0.8" font-family="serif">${greekChars[i]}</text>`)
  }
  addPc(`<path d="M -10 -70 Q -14 -100 -12 -130 Q -10 -150 -8 -160 L 8 -160 Q 10 -150 12 -130 Q 14 -100 10 -70 Z" fill="#E8DDC5" stroke="#5C4A35" stroke-width="1.2"/>`)
  addPc(`<path d="M -10 -70 Q -14 -100 -12 -130 L -8 -130 Q -10 -100 -8 -70 Z" fill="#C9B89A"/>`)
  addPc(`<path d="M -8 -90 L 8 -90" stroke="#9C8A6A" stroke-width="0.6" opacity="0.6"/>`)
  addPc(`<path d="M -10 -110 L 10 -110" stroke="#9C8A6A" stroke-width="0.6" opacity="0.6"/>`)
  addPc(`<path d="M -11 -125 L 11 -125" stroke="#9C8A6A" stroke-width="0.6" opacity="0.6"/>`)
  addPc(`<path d="M -12 -140 L 12 -140" stroke="#9C8A6A" stroke-width="0.6" opacity="0.6"/>`)
  addPc(`<path d="M -8 -160 Q -10 -175 -7 -185 L 7 -185 Q 10 -175 8 -160 Z" fill="#E8DDC5" stroke="#5C4A35" stroke-width="1.2"/>`)
  addPc(`<path d="M -8 -160 Q -10 -175 -7 -185 L -3 -185 Q -5 -175 -4 -160 Z" fill="#C9B89A"/>`)
  addPc(`<line x1="-7" y1="-170" x2="7" y2="-170" stroke="#9C8A6A" stroke-width="0.5" opacity="0.6"/>`)
  addPc(`<line x1="-7" y1="-180" x2="7" y2="-180" stroke="#9C8A6A" stroke-width="0.5" opacity="0.6"/>`)
  addPc(`<rect x="-12" y="-180" width="3" height="20" fill="#E8DDC5" stroke="#5C4A35" stroke-width="0.8"/>`)
  addPc(`<rect x="9" y="-180" width="3" height="20" fill="#E8DDC5" stroke="#5C4A35" stroke-width="0.8"/>`)
  addPc(`<line x1="-10.5" y1="-170" x2="-10.5" y2="-162" stroke="#9C8A6A" stroke-width="0.4"/>`)
  addPc(`<line x1="10.5" y1="-170" x2="10.5" y2="-162" stroke="#9C8A6A" stroke-width="0.4"/>`)
  addPc(`<ellipse cx="0" cy="-192" rx="6" ry="7" fill="#E8DDC5" stroke="#5C4A35" stroke-width="1.2"/>`)
  addPc(`<path d="M -6 -195 Q -6 -202 0 -204 Q 6 -202 6 -195 Q 6 -198 0 -200 Q -6 -198 -6 -195 Z" fill="#9C7A4F" stroke="#5C4A35" stroke-width="0.8"/>`)
  addPc(`<circle cx="-2" cy="-193" r="0.8" fill="#3D2818"/>`)
  addPc(`<circle cx="2" cy="-193" r="0.8" fill="#3D2818"/>`)
  addPc(`<path d="M -2 -188 Q 0 -187 2 -188" stroke="#3D2818" stroke-width="0.5" fill="none"/>`)
  addPc(`<path d="M -3 -190 L -2.5 -190.5 M 3 -190 L 2.5 -190.5" stroke="#3D2818" stroke-width="0.4"/>`)
  addPc(`<ellipse cx="0" cy="-190" rx="0.5" ry="0.8" fill="#3D2818" opacity="0.5"/>`)
  addPc(`<path d="M -5 -200 Q 0 -202 5 -200" stroke="#9C7A4F" stroke-width="0.4" fill="none"/>`)
  addPc(`<line x1="14" y1="-160" x2="14" y2="-200" stroke="#7A5A3E" stroke-width="2"/>`)
  addPc(`<line x1="14" y1="-200" x2="14" y2="-205" stroke="#9C7A4F" stroke-width="2"/>`)
  addPc(`<circle cx="14" cy="-205" r="2" fill="#7A5A3E" stroke="#5C4A35" stroke-width="0.5"/>`)
  addPc(`<line x1="14" y1="-160" x2="14" y2="-155" stroke="#5C4A35" stroke-width="2"/>`)
  addPc(`<line x1="13" y1="-180" x2="15" y2="-180" stroke="#5C4A35" stroke-width="0.5"/>`)
  addPc(`<line x1="13" y1="-170" x2="15" y2="-170" stroke="#5C4A35" stroke-width="0.5"/>`)
  addPc(`<line x1="13" y1="-190" x2="15" y2="-190" stroke="#5C4A35" stroke-width="0.5"/>`)
  for (let i = 0; i < 6; i++) {
    const yy = -165 - i * 7
    const sign = i % 2 === 0 ? -1 : 1
    addPc(`<path d="M ${14 + sign * 3} ${yy} Q ${14 - sign * 3} ${yy - 3.5} ${14 + sign * 3} ${yy - 7}" stroke="#5E8954" stroke-width="1.3" fill="none" stroke-linecap="round"/>`)
  }
  addPc(`<ellipse cx="11.5" cy="-208" rx="2" ry="1.2" fill="#5E8954" stroke="#3F5E4A" stroke-width="0.4"/>`)
  addPc(`<circle cx="11" cy="-208.5" r="0.4" fill="#3D2818"/>`)
  addPc(`<line x1="10" y1="-208" x2="9" y2="-207.5" stroke="#C75050" stroke-width="0.3"/>`)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * 2 * Math.PI
    const x1 = Math.cos(angle) * 9
    const y1 = -192 + Math.sin(angle) * 9
    const x2 = Math.cos(angle) * 12
    const y2 = -192 + Math.sin(angle) * 12
    addPc(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#FFE598" stroke-width="0.8" opacity="0.7"/>`)
  }
  for (let i = 0; i < 16; i++) {
    const x = -22 + (i * 3)
    addPc(`<circle cx="${x.toFixed(1)}" cy="-48" r="1" fill="#5E8954" opacity="0.85"/>`)
  }
  for (let i = 0; i < 16; i++) {
    const x = -10 + (i % 4) * 7
    const y = -75 - Math.floor(i / 4) * 18
    addPc(`<line x1="${x}" y1="${y}" x2="${x + 5}" y2="${y - 1}" stroke="#9C8A6A" stroke-width="0.3" opacity="0.6"/>`)
  }
  for (let i = 0; i < 8; i++) {
    const x = -22 + i * 6
    addPc(`<circle cx="${x}" cy="-48" r="0.7" fill="#F4B5C9" stroke="#A85040" stroke-width="0.3"/>`)
  }
  for (let i = 0; i < 16; i++) {
    const x = -10 + (i % 5) * 5
    const y = -100 - Math.floor(i / 5) * 30
    addPc(`<line x1="${x}" y1="${y}" x2="${x + 3}" y2="${y + 1}" stroke="#9C8A6A" stroke-width="0.3" opacity="0.6"/>`)
  }
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI - Math.PI / 2
    const x1 = Math.cos(angle) * 13
    const y1 = -192 + Math.sin(angle) * 13
    const x2 = Math.cos(angle) * 16
    const y2 = -192 + Math.sin(angle) * 16
    addPc(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#FFE598" stroke-width="0.5" opacity="0.5"/>`)
  }
  for (let i = 0; i < 24; i++) {
    const stepIdx = i % 3
    const yPed = stepIdx === 0 ? -45 : stepIdx === 1 ? -57 : -69
    const x = -22 + (Math.floor(i / 3) * 6)
    addPc(`<ellipse cx="${x}" cy="${yPed}" rx="1.3" ry="0.5" fill="#F4B5C9" opacity="0.85"/>`)
  }

  // === PEDIMENT (200) ===
  addPc(`<path d="M -218 -358 L 0 -432 L 218 -358 Z" fill="#B5A380"/>`)
  addPc(`<path d="M -230 -354 L 0 -442 L 230 -354 Z" fill="#D4C5A8"/>`)
  addPc(`<path d="M -218 -358 L 0 -432 L 218 -358 Z" fill="#9C8A6A" opacity="0.5"/>`)
  addPc(`<path d="M -230 -354 L 0 -442 L 230 -354 Z" fill="none" stroke="#5C4A35" stroke-width="2.2" stroke-linejoin="round"/>`)
  for (let i = 0; i < 12; i++) {
    const t = i / 12
    const x1 = -230 + t * 230
    const y1 = -354 - t * 90
    addPc(`<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${(x1 + 19).toFixed(1)} ${(y1 - 7.5).toFixed(1)} L ${(x1 + 19).toFixed(1)} ${(y1 - 2).toFixed(1)} L ${x1.toFixed(1)} ${(y1 + 5).toFixed(1)} Z" fill="#D4C5A8"/>`)
  }
  for (let i = 0; i < 12; i++) {
    const t = i / 12
    const x1 = 230 - t * 230
    const y1 = -354 - t * 90
    addPc(`<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${(x1 - 19).toFixed(1)} ${(y1 - 7.5).toFixed(1)} L ${(x1 - 19).toFixed(1)} ${(y1 - 2).toFixed(1)} L ${x1.toFixed(1)} ${(y1 + 5).toFixed(1)} Z" fill="#D4C5A8"/>`)
  }
  for (let i = 0; i < 8; i++) {
    const t = (i + 1) / 12
    const xL = -230 + t * 230
    const yL = -354 - t * 90
    addPc(`<line x1="${xL.toFixed(1)}" y1="${yL.toFixed(1)}" x2="${(xL + 19).toFixed(1)}" y2="${(yL - 7).toFixed(1)}" stroke="#5C4A35" stroke-width="0.5" opacity="0.6"/>`)
  }
  // Asclepius + partner figures (16)
  addPc(`<ellipse cx="-50" cy="-385" rx="6" ry="8" fill="#9C7A4F"/>`)
  addPc(`<rect x="-54" y="-378" width="8" height="22" fill="#9C7A4F"/>`)
  addPc(`<path d="M -56 -356 L -44 -356 L -42 -358 L -58 -358 Z" fill="#9C7A4F"/>`)
  addPc(`<line x1="-50" y1="-377" x2="-50" y2="-358" stroke="#7A5A3E" stroke-width="0.8"/>`)
  addPc(`<line x1="-46" y1="-377" x2="-46" y2="-358" stroke="#7A5A3E" stroke-width="0.8"/>`)
  addPc(`<circle cx="-52" cy="-388" r="0.8" fill="#3D2818"/>`)
  addPc(`<circle cx="-48" cy="-388" r="0.8" fill="#3D2818"/>`)
  addPc(`<path d="M -54 -383 Q -50 -380 -46 -383" stroke="#3D2818" stroke-width="0.5" fill="none"/>`)
  addPc(`<ellipse cx="50" cy="-385" rx="6" ry="8" fill="#9C7A4F"/>`)
  addPc(`<rect x="46" y="-378" width="8" height="22" fill="#9C7A4F"/>`)
  addPc(`<path d="M 44 -356 L 56 -356 L 58 -358 L 42 -358 Z" fill="#9C7A4F"/>`)
  addPc(`<line x1="50" y1="-377" x2="50" y2="-358" stroke="#7A5A3E" stroke-width="0.8"/>`)
  addPc(`<line x1="54" y1="-377" x2="54" y2="-358" stroke="#7A5A3E" stroke-width="0.8"/>`)
  addPc(`<circle cx="48" cy="-388" r="0.8" fill="#3D2818"/>`)
  addPc(`<circle cx="52" cy="-388" r="0.8" fill="#3D2818"/>`)
  // Laurel branches (40)
  for (let i = 0; i < 20; i++) {
    const t = i / 20
    const x = -150 + t * 50
    const y = -370 - t * 30
    addPc(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3" ry="1.5" fill="#5E8954" opacity="0.85"/>`)
  }
  for (let i = 0; i < 20; i++) {
    const t = i / 20
    const x = 150 - t * 50
    const y = -370 - t * 30
    addPc(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3" ry="1.5" fill="#5E8954" opacity="0.85"/>`)
  }
  // Tympanum bricks (50, formule corrigée)
  const tympH = (y: number) => 218 * (y + 432) / 74
  for (let row = 0; row < 5; row++) {
    const yTop = -372 - row * 14
    const yBottom = yTop + 14
    const halfWidth = Math.min(tympH(yTop), tympH(yBottom)) - 1
    if (halfWidth <= 0) continue
    const numBricks = 10
    const brickW = (2 * halfWidth) / numBricks
    for (let col = 0; col < numBricks; col++) {
      const x = -halfWidth + col * brickW
      addPc(`<rect x="${x.toFixed(1)}" y="${yTop}" width="${(brickW + 0.5).toFixed(1)}" height="14" fill="#A89578" opacity="0.45" stroke="#9C8A6A" stroke-width="0.3"/>`)
    }
  }
  // Pediment frame border (30)
  for (let i = 0; i < 15; i++) {
    const t = i / 15
    const x = -218 + t * 218
    const y = -358 - t * 74
    addPc(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + 5).toFixed(1)}" y2="${(y - 1.5).toFixed(1)}" stroke="#9C8A6A" stroke-width="0.7" opacity="0.6"/>`)
  }
  for (let i = 0; i < 15; i++) {
    const t = i / 15
    const x = 218 - t * 218
    const y = -358 - t * 74
    addPc(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - 5).toFixed(1)}" y2="${(y - 1.5).toFixed(1)}" stroke="#9C8A6A" stroke-width="0.7" opacity="0.6"/>`)
  }
  for (let i = 0; i < 9; i++) {
    const x = -200 + i * 50
    addPc(`<path d="M ${x} -355 L ${x - 3} -362 L ${x} -370 L ${x + 3} -362 Z" fill="#C9B89A" stroke="#5C4A35" stroke-width="0.8"/>`)
  }
  addPc(`<rect x="-3" y="-450" width="6" height="8" fill="#A87858" stroke="#5C4A35" stroke-width="0.8"/>`)
  // Couronne de laurier (10)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 7) * Math.PI - Math.PI
    const cxL = Math.cos(angle) * 20
    const cyL = -395 + Math.sin(angle) * 8
    const rot = (angle + Math.PI / 2) * 180 / Math.PI
    addPc(`<ellipse cx="${cxL.toFixed(1)}" cy="${cyL.toFixed(1)}" rx="4" ry="1.8" fill="#5E8954" stroke="#3F5E4A" stroke-width="0.5" transform="rotate(${rot.toFixed(0)} ${cxL.toFixed(1)} ${cyL.toFixed(1)})"/>`)
  }
  addPc(`<path d="M -8 -390 Q 0 -385 8 -390 L 6 -380 Q 0 -383 -6 -380 Z" fill="#C75050" stroke="#A85040" stroke-width="0.4"/>`)
  addPc(`<circle cx="0" cy="-395" r="3" fill="#FFE598" stroke="#9C8A6A" stroke-width="0.6"/>`)
  // Méandre grec en bas du tympanum (17)
  for (let i = 0; i < 9; i++) {
    const x = -180 + i * 45
    addPc(`<path d="M ${x} -360 L ${x + 4} -360 L ${x + 4} -363 L ${x + 1} -363 L ${x + 1} -362 L ${x + 3} -362 L ${x + 3} -361 L ${x} -361 Z" fill="#9C8A6A" stroke="#5C4A35" stroke-width="0.4" opacity="0.85"/>`)
  }
  for (let i = 0; i < 8; i++) {
    const x = -160 + i * 45
    addPc(`<circle cx="${x}" cy="-361" r="1.5" fill="#9C8A6A" stroke="#5C4A35" stroke-width="0.4"/>`)
  }

  // === DÉCORATIONS FINALES (140) ===
  for (let i = 0; i < 30; i++) {
    const which = Math.floor(i / 10)
    const idx = i % 10
    const cxA = which === 0 ? -230 : (which === 1 ? 230 : 0)
    const cyA = which === 2 ? -442 : -354
    const angle = (idx / 10) * Math.PI
    const lx = cxA + Math.cos(angle - Math.PI / 2) * 10
    const ly = cyA + Math.sin(angle - Math.PI / 2) * 12
    addPc(`<line x1="${cxA}" y1="${cyA}" x2="${lx.toFixed(1)}" y2="${ly.toFixed(1)}" stroke="#5C4A35" stroke-width="1.4" stroke-linecap="round" opacity="0.85"/>`)
  }
  for (let g = 0; g < 3; g++) {
    const xStart = -153 + g * 102
    const xEnd = xStart + 102
    addPc(`<path d="M ${xStart} -282 Q ${xStart + 51} -274 ${xEnd} -282" stroke="#9C8A6A" stroke-width="1" fill="none"/>`)
    for (let l = 0; l < 7; l++) {
      const t = l / 6
      const x = xStart + t * 102
      const y = -282 + Math.sin(t * Math.PI) * 8
      addPc(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3" ry="2" fill="#5E8954" stroke="#3F5E4A" stroke-width="0.5"/>`)
    }
  }
  const birdSpots = [
    { x: -200, y: -373 }, { x: -150, y: -373 }, { x: -100, y: -373 },
    { x: -50, y: -373 }, { x: 50, y: -373 }, { x: 100, y: -373 },
    { x: 150, y: -373 }, { x: 200, y: -373 },
    { x: -80, y: -460 }, { x: 80, y: -460 }, { x: 0, y: -465 }, { x: -150, y: -455 },
  ]
  for (let i = 0; i < 12; i++) {
    const b = birdSpots[i]
    addPc(`<path d="M ${b.x} ${b.y} Q ${b.x + 3} ${b.y - 2} ${b.x + 6} ${b.y} M ${b.x} ${b.y} Q ${b.x - 1} ${b.y - 1} ${b.x - 3} ${b.y}" stroke="#3D2818" stroke-width="0.7" fill="none" stroke-linecap="round"/>`)
  }
  for (let i = 0; i < 12; i++) {
    const x = -270 + i * 50
    addPc(`<circle cx="${x}" cy="4" r="3" fill="#F4B5C9" stroke="#A85040" stroke-width="0.6"/>`)
  }
  for (let i = 0; i < 6; i++) {
    const x = -250 + i * 90
    const y = -440 + (i % 2) * 8
    addPc(`<ellipse cx="${x}" cy="${y}" rx="14" ry="3" fill="#FFFFFF" opacity="0.55"/>`)
  }
  for (let p = 0; p < 3; p++) {
    const px = -200 + p * 200
    addPc(`<ellipse cx="${px}" cy="-12" rx="3" ry="4" fill="#7A5A3E"/>`)
    addPc(`<rect x="${px - 2.5}" y="-10" width="5" height="10" fill="#9C7A4F"/>`)
    addPc(`<rect x="${px - 3}" y="0" width="6" height="3" fill="#5C4A35"/>`)
    addPc(`<circle cx="${px - 1}" cy="-13" r="0.3" fill="#3D2818"/>`)
    addPc(`<circle cx="${px + 1}" cy="-13" r="0.3" fill="#3D2818"/>`)
  }
  for (let i = 0; i < 24; i++) {
    const x = -260 + i * 22
    addPc(`<path d="M ${x} 4 Q ${x - 1} 1 ${x - 1} -1 M ${x} 4 Q ${x + 1} 1 ${x + 1} -1" stroke="#5E8954" stroke-width="0.6" fill="none"/>`)
  }
  for (let i = 0; i < 14; i++) {
    const x = -200 + (i * 28)
    const y = -50 - (i % 5) * 60
    addPc(`<line x1="${x.toFixed(1)}" y1="${y}" x2="${(x + 10).toFixed(1)}" y2="${y}" stroke="#9C8A6A" stroke-width="0.5" opacity="0.55"/>`)
  }
  const ivyExtraXs = [-153, -51, 51, 153, -153, 153]
  for (let i = 0; i < 6; i++) {
    addPc(`<ellipse cx="${ivyExtraXs[i]}" cy="${-200 - i * 8}" rx="2" ry="1.5" fill="#7AA56B" stroke="#3F5E4A" stroke-width="0.4"/>`)
  }
  for (let i = 0; i < 6; i++) {
    const x = -200 + i * 80
    addPc(`<circle cx="${x}" cy="-32" r="2" fill="#FFE598" stroke="#9C8A6A" stroke-width="0.4"/>`)
  }

  return list
})()


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

  // Nombre de pièces du temple visibles à ce niveau de progression.
  // Floor pour que la valeur ne change qu'aux franchissements de seuil
  // (pas à chaque tick), permettant à useMemo de cacher le HTML.
  const visibleTempleCount = Math.floor(treeProgress * TEMPLE_PIECES.length)
  const templeHtml = useMemo(() => {
    if (visibleTempleCount === 0) return ''
    // Ombre au sol qui apparaît dès la première pierre posée
    let html = '<ellipse cx="0" cy="0" rx="290" ry="14" fill="rgba(0,0,0,0.22)"/>'
    for (let i = 0; i < visibleTempleCount && i < TEMPLE_PIECES.length; i++) {
      html += TEMPLE_PIECES[i].svg
    }
    return html
  }, [visibleTempleCount])

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

      {/* TEMPLE D'ASCLÉPIOS — Construction pierre par pierre sur 1500h cumulées.
          1500 pièces qui apparaissent dans l'ordre de construction réelle :
          fondations → colonnes → architrave → frieze → corniche → statue
          intérieure → pediment → décorations finales.
          Rendu via dangerouslySetInnerHTML pour bypass de la réconciliation
          React (1500 nodes seraient lents à diffuser à chaque tick du cycle
          jour/nuit). Memoization sur visibleTempleCount : on ne reconstruit
          la chaîne SVG que quand un nouveau seuil de pièce est franchi
          (~ toutes les heures de progression, pas tous les 100ms). */}
      <g
        transform={`translate(${HERO_TRUNK_X} ${HERO_GROUND_Y})`}
        dangerouslySetInnerHTML={{ __html: templeHtml }}
      />

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
