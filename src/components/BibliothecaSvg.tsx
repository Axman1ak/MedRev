// src/components/BibliothecaSvg.tsx
// Bibliothèque MedRev — vue cumulative annuelle, 2 thèmes (érudit clair / archive sombre).
// Chaque fiche notée ajoute 1 livre (cap = BIBLIOTHECA_TOTAL_CAPACITY = 2000).
// 6 trésors décoratifs se débloquent à 100/300/600/900/1200/1500 fiches.
//
// viewBox étendu (-112 0 2109 1185, aspect 1.78 / 16:9) avec preserveAspectRatio
// "xMidYMid slice" pour que le SVG remplisse intégralement n'importe quel
// container sans jamais laisser apparaître le bg du parent. Le mur et le sol
// du SVG s'étendent bien au-delà du meuble pour combler le viewport entier.
//
// Tous les fills/stops du SVG utilisent des CSS variables (var(--wall-1) etc.)
// définies dans globals.css avec override [data-theme="dark"] — le thème change
// automatiquement quand l'attribut data-theme bascule sur <html>.
//
// Utilisé sur la page Focus (zone hero, plein écran) ET sur le Dashboard
// (mini-vue dans la card today). Les livres sont pré-générés à l'import (PRNG
// seedé) et rendus via dangerouslySetInnerHTML pour bypass de la réconciliation
// React (~2000 livres × ~10 sous-éléments = 20000 nœuds, trop coûteux à diff).

import { useMemo, useEffect, useRef, type CSSProperties } from 'react'

// ============ CSS VARIABLES THÈME ============
// Tokens injectés UNE FOIS au montage du premier composant. Les valeurs
// basculent automatiquement avec [data-theme="dark"] sur <html>. Côté light
// = cabinet d'érudit (parchemin / noyer clair / laiton). Côté dark = archive
// musée (anthracite / acier brossé / cyan LED).
const BIB_TOKENS_CSS = `
:root, [data-theme="light"] {
  /* "Bibliothèque de nuit" — accordée à la palette Marine du site
     (rail #15304E, accent #7FB0D4). Le laiton devient argent lunaire. */
  --bib-wall-1: #23456A;
  --bib-wall-2: #16314E;
  --bib-wall-3: #0D2138;
  --bib-floor-1: #13283E;
  --bib-floor-2: #081624;
  --bib-walnut-face-1: #33485E;
  --bib-walnut-face-2: #22344A;
  --bib-walnut-face-3: #16243A;
  --bib-walnut-side-1: #22344A;
  --bib-walnut-side-2: #101E32;
  --bib-shelf-board-1: #33485E;
  --bib-shelf-board-2: #1C2C42;
  --bib-shelf-board-3: #101E30;
  --bib-warm-glow-1: rgba(127, 176, 212, 0.14);
  --bib-warm-glow-2: rgba(127, 176, 212, 0.05);
  --bib-vignette-edge: rgba(2, 10, 20, 0.50);
  --bib-light-shaft-1: rgba(168, 208, 236, 0.16);
  --bib-light-shaft-2: rgba(168, 208, 236, 0.05);
  --bib-interior-bg: #122A44;
  --bib-line-dark: #0E1E30;
  --bib-line-darker: #040C16;
  --bib-brass-1: #C8DCEC;
  --bib-brass-2: #7FB0D4;
  --bib-brass-3: #3E6E96;
  --bib-dust: rgba(168, 208, 236, 0.50);
}
[data-theme="dark"] {
  --bib-wall-1: #0E1218;
  --bib-wall-2: #080A0E;
  --bib-wall-3: #04060A;
  --bib-floor-1: #0B0E14;
  --bib-floor-2: #03050A;
  --bib-walnut-face-1: #2C313A;
  --bib-walnut-face-2: #1B2028;
  --bib-walnut-face-3: #0F1318;
  --bib-walnut-side-1: #1B2028;
  --bib-walnut-side-2: #0A0C10;
  --bib-shelf-board-1: #2C313A;
  --bib-shelf-board-2: #14181F;
  --bib-shelf-board-3: #0A0C10;
  --bib-warm-glow-1: rgba(91, 227, 240, 0.06);
  --bib-warm-glow-2: rgba(91, 227, 240, 0.02);
  --bib-vignette-edge: rgba(0, 0, 0, 0.65);
  --bib-light-shaft-1: rgba(91, 227, 240, 0.06);
  --bib-light-shaft-2: rgba(91, 227, 240, 0.02);
  --bib-interior-bg: #04060A;
  --bib-line-dark: rgba(91, 227, 240, 0.30);
  --bib-line-darker: rgba(91, 227, 240, 0.55);
  --bib-brass-1: #8BEEF8;
  --bib-brass-2: #5BE3F0;
  --bib-brass-3: #2A8090;
  --bib-dust: rgba(91, 227, 240, 0.55);
}
`

let __bibTokensInjected = false
function injectBibTokens() {
  if (typeof document === 'undefined') return
  if (__bibTokensInjected) return
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-bib-tokens', '')
  styleEl.textContent = BIB_TOKENS_CSS
  document.head.appendChild(styleEl)
  __bibTokensInjected = true
}

// ============ CONSTANTES EXPORTÉES ============
/** Capacité maximale de la bibliothèque. À ce nombre de fiches, elle est complète. */
export const BIBLIOTHECA_TOTAL_CAPACITY = 2000

/** Cible de complétion : 2000h cumulées (~ 1 année P1, 1 fiche ≈ 1h en moyenne). */
export const BIBLIOTHECA_TIME_TO_FULL_MS = 2000 * 60 * 60 * 1000

// ============ GÉOMÉTRIE INTERNE ============
// viewBox étendu pour aspect 1.78 (16:9). Le meuble lui-même garde ses
// dimensions originales (FRAME_LEFT 130 etc.), seul le mur s'étend autour.
const VIEWBOX_X = -112
const VIEWBOX_Y = 0
const VIEWBOX_W = 2109
const VIEWBOX_H = 1185

const FRAME_LEFT = 130
const FRAME_RIGHT = 1755   // étendu de 1470→1755 pour fit ~182 livres/étagère
const FRAME_TOP = 115
const FRAME_BOTTOM = 1025  // étendu de 940→1025 pour la 11e étagère
const SHELF_COUNT = 11
const SHELF_PITCH = (FRAME_BOTTOM - FRAME_TOP) / SHELF_COUNT
const BOARD_THICKNESS = 7

// ============ PALETTE CUIR (commune aux 2 thèmes) ============
// 18 tons de cuir vieilli, saturation modérée pour cohésion visuelle.
// Palette "nuit" : cuirs assourdis froids (ardoise, sapin, prune, bordeaux
// éteint, indigo) + titres argentés — accordés au mur marine.
type LeatherTone = { main: string; accent: string; title: string }
// Palette "joyaux de nuit" : les tons éteints précédents se fondaient dans
// le mur marine (retour Lou : "trop fade"). Cuirs francs et saturés —
// royal, émeraude, bordeaux, violet, turquoise + quelques chauds de
// bibliothèque classique (caramel, brique) — qui ressortent sur le fond
// sombre tout en restant nocturnes.
const PALETTE: LeatherTone[] = [
  { main: '#2E5A8E', accent: '#4878B0', title: '#C8E0F4' },
  { main: '#1E3E66', accent: '#33598C', title: '#9CC0E4' },
  { main: '#1E5E48', accent: '#338068', title: '#A8DCC8' },
  { main: '#174434', accent: '#2A6650', title: '#8CC4AC' },
  { main: '#7A2E3E', accent: '#A04458', title: '#ECB8C4' },
  { main: '#5C2030', accent: '#84364A', title: '#D8A4B4' },
  { main: '#4A3070', accent: '#684E96', title: '#CCB8EC' },
  { main: '#38245C', accent: '#543E80', title: '#B4A0DC' },
  { main: '#1E6070', accent: '#338698', title: '#A8DCE8' },
  { main: '#14485C', accent: '#256880', title: '#90C4D8' },
  { main: '#8A5A2E', accent: '#B07A44', title: '#F0D8B0' },
  { main: '#934832', accent: '#B86448', title: '#F0C0AC' },
  { main: '#34509E', accent: '#4C6CC0', title: '#C0D0F4' },
  { main: '#24356E', accent: '#3A4E94', title: '#A4B4E8' },
  { main: '#6E6028', accent: '#94823C', title: '#E8D898' },
  { main: '#8CA4BC', accent: '#A8BCD0', title: '#1C2B3C' },
  { main: '#C4D4E4', accent: '#D8E4F0', title: '#3E5366' },
  { main: '#643A78', accent: '#86549E', title: '#DCBCEC' },
]

// Cuirs des OUVRAGES D'ARGENT (rares). Déclaré ici car utilisé par l'IIFE
// ALL_BOOKS qui s'exécute au chargement du module (ordre d'évaluation).
const RARE_LEATHERS = ['#0E1C30', '#1C1430', '#0E2628', '#241430', '#101A3A']

// ============ ZONES RÉSERVÉES POUR LES TRÉSORS ============
// Positions remappées sur le viewBox étendu (FRAME_RIGHT 1755 vs 1470 original) :
// - shelf 0 left: 165-248 (inchangé, bord gauche)
// - shelf 0 right: 1625-1715 (décalé +285)
// - shelf 3 center: 882-982 (recentré sur nouveau milieu 942)
// - shelf 5 left: 200-280 (inchangé)
// - shelf 7 right: 1565-1695 (décalé +285)
// - shelf 9 center: 822-922 (recentré)
type DecoZone = { x: number; x2: number }
const DECO_ZONES: Record<number, DecoZone[]> = {
  0: [{ x: 165, x2: 248 }, { x: 1625, x2: 1715 }],
  3: [{ x: 882, x2: 982 }],
  5: [{ x: 200, x2: 280 }],
  7: [{ x: 1565, x2: 1695 }],
  9: [{ x: 822, x2: 922 }],
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
    s += `<rect x="${FRAME_LEFT}" y="${yBoardTop - 14}" width="${FRAME_RIGHT - FRAME_LEFT}" height="14" fill="url(#bib-undershadow)"/>`
    s += `<rect x="${FRAME_LEFT - 8}" y="${yBoardTop}" width="${FRAME_RIGHT - FRAME_LEFT + 16}" height="${BOARD_THICKNESS}" fill="url(#bib-shelfBoard)"/>`
    s += `<line x1="${FRAME_LEFT - 8}" y1="${yBoardTop}" x2="${FRAME_RIGHT + 8}" y2="${yBoardTop}" stroke="var(--bib-line-dark, #2C415A)" stroke-width="0.5" opacity="0.7"/>`
    s += `<line x1="${FRAME_LEFT - 8}" y1="${yBoardTop + BOARD_THICKNESS}" x2="${FRAME_RIGHT + 8}" y2="${yBoardTop + BOARD_THICKNESS}" stroke="var(--bib-line-darker, #0A0503)" stroke-width="0.8"/>`
  }
  return s
})()

// ============ PRÉ-GÉNÉRATION DE TOUS LES LIVRES ============
// Calcul fait UNE FOIS à l'import du module (déterministe via PRNG seedé).
// Ordre : étagère par étagère, gauche à droite. C'est l'ordre dans lequel
// les livres apparaîtront au fil des fiches notées.
//
// NOUVEAU (refonte "bibliothèque vivante") :
// - ~1 livre sur 22 est un OUVRAGE DORÉ (rare) : plus grand, reliure gemmée,
//   dorures pleines, et un glint lumineux périodique. Déterministe (PRNG),
//   donc le même livre est doré pour tout le monde au même rang — la
//   récompense variable : "le prochain sera-t-il doré ?".
// - Chaque livre mémorise sa position (cx, top) pour viser la bouffée de
//   poussière au pop-in, et son étagère pour les plaques de complétion.
type Book = { svg: string; shelf: number; cx: number; top: number; rare: boolean }

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
    let groupRare = false

    while (cursor < FRAME_RIGHT - 8) {
      const zone = zones.find((z) => cursor >= z.x - 2 && cursor < z.x2)
      if (zone) { cursor = zone.x2 + 2; continue }

      if (groupRemaining === 0) {
        if (rand() < 0.045) {
          // OUVRAGE DORÉ — rare, toujours seul. Plus grand et plus large,
          // mais ≤ 74 pour tenir sous la planche (hauteur compartiment ~75).
          groupRemaining = 1
          groupRare = true
          groupColor = PALETTE[Math.floor(rand() * PALETTE.length)]
          groupHeight = 70 + Math.floor(rand() * 5)
          groupWidth = 12 + Math.floor(rand() * 4)
        } else if (rand() < 0.32) {
          // Série multi-volumes (3-7 livres mêmes couleurs/hauteurs)
          groupRemaining = 3 + Math.floor(rand() * 5)
          groupRare = false
          groupColor = PALETTE[Math.floor(rand() * PALETTE.length)]
          groupHeight = 56 + Math.floor(rand() * 18)
          groupWidth = 7 + Math.floor(rand() * 4)
        } else {
          groupRemaining = 1
          groupRare = false
          groupColor = PALETTE[Math.floor(rand() * PALETTE.length)]
          groupHeight = 54 + Math.floor(rand() * 22)
          groupWidth = 6 + Math.floor(rand() * 6)
        }
      }
      const w = groupWidth + (groupRemaining > 1 || groupRare ? 0 : Math.floor((rand() - 0.5) * 2))
      const nextZone = zones.find((z) => cursor < z.x && cursor + w > z.x)
      if (nextZone) { cursor = nextZone.x2 + 2; groupRemaining = 0; continue }
      if (cursor + w > FRAME_RIGHT - 4) break

      const yBookTop = yBoardTop - groupHeight
      const tilt = (groupRemaining === 1 && !groupRare && rand() < 0.02) ? (rand() - 0.5) * 5 : 0
      books.push({
        svg: groupRare
          ? renderRareBook(cursor, yBookTop, w, groupHeight, rand)
          : renderBook(cursor, yBookTop, w, groupHeight, groupColor!, tilt, rand),
        shelf: s,
        cx: cursor + w / 2,
        top: yBookTop,
        rare: groupRare,
      })

      cursor += w
      groupRemaining--
      if (groupRemaining === 0) groupRare = false
      if (groupRemaining === 0 && rand() < 0.04) cursor += 1 + Math.floor(rand() * 2)
    }
  }
  return books
})()

// Dernier index de livre par étagère (pour les plaques de complétion) :
// l'étagère s est "complète" quand visibleBooks > SHELF_LAST_BOOK_INDEX[s].
const SHELF_LAST_BOOK_INDEX: number[] = (() => {
  const out: number[] = new Array(SHELF_COUNT).fill(-1)
  ALL_BOOKS.forEach((b, i) => { out[b.shelf] = i })
  return out
})()

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']

// Trajectoires (dx, dy) des particules de la bouffée de poussière au pop-in.
const BURST_VECTORS: Array<[number, number]> = [
  [-16, -22], [14, -26], [-8, -34], [6, -18], [-22, -10], [20, -12], [0, -40],
]

// Poussières ambiantes : positions dans le faisceau + tempo désynchronisé.
const MOTES = [
  { cx: 290, cy: 280, r: 0.7, dur: 12, delay: 0 },
  { cx: 350, cy: 380, r: 0.5, dur: 15, delay: 3.2 },
  { cx: 410, cy: 450, r: 0.6, dur: 10, delay: 6.1 },
  { cx: 320, cy: 540, r: 0.4, dur: 16, delay: 1.4 },
  { cx: 450, cy: 600, r: 0.7, dur: 11, delay: 8.3 },
  { cx: 380, cy: 700, r: 0.5, dur: 14, delay: 4.7 },
  { cx: 520, cy: 780, r: 0.6, dur: 13, delay: 9.6 },
  { cx: 270, cy: 870, r: 0.5, dur: 17, delay: 2.5 },
  { cx: 600, cy: 410, r: 0.4, dur: 12, delay: 7.2 },
  { cx: 700, cy: 610, r: 0.5, dur: 15, delay: 5.8 },
  { cx: 250, cy: 460, r: 0.35, dur: 18, delay: 10.4 },
  { cx: 160, cy: 340, r: 0.4, dur: 13, delay: 0.9 },
]

// Plaque de laiton gravée, incrustée dans la planche de l'étagère complétée.
// 11 jalons intermédiaires entre les 6 trésors : il y a TOUJOURS un objectif proche.
function renderShelfPlaque(s: number): string {
  const yBoardTop = shelfBoardTop(s)
  const cx = (FRAME_LEFT + FRAME_RIGHT) / 2
  return `<g transform="translate(${cx} ${yBoardTop})">
    <rect x="-56" y="0.6" width="112" height="${BOARD_THICKNESS - 1.2}" rx="1.4" fill="url(#bib-brass)" stroke="rgba(0,0,0,0.45)" stroke-width="0.4"/>
    <rect x="-54" y="1.4" width="108" height="${BOARD_THICKNESS - 2.8}" rx="1" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.3"/>
    <circle cx="-51" cy="${BOARD_THICKNESS / 2}" r="0.7" fill="rgba(0,0,0,0.4)"/>
    <circle cx="51" cy="${BOARD_THICKNESS / 2}" r="0.7" fill="rgba(0,0,0,0.4)"/>
    <text y="${BOARD_THICKNESS / 2 + 1.7}" text-anchor="middle" font-family="Cinzel,serif" font-size="4.6" fill="rgba(8,20,34,0.88)" letter-spacing="1.2">RAYON ${ROMAN[s]} · COMPLET</text>
  </g>`
}

function renderBook(
  x: number, y: number, w: number, h: number,
  c: LeatherTone, tilt: number, rand: () => number
): string {
  const rotAttr = tilt ? ` rotate(${tilt.toFixed(2)} ${(w / 2).toFixed(1)} ${h.toFixed(1)})` : ''
  let s = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})${rotAttr}">`
  s += `<rect width="${w}" height="${h}" fill="${c.main}"/>`
  s += `<rect x="0" y="0" width="${w}" height="1.3" fill="${c.accent}"/>`
  s += `<rect x="0" y="1.3" width="${w}" height="0.5" fill="rgba(0,0,0,0.4)"/>`
  s += `<rect x="0" y="${(h - 1.5).toFixed(1)}" width="${w}" height="1.5" fill="rgba(0,0,0,0.55)"/>`
  s += `<rect x="0" y="0" width="0.9" height="${h}" fill="rgba(200,224,244,0.22)"/>`
  s += `<rect x="${(w - 0.6).toFixed(1)}" y="0" width="0.6" height="${h}" fill="rgba(0,0,0,0.4)"/>`
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
  if (w >= 9 && rand() < 0.65) {
    const ty = h * (0.43 + rand() * 0.06)
    const tw = Math.max(2, w - 4)
    const tx = (w - tw) / 2
    s += `<rect x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" width="${tw.toFixed(1)}" height="0.5" fill="${c.title}" opacity="0.55"/>`
    if (rand() < 0.6) {
      s += `<rect x="${(tx + tw * 0.15).toFixed(1)}" y="${(ty + 1.6).toFixed(1)}" width="${(tw * 0.7).toFixed(1)}" height="0.4" fill="${c.title}" opacity="0.4"/>`
    }
  }
  if (w >= 11 && rand() < 0.4) {
    const cy = h * 0.62
    s += `<circle cx="${(w / 2).toFixed(1)}" cy="${cy.toFixed(1)}" r="0.7" fill="${c.title}" opacity="0.6"/>`
  }
  s += '</g>'
  return s
}

// OUVRAGE DORÉ — reliure de prestige : cuir nuit, dorures pleines, nervures,
// cartouche central et gemme. Le glint (.bib-rare-glint) s'allume ~1s toutes
// les 6-9s (délai désynchronisé par livre) : la bibliothèque scintille.
// NB : RARE_LEATHERS est déclaré AVANT ALL_BOOKS (près de PALETTE) car
// l'IIFE ALL_BOOKS s'exécute au chargement du module et appelle cette fonction.
function renderRareBook(
  x: number, y: number, w: number, h: number, rand: () => number
): string {
  const main = RARE_LEATHERS[Math.floor(rand() * RARE_LEATHERS.length)]
  const gold = '#C8DFF0'      // argent lunaire (palette Marine du site)
  const goldDeep = '#6E9CC0'
  const delay = (rand() * 7).toFixed(2)
  const dur = (6 + rand() * 3).toFixed(2)
  let s = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">`
  s += `<rect width="${w}" height="${h}" fill="${main}"/>`
  // Tranches haut/bas dorées
  s += `<rect x="0" y="0" width="${w}" height="2" fill="${gold}"/>`
  s += `<rect x="0" y="2" width="${w}" height="0.6" fill="rgba(0,0,0,0.5)"/>`
  s += `<rect x="0" y="${(h - 2.2).toFixed(1)}" width="${w}" height="2.2" fill="${goldDeep}"/>`
  // Nervures de dos (5 doubles filets dorés)
  for (let i = 1; i <= 5; i++) {
    const ny = (h * i) / 6
    s += `<rect y="${ny.toFixed(1)}" width="${w}" height="0.9" fill="${gold}" opacity="0.85"/>`
    s += `<rect y="${(ny + 0.9).toFixed(1)}" width="${w}" height="0.45" fill="rgba(0,0,0,0.55)"/>`
  }
  // Cartouche central + gemme
  const cw = Math.max(3, w - 5)
  s += `<rect x="${((w - cw) / 2).toFixed(1)}" y="${(h * 0.38).toFixed(1)}" width="${cw.toFixed(1)}" height="${(h * 0.14).toFixed(1)}" fill="none" stroke="${gold}" stroke-width="0.5" opacity="0.9"/>`
  s += `<circle cx="${(w / 2).toFixed(1)}" cy="${(h * 0.45).toFixed(1)}" r="1.5" fill="#B23040"/>`
  s += `<circle cx="${(w / 2 - 0.4).toFixed(1)}" cy="${(h * 0.45 - 0.4).toFixed(1)}" r="0.5" fill="rgba(255,230,230,0.9)"/>`
  // Lumières de matière
  s += `<rect x="0" y="0" width="1.1" height="${h}" fill="rgba(214,232,246,0.30)"/>`
  s += `<rect x="${(w - 0.7).toFixed(1)}" y="0" width="0.7" height="${h}" fill="rgba(0,0,0,0.45)"/>`
  // Glint périodique (désynchronisé par livre)
  s += `<rect class="bib-rare-glint" width="${w}" height="${h}" fill="url(#bib-rareGlint)" style="animation-delay:${delay}s;animation-duration:${dur}s"/>`
  s += '</g>'
  return s
}

// ============ DÉCORATIONS / TRÉSORS ============
// Positions adaptées au viewBox étendu (positions à droite décalées de +285,
// positions centrales recentrées sur le nouveau milieu 942 du shelf area).
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
        <line x1="-22" y1="-12" x2="22" y2="-12" stroke="#2C415A" stroke-width="0.5"/>
        <rect x="-18" y="-15" width="36" height="3" fill="url(#bib-marble)"/>
        <path d="M -16 -15 Q -14 -32 -10 -38 L 10 -38 Q 14 -32 16 -15 Z" fill="url(#bib-marble)" stroke="#5E7A94" stroke-width="0.4"/>
        <rect x="-6" y="-44" width="12" height="9" fill="url(#bib-marble)"/>
        <ellipse cx="0" cy="-58" rx="13" ry="16" fill="url(#bib-marble)" stroke="#5E7A94" stroke-width="0.4"/>
        <path d="M -13 -65 Q -10 -75 0 -76 Q 10 -75 13 -65 Q 12 -60 8 -60 L -8 -60 Q -12 -60 -13 -65 Z" fill="#7E96AC" opacity="0.85"/>
        <path d="M -8 -50 Q -6 -42 0 -40 Q 6 -42 8 -50 Q 4 -48 0 -48 Q -4 -48 -8 -50 Z" fill="#7E96AC" opacity="0.7"/>
        <circle cx="-4" cy="-60" r="0.7" fill="#22384E"/>
        <circle cx="4" cy="-60" r="0.7" fill="#22384E"/>
        <ellipse cx="-4" cy="-64" rx="6" ry="5" fill="url(#bib-marbleHi)"/>
        <path d="M 0 -58 Q -1.5 -54 0 -52 Q 1.5 -54 0 -58 Z" fill="#5E7A94" opacity="0.6"/>
        <text y="-4" text-anchor="middle" font-family="Cinzel,serif" font-size="4" fill="#3E6E96" letter-spacing="0.7">HIPPOCRATES</text>
      </g>`
    })(),
  },
  {
    unlockAt: 300,
    name: 'Sablier',
    svg: (() => {
      const bb = shelfBoardTop(0)
      return `<g transform="translate(1670 ${bb})">
        <rect x="-18" y="-6" width="36" height="6" fill="url(#bib-brass)" stroke="#22384E" stroke-width="0.3"/>
        <rect x="-16" y="-58" width="2" height="52" fill="url(#bib-brass)"/>
        <rect x="14" y="-58" width="2" height="52" fill="url(#bib-brass)"/>
        <rect x="-18" y="-64" width="36" height="6" fill="url(#bib-brass)" stroke="#22384E" stroke-width="0.3"/>
        <path d="M -12 -60 Q -12 -50 -1 -34 L 1 -34 Q 12 -50 12 -60 Z" fill="rgba(220,200,160,0.35)" stroke="#7E96AC" stroke-width="0.5"/>
        <path d="M -12 -8 Q -12 -18 -1 -34 L 1 -34 Q 12 -18 12 -8 Z" fill="rgba(220,200,160,0.35)" stroke="#7E96AC" stroke-width="0.5"/>
        <path d="M -10 -8 Q -10 -14 -1 -22 L 1 -22 Q 10 -14 10 -8 Z" fill="#9FC4E0"/>
        <path d="M -3 -56 Q -3 -50 -0.5 -38 L 0.5 -38 Q 3 -50 3 -56 Z" fill="#9FC4E0" opacity="0.8"/>
        <line x1="0" y1="-38" x2="0" y2="-22" stroke="#9FC4E0" stroke-width="0.6"/>
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
      return `<g transform="translate(932 ${bb})">
        <rect x="-44" y="-10" width="60" height="10" fill="#27435E"/>
        <rect x="-44" y="-10" width="60" height="1.2" fill="#3C5F80"/>
        <rect x="-44" y="-2" width="60" height="2" fill="rgba(0,0,0,0.5)"/>
        <rect x="-46" y="-9" width="2" height="9" fill="#16243A"/>
        <line x1="-44" y1="-7" x2="16" y2="-7" stroke="#7FB0D4" stroke-width="0.5" opacity="0.7"/>
        <line x1="-44" y1="-4" x2="16" y2="-4" stroke="#7FB0D4" stroke-width="0.4" opacity="0.6"/>
        <rect x="-42" y="-20" width="56" height="10" fill="#1F3D33"/>
        <rect x="-42" y="-20" width="56" height="1.2" fill="#33584A"/>
        <rect x="-42" y="-12" width="56" height="2" fill="rgba(0,0,0,0.5)"/>
        <rect x="-44" y="-19" width="2" height="9" fill="#13281F"/>
        <line x1="-42" y1="-17" x2="14" y2="-17" stroke="#6E9CC0" stroke-width="0.5" opacity="0.7"/>
        <line x1="-42" y1="-14" x2="14" y2="-14" stroke="#6E9CC0" stroke-width="0.4" opacity="0.6"/>
        <rect x="-40" y="-30" width="52" height="10" fill="#1A2742"/>
        <rect x="-40" y="-30" width="52" height="1.2" fill="#2C3D5E"/>
        <rect x="-40" y="-22" width="52" height="2" fill="rgba(0,0,0,0.5)"/>
        <rect x="-42" y="-29" width="2" height="9" fill="#10182E"/>
        <line x1="-40" y1="-27" x2="12" y2="-27" stroke="#7FB0D4" stroke-width="0.5" opacity="0.7"/>
        <line x1="-40" y1="-24" x2="12" y2="-24" stroke="#7FB0D4" stroke-width="0.4" opacity="0.6"/>
        <ellipse cx="32" cy="-30" rx="11" ry="3" fill="url(#bib-brass)"/>
        <rect x="29" y="-44" width="6" height="14" fill="url(#bib-brass)"/>
        <rect x="27" y="-46" width="10" height="3" fill="url(#bib-brass)"/>
        <rect x="30" y="-62" width="4" height="16" fill="#E2EAF2"/>
        <rect x="30" y="-62" width="4" height="1" fill="#B6C8D8"/>
        <line x1="32" y1="-62" x2="32" y2="-66" stroke="#22384E" stroke-width="0.6"/>
        <g class="bib-flame-live">
          <ellipse cx="32" cy="-72" rx="4" ry="7" fill="url(#bib-flame)"/>
          <ellipse cx="32" cy="-70" rx="2" ry="4" fill="rgba(255,255,210,0.9)"/>
        </g>
        <circle class="bib-flame-halo" cx="32" cy="-70" r="20" fill="url(#bib-flame)" opacity="0.3"/>
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
        <path d="M -18 -56 Q -10 -62 -2 -58 Q 4 -52 -2 -46 Q -10 -42 -16 -48 Z" fill="#5E8A7A" opacity="0.85"/>
        <path d="M 4 -42 Q 14 -38 18 -32 Q 14 -28 8 -32 Q 4 -36 4 -42 Z" fill="#5E8A7A" opacity="0.8"/>
        <path d="M -14 -36 Q -8 -32 -4 -28 Q -10 -26 -16 -30 Z" fill="#5E8A7A" opacity="0.85"/>
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
      return `<g transform="translate(1625 ${bb})">
        <ellipse cx="0" cy="-3" rx="55" ry="4" fill="url(#bib-scroll)" stroke="#5E7A94" stroke-width="0.4"/>
        <ellipse cx="-50" cy="-3" rx="6" ry="4" fill="#7E9CB8" stroke="#2C415A" stroke-width="0.4"/>
        <ellipse cx="50" cy="-3" rx="6" ry="4" fill="#7E9CB8" stroke="#2C415A" stroke-width="0.4"/>
        <circle cx="0" cy="-3" r="3" fill="#A82828" opacity="0.85"/>
        <circle cx="0" cy="-3.5" r="1" fill="#101C2C"/>
        <ellipse cx="-8" cy="-12" rx="48" ry="3.5" fill="url(#bib-scroll)" stroke="#5E7A94" stroke-width="0.4"/>
        <ellipse cx="-50" cy="-12" rx="5" ry="3.5" fill="#7E9CB8" stroke="#2C415A" stroke-width="0.4"/>
        <ellipse cx="34" cy="-12" rx="5" ry="3.5" fill="#7E9CB8" stroke="#2C415A" stroke-width="0.4"/>
        <g transform="translate(20 -22) rotate(-8)">
          <rect x="-8" y="-30" width="16" height="32" fill="url(#bib-scroll)" stroke="#5E7A94" stroke-width="0.4"/>
          <ellipse cx="0" cy="-30" rx="8" ry="2.5" fill="#7E9CB8" stroke="#2C415A" stroke-width="0.4"/>
          <ellipse cx="0" cy="2" rx="8" ry="2.5" fill="#5E7A94"/>
          <line x1="-5" y1="-22" x2="5" y2="-22" stroke="#5E7A94" stroke-width="0.3"/>
          <line x1="-5" y1="-18" x2="5" y2="-18" stroke="#5E7A94" stroke-width="0.3"/>
          <line x1="-5" y1="-14" x2="5" y2="-14" stroke="#5E7A94" stroke-width="0.3"/>
          <line x1="-5" y1="-10" x2="5" y2="-10" stroke="#5E7A94" stroke-width="0.3"/>
          <line x1="-5" y1="-6" x2="5" y2="-6" stroke="#5E7A94" stroke-width="0.3"/>
        </g>
        <g transform="translate(-30 -5) rotate(-35)">
          <path d="M 0 0 Q 2 -20 -2 -55 Q -10 -62 -16 -58 Q -8 -45 -3 -28 Q -1 -15 0 0 Z" fill="#E2EAF2" stroke="#7E96AC" stroke-width="0.4"/>
          <path d="M -2 -55 L 0 -62 L -3 -64 L -5 -60 Z" fill="#22384E"/>
        </g>
      </g>`
    })(),
  },
  {
    unlockAt: 1500,
    name: 'Codex ouvert sur lutrin',
    svg: (() => {
      const bb = shelfBoardTop(9)
      return `<g transform="translate(872 ${bb})">
        <path d="M -36 0 L -28 -8 L 28 -8 L 36 0 Z" fill="url(#bib-walnutFace)" stroke="#0A0503" stroke-width="0.6"/>
        <rect x="-32" y="-10" width="64" height="2" fill="url(#bib-walnutSide)"/>
        <path d="M -34 -10 L -32 -50 L -2 -54 L 0 -10 Z" fill="#DCE6F0" stroke="#5E7A94" stroke-width="0.5"/>
        <path d="M 0 -10 L 2 -54 L 32 -50 L 34 -10 Z" fill="#DCE6F0" stroke="#5E7A94" stroke-width="0.5"/>
        <path d="M 0 -10 L 0 -54" stroke="#5E7A94" stroke-width="0.6"/>
        <g stroke="#22384E" stroke-width="0.3" opacity="0.7">
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
        <text x="-27" y="-47" text-anchor="middle" font-family="Cinzel,serif" font-size="5" fill="#DCE6F0">A</text>
        <g stroke="#22384E" stroke-width="0.3" opacity="0.7">
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

/** ViewBox du SVG — pour mapper des coordonnées internes vers l'écran
 *  (preserveAspectRatio "slice" = comportement CSS cover). */
export const BIB_VIEWBOX = { x: VIEWBOX_X, y: VIEWBOX_Y, w: VIEWBOX_W, h: VIEWBOX_H }

/** Position (coordonnées viewBox) du livre de rang `index` (0-based).
 *  Utilisé par le pupitre Focus : le livre refermé vole vers cette place. */
export function bookSpotAt(index: number): { cx: number; top: number } | null {
  if (index < 0 || index >= ALL_BOOKS.length) return null
  return { cx: ALL_BOOKS[index].cx, top: ALL_BOOKS[index].top }
}

/** Prochain jalon sur l'échelle combinée "rayons complets" + "trésors".
 *  prevAt = jalon précédent (pour une barre de proximité locale, pas globale). */
export function nextMilestone(fichesCount: number): { label: string; at: number; prevAt: number } | null {
  const ms: { at: number; label: string }[] = []
  for (let s = 0; s < SHELF_COUNT; s++) {
    const li = SHELF_LAST_BOOK_INDEX[s]
    if (li >= 0) ms.push({ at: li + 1, label: `Rayon ${ROMAN[s]} complet` })
  }
  for (const d of DECORATIONS) ms.push({ at: d.unlockAt, label: d.name })
  ms.sort((a, b) => a.at - b.at)
  const next = ms.find(m => m.at > fichesCount)
  if (!next) return null
  let prevAt = 0
  for (const m of ms) { if (m.at <= fichesCount) prevAt = m.at }
  return { label: next.label, at: next.at, prevAt }
}

// ============ PROPS ============
type BibliothecaSvgProps = {
  /** Nombre de fiches notées (cumulé sur l'année). 1 fiche = 1 livre ajouté. */
  fichesCount: number
  /** Classe CSS sur le <svg>. */
  className?: string
  style?: CSSProperties
  /** viewBox du SVG. Default '-112 0 2109 1185' (aspect 1.78, mur étendu pour
   *  combler le viewport sans laisser apparaître le bg du parent). */
  viewBox?: string
  /** preserveAspectRatio du SVG. Default 'xMidYMid slice' : le SVG remplit
   *  intégralement son container sans letterbox (le mur étendu cache toute
   *  zone vide). Le meuble reste centré dans le viewBox étendu. */
  preserveAspectRatio?: string
}

// ============ COMPOSANT ============
export default function BibliothecaSvg({
  fichesCount,
  className,
  style,
  viewBox = `${VIEWBOX_X} ${VIEWBOX_Y} ${VIEWBOX_W} ${VIEWBOX_H}`,
  preserveAspectRatio = 'xMidYMid slice',
}: BibliothecaSvgProps) {
  // Inject les tokens thème UNE FOIS (idempotent)
  useEffect(() => { injectBibTokens() }, [])

  // Nombre de livres visibles : 1 fiche = 1 livre, capé à la capacité totale
  const visibleBooks = Math.min(Math.max(0, Math.floor(fichesCount)), ALL_BOOKS.length)

  // fichesCount du render PRÉCÉDENT. Les célébrations (burst de poussière,
  // gravure de plaque, reveal de trésor) ne se déclenchent que sur un VRAI
  // incrément en cours de session — jamais au montage de la page, sinon ça
  // flasherait à chaque visite et le moment perdrait toute valeur.
  const prevFichesRef = useRef<number | null>(null)
  const prevFiches = prevFichesRef.current
  useEffect(() => { prevFichesRef.current = visibleBooks }, [visibleBooks])
  const isIncrement = prevFiches !== null && visibleBooks > prevFiches

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

  const latestBook = lastBookIdx >= 0 && lastBookIdx < ALL_BOOKS.length
    ? ALL_BOOKS[lastBookIdx]
    : null

  // Étagère qui vient TOUT JUSTE d'être complétée par cet incrément (-1 sinon).
  const justCompletedShelf = (() => {
    if (!isIncrement || prevFiches === null) return -1
    for (let s = 0; s < SHELF_COUNT; s++) {
      const li = SHELF_LAST_BOOK_INDEX[s]
      if (li >= 0 && prevFiches <= li && visibleBooks > li) return s
    }
    return -1
  })()

  // Plaques des étagères complétées (hors celle qui vient de l'être,
  // rendue à part avec son animation de gravure).
  const stablePlaquesHtml = useMemo(() => {
    let html = ''
    for (let s = 0; s < SHELF_COUNT; s++) {
      const li = SHELF_LAST_BOOK_INDEX[s]
      if (li >= 0 && visibleBooks > li && s !== justCompletedShelf) html += renderShelfPlaque(s)
    }
    return html
    // justCompletedShelf dérive de visibleBooks + ref : inutile en dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleBooks])

  // Trésors fraîchement débloqués par cet incrément → reveal doré.
  const newlyUnlockedAts = isIncrement && prevFiches !== null
    ? DECORATIONS.filter(d => prevFiches < d.unlockAt && visibleBooks >= d.unlockAt).map(d => d.unlockAt)
    : []
  let staticDecorationsHtml = ''
  let revealDecorationsHtml = ''
  for (const d of DECORATIONS) {
    if (fichesCount < d.unlockAt) continue
    if (newlyUnlockedAts.includes(d.unlockAt)) revealDecorationsHtml += d.svg
    else staticDecorationsHtml += d.svg
  }

  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={style}
      role="img"
      preserveAspectRatio={preserveAspectRatio}
    >
      <title>Bibliothèque MedRev</title>

      {/* Animations CSS embarquées (auto-suffisantes) */}
      <style>{`
        @keyframes bib-book-pop-in {
          0%   { transform: scaleY(0.05) translateY(0); opacity: 0; }
          55%  { transform: scaleY(1.06) translateY(0); opacity: 1; }
          100% { transform: scaleY(1) translateY(0); opacity: 1; }
        }
        @keyframes bib-book-glow {
          0%   { filter: drop-shadow(0 0 0 rgba(151, 196, 228, 0)); }
          40%  { filter: drop-shadow(0 0 8px rgba(151, 196, 228, 0.9)); }
          100% { filter: drop-shadow(0 0 0 rgba(151, 196, 228, 0)); }
        }
        .bib-book-pop {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: bib-book-pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both,
                     bib-book-glow 0.9s ease-out both;
        }

        /* --- Ouvrages dorés : glint périodique désynchronisé --- */
        @keyframes bib-glint-sweep {
          0%, 86% { opacity: 0; }
          92%     { opacity: 0.75; }
          100%    { opacity: 0; }
        }
        .bib-rare-glint {
          opacity: 0;
          animation-name: bib-glint-sweep;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }

        /* --- Bouffée de poussière dorée au nouveau livre --- */
        @keyframes bib-dust-fly {
          from { transform: translate(0, 0); opacity: 0.95; }
          to   { transform: translate(var(--dx), var(--dy)); opacity: 0; }
        }
        .bib-dustburst circle:not(.bib-dustring) {
          fill: var(--bib-brass-1, #E8C77A);
          animation: bib-dust-fly 0.8s ease-out both;
        }
        @keyframes bib-ring-out {
          from { transform: scale(0.2); opacity: 0.8; }
          to   { transform: scale(1.7); opacity: 0; }
        }
        .bib-dustring {
          transform-box: fill-box;
          transform-origin: center;
          animation: bib-ring-out 0.6s ease-out both;
        }

        /* --- Plaque de rayon complété : gravure qui s'incruste --- */
        @keyframes bib-plaque-in {
          0%   { opacity: 0; transform: scale(0.6); }
          60%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        .bib-plaque-pop {
          transform-box: fill-box;
          transform-origin: center;
          animation: bib-plaque-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both,
                     bib-book-glow 1.4s ease-out both;
        }

        /* --- Trésor fraîchement débloqué : reveal doré --- */
        @keyframes bib-treasure-in {
          0%   { opacity: 0; transform: translateY(10px) scale(0.85); }
          60%  { opacity: 1; transform: translateY(-3px) scale(1.04); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .bib-treasure-reveal {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: bib-treasure-in 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) both,
                     bib-book-glow 1.6s ease-out both;
        }

        /* --- Vie ambiante --- */
        @keyframes bib-mote-drift {
          0%   { transform: translateY(0); opacity: 0; }
          12%  { opacity: 0.7; }
          85%  { opacity: 0.25; }
          100% { transform: translateY(-52px); opacity: 0; }
        }
        .bib-mote { animation: bib-mote-drift linear infinite; }
        @keyframes bib-flame-dance {
          0%   { transform: scale(1) translateX(0); }
          25%  { transform: scale(1.06, 0.94) translateX(0.3px); }
          50%  { transform: scale(0.95, 1.08) translateX(-0.3px); }
          75%  { transform: scale(1.03, 0.97) translateX(0.2px); }
          100% { transform: scale(1) translateX(0); }
        }
        .bib-flame-live {
          transform-box: fill-box;
          transform-origin: 50% 90%;
          animation: bib-flame-dance 1.1s ease-in-out infinite;
        }
        @keyframes bib-halo-breathe { 0%, 100% { opacity: 0.22; } 50% { opacity: 0.38; } }
        .bib-flame-halo { animation: bib-halo-breathe 2.6s ease-in-out infinite; }
        @keyframes bib-shaft-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.72; } }
        .bib-shaft { animation: bib-shaft-breathe 11s ease-in-out infinite; }

        /* Accessibilité : on coupe tout pour qui préfère le calme. */
        @media (prefers-reduced-motion: reduce) {
          .bib-rare-glint, .bib-mote, .bib-flame-live, .bib-flame-halo,
          .bib-shaft, .bib-dustburst circle, .bib-dustring,
          .bib-book-pop, .bib-plaque-pop, .bib-treasure-reveal {
            animation: none !important;
          }
        }
      `}</style>

      <defs>
        {/* Tous les gradients référencent des CSS variables qui basculent
            automatiquement avec [data-theme="dark"] sur <html>. */}
        <linearGradient id="bib-wallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bib-wall-1)" />
          <stop offset="50%" stopColor="var(--bib-wall-2)" />
          <stop offset="100%" stopColor="var(--bib-wall-3)" />
        </linearGradient>
        <linearGradient id="bib-walnutFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bib-walnut-face-1)" />
          <stop offset="50%" stopColor="var(--bib-walnut-face-2)" />
          <stop offset="100%" stopColor="var(--bib-walnut-face-3)" />
        </linearGradient>
        <linearGradient id="bib-walnutSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bib-walnut-side-1)" />
          <stop offset="100%" stopColor="var(--bib-walnut-side-2)" />
        </linearGradient>
        <linearGradient id="bib-shelfBoard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bib-shelf-board-1)" />
          <stop offset="40%" stopColor="var(--bib-shelf-board-2)" />
          <stop offset="100%" stopColor="var(--bib-shelf-board-3)" />
        </linearGradient>
        <linearGradient id="bib-floorGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bib-floor-1)" />
          <stop offset="100%" stopColor="var(--bib-floor-2)" />
        </linearGradient>
        <radialGradient id="bib-warmGlow" cx="22%" cy="18%" r="75%">
          <stop offset="0%" stopColor="var(--bib-warm-glow-1)" />
          <stop offset="40%" stopColor="var(--bib-warm-glow-2)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <radialGradient id="bib-vignette" cx="50%" cy="50%" r="78%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="65%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="var(--bib-vignette-edge)" />
        </radialGradient>
        <linearGradient id="bib-lightShaft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--bib-light-shaft-1)" />
          <stop offset="40%" stopColor="var(--bib-light-shaft-2)" />
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
          <stop offset="0%" stopColor="#E2EAF2" />
          <stop offset="50%" stopColor="#B6C8D8" />
          <stop offset="100%" stopColor="#7E96AC" />
        </linearGradient>
        <radialGradient id="bib-marbleHi" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="rgba(240,248,255,0.6)" />
          <stop offset="100%" stopColor="rgba(240,248,255,0)" />
        </radialGradient>
        <linearGradient id="bib-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bib-brass-1)" />
          <stop offset="50%" stopColor="var(--bib-brass-2)" />
          <stop offset="100%" stopColor="var(--bib-brass-3)" />
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
          <stop offset="0%" stopColor="#D8E4F0" />
          <stop offset="100%" stopColor="#8CA8C0" />
        </linearGradient>
        <linearGradient id="bib-rareGlint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(214,232,246,0)" />
          <stop offset="50%" stopColor="rgba(214,232,246,0.85)" />
          <stop offset="100%" stopColor="rgba(214,232,246,0)" />
        </linearGradient>
      </defs>

      {/* === ARRIÈRE-PLAN (mur derrière le meuble) — étendu au viewBox élargi === */}
      <rect x={VIEWBOX_X} y={VIEWBOX_Y} width={VIEWBOX_W} height={VIEWBOX_H} fill="url(#bib-wallGrad)" />

      {/* === SOL (parquet en perspective légère) — étendu lui aussi === */}
      <rect x={VIEWBOX_X} y="1025" width={VIEWBOX_W} height="160" fill="url(#bib-floorGrad)" />
      <g stroke="var(--bib-line-darker, #0A0503)" strokeWidth="0.8" opacity="0.7">
        <line x1="-50" y1="1025" x2="-90" y2="1185" />
        <line x1="190" y1="1025" x2="142" y2="1185" />
        <line x1="447" y1="1025" x2="412" y2="1185" />
        <line x1="707" y1="1025" x2="690" y2="1185" />
        <line x1="966" y1="1025" x2="966" y2="1185" />
        <line x1="1225" y1="1025" x2="1243" y2="1185" />
        <line x1="1485" y1="1025" x2="1520" y2="1185" />
        <line x1="1744" y1="1025" x2="1803" y2="1185" />
        <line x1="1950" y1="1025" x2="2030" y2="1185" />
      </g>
      <line x1={VIEWBOX_X} y1="1025" x2={VIEWBOX_X + VIEWBOX_W} y2="1025" stroke="var(--bib-line-dark, #3D2516)" strokeWidth="1.2" />

      {/* === CADRE EXTÉRIEUR : corniche, pilastres, plinthe === */}
      {/* Corniche (haut) */}
      <rect x="50" y="45" width="1785" height="14" fill="url(#bib-walnutFace)" />
      <rect x="60" y="59" width="1765" height="22" fill="url(#bib-walnutFace)" />
      <rect x="60" y="59" width="1765" height="22" filter="url(#bib-woodGrain)" />
      <rect x="74" y="81" width="1737" height="6" fill="url(#bib-walnutSide)" />
      <rect x="84" y="87" width="1717" height="14" fill="url(#bib-walnutFace)" />
      <rect x="84" y="87" width="1717" height="14" filter="url(#bib-woodGrain)" />
      <line x1="50" y1="45" x2="1835" y2="45" stroke="var(--bib-line-dark, #2C415A)" strokeWidth="0.6" opacity="0.7" />
      <line x1="50" y1="59" x2="1835" y2="59" stroke="var(--bib-line-darker, #0A0503)" strokeWidth="1.2" />
      <line x1="74" y1="87" x2="1811" y2="87" stroke="var(--bib-line-darker, #0A0503)" strokeWidth="1" />
      <line x1="84" y1="101" x2="1801" y2="101" stroke="var(--bib-line-darker, #0A0503)" strokeWidth="1.2" />

      {/* Médaillon central (M·R) — recentré sur 942.5 (milieu nouveau viewBox) */}
      <g transform="translate(943 65)">
        <ellipse cx="0" cy="0" rx="32" ry="14" fill="url(#bib-walnutSide)" stroke="var(--bib-line-dark, #2C415A)" strokeWidth="0.8" />
        <ellipse cx="0" cy="0" rx="22" ry="9" fill="none" stroke="var(--bib-brass-2, #3E6E96)" strokeWidth="0.5" opacity="0.8" />
        <text y="3.5" textAnchor="middle" fontFamily="Cinzel,serif" fontSize="9" fill="var(--bib-brass-2, #3E6E96)" letterSpacing="2">M·R</text>
      </g>

      {/* Pilastres latéraux — hauteur ajustée à FRAME_BOTTOM 1025 (au lieu de 945) */}
      <rect x="50" y="101" width="60" height="924" fill="url(#bib-walnutFace)" />
      <rect x="50" y="101" width="60" height="924" filter="url(#bib-woodGrain)" />
      <line x1="50" y1="101" x2="50" y2="1025" stroke="var(--bib-line-dark, #2C415A)" strokeWidth="0.6" opacity="0.6" />
      <line x1="110" y1="101" x2="110" y2="1025" stroke="var(--bib-line-darker, #0A0503)" strokeWidth="1.4" />
      <rect x="68" y="120" width="22" height="890" fill="url(#bib-walnutSide)" />
      <rect x="74" y="124" width="10" height="880" fill="none" stroke="var(--bib-line-dark, #2C415A)" strokeWidth="0.5" opacity="0.75" />

      <rect x="1775" y="101" width="60" height="924" fill="url(#bib-walnutFace)" />
      <rect x="1775" y="101" width="60" height="924" filter="url(#bib-woodGrain)" />
      <line x1="1835" y1="101" x2="1835" y2="1025" stroke="var(--bib-line-dark, #2C415A)" strokeWidth="0.6" opacity="0.6" />
      <line x1="1775" y1="101" x2="1775" y2="1025" stroke="var(--bib-line-darker, #0A0503)" strokeWidth="1.4" />
      <rect x="1795" y="120" width="22" height="890" fill="url(#bib-walnutSide)" />
      <rect x="1801" y="124" width="10" height="880" fill="none" stroke="var(--bib-line-dark, #2C415A)" strokeWidth="0.5" opacity="0.75" />

      {/* Plinthe (bas) — descendue à y=1025 */}
      <rect x="60" y="1025" width="1765" height="20" fill="url(#bib-walnutFace)" />
      <rect x="60" y="1025" width="1765" height="20" filter="url(#bib-woodGrain)" />
      <rect x="50" y="1045" width="1785" height="18" fill="url(#bib-walnutSide)" />
      <line x1="50" y1="1025" x2="1835" y2="1025" stroke="var(--bib-line-dark, #2C415A)" strokeWidth="0.5" opacity="0.6" />
      <line x1="60" y1="1045" x2="1825" y2="1045" stroke="var(--bib-line-darker, #0A0503)" strokeWidth="1.2" />

      {/* Intérieur du meuble (mur de fond plus sombre) — élargi à 1665 */}
      <rect x="110" y="101" width="1665" height="924" fill="var(--bib-interior-bg)" />

      {/* === ÉTAGÈRES (planches en bois) — toujours visibles === */}
      <g dangerouslySetInnerHTML={{ __html: SHELVES_HTML }} />

      {/* === LIVRES STABLES (tous sauf le dernier) === */}
      <g dangerouslySetInnerHTML={{ __html: stableBooksHtml }} />

      {/* === DERNIER LIVRE (avec animation pop-in à chaque incrément) === */}
      {latestBook && (
        <g
          key={lastBookIdx}
          className="bib-book-pop"
          dangerouslySetInnerHTML={{ __html: latestBook.svg }}
        />
      )}

      {/* === BOUFFÉE DE POUSSIÈRE DORÉE au nouveau livre (incrément seulement) === */}
      {latestBook && isIncrement && (
        <g
          key={`burst-${lastBookIdx}`}
          className="bib-dustburst"
          transform={`translate(${latestBook.cx.toFixed(1)} ${latestBook.top.toFixed(1)})`}
          pointerEvents="none"
        >
          <circle className="bib-dustring" r="11" fill="none" stroke="var(--bib-brass-1, #E8C77A)" strokeWidth="1.2" />
          {BURST_VECTORS.map(([dx, dy], i) => (
            <circle
              key={i}
              r={i % 2 ? 1.1 : 1.6}
              style={{
                ['--dx' as never]: `${dx}px`,
                ['--dy' as never]: `${dy}px`,
                animationDelay: `${(i * 0.02).toFixed(2)}s`,
              }}
            />
          ))}
        </g>
      )}

      {/* === PLAQUES DES RAYONS COMPLÉTÉS === */}
      <g dangerouslySetInnerHTML={{ __html: stablePlaquesHtml }} />
      {justCompletedShelf >= 0 && (
        <g
          key={`plaque-${justCompletedShelf}`}
          className="bib-plaque-pop"
          dangerouslySetInnerHTML={{ __html: renderShelfPlaque(justCompletedShelf) }}
        />
      )}

      {/* === DÉCORATIONS / TRÉSORS === */}
      <g dangerouslySetInnerHTML={{ __html: staticDecorationsHtml }} />
      {revealDecorationsHtml && (
        <g
          key={`treasure-${newlyUnlockedAts.join('-')}`}
          className="bib-treasure-reveal"
          dangerouslySetInnerHTML={{ __html: revealDecorationsHtml }}
        />
      )}

      {/* === ATMOSPHÈRE — étendue au viewBox étendu === */}
      <polygon className="bib-shaft" points="-112,0 940,0 230,1025 -112,1025" fill="url(#bib-lightShaft)" pointerEvents="none" />
      <rect x={VIEWBOX_X} y={VIEWBOX_Y} width={VIEWBOX_W} height={VIEWBOX_H} fill="url(#bib-warmGlow)" pointerEvents="none" />
      <rect x={VIEWBOX_X} y={VIEWBOX_Y} width={VIEWBOX_W} height={VIEWBOX_H} fill="url(#bib-vignette)" pointerEvents="none" />

      {/* Particules de poussière qui dérivent lentement dans le faisceau */}
      <g pointerEvents="none">
        {MOTES.map((m, i) => (
          <circle
            key={i}
            className="bib-mote"
            cx={m.cx}
            cy={m.cy}
            r={m.r}
            fill="var(--bib-dust, rgba(255,220,160,0.45))"
            style={{ animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
          />
        ))}
      </g>
    </svg>
  )
}

// ============ COMPOSANT : PANEL DES TRÉSORS (sidebar) ============
type BibliothecaTreasuresPanelProps = {
  fichesCount: number
  className?: string
  style?: CSSProperties
  showHeader?: boolean
}

export function BibliothecaTreasuresPanel({
  fichesCount,
  className,
  style,
  showHeader = true,
}: BibliothecaTreasuresPanelProps) {
  const upcoming = nextTreasure(fichesCount)
  const treasuresUnlocked = unlockedTreasuresCount(fichesCount)
  const progressPct = Math.min(100, (fichesCount / BIBLIOTHECA_TOTAL_CAPACITY) * 100)

  // Prochain jalon — échelle combinée "rayons complets" (11) + "trésors" (6) :
  // il y a TOUJOURS un objectif proche, et la barre mesure la distance entre
  // le jalon précédent et le suivant (pas le total, qui paraît infini).
  const milestones: { at: number; label: string }[] = []
  for (let s = 0; s < SHELF_COUNT; s++) {
    const li = SHELF_LAST_BOOK_INDEX[s]
    if (li >= 0) milestones.push({ at: li + 1, label: `Rayon ${ROMAN[s]} complet` })
  }
  for (const d of DECORATIONS) milestones.push({ at: d.unlockAt, label: d.name })
  milestones.sort((a, b) => a.at - b.at)
  const nextGoal = milestones.find(m => m.at > fichesCount) ?? null
  let prevGoalAt = 0
  for (const m of milestones) { if (m.at <= fichesCount) prevGoalAt = m.at }
  const goalPct = nextGoal
    ? Math.min(100, Math.max(0, ((fichesCount - prevGoalAt) / (nextGoal.at - prevGoalAt)) * 100))
    : 100
  const goalRemaining = nextGoal ? nextGoal.at - fichesCount : 0

  return (
    <aside className={`bib-treasures ${className ?? ''}`} style={style} aria-label="Trésors de la bibliothèque">
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

      {nextGoal && (
        <div className="bib-next-goal">
          <div className="bib-next-goal-row">
            <span className="bib-next-goal-kicker">Prochain jalon</span>
            <span className="bib-next-goal-left">
              {goalRemaining} livre{goalRemaining > 1 ? 's' : ''}
            </span>
          </div>
          <div className="bib-next-goal-name">{nextGoal.label}</div>
          <div className="bib-next-goal-bar" aria-hidden="true">
            <div className="bib-next-goal-fill" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      )}
      <div className="bib-treasures-title">Trésors · {treasuresUnlocked}/6</div>
      <ol className="bib-treasures-list">
        {DECORATIONS.map((d) => {
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
