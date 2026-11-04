'use client'
// Recherche globale (⌘K / Ctrl+K), ouverte depuis la barre de gauche.
// Elle remplace le faux champ « Rechercher » du tableau de bord, qui ne
// faisait rien. On cherche dans les fiches et les matières de l'étudiant.
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Item = { kind: 'fiche' | 'matiere'; id: string; name: string; systemId?: string; systemName?: string; color?: string }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function SearchPalette({ open, onClose, userId, colors }: {
  open: boolean
  onClose: () => void
  userId: string | null
  colors: Map<string, string>
}) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [items, setItems] = useState<Item[] | null>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQ(''); setSel(0)
    setTimeout(() => inputRef.current?.focus(), 0)
    if (items || !userId) return
    ;(async () => {
      const [{ data: sys }, { data: les }] = await Promise.all([
        supabase.from('systems').select('id, name').eq('user_id', userId),
        supabase.from('lessons').select('id, name, system_id').eq('user_id', userId),
      ])
      const sysName = new Map<string, string>(((sys as { id: string; name: string }[] | null) ?? []).map(s => [s.id, s.name]))
      const out: Item[] = []
      ;((sys as { id: string; name: string }[] | null) ?? []).forEach(s => out.push({ kind: 'matiere', id: s.id, name: s.name }))
      ;((les as { id: string; name: string; system_id: string }[] | null) ?? []).forEach(l =>
        out.push({ kind: 'fiche', id: l.id, name: l.name, systemId: l.system_id, systemName: sysName.get(l.system_id) || '' }))
      setItems(out)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId])

  const results = useMemo(() => {
    if (!items) return []
    const n = norm(q.trim())
    const list = n ? items.filter(i => norm(i.name).includes(n) || (i.systemName && norm(i.systemName).includes(n))) : items.filter(i => i.kind === 'matiere')
    return list.slice(0, 9)
  }, [items, q])

  function go(it: Item) {
    onClose()
    if (it.kind === 'matiere') {
      window.dispatchEvent(new CustomEvent('medrev-open-matiere', { detail: it.id }))
      if (!pathname.startsWith('/dashboard/fiches')) router.push(`/dashboard/fiches?matiere=${it.id}`)
      return
    }
    if (pathname.startsWith('/dashboard/fiches')) {
      window.dispatchEvent(new CustomEvent('medrev-open-fiche', { detail: it.id }))
    } else {
      router.push(`/dashboard/fiches?matiere=${it.systemId}&fiche=${it.id}`)
    }
  }

  if (!open) return null
  return (
    <div className="sp-wrap" onClick={onClose}>
      <div className="sp-card" role="dialog" aria-modal="true" aria-label="Rechercher" onClick={e => e.stopPropagation()}>
        <label className="sp-field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5" strokeLinecap="round"/></svg>
          <input
            ref={inputRef}
            value={q}
            placeholder="Rechercher une fiche ou une matière"
            aria-label="Rechercher une fiche ou une matière"
            onChange={e => { setQ(e.target.value); setSel(0) }}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
              else if (e.key === 'Enter' && results[sel]) go(results[sel])
            }}
          />
          <kbd>Échap</kbd>
        </label>
        <div className="sp-list">
          {!items && <div className="sp-empty">Chargement…</div>}
          {items && results.length === 0 && <div className="sp-empty">Aucun résultat</div>}
          {results.map((it, i) => {
            const color = colors.get(it.kind === 'matiere' ? it.id : (it.systemId || '')) || '#7FB0D4'
            return (
              <button key={it.kind + it.id} type="button" className={`sp-row${i === sel ? ' on' : ''}`}
                onMouseEnter={() => setSel(i)} onClick={() => go(it)}>
                <span className="sp-dot" style={{ background: color }} />
                <span className="sp-name">{it.name}</span>
                <span className="sp-meta">{it.kind === 'matiere' ? 'Matière' : it.systemName}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
