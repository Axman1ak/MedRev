'use client'
// src/components/SystemModal.tsx

import { useState } from 'react'
import type { System } from '@/types'

interface Props {
  system: System | null
  userId: string
  lessonCount: number
  onClose: () => void
  onSave: (data: Partial<System>) => Promise<void>
  onDelete?: () => void
}

export default function SystemModal({ system, lessonCount, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(system?.name || '')
  const [icon, setIcon] = useState(system?.icon || '📁')
  const [calHidden, setCalHidden] = useState(system?.cal_hidden ?? false)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), icon: icon || '📁', cal_hidden: calHidden })
    setSaving(false)
  }

  function handleDelete() {
    if (!onDelete) return
    if (lessonCount > 0 && !confirm(`Cette matière contient ${lessonCount} fiche(s). Supprimer quand même ?`)) return
    onDelete()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="font-syne font-bold text-lg mb-5" style={{ color: 'var(--t1)' }}>
          {system ? 'Modifier la matière' : 'Nouvelle matière'}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="label">Nom de la matière *</label>
            <input className="input" placeholder="ex: CARDIO, HISTO, BIOCHIMIE..." value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Emoji</label>
            <input className="input" placeholder="🔬" value={icon} onChange={e => setIcon(e.target.value)} maxLength={4} />
          </div>
          <div>
            <label className="label">Calendrier</label>
            <div className="flex items-center gap-3 mt-1">
              <div onClick={() => setCalHidden(!calHidden)}
                style={{ width: 40, height: 22, borderRadius: 11, background: !calHidden ? 'var(--accent)' : 'var(--t3)', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: !calHidden ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </div>
              <span className="text-sm" style={{ color: 'var(--t2)' }}>
                {calHidden ? 'Masquée du calendrier' : 'Affichée dans le calendrier'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>
              {onDelete && (
                <button type="button" onClick={handleDelete} className="btn btn-danger btn-sm">
                  🗑 Supprimer
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn btn-ghost">Annuler</button>
              <button type="submit" disabled={!name.trim() || saving} className="btn btn-primary" style={{ opacity: (!name.trim() || saving) ? 0.5 : 1 }}>
                {saving ? '...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
