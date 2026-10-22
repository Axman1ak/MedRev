'use client'
// src/components/ImportFiches.tsx
//
// Import de fiches depuis le document qui liste les cours (programme, plan du
// semestre). 1. Déposer  2. Vérifier  3. Créé.
// Les fiches sont créées sans J-0 (learn_date null, « À planifier ») : elles
// n'entrent dans le planning que lorsque l'étudiant fixe leur date, comme pour
// une fiche créée à la main. Une matière inconnue est créée dans le semestre
// en cours. Rien n'est écrit avant le clic final.

import { useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, System } from '@/types'
import { scheduleOf } from '@/lib/schedule'
import { SUBJ_COLORS, buildSubjectColorMap } from '@/lib/subjectColors'
import './import-fiches.css'

type Phase = 'drop' | 'reading' | 'review' | 'creating' | 'done'
interface Row { key: string; nom: string; sys: string; checked: boolean; exists: boolean }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Réduit une photo trop lourde (limite d'envoi de 4 Mo) en JPEG 2000 px.
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 3.5 * 1024 * 1024) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file
  } catch { return file }
}

export default function ImportFiches({
  userId, systems, lessons, year, semestre, onDone, onClose,
}: {
  userId: string
  systems: System[]
  lessons: Lesson[]
  year: string
  semestre: 1 | 2
  onDone: (newSystems: System[], newLessons: Lesson[]) => void
  onClose: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [phase, setPhase] = useState<Phase>('drop')
  const [rows, setRows] = useState<Row[]>([])
  const [newSys, setNewSys] = useState<string[]>([])
  const [docName, setDocName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [created, setCreated] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const colorOf = useMemo(() => buildSubjectColorMap(systems), [systems])

  const existing = useMemo(() => {
    const set = new Set<string>()
    for (const l of lessons) set.add(`${l.system_id}|${norm(l.name)}`)
    return set
  }, [lessons])

  async function read(f: File) {
    setErr(null)
    const file = await shrinkImage(f)
    setDocName(f.name)
    setPhase('reading')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('systems', JSON.stringify(systems.map(s => ({ id: s.id, name: s.name }))))
      const res = await fetch('/api/import-fiches', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`)
      const cours = (data as { cours: { nom: string; matiere: string; system_id: string | null }[] }).cours
      const proposed: string[] = []
      const next: Row[] = cours.map((c, i) => {
        let sys = c.system_id ? `id:${c.system_id}` : ''
        if (!sys) {
          const name = c.matiere || 'Autres cours'
          if (!proposed.some(p => norm(p) === norm(name))) proposed.push(name)
          sys = `new:${proposed.find(p => norm(p) === norm(name))}`
        }
        const exists = sys.startsWith('id:') && existing.has(`${sys.slice(3)}|${norm(c.nom)}`)
        return { key: `r${i}`, nom: c.nom, sys, checked: !exists, exists }
      })
      setNewSys(proposed)
      setRows(next)
      setPhase('review')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lecture impossible')
      setPhase('drop')
    }
  }

  const sysOptions = [
    ...systems.map(s => ({ value: `id:${s.id}`, label: s.name, color: colorOf.get(s.id) || SUBJ_COLORS[0], isNew: false })),
    ...newSys.map((n, i) => ({ value: `new:${n}`, label: n, color: SUBJ_COLORS[(systems.length + i) % SUBJ_COLORS.length], isNew: true })),
  ]
  const groups = sysOptions
    .map(o => ({ ...o, rows: rows.filter(r => r.sys === o.value) }))
    .filter(g => g.rows.length > 0)
  const toCreate = rows.filter(r => r.checked && r.nom.trim())
  const newSysUsed = newSys.filter(n => toCreate.some(r => r.sys === `new:${n}`))

  const update = (key: string, patch: Partial<Row>) =>
    setRows(rs => rs.map(r => {
      if (r.key !== key) return r
      const n = { ...r, ...patch }
      if (patch.sys || patch.nom !== undefined) {
        const exists = n.sys.startsWith('id:') && existing.has(`${n.sys.slice(3)}|${norm(n.nom)}`)
        n.exists = exists
        if (exists && patch.sys) n.checked = false
      }
      return n
    }))

  async function create() {
    if (toCreate.length === 0) return
    setPhase('creating'); setErr(null)
    try {
      // 1. Matières nouvelles
      const madeSystems: System[] = []
      const idFor = new Map<string, string>()
      for (let i = 0; i < newSysUsed.length; i++) {
        const name = newSysUsed[i]
        const { data, error } = await supabase.from('systems').insert({
          user_id: userId, name, semestre, year, icon: '',
          color: SUBJ_COLORS[(systems.length + i) % SUBJ_COLORS.length],
        }).select().single()
        if (error || !data) throw new Error(error?.message || `La matière « ${name} » n'a pas pu être créée.`)
        madeSystems.push(data as System)
        idFor.set(`new:${name}`, (data as System).id)
      }
      // 2. Fiches, sans J-0 (« À planifier »)
      const allSys = [...systems, ...madeSystems]
      const payload = toCreate.map(r => {
        const sid = r.sys.startsWith('id:') ? r.sys.slice(3) : idFor.get(r.sys)!
        const len = scheduleOf(allSys.find(s => s.id === sid)).length
        return { user_id: userId, system_id: sid, name: r.nom.trim(), learn_date: null, steps: new Array(len).fill(null), ai_questions: [], chapter: null }
      })
      const made: Lesson[] = []
      for (let i = 0; i < payload.length; i += 100) {
        const { data, error } = await supabase.from('lessons').insert(payload.slice(i, i + 100)).select()
        if (error) throw new Error(error.message)
        made.push(...((data as Lesson[]) ?? []))
      }
      setCreated(made.length)
      onDone(madeSystems, made)
      setPhase('done')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'La création a échoué')
      setPhase('review')
    }
  }

  const step = phase === 'drop' || phase === 'reading' ? 0 : phase === 'done' ? 2 : 1

  return (
    <div className="imp-ov" onClick={onClose}>
      <div className="imp-mod" onClick={e => e.stopPropagation()} role="dialog" aria-label="Importer mes fiches">
        <div className="imp-head">
          <div>
            <h2>{step === 0 ? 'Importer mes fiches' : step === 1 ? 'Vérifie avant de créer' : 'C’est fait'}</h2>
            <p>
              {step === 0 && 'Dépose le document qui liste tes cours (programme, plan du semestre) : MedRev crée toutes tes fiches d’un coup.'}
              {step === 1 && `MedRev a trouvé ${rows.length} cours dans « ${docName} ». Corrige un nom ou une matière si besoin.`}
              {step === 2 && `${created} fiche${created > 1 ? 's' : ''} créée${created > 1 ? 's' : ''}. Fixe leur date d’apprentissage (J-0) le jour où tu as le cours, et dépose leurs polys quand tu les as.`}
            </p>
          </div>
          <button type="button" className="imp-x" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="imp-steps">
          {['Déposer', 'Vérifier', 'Créé'].map((l, i) => <span key={l} className={i === step ? 'on' : i < step ? 'ok' : ''}>{i + 1} {l}</span>)}
        </div>

        {step === 0 && (
          <div
            className={`imp-drop${over ? ' over' : ''}${phase === 'reading' ? ' busy' : ''}`}
            onDragOver={e => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f && phase === 'drop') void read(f) }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
            <b>{phase === 'reading' ? 'Lecture du document…' : 'Glisse la liste de tes cours ici'}</b>
            <span>{phase === 'reading' ? 'Environ 20 secondes.' : 'Un PDF, une capture d’écran ou une photo de ton programme.'}</span>
            {phase === 'drop' && <button type="button" className="imp-btn pri" onClick={() => input.current?.click()}>Choisir un fichier</button>}
            <input ref={input} type="file" accept="application/pdf,image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f) }} />
          </div>
        )}

        {step === 1 && (
          <div className="imp-scroll">
            {groups.map(g => (
              <div key={g.value} className="imp-group">
                <div className="imp-mat"><i style={{ background: g.color }} />{g.label}, {g.rows.length} cours{g.isNew && <em>Nouvelle matière</em>}</div>
                <div className="imp-list">
                  {g.rows.map(r => (
                    <div key={r.key} className={`imp-row${r.checked ? '' : ' off'}`}>
                      <button type="button" className={`imp-cb${r.checked ? ' on' : ''}`} aria-pressed={r.checked} aria-label={r.checked ? 'Ne pas créer' : 'Créer'} onClick={() => update(r.key, { checked: !r.checked })}>{r.checked ? '✓' : ''}</button>
                      <input className="imp-name" value={r.nom} onChange={e => update(r.key, { nom: e.target.value })} aria-label="Nom de la fiche" />
                      <select className="imp-sel" value={r.sys} onChange={e => update(r.key, { sys: e.target.value })} aria-label="Matière">
                        {sysOptions.map(o => <option key={o.value} value={o.value}>{o.label}{o.isNew ? ' (nouvelle)' : ''}</option>)}
                      </select>
                      {r.exists && <span className="imp-tag">Existe déjà</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {err && <p className="imp-err" role="alert">{err}</p>}

        <div className="imp-foot">
          {step === 0 && <><p>Rien n&apos;est créé avant ta validation à l&apos;étape suivante.</p><span /></>}
          {step === 1 && (
            <>
              <p>{toCreate.length} fiche{toCreate.length > 1 ? 's' : ''}{newSysUsed.length ? `, ${newSysUsed.length} nouvelle${newSysUsed.length > 1 ? 's' : ''} matière${newSysUsed.length > 1 ? 's' : ''}` : ''}. Une fiche qui existe déjà n&apos;est pas recréée.</p>
              <button type="button" className="imp-btn pri" disabled={phase === 'creating' || toCreate.length === 0} onClick={create}>
                {phase === 'creating' ? 'Création…' : `Créer ${toCreate.length} fiche${toCreate.length > 1 ? 's' : ''}`}
              </button>
            </>
          )}
          {step === 2 && <><span /><button type="button" className="imp-btn pri" onClick={onClose}>Voir mes fiches</button></>}
        </div>
      </div>
    </div>
  )
}
