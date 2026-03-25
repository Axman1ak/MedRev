'use client'
// src/components/LessonModal.tsx

import { useState } from 'react'
import type { Lesson, System } from '@/types'
import { todayStr } from '@/types'

interface Props {
  lesson: Lesson | null
  systems: System[]
  defaultSystemId: string | null
  userId: string
  onClose: () => void
  onSave: (data: Partial<Lesson>) => Promise<void>
}

export default function LessonModal({ lesson, systems, defaultSystemId, onClose, onSave }: Props) {
  const [name, setName] = useState(lesson?.name || '')
  const [systemId, setSystemId] = useState(lesson?.system_id || defaultSystemId || systems[0]?.id || '')
  const [learnDate, setLearnDate] = useState(lesson?.learn_date || todayStr())
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), system_id: systemId, learn_date: learnDate || null })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="font-syne font-bold text-lg mb-5" style={{ color: 'var(--t1)' }}>
          {lesson ? 'Modifier la fiche' : 'Nouvelle fiche'}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="label">Nom de la fiche *</label>
            <input className="input" placeholder="ex: PHYSIO Fiche 1 — Cardiovasculaire" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Matière *</label>
            {systems.length > 0 ? (
              <select className="input" value={systemId} onChange={e => setSystemId(e.target.value)} required>
                {systems.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            ) : (
              <div className="text-sm" style={{ color: 'var(--danger)', padding: '10px 13px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 10 }}>
                Créez d'abord une matière avant d'ajouter une fiche.
              </div>
            )}
          </div>
          <div>
            <label className="label">Date J0 — première lecture</label>
            <input className="input" type="date" value={learnDate} onChange={e => setLearnDate(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">Annuler</button>
            <button type="submit" disabled={!name.trim() || !systemId || saving} className="btn btn-primary" style={{ opacity: (!name.trim() || !systemId || saving) ? 0.5 : 1 }}>
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
