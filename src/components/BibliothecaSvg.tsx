// src/components/BibliothecaSvg.tsx
// Bibliothèque MedRev — vue cumulative annuelle.
// Chaque fiche notée ajoute 1 livre (cap = BIBLIOTHECA_TOTAL_CAPACITY).
// 6 trésors décoratifs se débloquent à des paliers : 100, 300, 600, 1000, 1500, 2000 fiches.
//
// Deux thèmes possibles :
//   - 'erudit'  → cabinet d'érudit français (noyer clair, parchemin, laiton)
//   - 'archive' → musée du futur (métal noir poli, LED cyan, atmosphère vitrine sci-fi)
//
// Les LIVRES sont strictement identiques dans les deux modes (mêmes 18 cuirs vintage).
// Seuls le décor (cadre, étagères, atmosphère, trésors) changent.
//
// Utilisé sur la page Focus (zone hero) ET sur le Dashboard (mini-vue).
// Les livres sont pré-générés à l'import (PRNG seedé pour reproductibilité)
// et rendus via dangerouslySetInnerHTML pour bypass de la réconciliation React
// (2000 livres × ~10 sous-éléments = 20000 nœuds, trop coûteux à diff à chaque
// re-render).

import { useEffect, useMemo, useState, type CSSProperties } from 'react'

// ============ CONSTANTES EXPORTÉES ============
/** Capacité maximale de la bibliothèque. À ce nombre de fiches, elle est complète. */
export const BIBLIOTHECA_TOTAL_CAPACITY = 2000

/** Cible de complétion : 2000h cumulées (~ 1 année P1, 1 fiche ≈ 1h en moyenne). */
export const BIBLIOTHECA_TIME_TO_FULL_MS = 2000 * 60 * 60 * 1000

// ============ THÈME ============
export type BibliothecaTheme = 'erudit' | 'archive'

// ============ GÉOMÉTRIE INTERNE ============
const FRAME_LEFT = 130
const FRAME_RIGHT = 1470
const FRAME_TOP = 115
const FRAME_BOTTOM = 940
const SHELF_COUNT = 10
const SHELF_PITCH = (FRAME_BOTTOM - FRAME_TOP) / SHELF_COUNT
const BOARD_THICKNESS = 7

// ============ PALETTE CUIR (commune aux deux thèmes) ============
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

// ============ ÉTAGÈRES (planches en bois) — thème ÉRUDIT ============
const SHELVES_HTML_ERUDIT: string = (() => {
  let s = ''
  for (let i = 0; i < SHELF_COUNT; i++) {
    const yCompTop = FRAME_TOP + i * SHELF_PITCH
    const yBoardTop = yCompTop + SHELF_PITCH - BOARD_THICKNESS
    // Ombre douce au-dessus de la planche
    s += `<rect x="${FRAME_LEFT}" y="${yBoardTop - 14}" width="${FRAME_RIGHT - FRAME_LEFT}" height="14" fill="url(#bib-undershadow-erudit)"/>`
    // Planche (rect en gradient noyer clair)
    s += `<rect x="${FRAME_LEFT - 8}" y="${yBoardTop}" width="${FRAME_RIGHT - FRAME_LEFT + 16}" height="${BOARD_THICKNESS}" fill="url(#bib-shelfBoard-erudit)"/>`
    // Lignes de finition haut/bas de la planche
    s += `<line x1="${FRAME_LEFT - 8}" y1="${yBoardTop}" x2="${FRAME_RIGHT + 8}" y2="${yBoardTop}" stroke="#8C6839" stroke-width="0.5" opacity="0.7"/>`
    s += `<line x1="${FRAME_LEFT - 8}" y1="${yBoardTop + BOARD_THICKNESS}" x2="${FRAME_RIGHT + 8}" y2="${yBoardTop + BOARD_THICKNESS}" stroke="#5C3A21" stroke-width="0.8"/>`
  }
  return s
})()

// ============ ÉTAGÈRES (planches métal noir + LED cyan) — thème ARCHIVE ============
const SHELVES_HTML_ARCHIVE: string = (() => {
  let s = ''
  for (let i = 0; i < SHELF_COUNT; i++) {
    const yCompTop = FRAME_TOP + i * SHELF_PITCH
    const yBoardTop = yCompTop + SHELF_PITCH - BOARD_THICKNESS
    // Glow LED descendant qui éclaire les livres en dessous (placé en haut du compartiment)
    s += `<rect x="${FRAME_LEFT}" y="${yCompTop}" width="${FRAME_RIGHT - FRAME_LEFT}" height="22" fill="url(#bib-ledGlow-archive)" pointer-events="none"/>`
    // Ombre douce au-dessus de la planche
    s += `<rect x="${FRAME_LEFT}" y="${yBoardTop - 14}" width="${FRAME_RIGHT - FRAME_LEFT}" height="14" fill="url(#bib-undershadow-archive)"/>`
    // Planche métal noir poli
    s += `<rect x="${FRAME_LEFT - 8}" y="${yBoardTop}" width="${FRAME_RIGHT - FRAME_LEFT + 16}" height="${BOARD_THICKNESS}" fill="url(#bib-shelfBoard-archive)"/>`
    // Liseré métal supérieur (highlight)
    s += `<line x1="${FRAME_LEFT - 8}" y1="${yBoardTop}" x2="${FRAME_RIGHT + 8}" y2="${yBoardTop}" stroke="#4A5260" stroke-width="0.5" opacity="0.9"/>`
    s += `<line x1="${FRAME_LEFT - 8}" y1="${yBoardTop + BOARD_THICKNESS}" x2="${FRAME_RIGHT + 8}" y2="${yBoardTop + BOARD_THICKNESS}" stroke="#000000" stroke-width="0.8"/>`
    // Bandeau LED cyan en haut de chaque étagère (le tube fin lumineux)
    const yLed = yCompTop + 1.5
    s += `<rect x="${FRAME_LEFT + 4}" y="${yLed}" width="${FRAME_RIGHT - FRAME_LEFT - 8}" height="1.4" fill="#3DD9D9" opacity="0.85" filter="url(#bib-ledFilter)"/>`
    s += `<rect x="${FRAME_LEFT + 4}" y="${yLed}" width="${FRAME_RIGHT - FRAME_LEFT - 8}" height="0.5" fill="#A8FFFF" opacity="0.7"/>`
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

// --- Trésors thème ÉRUDIT (cabinet d'érudit français) ---
const TREASURES_ERUDIT: Decoration[] = [
  {
    unlockAt: 100,
    name: "Buste d'Hippocrate",
    svg: (() => {
      const bb = shelfBoardTop(0)
      return `<g transform="translate(206 ${bb})">
        <rect x="-22" y="-12" width="44" height="12" fill="url(#bib-walnutFace)"/>
        <rect x="-22" y="-12" width="44" height="12" filter="url(#bib-woodGrain)"/>
        <line x1="-22" y1="-12" x2="22" y2="-12" stroke="#8C6839" stroke-width="0.5"/>
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
    unlockAt: 1000,
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
    unlockAt: 1500,
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
    unlockAt: 2000,
    name: 'Codex ouvert sur lutrin',
    svg: (() => {
      const bb = shelfBoardTop(9)
      return `<g transform="translate(730 ${bb})">
        <path d="M -36 0 L -28 -8 L 28 -8 L 36 0 Z" fill="url(#bib-walnutFace)" stroke="#5C3A21" stroke-width="0.6"/>
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

// --- Trésors thème ARCHIVE (musée du futur) ---
// Mêmes paliers, mêmes shelf indexes, mêmes coordonnées x que TREASURES_ERUDIT
// pour respecter les DECO_ZONES définies plus haut. Style minimaliste, lignes
// fines, fill néon (cyan #3DD9D9, violet #7C5BD9, emerald #5DD39E) + glow.
const TREASURES_ARCHIVE: Decoration[] = [
  {
    unlockAt: 100,
    name: 'Terminal',
    svg: (() => {
      const bb = shelfBoardTop(0)
      // Petit moniteur tech sur socle, écran lumineux + LEDs latérales
      return `<g transform="translate(206 ${bb})" filter="url(#bib-neonGlow)">
        <rect x="-22" y="-10" width="44" height="10" fill="#1A1E24" stroke="#2E353E" stroke-width="0.5"/>
        <rect x="-18" y="-12" width="36" height="2" fill="#2E353E"/>
        <rect x="-26" y="-46" width="52" height="36" rx="3" fill="#0A0C10" stroke="#2E353E" stroke-width="0.8"/>
        <rect x="-22" y="-42" width="44" height="28" rx="1" fill="#06080B"/>
        <rect x="-22" y="-42" width="44" height="28" rx="1" fill="#3DD9D9" opacity="0.18"/>
        <line x1="-19" y1="-37" x2="10" y2="-37" stroke="#3DD9D9" stroke-width="0.6" opacity="0.95"/>
        <line x1="-19" y1="-33" x2="14" y2="-33" stroke="#3DD9D9" stroke-width="0.6" opacity="0.85"/>
        <line x1="-19" y1="-29" x2="6" y2="-29" stroke="#5DD39E" stroke-width="0.6" opacity="0.9"/>
        <line x1="-19" y1="-25" x2="16" y2="-25" stroke="#3DD9D9" stroke-width="0.6" opacity="0.8"/>
        <line x1="-19" y1="-21" x2="2" y2="-21" stroke="#7C5BD9" stroke-width="0.6" opacity="0.9"/>
        <rect x="-19" y="-19" width="2" height="3" fill="#3DD9D9"/>
        <circle cx="22" cy="-44" r="0.8" fill="#5DD39E"/>
        <circle cx="22" cy="-40" r="0.8" fill="#3DD9D9"/>
        <circle cx="22" cy="-36" r="0.8" fill="#7C5BD9" opacity="0.9"/>
        <circle cx="-24" cy="-44" r="0.8" fill="#3DD9D9"/>
      </g>`
    })(),
  },
  {
    unlockAt: 300,
    name: 'Drone-scribe',
    svg: (() => {
      const bb = shelfBoardTop(0)
      // Drone hexagonal posé, deux capteurs latéraux saillants
      return `<g transform="translate(1385 ${bb})" filter="url(#bib-neonGlow)">
        <rect x="-18" y="-6" width="36" height="6" fill="#1A1E24" stroke="#2E353E" stroke-width="0.4"/>
        <line x1="-16" y1="-3" x2="16" y2="-3" stroke="#3DD9D9" stroke-width="0.4" opacity="0.6"/>
        <polygon points="-14,-10 -14,-30 0,-40 14,-30 14,-10 0,-6" fill="#2E353E" stroke="#3DD9D9" stroke-width="0.6"/>
        <polygon points="-10,-14 -10,-28 0,-36 10,-28 10,-14 0,-12" fill="#0A0C10"/>
        <circle cx="0" cy="-22" r="4" fill="#06080B" stroke="#3DD9D9" stroke-width="0.5"/>
        <circle cx="0" cy="-22" r="2" fill="#3DD9D9"/>
        <circle cx="0" cy="-22" r="0.8" fill="#A8FFFF"/>
        <rect x="-22" y="-26" width="6" height="3" fill="#1A1E24" stroke="#3DD9D9" stroke-width="0.4"/>
        <circle cx="-19" cy="-24.5" r="0.8" fill="#7C5BD9"/>
        <rect x="16" y="-26" width="6" height="3" fill="#1A1E24" stroke="#3DD9D9" stroke-width="0.4"/>
        <circle cx="19" cy="-24.5" r="0.8" fill="#5DD39E"/>
        <line x1="-14" y1="-32" x2="-22" y2="-36" stroke="#3DD9D9" stroke-width="0.5" opacity="0.8"/>
        <line x1="14" y1="-32" x2="22" y2="-36" stroke="#3DD9D9" stroke-width="0.5" opacity="0.8"/>
        <circle cx="-22" cy="-36" r="1.2" fill="#3DD9D9"/>
        <circle cx="22" cy="-36" r="1.2" fill="#3DD9D9"/>
        <ellipse cx="0" cy="-50" rx="8" ry="2" fill="#3DD9D9" opacity="0.25"/>
      </g>`
    })(),
  },
  {
    unlockAt: 600,
    name: 'Cube-mémoire',
    svg: (() => {
      const bb = shelfBoardTop(3)
      // Pile de 3 livres horizontaux (même base que chandelier), + cube holo flottant
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
        <g transform="translate(32 -50)" filter="url(#bib-neonGlow)">
          <ellipse cx="0" cy="14" rx="10" ry="2" fill="#7C5BD9" opacity="0.35"/>
          <polygon points="-10,-2 0,-8 10,-2 10,8 0,14 -10,8" fill="none" stroke="#7C5BD9" stroke-width="0.7" opacity="0.95"/>
          <polygon points="-10,-2 0,4 10,-2" fill="none" stroke="#3DD9D9" stroke-width="0.6" opacity="0.9"/>
          <line x1="0" y1="4" x2="0" y2="14" stroke="#3DD9D9" stroke-width="0.5" opacity="0.85"/>
          <line x1="-10" y1="-2" x2="-10" y2="8" stroke="#7C5BD9" stroke-width="0.5" opacity="0.7"/>
          <line x1="10" y1="-2" x2="10" y2="8" stroke="#7C5BD9" stroke-width="0.5" opacity="0.7"/>
          <circle cx="0" cy="3" r="1.4" fill="#A8FFFF"/>
          <circle cx="-6" cy="-3" r="0.5" fill="#3DD9D9"/>
          <circle cx="6" cy="-3" r="0.5" fill="#7C5BD9"/>
          <line x1="-10" y1="-2" x2="-14" y2="-6" stroke="#3DD9D9" stroke-width="0.3" opacity="0.7"/>
          <line x1="10" y1="-2" x2="14" y2="-6" stroke="#7C5BD9" stroke-width="0.3" opacity="0.7"/>
        </g>
      </g>`
    })(),
  },
  {
    unlockAt: 1000,
    name: 'Holosphère',
    svg: (() => {
      const bb = shelfBoardTop(5)
      // Sphère holo cyan + orbites violettes + 3 satellites
      return `<g transform="translate(240 ${bb})" filter="url(#bib-neonGlow)">
        <rect x="-16" y="-8" width="32" height="8" fill="#1A1E24" stroke="#2E353E" stroke-width="0.4"/>
        <rect x="-2" y="-22" width="4" height="14" fill="#2E353E"/>
        <line x1="0" y1="-22" x2="0" y2="-8" stroke="#3DD9D9" stroke-width="0.4" opacity="0.6"/>
        <ellipse cx="-12" cy="-5" rx="3" ry="1" fill="#3DD9D9" opacity="0.35"/>
        <ellipse cx="12" cy="-5" rx="3" ry="1" fill="#3DD9D9" opacity="0.35"/>
        <circle cx="0" cy="-46" r="22" fill="#06080B" opacity="0.6"/>
        <circle cx="0" cy="-46" r="22" fill="#3DD9D9" opacity="0.18"/>
        <circle cx="0" cy="-46" r="22" fill="none" stroke="#3DD9D9" stroke-width="0.7" opacity="0.95"/>
        <ellipse cx="0" cy="-46" rx="22" ry="6" fill="none" stroke="#3DD9D9" stroke-width="0.4" opacity="0.7"/>
        <ellipse cx="0" cy="-46" rx="6" ry="22" fill="none" stroke="#3DD9D9" stroke-width="0.4" opacity="0.7"/>
        <ellipse cx="0" cy="-46" rx="30" ry="9" fill="none" stroke="#7C5BD9" stroke-width="0.5" opacity="0.9"/>
        <ellipse cx="0" cy="-46" rx="32" ry="14" fill="none" stroke="#7C5BD9" stroke-width="0.4" opacity="0.65" transform="rotate(-25 0 -46)"/>
        <circle cx="0" cy="-46" r="3" fill="#A8FFFF"/>
        <circle cx="30" cy="-46" r="1.6" fill="#3DD9D9"/>
        <circle cx="-30" cy="-46" r="1.6" fill="#5DD39E"/>
        <circle cx="0" cy="-37" r="1.4" fill="#7C5BD9"/>
        <circle cx="22" cy="-58" r="1.2" fill="#3DD9D9"/>
      </g>`
    })(),
  },
  {
    unlockAt: 1500,
    name: 'Index neural',
    svg: (() => {
      const bb = shelfBoardTop(7)
      // Graphe de noeuds : 6 cercles glow + arêtes
      return `<g transform="translate(1340 ${bb})" filter="url(#bib-neonGlow)">
        <rect x="-58" y="-6" width="116" height="6" fill="#1A1E24" stroke="#2E353E" stroke-width="0.4"/>
        <line x1="-56" y1="-3" x2="56" y2="-3" stroke="#3DD9D9" stroke-width="0.4" opacity="0.5"/>
        <g stroke="#3DD9D9" stroke-width="0.5" opacity="0.7" fill="none">
          <line x1="-40" y1="-18" x2="-12" y2="-32"/>
          <line x1="-12" y1="-32" x2="20" y2="-22"/>
          <line x1="20" y1="-22" x2="42" y2="-44"/>
          <line x1="-40" y1="-18" x2="-8" y2="-12"/>
          <line x1="-8" y1="-12" x2="20" y2="-22"/>
          <line x1="-12" y1="-32" x2="42" y2="-44"/>
          <line x1="-8" y1="-12" x2="36" y2="-14"/>
          <line x1="36" y1="-14" x2="42" y2="-44"/>
        </g>
        <circle cx="-40" cy="-18" r="3" fill="#3DD9D9"/>
        <circle cx="-40" cy="-18" r="1.4" fill="#A8FFFF"/>
        <circle cx="-12" cy="-32" r="3.2" fill="#7C5BD9"/>
        <circle cx="-12" cy="-32" r="1.4" fill="#D8C8FF"/>
        <circle cx="-8" cy="-12" r="2.4" fill="#5DD39E"/>
        <circle cx="20" cy="-22" r="3" fill="#3DD9D9"/>
        <circle cx="20" cy="-22" r="1.4" fill="#A8FFFF"/>
        <circle cx="36" cy="-14" r="2.4" fill="#7C5BD9"/>
        <circle cx="42" cy="-44" r="3.4" fill="#5DD39E"/>
        <circle cx="42" cy="-44" r="1.4" fill="#D8FFE6"/>
      </g>`
    })(),
  },
  {
    unlockAt: 2000,
    name: 'Tabula numerica',
    svg: (() => {
      const bb = shelfBoardTop(9)
      // Grand panneau holographique vertical avec lignes de "code"
      return `<g transform="translate(730 ${bb})" filter="url(#bib-neonGlow)">
        <path d="M -36 0 L -28 -8 L 28 -8 L 36 0 Z" fill="#1A1E24" stroke="#2E353E" stroke-width="0.6"/>
        <rect x="-32" y="-10" width="64" height="2" fill="#2E353E"/>
        <rect x="-30" y="-58" width="60" height="50" rx="2" fill="#06080B" stroke="#3DD9D9" stroke-width="0.8"/>
        <rect x="-30" y="-58" width="60" height="50" rx="2" fill="#3DD9D9" opacity="0.12"/>
        <line x1="-26" y1="-54" x2="-8" y2="-54" stroke="#5DD39E" stroke-width="0.4"/>
        <g stroke-width="0.5" fill="none">
          <line x1="-26" y1="-50" x2="-4" y2="-50" stroke="#3DD9D9" opacity="0.95"/>
          <line x1="-2" y1="-50" x2="14" y2="-50" stroke="#7C5BD9" opacity="0.85"/>
          <line x1="-26" y1="-46" x2="20" y2="-46" stroke="#3DD9D9" opacity="0.85"/>
          <line x1="-26" y1="-42" x2="-12" y2="-42" stroke="#5DD39E" opacity="0.9"/>
          <line x1="-10" y1="-42" x2="8" y2="-42" stroke="#3DD9D9" opacity="0.8"/>
          <line x1="10" y1="-42" x2="22" y2="-42" stroke="#7C5BD9" opacity="0.8"/>
          <line x1="-26" y1="-38" x2="2" y2="-38" stroke="#3DD9D9" opacity="0.8"/>
          <line x1="4" y1="-38" x2="24" y2="-38" stroke="#5DD39E" opacity="0.85"/>
          <line x1="-26" y1="-34" x2="-8" y2="-34" stroke="#7C5BD9" opacity="0.85"/>
          <line x1="-6" y1="-34" x2="18" y2="-34" stroke="#3DD9D9" opacity="0.8"/>
          <line x1="-26" y1="-30" x2="14" y2="-30" stroke="#3DD9D9" opacity="0.8"/>
          <line x1="-26" y1="-26" x2="-4" y2="-26" stroke="#5DD39E" opacity="0.85"/>
          <line x1="-2" y1="-26" x2="22" y2="-26" stroke="#3DD9D9" opacity="0.8"/>
          <line x1="-26" y1="-22" x2="6" y2="-22" stroke="#7C5BD9" opacity="0.85"/>
          <line x1="-26" y1="-18" x2="20" y2="-18" stroke="#3DD9D9" opacity="0.85"/>
          <line x1="-26" y1="-14" x2="-10" y2="-14" stroke="#5DD39E" opacity="0.9"/>
        </g>
        <rect x="-26" y="-12" width="3" height="2" fill="#3DD9D9"/>
        <circle cx="26" cy="-54" r="1" fill="#5DD39E"/>
        <circle cx="22" cy="-54" r="1" fill="#3DD9D9"/>
        <circle cx="18" cy="-54" r="1" fill="#7C5BD9"/>
      </g>`
    })(),
  },
]

// ============ HELPERS PUBLICS ============
/** Nombre de trésors débloqués pour un compteur de fiches donné. */
export function unlockedTreasuresCount(fichesCount: number): number {
  let n = 0
  for (const d of TREASURES_ERUDIT) {
    if (fichesCount >= d.unlockAt) n++
  }
  return n
}

/** Prochain trésor à débloquer (null si tout est débloqué). */
export function nextTreasure(fichesCount: number): { name: string; at: number } | null {
  for (const d of TREASURES_ERUDIT) {
    if (fichesCount < d.unlockAt) return { name: d.name, at: d.unlockAt }
  }
  return null
}

/** Liste complète des trésors thème ÉRUDIT (compatibilité legacy). */
export const BIBLIOTHECA_TREASURES = TREASURES_ERUDIT.map(d => ({ unlockAt: d.unlockAt, name: d.name }))

/** Liste complète des trésors thème ARCHIVE (utilisable côté dashboard). */
export const BIBLIOTHECA_TREASURES_ARCHIVE = TREASURES_ARCHIVE.map(d => ({ unlockAt: d.unlockAt, name: d.name }))

/** Nombre total de livres effectivement générés (peut différer de TOTAL_CAPACITY de quelques unités). */
export const BIBLIOTHECA_BOOKS_GENERATED = ALL_BOOKS.length

// ============ DÉTECTION AUTO DU THÈME ============
// Lit document.documentElement.dataset.theme : 'dark' → 'archive', sinon → 'erudit'.
// Re-évalue automatiquement via MutationObserver (le toggle de thème de l'app
// modifie cet attribut sans re-monter les composants).
function detectThemeFromDom(): BibliothecaTheme {
  if (typeof document === 'undefined') return 'erudit'
  return document.documentElement.dataset.theme === 'dark' ? 'archive' : 'erudit'
}

function useDetectedTheme(override?: BibliothecaTheme): BibliothecaTheme {
  const [theme, setTheme] = useState<BibliothecaTheme>(() => override ?? detectThemeFromDom())

  useEffect(() => {
    if (override) {
      setTheme(override)
      return
    }
    if (typeof document === 'undefined') return
    setTheme(detectThemeFromDom())
    const obs = new MutationObserver(() => {
      setTheme(detectThemeFromDom())
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [override])

  return theme
}

// ============ PROPS ============
type BibliothecaSvgProps = {
  /** Nombre de fiches notées (cumulé sur l'année). 1 fiche = 1 livre ajouté. */
  fichesCount: number
  /** Classe CSS sur le <svg>. */
  className?: string
  style?: CSSProperties
  /** viewBox du SVG. Default '0 0 1600 1100' (vue large complète). */
  viewBox?: string
  /** preserveAspectRatio du SVG. Default 'xMidYMid meet' : la bibliothèque
   *  entière est toujours visible (avec letterbox sur les côtés/haut/bas si le
   *  ratio du container ne matche pas). Passer 'xMidYMid slice' si on veut
   *  remplir le container quitte à cropper. */
  preserveAspectRatio?: string
  /** Forcer un thème. Si omis, détecté via document.documentElement.dataset.theme. */
  theme?: BibliothecaTheme
}

// ============ COMPOSANT ============
export default function BibliothecaSvg({
  fichesCount,
  className,
  style,
  viewBox = '0 0 1600 1100',
  preserveAspectRatio = 'xMidYMid meet',
  theme: themeProp,
}: BibliothecaSvgProps) {
  const theme = useDetectedTheme(themeProp)

  // Nombre de livres visibles : 1 fiche = 1 livre, capé à la capacité totale
  const visibleBooks = Math.min(Math.max(0, Math.floor(fichesCount)), ALL_BOOKS.length)

  // On sépare le rendu : tous les livres sauf le dernier sont stables (innerHTML
  // pour la perf) ; le dernier livre est rendu séparément avec un `key` qui
  // change à chaque incrément de fichesCount, ce qui re-monte le nœud et
  // déclenche l'animation CSS bib-book-pop-in.
  const stableCount = Math.max(0, visibleBooks - 1)
  const lastBookIdx = visibleBooks - 1

  const stableBooksHtml = useMemo(() => {
    if (stableCount === 0) return ''
    let s = ''
    for (let i = 0; i < stableCount; i++) s += ALL_BOOKS[i].svg
    return s
  }, [stableCount])

  const latestBookSvg = lastBookIdx >= 0 && lastBookIdx < ALL_BOOKS.length
    ? ALL_BOOKS[lastBookIdx].svg
    : null

  const decorations = theme === 'archive' ? TREASURES_ARCHIVE : TREASURES_ERUDIT
  const decorationsHtml = useMemo(() => {
    let s = ''
    for (const d of decorations) {
      if (fichesCount >= d.unlockAt) s += d.svg
    }
    return s
  }, [fichesCount, decorations])

  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={style}
      role="img"
      preserveAspectRatio={preserveAspectRatio}
      data-bib-theme={theme}
    >
      <title>Bibliothèque MedRev</title>

      {/* Animations CSS embarquées (auto-suffisantes, communes aux deux thèmes) */}
      <style>{`
        @keyframes bib-book-pop-in {
          0%   { transform: scaleY(0.05) translateY(0); opacity: 0; }
          55%  { transform: scaleY(1.06) translateY(0); opacity: 1; }
          100% { transform: scaleY(1) translateY(0); opacity: 1; }
        }
        @keyframes bib-book-glow {
          0%   { filter: drop-shadow(0 0 0 rgba(216, 168, 72, 0)); }
          40%  { filter: drop-shadow(0 0 8px rgba(216, 168, 72, 0.85)); }
          100% { filter: drop-shadow(0 0 0 rgba(216, 168, 72, 0)); }
        }
        .bib-book-pop {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: bib-book-pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both,
                     bib-book-glow 0.9s ease-out both;
        }
        @keyframes bib-treasure-unlock {
          0%   { transform: scale(0.4); opacity: 0; filter: drop-shadow(0 0 16px #D8A848); }
          60%  { transform: scale(1.12); opacity: 1; filter: drop-shadow(0 0 12px #D8A848); }
          100% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 0 transparent); }
        }
        @keyframes bib-data-twinkle {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 0.95; }
        }
        [data-bib-theme="archive"] .bib-data-pt { animation: bib-data-twinkle 3.4s ease-in-out infinite; }
      `}</style>

      <defs>
        {/* === GRADIENTS COMMUNS === */}
        <linearGradient id="bib-undershadow-erudit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(60,40,20,0.45)" />
          <stop offset="100%" stopColor="rgba(60,40,20,0)" />
        </linearGradient>
        <linearGradient id="bib-undershadow-archive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>

        {/* === GRADIENTS / FILTRES THÈME ÉRUDIT === */}
        <linearGradient id="bib-wallGrad-erudit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FAFAF7" />
          <stop offset="55%" stopColor="#F0EAD8" />
          <stop offset="100%" stopColor="#E5DCC2" />
        </linearGradient>
        <linearGradient id="bib-walnutFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C5A37D" />
          <stop offset="50%" stopColor="#A48159" />
          <stop offset="100%" stopColor="#8C6839" />
        </linearGradient>
        <linearGradient id="bib-walnutSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8C6839" />
          <stop offset="100%" stopColor="#5C3A21" />
        </linearGradient>
        <linearGradient id="bib-shelfBoard-erudit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B58A60" />
          <stop offset="40%" stopColor="#8C6839" />
          <stop offset="100%" stopColor="#5C3A21" />
        </linearGradient>
        <linearGradient id="bib-floorGrad-erudit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A48159" />
          <stop offset="100%" stopColor="#5C3A21" />
        </linearGradient>
        <radialGradient id="bib-warmGlow-erudit" cx="22%" cy="18%" r="75%">
          <stop offset="0%" stopColor="rgba(255,225,160,0.32)" />
          <stop offset="40%" stopColor="rgba(255,200,130,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <radialGradient id="bib-vignette-erudit" cx="50%" cy="50%" r="78%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="65%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(80,55,30,0.28)" />
        </radialGradient>
        <linearGradient id="bib-lightShaft-erudit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,235,170,0.35)" />
          <stop offset="40%" stopColor="rgba(255,215,140,0.1)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <filter id="bib-woodGrain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.85" numOctaves={2} seed={3} stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.32  0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 0.22 0" />
        </filter>
        <linearGradient id="bib-marble" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4ECDA" />
          <stop offset="50%" stopColor="#D8C8A8" />
          <stop offset="100%" stopColor="#A88058" />
        </linearGradient>
        <radialGradient id="bib-marbleHi" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="rgba(255,250,235,0.7)" />
          <stop offset="100%" stopColor="rgba(255,250,235,0)" />
        </radialGradient>
        <linearGradient id="bib-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8C078" />
          <stop offset="50%" stopColor="#B08838" />
          <stop offset="100%" stopColor="#7A5A20" />
        </linearGradient>
        <radialGradient id="bib-flame" cx="50%" cy="60%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,200,0.95)" />
          <stop offset="50%" stopColor="rgba(255,180,80,0.7)" />
          <stop offset="100%" stopColor="rgba(255,140,40,0)" />
        </radialGradient>
        <radialGradient id="bib-globe" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#7AAACE" />
          <stop offset="55%" stopColor="#3A6280" />
          <stop offset="100%" stopColor="#1A2F40" />
        </radialGradient>
        <linearGradient id="bib-scroll" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0E5C8" />
          <stop offset="100%" stopColor="#A88058" />
        </linearGradient>

        {/* === GRADIENTS / FILTRES THÈME ARCHIVE === */}
        <linearGradient id="bib-wallGrad-archive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A0E14" />
          <stop offset="50%" stopColor="#06080B" />
          <stop offset="100%" stopColor="#03050A" />
        </linearGradient>
        <linearGradient id="bib-metalFace-archive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2E353E" />
          <stop offset="50%" stopColor="#1A1E24" />
          <stop offset="100%" stopColor="#0A0C10" />
        </linearGradient>
        <linearGradient id="bib-metalSide-archive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A1E24" />
          <stop offset="100%" stopColor="#0A0C10" />
        </linearGradient>
        <linearGradient id="bib-shelfBoard-archive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A4250" />
          <stop offset="45%" stopColor="#1A1E24" />
          <stop offset="100%" stopColor="#0A0C10" />
        </linearGradient>
        <linearGradient id="bib-floorGrad-archive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A0E14" />
          <stop offset="100%" stopColor="#03050A" />
        </linearGradient>
        <radialGradient id="bib-vignette-archive" cx="50%" cy="50%" r="78%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
        </radialGradient>
        <linearGradient id="bib-ledGlow-archive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(61,217,217,0.55)" />
          <stop offset="60%" stopColor="rgba(61,217,217,0.08)" />
          <stop offset="100%" stopColor="rgba(61,217,217,0)" />
        </linearGradient>
        <radialGradient id="bib-statusLed-cyan" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A8FFFF" />
          <stop offset="40%" stopColor="#3DD9D9" />
          <stop offset="100%" stopColor="rgba(61,217,217,0)" />
        </radialGradient>
        <radialGradient id="bib-statusLed-emerald" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#D8FFE6" />
          <stop offset="40%" stopColor="#5DD39E" />
          <stop offset="100%" stopColor="rgba(93,211,158,0)" />
        </radialGradient>
        <filter id="bib-ledFilter" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id="bib-neonGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ====================================================== */}
      {/* === RENDU PAR THÈME ===                                 */}
      {/* ====================================================== */}
      {theme === 'erudit' ? (
        <>
          {/* === ARRIÈRE-PLAN (mur clair derrière le meuble) === */}
          <rect width="1600" height="1100" fill="url(#bib-wallGrad-erudit)" />

          {/* === SOL (parquet en perspective légère) === */}
          <rect x="0" y="945" width="1600" height="155" fill="url(#bib-floorGrad-erudit)" />
          <g stroke="#5C3A21" strokeWidth="0.8" opacity="0.6">
            <line x1="160" y1="945" x2="120" y2="1100" />
            <line x1="380" y1="945" x2="350" y2="1100" />
            <line x1="600" y1="945" x2="585" y2="1100" />
            <line x1="820" y1="945" x2="820" y2="1100" />
            <line x1="1040" y1="945" x2="1055" y2="1100" />
            <line x1="1260" y1="945" x2="1290" y2="1100" />
            <line x1="1480" y1="945" x2="1530" y2="1100" />
          </g>
          <line x1="0" y1="945" x2="1600" y2="945" stroke="#8C6839" strokeWidth="1.2" />

          {/* === CADRE EXTÉRIEUR — noyer clair === */}
          <rect x="50" y="45" width="1500" height="14" fill="url(#bib-walnutFace)" />
          <rect x="60" y="59" width="1480" height="22" fill="url(#bib-walnutFace)" />
          <rect x="60" y="59" width="1480" height="22" filter="url(#bib-woodGrain)" />
          <rect x="74" y="81" width="1452" height="6" fill="url(#bib-walnutSide)" />
          <rect x="84" y="87" width="1432" height="14" fill="url(#bib-walnutFace)" />
          <rect x="84" y="87" width="1432" height="14" filter="url(#bib-woodGrain)" />
          <line x1="50" y1="45" x2="1550" y2="45" stroke="#8C6839" strokeWidth="0.6" opacity="0.7" />
          <line x1="50" y1="59" x2="1550" y2="59" stroke="#5C3A21" strokeWidth="1.2" />
          <line x1="74" y1="87" x2="1526" y2="87" stroke="#5C3A21" strokeWidth="1" />
          <line x1="84" y1="101" x2="1516" y2="101" stroke="#5C3A21" strokeWidth="1.2" />

          {/* Médaillon central (M·R) */}
          <g transform="translate(800 65)">
            <ellipse cx="0" cy="0" rx="32" ry="14" fill="url(#bib-walnutSide)" stroke="#5C3A21" strokeWidth="0.8" />
            <ellipse cx="0" cy="0" rx="22" ry="9" fill="none" stroke="#B08838" strokeWidth="0.5" opacity="0.9" />
            <text y="3.5" textAnchor="middle" fontFamily="Cinzel,serif" fontSize="9" fill="#7A5A20" letterSpacing="2">M·R</text>
          </g>

          {/* Pilastres latéraux */}
          <rect x="50" y="101" width="60" height="844" fill="url(#bib-walnutFace)" />
          <rect x="50" y="101" width="60" height="844" filter="url(#bib-woodGrain)" />
          <line x1="50" y1="101" x2="50" y2="945" stroke="#8C6839" strokeWidth="0.6" opacity="0.6" />
          <line x1="110" y1="101" x2="110" y2="945" stroke="#5C3A21" strokeWidth="1.4" />
          <rect x="68" y="120" width="22" height="810" fill="url(#bib-walnutSide)" />
          <rect x="74" y="124" width="10" height="800" fill="none" stroke="#8C6839" strokeWidth="0.5" opacity="0.75" />

          <rect x="1490" y="101" width="60" height="844" fill="url(#bib-walnutFace)" />
          <rect x="1490" y="101" width="60" height="844" filter="url(#bib-woodGrain)" />
          <line x1="1550" y1="101" x2="1550" y2="945" stroke="#8C6839" strokeWidth="0.6" opacity="0.6" />
          <line x1="1490" y1="101" x2="1490" y2="945" stroke="#5C3A21" strokeWidth="1.4" />
          <rect x="1510" y="120" width="22" height="810" fill="url(#bib-walnutSide)" />
          <rect x="1516" y="124" width="10" height="800" fill="none" stroke="#8C6839" strokeWidth="0.5" opacity="0.75" />

          {/* Plinthe (bas) */}
          <rect x="60" y="945" width="1480" height="20" fill="url(#bib-walnutFace)" />
          <rect x="60" y="945" width="1480" height="20" filter="url(#bib-woodGrain)" />
          <rect x="50" y="965" width="1500" height="18" fill="url(#bib-walnutSide)" />
          <line x1="50" y1="945" x2="1550" y2="945" stroke="#8C6839" strokeWidth="0.5" opacity="0.6" />
          <line x1="60" y1="965" x2="1540" y2="965" stroke="#5C3A21" strokeWidth="1.2" />

          {/* Intérieur du meuble (parchemin) */}
          <rect x="110" y="101" width="1380" height="844" fill="#F0E5C8" />

          {/* === ÉTAGÈRES === */}
          <g dangerouslySetInnerHTML={{ __html: SHELVES_HTML_ERUDIT }} />

          {/* === LIVRES STABLES === */}
          <g dangerouslySetInnerHTML={{ __html: stableBooksHtml }} />

          {/* === DERNIER LIVRE (anim pop-in) === */}
          {latestBookSvg && (
            <g
              key={lastBookIdx}
              className="bib-book-pop"
              dangerouslySetInnerHTML={{ __html: latestBookSvg }}
            />
          )}

          {/* === DÉCORATIONS / TRÉSORS === */}
          <g dangerouslySetInnerHTML={{ __html: decorationsHtml }} />

          {/* === ATMOSPHÈRE : faisceau de lumière du jour, glow chaud, vignette === */}
          <polygon points="60,101 800,101 200,945 60,945" fill="url(#bib-lightShaft-erudit)" pointerEvents="none" />
          <rect width="1600" height="1100" fill="url(#bib-warmGlow-erudit)" pointerEvents="none" />
          <rect width="1600" height="1100" fill="url(#bib-vignette-erudit)" pointerEvents="none" />

          {/* Particules de poussière dorées dans le faisceau */}
          <g pointerEvents="none">
            <circle cx="290" cy="280" r="0.7" fill="rgba(180,140,70,0.55)" />
            <circle cx="350" cy="360" r="0.5" fill="rgba(180,140,70,0.4)" />
            <circle cx="410" cy="420" r="0.6" fill="rgba(180,140,70,0.5)" />
            <circle cx="320" cy="500" r="0.4" fill="rgba(180,140,70,0.35)" />
            <circle cx="450" cy="560" r="0.7" fill="rgba(180,140,70,0.5)" />
            <circle cx="380" cy="640" r="0.5" fill="rgba(180,140,70,0.45)" />
            <circle cx="520" cy="720" r="0.6" fill="rgba(180,140,70,0.4)" />
            <circle cx="270" cy="800" r="0.5" fill="rgba(180,140,70,0.35)" />
            <circle cx="600" cy="380" r="0.4" fill="rgba(180,140,70,0.4)" />
            <circle cx="700" cy="560" r="0.5" fill="rgba(180,140,70,0.35)" />
            <circle cx="250" cy="430" r="0.35" fill="rgba(180,140,70,0.35)" />
            <circle cx="160" cy="320" r="0.4" fill="rgba(180,140,70,0.4)" />
          </g>
        </>
      ) : (
        <>
          {/* === ARRIÈRE-PLAN (mur très sombre) === */}
          <rect width="1600" height="1100" fill="url(#bib-wallGrad-archive)" />

          {/* === SOL (dalles polies sombres) === */}
          <rect x="0" y="945" width="1600" height="155" fill="url(#bib-floorGrad-archive)" />
          <g stroke="#1A1E24" strokeWidth="0.8" opacity="0.85">
            <line x1="160" y1="945" x2="120" y2="1100" />
            <line x1="380" y1="945" x2="350" y2="1100" />
            <line x1="600" y1="945" x2="585" y2="1100" />
            <line x1="820" y1="945" x2="820" y2="1100" />
            <line x1="1040" y1="945" x2="1055" y2="1100" />
            <line x1="1260" y1="945" x2="1290" y2="1100" />
            <line x1="1480" y1="945" x2="1530" y2="1100" />
          </g>
          {/* Reflet cyan léger au sol (ambiance vitrine) */}
          <rect x="0" y="945" width="1600" height="35" fill="rgba(61,217,217,0.04)" pointerEvents="none" />
          <line x1="0" y1="945" x2="1600" y2="945" stroke="#3DD9D9" strokeWidth="0.7" opacity="0.4" />

          {/* === CADRE EXTÉRIEUR : métal noir poli === */}
          <rect x="50" y="45" width="1500" height="14" fill="url(#bib-metalFace-archive)" />
          <rect x="60" y="59" width="1480" height="22" fill="url(#bib-metalFace-archive)" />
          <rect x="74" y="81" width="1452" height="6" fill="url(#bib-metalSide-archive)" />
          <rect x="84" y="87" width="1432" height="14" fill="url(#bib-metalFace-archive)" />
          <line x1="50" y1="45" x2="1550" y2="45" stroke="#3A4250" strokeWidth="0.6" opacity="0.8" />
          <line x1="50" y1="59" x2="1550" y2="59" stroke="#000000" strokeWidth="1.2" />
          <line x1="74" y1="87" x2="1526" y2="87" stroke="#000000" strokeWidth="1" />
          <line x1="84" y1="101" x2="1516" y2="101" stroke="#000000" strokeWidth="1.2" />

          {/* Bandeau LED supérieur sur toute la largeur (signature de la vitrine) */}
          <rect x="120" y="92" width="1360" height="1.6" fill="#3DD9D9" filter="url(#bib-ledFilter)" opacity="0.9" />

          {/* Médaillon central (M·R numérique) */}
          <g transform="translate(800 65)">
            <ellipse cx="0" cy="0" rx="32" ry="14" fill="url(#bib-metalSide-archive)" stroke="#3A4250" strokeWidth="0.8" />
            <ellipse cx="0" cy="0" rx="22" ry="9" fill="none" stroke="#3DD9D9" strokeWidth="0.5" opacity="0.9" />
            <text y="3.5" textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="9" fill="#3DD9D9" letterSpacing="2">M·R</text>
          </g>

          {/* Pilastres latéraux + indicateurs LED status (cyan/emerald) aux extrêmes */}
          <rect x="50" y="101" width="60" height="844" fill="url(#bib-metalFace-archive)" />
          <line x1="50" y1="101" x2="50" y2="945" stroke="#3A4250" strokeWidth="0.6" opacity="0.6" />
          <line x1="110" y1="101" x2="110" y2="945" stroke="#000000" strokeWidth="1.4" />
          <rect x="68" y="120" width="22" height="810" fill="url(#bib-metalSide-archive)" />
          <rect x="74" y="124" width="10" height="800" fill="none" stroke="#3A4250" strokeWidth="0.5" opacity="0.75" />
          {/* LEDs status pilastre gauche */}
          <circle cx="80" cy="155" r="2.4" fill="url(#bib-statusLed-cyan)" className="bib-data-pt" />
          <circle cx="80" cy="180" r="1.8" fill="url(#bib-statusLed-emerald)" className="bib-data-pt" style={{ animationDelay: '0.7s' }} />
          <circle cx="80" cy="900" r="2" fill="url(#bib-statusLed-cyan)" className="bib-data-pt" style={{ animationDelay: '1.4s' }} />

          <rect x="1490" y="101" width="60" height="844" fill="url(#bib-metalFace-archive)" />
          <line x1="1550" y1="101" x2="1550" y2="945" stroke="#3A4250" strokeWidth="0.6" opacity="0.6" />
          <line x1="1490" y1="101" x2="1490" y2="945" stroke="#000000" strokeWidth="1.4" />
          <rect x="1510" y="120" width="22" height="810" fill="url(#bib-metalSide-archive)" />
          <rect x="1516" y="124" width="10" height="800" fill="none" stroke="#3A4250" strokeWidth="0.5" opacity="0.75" />
          {/* LEDs status pilastre droit */}
          <circle cx="1520" cy="155" r="2.4" fill="url(#bib-statusLed-emerald)" className="bib-data-pt" style={{ animationDelay: '0.3s' }} />
          <circle cx="1520" cy="180" r="1.8" fill="url(#bib-statusLed-cyan)" className="bib-data-pt" style={{ animationDelay: '1.1s' }} />
          <circle cx="1520" cy="900" r="2" fill="url(#bib-statusLed-emerald)" className="bib-data-pt" style={{ animationDelay: '1.9s' }} />

          {/* Plinthe (bas) */}
          <rect x="60" y="945" width="1480" height="20" fill="url(#bib-metalFace-archive)" />
          <rect x="50" y="965" width="1500" height="18" fill="url(#bib-metalSide-archive)" />
          <line x1="50" y1="945" x2="1550" y2="945" stroke="#3A4250" strokeWidth="0.5" opacity="0.6" />
          <line x1="60" y1="965" x2="1540" y2="965" stroke="#000000" strokeWidth="1.2" />

          {/* Intérieur du meuble (fond très sombre) */}
          <rect x="110" y="101" width="1380" height="844" fill="#06080B" />

          {/* === ÉTAGÈRES (métal noir + LED cyan en haut) === */}
          <g dangerouslySetInnerHTML={{ __html: SHELVES_HTML_ARCHIVE }} />

          {/* === LIVRES STABLES === */}
          <g dangerouslySetInnerHTML={{ __html: stableBooksHtml }} />

          {/* === DERNIER LIVRE (anim pop-in) === */}
          {latestBookSvg && (
            <g
              key={lastBookIdx}
              className="bib-book-pop"
              dangerouslySetInnerHTML={{ __html: latestBookSvg }}
            />
          )}

          {/* === DÉCORATIONS / TRÉSORS (numériques) === */}
          <g dangerouslySetInnerHTML={{ __html: decorationsHtml }} />

          {/* === ATMOSPHÈRE === */}
          {/* Vignette douce */}
          <rect width="1600" height="1100" fill="url(#bib-vignette-archive)" pointerEvents="none" />

          {/* Data points qui scintillent (cyan/emerald/violet) */}
          <g pointerEvents="none">
            <circle cx="220" cy="200" r="1.2" fill="#3DD9D9" className="bib-data-pt" />
            <circle cx="380" cy="320" r="1" fill="#5DD39E" className="bib-data-pt" style={{ animationDelay: '0.5s' }} />
            <circle cx="500" cy="240" r="0.9" fill="#7C5BD9" className="bib-data-pt" style={{ animationDelay: '1.0s' }} />
            <circle cx="640" cy="180" r="1.1" fill="#3DD9D9" className="bib-data-pt" style={{ animationDelay: '1.6s' }} />
            <circle cx="900" cy="220" r="1" fill="#5DD39E" className="bib-data-pt" style={{ animationDelay: '0.8s' }} />
            <circle cx="1080" cy="300" r="1.2" fill="#3DD9D9" className="bib-data-pt" style={{ animationDelay: '2.2s' }} />
            <circle cx="1240" cy="180" r="1" fill="#7C5BD9" className="bib-data-pt" style={{ animationDelay: '1.3s' }} />
            <circle cx="320" cy="560" r="1.1" fill="#3DD9D9" className="bib-data-pt" style={{ animationDelay: '0.4s' }} />
            <circle cx="540" cy="660" r="0.9" fill="#5DD39E" className="bib-data-pt" style={{ animationDelay: '2.0s' }} />
            <circle cx="720" cy="600" r="1" fill="#7C5BD9" className="bib-data-pt" style={{ animationDelay: '1.1s' }} />
            <circle cx="980" cy="640" r="1.2" fill="#3DD9D9" className="bib-data-pt" style={{ animationDelay: '0.6s' }} />
            <circle cx="1180" cy="560" r="1" fill="#5DD39E" className="bib-data-pt" style={{ animationDelay: '2.5s' }} />
            <circle cx="1340" cy="700" r="1.1" fill="#3DD9D9" className="bib-data-pt" style={{ animationDelay: '1.7s' }} />
            <circle cx="260" cy="800" r="1" fill="#7C5BD9" className="bib-data-pt" style={{ animationDelay: '0.9s' }} />
            <circle cx="600" cy="860" r="1.1" fill="#5DD39E" className="bib-data-pt" style={{ animationDelay: '2.3s' }} />
            <circle cx="1100" cy="820" r="1" fill="#3DD9D9" className="bib-data-pt" style={{ animationDelay: '1.5s' }} />
          </g>
        </>
      )}
    </svg>
  )
}

// ============ COMPOSANT : PANEL DES TRÉSORS (sidebar) ============
// Liste verticale des 6 trésors. Verrouillés : silhouette + nom masqué.
// Débloqués : nom révélé + petit indicateur d'or. Le prochain palier est mis
// en avant avec un compteur "encore X h" pour donner un horizon.

type BibliothecaTreasuresPanelProps = {
  fichesCount: number
  className?: string
  style?: CSSProperties
  /** Affiche un en-tête avec le compteur d'ouvrages. Default true. */
  showHeader?: boolean
  /** Forcer un thème. Si omis, détecté via document.documentElement.dataset.theme. */
  theme?: BibliothecaTheme
}

export function BibliothecaTreasuresPanel({
  fichesCount,
  className,
  style,
  showHeader = true,
  theme: themeProp,
}: BibliothecaTreasuresPanelProps) {
  const theme = useDetectedTheme(themeProp)
  const treasures = theme === 'archive' ? TREASURES_ARCHIVE : TREASURES_ERUDIT
  const upcoming = nextTreasure(fichesCount)
  const treasuresUnlocked = unlockedTreasuresCount(fichesCount)
  const progressPct = Math.min(100, (fichesCount / BIBLIOTHECA_TOTAL_CAPACITY) * 100)

  // En mode archive on ajoute la classe modificatrice .bib-treasures-archive
  // (le CSS dédié peut alors restyler parchemin/laiton → métal/néon).
  const rootCls = [
    'bib-treasures',
    theme === 'archive' ? 'bib-treasures-archive' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <aside className={rootCls} style={style} aria-label="Trésors de la bibliothèque">
      {showHeader && (
        <header className="bib-treasures-header">
          <div className="bib-treasures-kicker">Bibliotheca</div>
          <div className="bib-treasures-count">
            <span className="bib-treasures-count-num">{fichesCount}</span>
            <span className="bib-treasures-count-sep">/</span>
            <span className="bib-treasures-count-tot">{BIBLIOTHECA_TOTAL_CAPACITY}</span>
            <span className="bib-treasures-count-lbl">ouvrages</span>
          </div>
          <div className="bib-treasures-progress" aria-hidden="true">
            <div className="bib-treasures-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
        </header>
      )}
      <div className="bib-treasures-title">Trésors · {treasuresUnlocked}/6</div>
      <ol className="bib-treasures-list">
        {treasures.map((d) => {
          const unlocked = fichesCount >= d.unlockAt
          const isNext = !unlocked && upcoming?.at === d.unlockAt
          const cls = ['bib-treasure', unlocked ? 'unlocked' : 'locked', isNext ? 'next' : ''].filter(Boolean).join(' ')
          return (
            <li key={d.unlockAt} className={cls}>
              <span className="bib-treasure-marker" aria-hidden="true">
                {unlocked ? '✦' : (isNext ? '◆' : '·')}
              </span>
              <span className="bib-treasure-info">
                <span className="bib-treasure-threshold">{d.unlockAt}h</span>
                <span className="bib-treasure-name">
                  {unlocked ? d.name : (isNext ? `Encore ${d.unlockAt - fichesCount} h` : '???')}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
