'use client'
// src/components/QcmPitchModal.tsx
//
// Ce qui s'ouvre quand un étudiant se met 1, 2 ou 3 sur une fiche.
//
// LE MOMENT
// ---------
// Il vient de reconnaître, lui-même, qu'il ne maîtrise pas. C'est le seul
// instant de la journée où l'argument « entraîne-toi au lieu de relire » ne
// tombe pas à côté. Avant, un bandeau discret s'insérait sous la note : trop
// petit pour être lu, collé à la grille des paliers, sans force de conviction.
//
// CE QU'ON AVANCE, ET CE QU'ON N'AVANCE PAS
// -----------------------------------------
// Les arguments ci-dessous sont tous vérifiables : le rappel actif bat la
// relecture, le concours est un QCM chronométré, une question ratée localise
// le trou, et la génération part du cours de l'étudiant.
//
// On n'affiche AUCUNE statistique de performance. La seule mesure disponible
// (2,94 contre 2,76 d'auto-évaluation, cinq utilisateurs, causalité probable
// en sens inverse) ne démontre rien, et une preuve inventée se retourne contre
// toi dès qu'un tutorat demande d'où elle sort.
//
// FRÉQUENCE
// ---------
// Une fois par jour au maximum, et plus jamais si l'étudiant le refuse. Un
// argument répété à chaque note basse cesse d'être un argument.

import { useEffect } from 'react'
import './qcm-pitch.css'

const LS_JOUR = 'medrev-pitch-qcm-jour'
const LS_JAMAIS = 'medrev-pitch-qcm-jamais'

export type PitchKind = 'sans-cours' | 'cours-sans-qcm' | 'avec-qcm'

/** Faut-il proposer le pitch aujourd'hui ? Appelé avant d'ouvrir la modale. */
export function peutProposerPitch(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (localStorage.getItem(LS_JAMAIS) === '1') return false
    return localStorage.getItem(LS_JOUR) !== new Date().toISOString().slice(0, 10)
  } catch {
    // Navigation privée ou stockage bloqué : on ne harcèle pas, on s'abstient.
    return false
  }
}

function marquerVuAujourdhui() {
  try { localStorage.setItem(LS_JOUR, new Date().toISOString().slice(0, 10)) } catch { /* sans gravité */ }
}
function nePlusProposer() {
  try { localStorage.setItem(LS_JAMAIS, '1') } catch { /* sans gravité */ }
}

const ARGUMENTS: Record<PitchKind, { titre: string; texte: string }[]> = {
  'sans-cours': [
    {
      titre: 'Relire, c’est reconnaître. Répondre, c’est se souvenir.',
      texte: "Une page relue paraît familière, et cette familiarité se confond avec le fait de la savoir. Une question tranche la question.",
    },
    {
      titre: 'Ton concours est un QCM chronométré',
      texte: "Le jour J, on ne te demande pas de réciter ton cours mais de cocher vite et juste, avec un barème qui sanctionne la discordance. Ça se travaille à part.",
    },
    {
      titre: 'Depuis TON cours, pas un cours générique',
      texte: "Tu déposes ton poly, MedRev écrit les questions dessus, avec le renvoi à la page exacte quand tu te trompes.",
    },
  ],
  'cours-sans-qcm': [
    {
      titre: 'Ton cours est déjà là',
      texte: "Il ne manque qu'un clic pour en tirer une trentaine de questions, avec le renvoi à la page exacte quand tu te trompes.",
    },
    {
      titre: 'Relire, c’est reconnaître. Répondre, c’est se souvenir.',
      texte: "Une page relue paraît familière, et cette familiarité se confond avec le fait de la savoir. Une question tranche la question.",
    },
    {
      titre: 'Ton concours est un QCM chronométré',
      texte: "Le jour J, on ne te demande pas de réciter mais de cocher vite et juste, avec un barème qui sanctionne la discordance.",
    },
  ],
  'avec-qcm': [
    {
      titre: 'Tu as déjà des questions sur cette fiche',
      texte: "C'est le moment de les passer : tu sauras en cinq minutes ce qui ne rentre pas, au lieu de le deviner à la relecture.",
    },
    {
      titre: 'Le simulateur retient ce que tu rates',
      texte: "Les questions manquées reviennent plus souvent, et tu peux relancer une session uniquement dessus.",
    },
  ],
}

export default function QcmPitchModal({
  kind,
  ficheNom,
  note,
  nbQcm,
  enCours,
  onAction,
  onClose,
}: {
  kind: PitchKind
  ficheNom: string
  note: number
  nbQcm?: number
  /** Génération en cours : on bloque le bouton sans fermer la modale. */
  enCours?: boolean
  onAction: () => void
  onClose: () => void
}) {
  useEffect(() => {
    marquerVuAujourdhui()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const libelleAction =
    kind === 'avec-qcm' ? `M’entraîner sur ${nbQcm} questions →`
    : kind === 'cours-sans-qcm' ? (enCours ? 'Génération… (30-60s)' : 'Générer mes QCM →')
    : 'Ajouter mon cours →'

  const titre =
    kind === 'avec-qcm' ? 'Teste-toi plutôt que de relire'
    : kind === 'cours-sans-qcm' ? 'Transforme ce cours en questions'
    : 'Tu ne sauras pas en relisant'

  return (
    <div className="qp-overlay" role="dialog" aria-modal="true" aria-labelledby="qp-title" onClick={onClose}>
      <div className="qp-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="qp-close" onClick={onClose} aria-label="Fermer">×</button>

        <div className="qp-kicker">
          Tu viens de te mettre <strong>{note}/5</strong> sur <strong>{ficheNom}</strong>
        </div>
        <h2 id="qp-title" className="qp-title">{titre}</h2>

        <ul className="qp-args">
          {ARGUMENTS[kind].map(a => (
            <li key={a.titre} className="qp-arg">
              <span className="qp-arg-mark" aria-hidden="true" />
              <div>
                <strong>{a.titre}</strong>
                <p>{a.texte}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="qp-actions">
          <button type="button" className="qp-btn-primary" onClick={onAction} disabled={enCours}>
            {libelleAction}
          </button>
          <button type="button" className="qp-btn-ghost" onClick={onClose}>
            Plus tard
          </button>
        </div>

        <button
          type="button"
          className="qp-never"
          onClick={() => { nePlusProposer(); onClose() }}
        >
          Ne plus me proposer ça
        </button>
      </div>
    </div>
  )
}
