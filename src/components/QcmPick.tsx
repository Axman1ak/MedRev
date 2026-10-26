'use client'
// Choix du nombre de QCM à créer. Un bouton normal ; au clic, il laisse la
// place, au même endroit et à la même hauteur, à une petite rangée
// « Combien ? 10 20 30 ». Rien ne s'ouvre par-dessus, rien ne pousse la page.

import { QCM_COUNTS, type QcmCount } from '@/lib/qcmCount'
import './qcm-pick.css'

export default function QcmPick({
  open, onOpen, onClose, onPick, label, className, plus = false, disabled = false,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  onPick: (n: QcmCount) => void
  label: string
  className: string
  plus?: boolean
  disabled?: boolean
}) {
  if (!open || disabled) {
    return <button type="button" className={className} onClick={onOpen} disabled={disabled}>{label}</button>
  }
  return (
    <div className="qpick" role="group" aria-label="Combien de questions ?">
      <span className="qpick-l">{plus ? 'Ajouter' : 'Combien ?'}</span>
      {QCM_COUNTS.map(n => (
        <button key={n} type="button" className="qpick-n" onClick={() => onPick(n)}>{plus ? `+${n}` : n}</button>
      ))}
      <button type="button" className="qpick-x" aria-label="Annuler" onClick={onClose}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  )
}
