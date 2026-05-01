// src/components/BibliothecaSvg.tsx
// Bibliothèque MedRev — vue cumulative annuelle.
// Chaque fiche notée ajoute 1 livre (cap = BIBLIOTHECA_TOTAL_CAPACITY).
// 6 trésors décoratifs se débloquent à des paliers : 100, 300, 600, 900, 1200, 1500 fiches.
//
// Utilisé sur la page Focus (zone hero) ET sur le Dashboard (mini-vue).
// Les livres sont pré-générés à l'import (PRNG seedé pour reproductibilité)
// et rendus via dangerouslySetInnerHTML pour bypass de la réconciliation React
// (1500 livres × ~10 sous-éléments = 15000 nœuds, trop coûteux à diff à chaque
// re-render).

import { useMemo, type CSSProperties } from 'react'

// ============ CONSTANTES EXPORTÉES ============
/** Capacité maximale de la bibliothèque. À ce nombre de fiches, elle est complète. */
export const BIBLIOTHECA_TOTAL_CAPACITY = 1500

/** Cible de complétion : 1500h cumulées (~ 1 année P1, 1 fiche ≈ 1h en moyenne). */
export const BIBLIOTHECA_TIME_TO_FULL_MS = 1500 * 60 * 60 * 1000

// ============ GÉOMÉTRIE INTERNE ============
const FRAME_LEFT = 130
const FRAME_RIGHT = 1470
const FRAME_TOP = 115
const FRAME_BOTTOM = 940
const SHELF_COUNT = 10
const SHELF_PITCH = (FRAME_BOTTOM - FRAME_TOP) / SHELF_COUNT
const BOARD_THICKNESS = 7

// ============ PALETTE CUIR ============
// 18 tons de cuir vieilli, saturation modérée pour cohésion visuelle.
type LeatherTone = { main: string; accent: string; title: string }
const PALETTE: LeatherTone[] = [
  { main: '#5A2424', accent: '#8A4040', title: '#D8A848' },
  { main: '#6E2A2A', accent: '#9C4040', title: '#D8A848' },
  { main: '#2A4030', accent: '#48684E', title: '#C89040' },
  { main: '#1E3624', accent: '#385840', title: '#B88838' },
  { main: '#1F2E50', accent: '#3D5278', title: '#D8A848' },
  { main: '#1A2840', accent: '#324868', title: '#C89040' },
  { main: '#7A4A2A', accent: '#A8704A', title: '#E8C088' },
  { main: '#8A5828', accent: '#B07440', title: '#E8C088' },
  { main: '#3A2030', accent: '#5C3E50', title: '#C89040' },
  { main: '#4A2840', accent: '#6E4868', title: '#D8A848' },
  { main: '#4A5060', accent: '#6E7888', title: '#C89040' },
  { main: '#3A4A55', accent: '#5A6A75', title: '#A88040' },
  { main: '#5C5A28', accent: '#7E7A48', title: '#E8C088' },
  { main: '#3D2A14', accent: '#5C4028', title: '#A86A28' },
  { main: '#1F1810', accent: '#3A2C20', title: '#9A6E20' },
  { main: '#A88058', accent: '#C8A078', title: '#E8C088' },
  { main: '#C8B898', accent: '#D8C8A8', title: '#8A5828' },
  { main: '#604A38', accent: '#806648', title: '#C89040' },
]

// ============ ZONES RÉSERVÉES POUR LES TRÉSORS ============
// Le générateur de livres saute ces plages — un livre n'occupera jamais l'emplacement
// d'un trésor. Si le trésor n'est pas encore débloqué, l'emplacement reste vide
// (ombre du fond intérieur), prêt à accueillir l'objet quand le palier sera atteint.
type DecoZone = { x: number; x2: number }
const DECO_ZONES: Record<number, DecoZone[]> = {
  0: [{ x: 165, x2: 248 }, { x: 1340, x2: 1430 }],
  3: [{ x: 740, x2: 840 }],
  5: [{ x: 200, x2: 280 }],
  7: [{ x: 1280, x2: 1410 }],
  9: [{ x: 680, x2: 780 }],
}

// ============ PRNG (mulberry32) ============
function mulberry32(a: number): () => number {
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ============ Helpers de positions ============
function shelfBoardTop(s: number): number {
  return FRAME_TOP + s * SHELF_PITCH + SHELF_PITCH - BOARD_THICKNESS
}

// ============ ÉTAGÈRES (planches en bois) — statique, calculé à l'import ============
const SHELVES_HTML: string = (() => {
  let s = ''
  for (let i = 0; i < SHELF_COUNT; i++) {
    const yCompTop = FRAME_TOP + i * SHELF_PITCH
    const yBoardTop = yCompTop + SHELF_PITCH - BOARD_THICKNESS
    // Ombre douce au-dessus de la planche
    s += `<rect x="${FRAME_LEFT}" y="${yBoardTop - 14}" width="${FRAME_RIGHT - FRAME_LEFT}" height="14" fill="url(#bib-undershadow)"/>`
    // Planche (rect en gradient)
    s += `<rect x="${FRAME_LEFT - 8}" y="${yBoardTop}" width="${FRAME_RIGHT - FRAME_LEFT + 16}" height="${BOARD_THICKNESS}" fill="url(#bib-shelfBoard)"/>`
    // Lignes de finition haut/bas de la planche
    s += `<line x1="${FRAME_LEFT - 8}" y1="${yBoardTop}" x2="${FRAME_RIGHT + 8}" y2="${yBoardTop}" stroke="#5A3520" stroke-width="0.5" opacity="0.7"/>`
    s += `<line x1="${FRAME_LEFT - 8}" y1="${yBoardTop + BOARD_THICKNESS}" x2="${FRAME_RIGHT + 8}" y2="${yBoardTop + BOARD_THICKNESS}" stroke="#0A0503" stroke-width="0.8"/>`
  }
  return s
})()

// ============ PRÉ-GÉNÉRATION DE TOUS LES LIVRES ============
// Calcul fait UNE FOIS à l'import du module (déterministe via PRNG seedé).
// Ordre : étagère par étagère, gauche à droite. C'est l'ordre dans lequel
// les livres apparaîtront au fil des fiches notées.
type Book = { svg: string; shelf: number }

const ALL_BOOKS: Book[] = (() => {
  const rand = mulberry32(11)
  const books: Book[] = []

  for (let s = 0; s < SHELF_COUNT; s++) {
    const yCompTop = FRAME_TOP + s * SHELF_PITCH
    const yBoardTop = yCompTop + SHELF_PITCH - BOARD_THICKNESS
    const zones = DECO_ZONES[s] || []
    let cursor = FRAME_LEFT + 2
    let groupColor: LeatherTone | null = null
    let groupRemaining = 0
    let groupHeight = 0
    let groupWidth = 0

    while (cursor < FRAME_RIGHT - 8) {
      const zone = zones.find((z) => cursor >= z.x - 2 && cursor < z.x2)
      if (zone) { cursor = zone.x2 + 2; continue }

      if (groupRemaining === 0) {
        if (rand() < 0.32) {
          // Série multi-volumes (3-7 livres mêmes couleurs/hauteurs)
          groupRemaining = 3 + Math.floor(rand() * 5)
          groupColor = PALETTE[Math.floor(rand() * PALETTE.length)]
          groupHeight = 56 + Math.floor(rand() * 18)
          groupWidth = 7 + Math.floor(rand() * 4)
        } else {
          groupRemaining = 1
          groupColor = PALETTE[Math.floor(rand() * PALETTE.length)]
          groupHeight = 54 + Math.floor(rand() * 22)
          groupWidth = 6 + Math.floor(rand() * 6)
        }
      }
      const w = groupWidth + (groupRemaining > 1 ? 0 : Math.floor((rand() - 0.5) * 2))
      const nextZone = zones.find((z) => cursor < z.x && cursor + w > z.x)
      if (nextZone) { cursor = nextZone.x2 + 2; groupRemaining = 0; continue }
      if (cursor + w > FRAME_RIGHT - 4) break

      const yBookTop = yBoardTop - groupHeight
      const tilt = (groupRemaining === 1 && rand() < 0.02) ? (rand() - 0.5) * 5 : 0
      books.push({
        svg: renderBook(cursor, yBookTop, w, groupHeight, groupColor!, tilt, rand),
        shelf: s,
      })

      cursor += w
      groupRemaining--
      if (groupRemaining === 0 && rand() < 0.04) cursor += 1 + Math.floor(rand() * 2)
    }
  }
  return books
})()

function renderBook(
  x: number, y: number, w: number, h: number,
  c: LeatherTone, tilt: number, rand: () => number
): string {
  const rotAttr = tilt ? ` rotate(${tilt.toFixed(2)} ${(w / 2).toFixed(1)} ${h.toFixed(1)})` : ''
  let s = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})${rotAttr}">`
  // Corps
  s += `<rect width="${w}" height="${h}" fill="${c.main}"/>`
  // Cap supérieur (cuir plus clair sur la tranche du dessus)
  s += `<rect x="0" y="0" width="${w}" height="1.3" fill="${c.accent}"/>`
  s += `<rect x="0" y="1.3" width="${w}" height="0.5" fill="rgba(0,0,0,0.4)"/>`
  // Pied (ombre sur la planche)
  s += `<rect x="0" y="${(h - 1.5).toFixed(1)}" width="${w}" height="1.5" fill="rgba(0,0,0,0.55)"/>`
  // Surbrillance gauche (lumière depuis haut-gauche)
  s += `<rect x="0" y="0" width="0.9" height="${h}" fill="rgba(255,220,180,0.25)"/>`
  // Ombre droite
  s += `<rect x="${(w - 0.6).toFixed(1)}" y="0" width="0.6" height="${h}" fill="rgba(0,0,0,0.4)"/>`
  // Bandes dorées (raised bands sur cuir gravé)
  if (rand() < 0.88) {
    const y1 = h * (0.20 + rand() * 0.08)
    s += `<rect y="${y1.toFixed(1)}" width="${w}" height="0.7" fill="${c.title}" opacity="0.8"/>`
    s += `<rect y="${(y1 + 0.7).toFixed(1)}" width="${w}" height="0.4" fill="rgba(0,0,0,0.5)"/>`
  }
  if (rand() < 0.55) {
    const y2 = h * (0.72 + rand() * 0.08)
    s += `<rect y="${y2.toFixed(1)}" width="${w}" height="0.7" fill="${c.title}" opacity="0.8"/>`
    s += `<rect y="${(y2 + 0.7).toFixed(1)}" width="${w}" height="0.4" fill="rgba(0,0,0,0.5)"/>`
  }
  // Hint de titre doré sur livres assez larges
  if (w >= 9 && rand() < 0.65) {
    const ty = h * (0.43 + rand() * 0.06)
    const tw = Math.max(2, w - 4)
    const tx = (w - tw) / 2
    s += `<rect x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" width="${tw.toFixed(1)}" height="0.5" fill="${c.title}" opacity="0.55"/>`
    if (rand() < 0.6) {
      s += `<rect x="${(tx + tw * 0.15).toFixed(1)}" y="${(ty + 1.6).toFixed(1)}" width="${(tw * 0.7).toFixed(1)}" height="0.4" fill="${c.title}" opacity="0.4"/>`
    }
  }
  // Petit ornement sous le titre sur livres larges
  if (w >= 11 && rand() < 0.4) {
    const cy = h * 0.62
    s += `<circle cx="${(w / 2).toFixed(1)}" cy="${cy.toFixed(1)}" r="0.7" fill="${c.title}" opacity="0.6"/>`
  }
  s += '</g>'
  return s
}

// ============ DÉCORATIONS / TRÉSORS ============
type Decoration = { unlockAt: number; name: string; svg: string }

const DECORATIONS: Decoration[] = [
  {
    unlockAt: 100,
    name: "Buste d'Hippocrate",
    svg: (() => {
      const bb = shelfBoardTop(0)
      return `<g transform="translate(206 ${bb})">
        <rect x="-22" y="-12" width="44" height="12" fill="url(#bib-walnutFace)"/>
        <rect x="-22" y="-12" width="44" height="12" filter="url(#bib-woodGrain)"/>
        <line x1="-22" y1="-12" x2="22" y2="-12" stroke="#5A3520" stroke-width="0.5"/>
        <rect x="-18" y="-15" width="36" height="3" fill="url(#bib-marble)"/>
        <path d="M -16 -15 Q -14 -32 -10 -38 L 10 -38 Q 14 -32 16 -15 Z" fill="url(#bib-marble)" stroke="#7A6448" stroke-width="0.4"/>
        <rect x="-6" y="-44" width="12" height="9" fill="url(#bib-marble)"/>
        <ellipse cx="0" cy="-58" rx="13" ry="16" fill="url(#bib-marble)" stroke="#7A6448" stroke-width="0.4"/>
        <path d="M -13 -65 Q -10 -75 0 -76 Q 10 -75 13 -65 Q 12 -60 8 -60 L -8 -60 Q -12 -60 -13 -65 Z" fill="#9A8470" opacity="0.85"/>
        <path d="M -8 -50 Q -6 -42 0 -40 Q 6 -42 8 -50 Q 4 -48 0 -48 Q -4 -48 -8 -50 Z" fill="#9A8470" opacity="0.7"/>
        <circle cx="-4" cy="-60" r="0.7" fill="#3A2818"/>
        <circle cx="4" cy="-60" r="0.7" fill="#3A2818"/>
        <ellipse cx="-4" cy="-64" rx="6" ry="5" fill="url(#bib-marbleHi)"/>
        <path d="M 0 -58 Q -1.5 -54 0 -52 Q 1.5 -54 0 -58 Z" fill="#7A6448" opacity="0.6"/>
        <text y="-4" text-anchor="middle" font-family="Cinzel,serif" font-size="4" fill="#9A6E20" letter-spacing="0.7">HIPPOCRATES</text>
      </g>`
    })(),
  },
  {
    unlockAt: 300,
    name: 'Sablier',
    svg: (() => {
      const bb = shelfBoardTop(0)
      return `<g transform="translate(1385 ${bb})">
        <rect x="-18" y="-6" width="36" height="6" fill="url(#bib-brass)" stroke="#3A2818" stroke-width="0.3"/>
        <rect x="-16" y="-58" width="2" height="52" fill="url(#bib-brass)"/>
        <rect x="14" y="-58" width="2" height="52" fill="url(#bib-brass)"/>
        <rect x="-18" y="-64" width="36" height="6" fill="url(#bib-brass)" stroke="#3A2818" stroke-width="0.3"/>
        <path d="M -12 -60 Q -12 -50 -1 -34 L 1 -34 Q 12 -50 12 -60 Z" fill="rgba(220,200,160,0.35)" stroke="#9A8470" stroke-width="0.5"/>
        <path d="M -12 -8 Q -12 -18 -1 -34 L 1 -34 Q 12 -18 12 -8 Z" fill="rgba(220,200,160,0.35)" stroke="#9A8470" stroke-width="0.5"/>
        <path d="M -10 -8 Q -10 -14 -1 -22 L 1 -22 Q 10 -14 10 -8 Z" fill="#C89858"/>
        <path d="M -3 -56 Q -3 -50 -0.5 -38 L 0.5 -38 Q 3 -50 3 -56 Z" fill="#C89858" opacity="0.8"/>
        <line x1="0" y1="-38" x2="0" y2="-22" stroke="#C89858" stroke-width="0.6"/>
        <ellipse cx="-7" cy="-50" rx="2" ry="6" fill="rgba(255,255,255,0.3)"/>
        <ellipse cx="-7" cy="-15" rx="2" ry="5" fill="rgba(255,255,255,0.2)"/>
      </g>`
    })(),
  },
  {
    unlockAt: 600,
    name: 'Chandelier sur pile de manuscrits',
    svg: (() => {
      const bb = shelfBoardTop(3)
      return `<g transform="translate(790 ${bb})">
        <rect x="-44" y="-10" width="60" height="10" fill="#5A2424"/>
        <rect x="-44" y="-10" width="60" height="1.2" fill="#8A4040"/>
        <rect x="-44" y="-2" width="60" height="2" fill="rgba(0,0,0,0.5)"/>
        <rect x="-46" y="-9" width="2" height="9" fill="#3A1818"/>
        <line x1="-44" y1="-7" x2="16" y2="-7" stroke="#D8A848" stroke-width="0.5" opacity="0.7"/>
        <line x1="-44" y1="-4" x2="16" y2="-4" stroke="#D8A848" stroke-width="0.4" opacity="0.6"/>
        <rect x="-42" y="-20" width="56" height="10" fill="#2A4030"/>
        <rect x="-42" y="-20" width="56" height="1.2" fill="#48684E"/>
        <rect x="-42" y="-12" width="56" height="2" fill="rgba(0,0,0,0.5)"/>
        <rect x="-44" y="-19" width="2" height="9" fill="#1A2A1F"/>
        <line x1="-42" y1="-17" x2="14" y2="-17" stroke="#C89040" stroke-width="0.5" opacity="0.7"/>
        <line x1="-42" y1="-14" x2="14" y2="-14" stroke="#C89040" stroke-width="0.4" opacity="0.6"/>
        <rect x="-40" y="-30" width="52" height="10" fill="#1F2E50"/>
        <rect x="-40" y="-30" width="52" height="1.2" fill="#3D5278"/>
        <rect x="-40" y="-22" width="52" height="2" fill="rgba(0,0,0,0.5)"/>
        <rect x="-42" y="-29" width="2" height="9" fill="#101830"/>
        <line x1="-40" y1="-27" x2="12" y2="-27" stroke="#D8A848" stroke-width="0.5" opacity="0.7"/>
        <line x1="-40" y1="-24" x2="12" y2="-24" stroke="#D8A848" stroke-width="0.4" opacity="0.6"/>
        <ellipse cx="32" cy="-30" rx="11" ry="3" fill="url(#bib-brass)"/>
        <rect x="29" y="-44" width="6" height="14" fill="url(#bib-brass)"/>
        <rect x="27" y="-46" width="10" height="3" fill="url(#bib-brass)"/>
        <rect x="30" y="-62" width="4" height="16" fill="#E8DDC0"/>
        <rect x="30" y="-62" width="4" height="1" fill="#C8B89C"/>
        <line x1="32" y1="-62" x2="32" y2="-66" stroke="#3A2818" stroke-width="0.6"/>
        <ellipse cx="32" cy="-72" rx="4" ry="7" fill="url(#bib-flame)"/>
        <ellipse cx="32" cy="-70" rx="2" ry="4" fill="rgba(255,255,210,0.9)"/>
        <circle cx="32" cy="-70" r="20" fill="url(#bib-flame)" opacity="0.3"/>
      </g>`
    })(),
  },
  {
    unlockAt: 900,
    name: 'Globe terrestre',
    svg: (() => {
      const bb = shelfBoardTop(5)
      return `<g transform="translate(240 ${bb})">
        <rect x="-16" y="-8" width="32" height="8" fill="url(#bib-walnutFace)"/>
        <rect x="-2" y="-22" width="4" height="14" fill="url(#bib-walnutFace)"/>
        <ellipse cx="0" cy="-46" rx="32" ry="32" fill="none" stroke="url(#bib-brass)" stroke-width="2.4"/>
        <circle cx="0" cy="-46" r="27" fill="url(#bib-globe)"/>
        <path d="M -18 -56 Q -10 -62 -2 -58 Q 4 -52 -2 -46 Q -10 -42 -16 -48 Z" fill="#7A8A4A" opacity="0.85"/>
        <path d="M 4 -42 Q 14 -38 18 -32 Q 14 -28 8 -32 Q 4 -36 4 -42 Z" fill="#7A8A4A" opacity="0.8"/>
        <path d="M -14 -36 Q -8 -32 -4 -28 Q -10 -26 -16 -30 Z" fill="#7A8A4A" opacity="0.85"/>
        <path d="M -27 -46 Q 0 -56 27 -46 Q 0 -36 -27 -46" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>
        <path d="M 0 -73 Q 14 -46 0 -19 Q -14 -46 0 -73" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>
        <ellipse cx="-9" cy="-56" rx="9" ry="8" fill="rgba(255,240,210,0.18)"/>
        <line x1="-2" y1="-14" x2="22" y2="-78" stroke="url(#bib-brass)" stroke-width="1.6"/>
      </g>`
    })(),
  },
  {
    unlockAt: 1200,
    name: 'Manuscrits & plume',
    svg: (() => {
      const bb = shelfBoardTop(7)
      return `<g transform="translate(1340 ${bb})">
        <ellipse cx="0" cy="-3" rx="55" ry="4" fill="url(#bib-scroll)" stroke="#7A5230" stroke-width="0.4"/>
        <ellipse cx="-50" cy="-3" rx="6" ry="4" fill="#9A7848" stroke="#5A3520" stroke-width="0.4"/>
        <ellipse cx="50" cy="-3" rx="6" ry="4" fill="#9A7848" stroke="#5A3520" stroke-width="0.4"/>
        <circle cx="0" cy="-3" r="3" fill="#A82828" opacity="0.85"/>
        <circle cx="0" cy="-3.5" r="1" fill="#3A0808"/>
        <ellipse cx="-8" cy="-12" rx="48" ry="3.5" fill="url(#bib-scroll)" stroke="#7A5230" stroke-width="0.4"/>
        <ellipse cx="-50" cy="-12" rx="5" ry="3.5" fill="#9A7848" stroke="#5A3520" stroke-width="0.4"/>
        <ellipse cx="34" cy="-12" rx="5" ry="3.5" fill="#9A7848" stroke="#5A3520" stroke-width="0.4"/>
        <g transform="translate(20 -22) rotate(-8)">
          <rect x="-8" y="-30" width="16" height="32" fill="url(#bib-scroll)" stroke="#7A5230" stroke-width="0.4"/>
          <ellipse cx="0" cy="-30" rx="8" ry="2.5" fill="#9A7848" stroke="#5A3520" stroke-width="0.4"/>
          <ellipse cx="0" cy="2" rx="8" ry="2.5" fill="#7A5230"/>
          <line x1="-5" y1="-22" x2="5" y2="-22" stroke="#7A5230" stroke-width="0.3"/>
          <line x1="-5" y1="-18" x2="5" y2="-18" stroke="#7A5230" stroke-width="0.3"/>
          <line x1="-5" y1="-14" x2="5" y2="-14" stroke="#7A5230" stroke-width="0.3"/>
          <line x1="-5" y1="-10" x2="5" y2="-10" stroke="#7A5230" stroke-width="0.3"/>
          <line x1="-5" y1="-6" x2="5" y2="-6" stroke="#7A5230" stroke-width="0.3"/>
        </g>
        <g transform="translate(-30 -5) rotate(-35)">
          <path d="M 0 0 Q 2 -20 -2 -55 Q -10 -62 -16 -58 Q -8 -45 -3 -28 Q -1 -15 0 0 Z" fill="#F0E5C8" stroke="#9A8470" stroke-width="0.4"/>
          <path d="M -2 -55 L 0 -62 L -3 -64 L -5 -60 Z" fill="#3A2818"/>
        </g>
      </g>`
    })(),
  },
  {
    unlockAt: 1500,
    name: 'Codex ouvert sur lutrin',
    svg: (() => {
      const bb = shelfBoardTop(9)
      return `<g transform="translate(730 ${bb})">
        <path d="M -36 0 L -28 -8 L 28 -8 L 36 0 Z" fill="url(#bib-walnutFace)" stroke="#0A0503" stroke-width="0.6"/>
        <rect x="-32" y="-10" width="64" height="2" fill="url(#bib-walnutSide)"/>
        <path d="M -34 -10 L -32 -50 L -2 -54 L 0 -10 Z" fill="#E8D4A8" stroke="#8A5828" stroke-width="0.5"/>
        <path d="M 0 -10 L 2 -54 L 32 -50 L 34 -10 Z" fill="#E8D4A8" stroke="#8A5828" stroke-width="0.5"/>
        <path d="M 0 -10 L 0 -54" stroke="#8A5828" stroke-width="0.6"/>
        <g stroke="#3A2818" stroke-width="0.3" opacity="0.7">
          <line x1="-30" y1="-46" x2="-6" y2="-48"/>
          <line x1="-30" y1="-42" x2="-7" y2="-44"/>
          <line x1="-30" y1="-38" x2="-5" y2="-40"/>
          <line x1="-30" y1="-34" x2="-7" y2="-36"/>
          <line x1="-30" y1="-30" x2="-6" y2="-32"/>
          <line x1="-30" y1="-26" x2="-8" y2="-28"/>
          <line x1="-30" y1="-22" x2="-7" y2="-24"/>
          <line x1="-30" y1="-18" x2="-6" y2="-20"/>
          <line x1="-30" y1="-14" x2="-12" y2="-16"/>
        </g>
        <rect x="-30" y="-52" width="6" height="6" fill="#A82828"/>
        <text x="-27" y="-47" text-anchor="middle" font-family="Cinzel,serif" font-size="5" fill="#E8D4A8">A</text>
        <g stroke="#3A2818" stroke-width="0.3" opacity="0.7">
          <line x1="6" y1="-50" x2="30" y2="-48"/>
          <line x1="7" y1="-46" x2="30" y2="-44"/>
          <line x1="5" y1="-42" x2="30" y2="-40"/>
          <line x1="7" y1="-38" x2="30" y2="-36"/>
          <line x1="6" y1="-34" x2="30" y2="-32"/>
          <line x1="8" y1="-30" x2="30" y2="-28"/>
          <line x1="7" y1="-26" x2="30" y2="-24"/>
          <line x1="6" y1="-22" x2="30" y2="-20"/>
          <line x1="12" y1="-18" x2="30" y2="-16"/>
        </g>
        <circle cx="20" cy="-34" r="3" fill="none" stroke="#A82828" stroke-width="0.5"/>
        <path d="M 18 -34 L 22 -34 M 20 -36 L 20 -32" stroke="#A82828" stroke-width="0.5"/>
      </g>`
    })(),
  },
]

// ============ HELPERS PUBLICS ============
/** Nombre de trésors débloqués pour un compteur de fiches donné. */
export function unlockedTreasuresCount(fichesCount: number): number {
  let n = 0
  for (const d of DECORATIONS) {
    if (fichesCount >= d.unlockAt) n++
  }
  return n
}

/** Prochain trésor à débloquer (null si tout est débloqué). */
export function nextTreasure(fichesCount: number): { name: string; at: number } | null {
  for (const d of DECORATIONS) {
    if (fichesCount < d.unlockAt) return { name: d.name, at: d.unlockAt }
  }
  return null
}

/** Liste complète des trésors (pour affichage UI). */
export const BIBLIOTHECA_TREASURES = DECORATIONS.map(d => ({ unlockAt: d.unlockAt, name: d.name }))

/** Nombre total de livres effectivement générés (peut différer de TOTAL_CAPACITY de quelques unités). */
export const BIBLIOTHECA_BOOKS_GENERATED = ALL_BOOKS.length

// ============ PROPS ============
type BibliothecaSvgProps = {
  /** Nombre de fiches notées (cumulé sur l'année). 1 fiche = 1 livre ajouté. */
  fichesCount: number
  /** Classe CSS sur le <svg>. */
  className?: string
  style?: CSSProperties
  /** viewBox du SVG. Default '0 0 1600 1100' (vue large complète). */
  viewBox?: string
}

// ============ COMPOSANT ============
export default function BibliothecaSvg({
  fichesCount,
  className,
  style,
  viewBox = '0 0 1600 1100',
}: BibliothecaSvgProps) {
  // Nombre de livres visibles : 1 fiche = 1 livre, capé à la capacité totale
  const visibleBooks = Math.min(Math.max(0, Math.floor(fichesCount)), ALL_BOOKS.length)

  const booksHtml = useMemo(() => {
    if (visibleBooks === 0) return ''
    let s = ''
    for (let i = 0; i < visibleBooks; i++) s += ALL_BOOKS[i].svg
    return s
  }, [visibleBooks])

  const decorationsHtml = useMemo(() => {
    let s = ''
    for (const d of DECORATIONS) {
      if (fichesCount >= d.unlockAt) s += d.svg
    }
    return s
  }, [fichesCount])

  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={style}
      role="img"
      preserveAspectRatio="xMidYMid slice"
    >
      <title>Bibliothèque MedRev</title>

      <defs>
        <linearGradient id="bib-wallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0E0805" />
          <stop offset="50%" stopColor="#1A0F08" />
          <stop offset="100%" stopColor="#0A0503" />
        </linearGradient>
        <linearGradient id="bib-walnutFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3D2516" />
          <stop offset="50%" stopColor="#2D1B0E" />
          <stop offset="100%" stopColor="#1F1208" />
        </linearGradient>
        <linearGradient id="bib-walnutSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A180C" />
          <stop offset="100%" stopColor="#170D06" />
        </linearGradient>
        <linearGradient id="bib-shelfBoard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A2316" />
          <stop offset="40%" stopColor="#251609" />
          <stop offset="100%" stopColor="#160C05" />
        </linearGradient>
        <linearGradient id="bib-floorGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1F120A" />
          <stop offset="100%" stopColor="#0A0503" />
        </linearGradient>
        <radialGradient id="bib-warmGlow" cx="22%" cy="18%" r="75%">
          <stop offset="0%" stopColor="rgba(255,205,130,0.22)" />
          <stop offset="40%" stopColor="rgba(255,180,100,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <radialGradient id="bib-vignette" cx="50%" cy="50%" r="78%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="65%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
        </radialGradient>
        <linearGradient id="bib-lightShaft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,210,140,0.18)" />
          <stop offset="40%" stopColor="rgba(255,190,110,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <filter id="bib-woodGrain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.85" numOctaves={2} seed={3} stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.04  0 0 0 0.32 0" />
        </filter>
        <linearGradient id="bib-undershadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <linearGradient id="bib-marble" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8DDC8" />
          <stop offset="50%" stopColor="#C8B89C" />
          <stop offset="100%" stopColor="#9A8470" />
        </linearGradient>
        <radialGradient id="bib-marbleHi" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="rgba(255,250,235,0.6)" />
          <stop offset="100%" stopColor="rgba(255,250,235,0)" />
        </radialGradient>
        <linearGradient id="bib-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D8A848" />
          <stop offset="50%" stopColor="#9A6E20" />
          <stop offset="100%" stopColor="#5A3F12" />
        </linearGradient>
        <radialGradient id="bib-flame" cx="50%" cy="60%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,200,0.95)" />
          <stop offset="50%" stopColor="rgba(255,180,80,0.7)" />
          <stop offset="100%" stopColor="rgba(255,140,40,0)" />
        </radialGradient>
        <radialGradient id="bib-globe" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#5A8AC0" />
          <stop offset="55%" stopColor="#2A4A6A" />
          <stop offset="100%" stopColor="#0F1F30" />
        </radialGradient>
        <linearGradient id="bib-scroll" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8D4A8" />
          <stop offset="100%" stopColor="#A88058" />
        </linearGradient>
      </defs>

      {/* === ARRIÈRE-PLAN (mur derrière le meuble) === */}
      <rect width="1600" height="1100" fill="url(#bib-wallGrad)" />

      {/* === SOL (parquet en perspective légère) === */}
      <rect x="0" y="945" width="1600" height="155" fill="url(#bib-floorGrad)" />
      <g stroke="#0A0503" strokeWidth="0.8" opacity="0.7">
        <line x1="160" y1="945" x2="120" y2="1100" />
        <line x1="380" y1="945" x2="350" y2="1100" />
        <line x1="600" y1="945" x2="585" y2="1100" />
        <line x1="820" y1="945" x2="820" y2="1100" />
        <line x1="1040" y1="945" x2="1055" y2="1100" />
        <line x1="1260" y1="945" x2="1290" y2="1100" />
        <line x1="1480" y1="945" x2="1530" y2="1100" />
      </g>
      <line x1="0" y1="945" x2="1600" y2="945" stroke="#3D2516" strokeWidth="1.2" />

      {/* === CADRE EXTÉRIEUR : corniche, pilastres, plinthe === */}
      {/* Corniche (haut) */}
      <rect x="50" y="45" width="1500" height="14" fill="url(#bib-walnutFace)" />
      <rect x="60" y="59" width="1480" height="22" fill="url(#bib-walnutFace)" />
      <rect x="60" y="59" width="1480" height="22" filter="url(#bib-woodGrain)" />
      <rect x="74" y="81" width="1452" height="6" fill="url(#bib-walnutSide)" />
      <rect x="84" y="87" width="1432" height="14" fill="url(#bib-walnutFace)" />
      <rect x="84" y="87" width="1432" height="14" filter="url(#bib-woodGrain)" />
      <line x1="50" y1="45" x2="1550" y2="45" stroke="#5A3520" strokeWidth="0.6" opacity="0.7" />
      <line x1="50" y1="59" x2="1550" y2="59" stroke="#0A0503" strokeWidth="1.2" />
      <line x1="74" y1="87" x2="1526" y2="87" stroke="#0A0503" strokeWidth="1" />
      <line x1="84" y1="101" x2="1516" y2="101" stroke="#0A0503" strokeWidth="1.2" />

      {/* Médaillon central (M·R) */}
      <g transform="translate(800 65)">
        <ellipse cx="0" cy="0" rx="32" ry="14" fill="url(#bib-walnutSide)" stroke="#5A3520" strokeWidth="0.8" />
        <ellipse cx="0" cy="0" rx="22" ry="9" fill="none" stroke="#9A6E20" strokeWidth="0.5" opacity="0.8" />
        <text y="3.5" textAnchor="middle" fontFamily="Cinzel,serif" fontSize="9" fill="#9A6E20" letterSpacing="2">M·R</text>
      </g>

      {/* Pilastres latéraux */}
      <rect x="50" y="101" width="60" height="844" fill="url(#bib-walnutFace)" />
      <rect x="50" y="101" width="60" height="844" filter="url(#bib-woodGrain)" />
      <line x1="50" y1="101" x2="50" y2="945" stroke="#5A3520" strokeWidth="0.6" opacity="0.6" />
      <line x1="110" y1="101" x2="110" y2="945" stroke="#0A0503" strokeWidth="1.4" />
      <rect x="68" y="120" width="22" height="810" fill="url(#bib-walnutSide)" />
      <rect x="74" y="124" width="10" height="800" fill="none" stroke="#5A3520" strokeWidth="0.5" opacity="0.75" />

      <rect x="1490" y="101" width="60" height="844" fill="url(#bib-walnutFace)" />
      <rect x="1490" y="101" width="60" height="844" filter="url(#bib-woodGrain)" />
      <line x1="1550" y1="101" x2="1550" y2="945" stroke="#5A3520" strokeWidth="0.6" opacity="0.6" />
      <line x1="1490" y1="101" x2="1490" y2="945" stroke="#0A0503" strokeWidth="1.4" />
      <rect x="1510" y="120" width="22" height="810" fill="url(#bib-walnutSide)" />
      <rect x="1516" y="124" width="10" height="800" fill="none" stroke="#5A3520" strokeWidth="0.5" opacity="0.75" />

      {/* Plinthe (bas) */}
      <rect x="60" y="945" width="1480" height="20" fill="url(#bib-walnutFace)" />
      <rect x="60" y="945" width="1480" height="20" filter="url(#bib-woodGrain)" />
      <rect x="50" y="965" width="1500" height="18" fill="url(#bib-walnutSide)" />
      <line x1="50" y1="945" x2="1550" y2="945" stroke="#5A3520" strokeWidth="0.5" opacity="0.6" />
      <line x1="60" y1="965" x2="1540" y2="965" stroke="#0A0503" strokeWidth="1.2" />

      {/* Intérieur du meuble (mur de fond plus sombre) */}
      <rect x="110" y="101" width="1380" height="844" fill="#0F0805" />

      {/* === ÉTAGÈRES (planches en bois) — toujours visibles === */}
      <g dangerouslySetInnerHTML={{ __html: SHELVES_HTML }} />

      {/* === LIVRES (apparaissent au fil des fiches) === */}
      <g dangerouslySetInnerHTML={{ __html: booksHtml }} />

      {/* === DÉCORATIONS / TRÉSORS (palier après palier) === */}
      <g dangerouslySetInnerHTML={{ __html: decorationsHtml }} />

      {/* === ATMOSPHÈRE === */}
      {/* Faisceau de lumière chaude depuis haut-gauche */}
      <polygon points="60,101 800,101 200,945 60,945" fill="url(#bib-lightShaft)" pointerEvents="none" />
      {/* Glow chaud diffus */}
      <rect width="1600" height="1100" fill="url(#bib-warmGlow)" pointerEvents="none" />
      {/* Vignette globale */}
      <rect width="1600" height="1100" fill="url(#bib-vignette)" pointerEvents="none" />

      {/* Particules de poussière dans le faisceau */}
      <g pointerEvents="none">
        <circle cx="290" cy="280" r="0.7" fill="rgba(255,220,160,0.55)" />
        <circle cx="350" cy="360" r="0.5" fill="rgba(255,220,160,0.4)" />
        <circle cx="410" cy="420" r="0.6" fill="rgba(255,220,160,0.5)" />
        <circle cx="320" cy="500" r="0.4" fill="rgba(255,220,160,0.35)" />
        <circle cx="450" cy="560" r="0.7" fill="rgba(255,220,160,0.5)" />
        <circle cx="380" cy="640" r="0.5" fill="rgba(255,220,160,0.45)" />
        <circle cx="520" cy="720" r="0.6" fill="rgba(255,220,160,0.4)" />
        <circle cx="270" cy="800" r="0.5" fill="rgba(255,220,160,0.35)" />
        <circle cx="600" cy="380" r="0.4" fill="rgba(255,220,160,0.4)" />
        <circle cx="700" cy="560" r="0.5" fill="rgba(255,220,160,0.35)" />
        <circle cx="250" cy="430" r="0.35" fill="rgba(255,220,160,0.35)" />
        <circle cx="160" cy="320" r="0.4" fill="rgba(255,220,160,0.4)" />
      </g>
    </svg>
  )
}
