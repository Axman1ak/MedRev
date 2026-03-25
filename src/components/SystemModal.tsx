'use client'
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

const EMOJIS = [
  '📚','🔬','🧬','💊','🩺','🫀','🧠','🦷','🦴','👁',
  '🩻','🩹','💉','🧪','🔭','📖','✏️','📝','🗂️','📋',
  '🎯','⭐','🏆','💡','🔑','🌡️','🫁','🦠','🧫','🩸',
]

export default function SystemModal({ system, lessonCount, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(system?.name || '')
  const [icon, setIcon] = useState(system?.icon || '📁')
  const [calHidden, setCalHidden] = useState(system?.cal_hidden ?? false)
  const [saving, setSaving] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), icon: icon || '📁', cal_hidden: calHidden })
    setSaving(false)
  }

  function handleDelete() {
    if (!onDelete) return
    if (lessonCount > 0 && !confirm('Supprimer cette matiere et ses fiches ?')) return
    onDelete()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="font-syne font-bold text-lg mb-5" style={{ color: 'var(--t1)' }}>
          {system ? 'Modifier la matiere' : 'Nouvelle matiere'}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="label">Nom *</label>
            <input className="input" placeholder="ex: CARDIO, HISTO..." value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Icone</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div onClick={() => setShowPicker(!showPicker)}
                style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg3)', border: '2px solid ' + (showPicker ? 'var(--accent)' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer', flexShrink: 0 }}>
                {icon}
              </div>
              <span className="text-xs" style={{ color: 'var(--t3)' }}>Cliquez pour choisir</span>
            </div>
            {showPicker && (
              <div style={{ marginTop: 8, padding: 10, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
                {EMOJIS.map(em => (
                  <button key={em} type="button" onClick={() => { setIcon(em); setShowPicker(false) }}
                    style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid ' + (icon === em ? 'var(--accent)' : 'transparent'), background: icon === em ? 'rgba(79,142,247,.15)' : 'transparent', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label">Calendrier</label>
            <div className="flex items-center gap-3 mt-1">
              <div onClick={() => setCalHidden(!calHidden)}
                style={{ width: 40, height: 22, borderRadius: 11, background: !calHidden ? 'var(--accent)' : 'var(--t3)', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: !calHidden ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </div>
              <span className="text-sm" style={{ color: 'var(--t2)' }}>{calHidden ? 'Masquee' : 'Affichee dans le calendrier'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>{onDelete && <button type="button" onClick={handleDelete} className="btn btn-danger btn-sm">Supprimer</button>}</div>
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
