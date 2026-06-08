// src/components/SubjectIcon.tsx
// Icône de matière déduite automatiquement du nom (retour testeurs : « icônes
// pour les matières »). 100 % présentation — aucun changement de données.
// Style : trait, 24x24, stroke currentColor → se colore via la couleur passée.

import type { ReactElement } from 'react'

// Normalise : minuscules + sans accents, pour un matching robuste.
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "")
}

// Chaque entrée : liste de mots-clés → clé d'icône. Premier match gagne.
const RULES: { keys: string[]; icon: string }[] = [
  { keys: ['cardio', 'coeur', 'cardiovasc'], icon: 'heart' },
  { keys: ['neuro', 'cerveau', 'nerveux', 'psychiatr', 'psy'], icon: 'brain' },
  { keys: ['respi', 'pneumo', 'poumon', 'thorax', 'pleur'], icon: 'lungs' },
  { keys: ['os ', 'osseux', 'rhumato', 'locomoteur', 'squelette', 'ortho', 'articul', 'arthro'], icon: 'bone' },
  { keys: ['cellul', 'cyto', 'cellule'], icon: 'cell' },
  { keys: ['biochim', 'metabol'], icon: 'molecule' },
  { keys: ['chimie', 'chim'], icon: 'flask' },
  { keys: ['biophys', 'physique', 'physiq'], icon: 'atom' },
  { keys: ['genet', 'adn', 'heredit', 'molecula'], icon: 'dna' },
  { keys: ['histo', 'anatomo-path', 'microscop'], icon: 'microscope' },
  { keys: ['physio'], icon: 'pulse' },
  { keys: ['anat'], icon: 'body' },
  { keys: ['embryo', 'repro', 'gyneco', 'obstet'], icon: 'embryo' },
  { keys: ['pharma', 'therapeut', 'medicament'], icon: 'pill' },
  { keys: ['immuno', 'bacterio', 'viro', 'infectio', 'micro'], icon: 'microbe' },
  { keys: ['ophtalmo', 'oeil', 'vision'], icon: 'eye' },
  { keys: ['dent', 'odonto'], icon: 'tooth' },
  { keys: ['stat', 'biostat', 'proba', 'epidemio'], icon: 'chart' },
  { keys: ['shs', 'sciences humaines', 'ethiq', 'socio', 'sante publique', 'droit'], icon: 'people' },
  { keys: ['anglais', 'langue', 'espagnol', 'lve', 'lv1'], icon: 'globe' },
  { keys: ['nephro', 'rein', 'urinaire', 'uro'], icon: 'drop' },
  { keys: ['hemato', 'sang', 'hemostase'], icon: 'drop' },
  { keys: ['digest', 'gastro', 'hepato', 'abdomen', 'nutrition'], icon: 'flask' },
  { keys: ['endocrin', 'hormon'], icon: 'molecule' },
]

function iconKey(name: string): string {
  const n = norm(name)
  for (const r of RULES) {
    if (r.keys.some(k => n.includes(k.trim()))) return r.icon
  }
  return 'default'
}

// Paths SVG (viewBox 0 0 24 24, stroke currentColor).
function paths(key: string): ReactElement {
  switch (key) {
    case 'heart':
      return <path d="M12 20s-7-4.4-9.2-8.6C1.3 8.2 3 5 6.2 5c2 0 3.4 1.2 5.8 3.2C14.4 6.2 15.8 5 17.8 5 21 5 22.7 8.2 21.2 11.4 19 15.6 12 20 12 20z" />
    case 'brain':
      return <><path d="M9 5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.5A3 3 0 0 0 6 19a3 3 0 0 0 3 1V5z" /><path d="M15 5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.5A3 3 0 0 1 18 19a3 3 0 0 1-3 1V5z" /></>
    case 'lungs':
      return <><path d="M12 4v8" /><path d="M12 12c-.6-1.4-1.8-2.4-3.4-2.4-1.8 0-2.6 1.6-2.6 4.4 0 3 .6 5 2.8 5 1.8 0 3.2-1.4 3.2-3.6" /><path d="M12 12c.6-1.4 1.8-2.4 3.4-2.4 1.8 0 2.6 1.6 2.6 4.4 0 3-.6 5-2.8 5-1.8 0-3.2-1.4-3.2-3.6" /></>
    case 'bone':
      return <path d="M8.5 8.5 15.5 15.5M7.8 6.4a1.8 1.8 0 1 0 1.6 2.6M6.4 7.8a1.8 1.8 0 1 0 2.6 1.6M16.2 17.6a1.8 1.8 0 1 0-1.6-2.6M17.6 16.2a1.8 1.8 0 1 0-2.6-1.6" />
    case 'cell':
      return <><circle cx="12" cy="12" r="8.5" /><circle cx="13" cy="13" r="3" /><circle cx="8" cy="9" r="1" /></>
    case 'molecule':
      return <><circle cx="6" cy="8" r="2" /><circle cx="18" cy="9" r="2" /><circle cx="12" cy="17" r="2" /><path d="M7.7 9.2 10.6 15.4M16.4 10.4 13.4 16M7.7 8.2 16.3 8.6" /></>
    case 'flask':
      return <path d="M9.5 3h5M10.5 3v5.5l-4.8 8A1.8 1.8 0 0 0 7.3 19.5h9.4a1.8 1.8 0 0 0 1.6-2.9l-4.8-8V3M8 14h8" />
    case 'atom':
      return <><circle cx="12" cy="12" r="1.6" /><ellipse cx="12" cy="12" rx="9" ry="3.6" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" /></>
    case 'dna':
      return <path d="M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9s8 5 8 9M9 6h6M8.5 9.5h7M8.5 14.5h7M9 18h6" />
    case 'microscope':
      return <path d="M6 20h12M9 20l-1-3M11 6l4 4-3.5 3.5L7.5 9.5zM9.5 7.5 8 6M16 13c2 1 3 3 2.5 6" />
    case 'pulse':
      return <path d="M3 12h4l2-5 3 10 2.5-7 1.5 2h5" />
    case 'body':
      return <><circle cx="12" cy="5" r="2.2" /><path d="M12 7.2V15M12 9 7 11M12 9l5 2M12 15l-2.5 5M12 15l2.5 5" /></>
    case 'embryo':
      return <path d="M14 4a7 7 0 1 0 4 12 4.5 4.5 0 0 1-4-4.5A4.5 4.5 0 0 1 18 7 7 7 0 0 0 14 4z" />
    case 'pill':
      return <><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)" /><path d="M9 7.5 15 16.5" transform="rotate(-35 12 12)" /></>
    case 'microbe':
      return <><circle cx="12" cy="12" r="6" /><path d="M12 6V3M12 21v-3M6 12H3M21 12h-3M7.8 7.8 5.6 5.6M18.4 18.4l-2.2-2.2M16.2 7.8l2.2-2.2M5.6 18.4l2.2-2.2" /><circle cx="10.5" cy="11" r="1" /><circle cx="14" cy="13.5" r="1" /></>
    case 'eye':
      return <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>
    case 'tooth':
      return <path d="M7 4c-2 0-3 1.6-3 4 0 3 1 4 1.5 7 .4 2.4.6 5 1.5 5 1.2 0 1-3 3-3s1.8 3 3 3c.9 0 1.1-2.6 1.5-5 .5-3 1.5-4 1.5-7 0-2.4-1-4-3-4-1.5 0-2 1-3 1s-1.5-1-3-1z" />
    case 'chart':
      return <path d="M5 20V10M12 20V4M19 20v-7" />
    case 'people':
      return <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>
    case 'globe':
      return <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></>
    case 'drop':
      return <path d="M12 3.5c3 4 5.5 6.6 5.5 9.6A5.5 5.5 0 0 1 6.5 13c0-3 2.5-5.6 5.5-9.5z" />
    default:
      return <path d="M6.5 4h8L18 7.5V20H6.5zM14 4v4h4M9.5 12h5M9.5 15.5h5" />
  }
}

export default function SubjectIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths(iconKey(name))}
    </svg>
  )
}
