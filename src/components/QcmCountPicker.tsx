'use client'
// Petit choix 10 / 20 / 30 placé à côté des boutons « Générer ».
import { QCM_COUNTS, type QcmCount } from '@/lib/qcmCount'
import './qcm-count.css'

export default function QcmCountPicker({ value, onChange, disabled }: { value: QcmCount; onChange: (n: QcmCount) => void; disabled?: boolean }) {
  return (
    <div className="qnb" role="group" aria-label="Nombre de questions à créer">
      {QCM_COUNTS.map(n => (
        <button key={n} type="button" className={value === n ? 'on' : ''} aria-pressed={value === n} disabled={disabled} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  )
}
