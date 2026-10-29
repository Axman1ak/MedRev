'use client'
import { useEffect, useRef, useState } from 'react'
import { TODAY_SORT_LABELS, type TodaySort } from '@/lib/todaySort'
import './today-sort.css'

const ORDER: TodaySort[] = ['retard', 'subject', 'j']

export default function TodaySortMenu({ value, onChange, className }: { value: TodaySort; onChange: (v: TodaySort) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div className={`tsort${className ? ` ${className}` : ''}`} ref={ref}>
      <button
        type="button"
        className="tsort-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Trier les fiches : ${TODAY_SORT_LABELS[value]}`}
        title={`Trier : ${TODAY_SORT_LABELS[value]}`}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M4 7h16M7 12h10M10 17h4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="tsort-menu" role="menu">
          <div className="tsort-head">Trier les fiches</div>
          {ORDER.map(k => (
            <button
              key={k}
              type="button"
              role="menuitemradio"
              aria-checked={value === k}
              className={`tsort-opt${value === k ? ' on' : ''}`}
              onClick={() => { onChange(k); setOpen(false) }}
            >
              <span>{TODAY_SORT_LABELS[k]}</span>
              {value === k && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </button>
          ))}
          <div className="tsort-note">La session suit le même ordre.</div>
        </div>
      )}
    </div>
  )
}
