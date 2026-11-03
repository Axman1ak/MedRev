'use client'
// Tableau de bord recentré sur une seule question : qu'est-ce que je révise
// aujourd'hui, et comment je rattrape mon retard. Trois mises en page à
// comparer (aperçu) : « jour », « urgence » et « semaine ».
import Link from 'next/link'
import { useState } from 'react'
import SubjectIcon from '@/components/SubjectIcon'
import type { Lesson, System, TdEvent } from '@/types'
import './dash-focus.css'

export type FocusItem = {
  lesson: Lesson
  due: { stepIndex: number; status: string; overdueDays: number }
}
export type FocusDay = { date: string; dow: string; num: number; items: FocusItem[]; isToday: boolean }
export type FocusVariant = 'jour' | 'urgence' | 'semaine'

type Props = {
  variant: FocusVariant
  queue: FocusItem[]
  days: FocusDay[]           // aujourd'hui puis les 6 jours suivants
  systems: System[]
  colorOf: Map<string, string>
  schedOf: (id: string | null | undefined) => number[]
  startHref: string
  onOpen: (l: Lesson) => void
  tds: TdEvent[]
  fmtTd: (t: string | null) => string
  sortMenu?: React.ReactNode
}

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`

function Row({ it, systems, colorOf, schedOf, onOpen, compact }: { it: FocusItem; systems: System[]; colorOf: Map<string, string>; schedOf: Props['schedOf']; onOpen: Props['onOpen']; compact?: boolean }) {
  const sys = systems.find(s => s.id === it.lesson.system_id)
  const name = sys?.name ?? 'Matière'
  const color = colorOf.get(it.lesson.system_id) || '#22507E'
  const late = it.due.status === 'missed'
  return (
    <button type="button" className={`dfx-row${compact ? ' compact' : ''}`} onClick={() => onOpen(it.lesson)}>
      {compact
        ? <span className="dfx-dot" style={{ background: color }} />
        : <span className="dfx-ic" style={{ color, background: `${color}1A` }}><SubjectIcon name={name} /></span>}
      <span className="dfx-mid">
        <span className="dfx-nm">{it.lesson.name}</span>
        <span className="dfx-sub">{name}<span className="dfx-j">J+{schedOf(it.lesson.system_id)[it.due.stepIndex]}</span></span>
      </span>
      {!compact && (late
        ? <span className="dfx-late">{it.due.overdueDays <= 1 ? 'hier' : `${it.due.overdueDays} j de retard`}</span>
        : <span className="dfx-today">aujourd&apos;hui</span>)}
    </button>
  )
}

export default function DashFocus(p: Props) {
  const late = p.queue.filter(x => x.due.status === 'missed')
  const today = p.queue.filter(x => x.due.status !== 'missed')
  const tomorrow = p.days[1]?.items ?? []
  const [dayIdx, setDayIdx] = useState(0)

  // Rattrapage : en ajoutant 3 fiches de retard par jour, à jour en N jours.
  const extra = 3
  const catchDays = late.length ? Math.ceil(late.length / extra) : 0
  const catchDate = catchDays ? p.days[Math.min(catchDays, p.days.length - 1)] : null

  const head = (
    <div className="dfx-head">
      <div>
        <h2 className="dfx-title">
          {p.queue.length === 0 ? 'Rien à réviser aujourd’hui' : `${plural(p.queue.length, 'fiche')} à réviser aujourd’hui`}
        </h2>
        <p className="dfx-lead">
          {late.length > 0
            ? <><b className="dfx-red">{late.length} en retard</b>{today.length > 0 ? `, ${today.length} prévue${today.length > 1 ? 's' : ''} pour aujourd’hui` : ''}.</>
            : p.queue.length > 0 ? 'Tout est à jour, il ne reste que les fiches du jour.' : 'Profite de ta journée.'}
        </p>
      </div>
      <div className="dfx-actions">
        {p.sortMenu}
        {p.queue.length > 0 && <Link href={p.startHref} className="dfx-go">Commencer la session</Link>}
      </div>
    </div>
  )

  const catchup = late.length > 0 && (
    <div className="dfx-catch">
      <div className="dfx-k">Pour rattraper</div>
      <p>En ajoutant <b>{extra} fiches de retard par jour</b>, tu es à jour {catchDays <= 1 ? 'demain' : catchDays >= 7 ? `dans ${catchDays} jours` : `${catchDate?.dow.toLowerCase()} ${catchDate?.num}`}.</p>
    </div>
  )

  const tdBlock = p.tds.length > 0 && (
    <div className="dfx-tds">
      <div className="dfx-k">Aujourd&apos;hui en cours</div>
      {p.tds.map(td => (
        <div key={td.id} className="dfx-td"><b>{td.start_time ? p.fmtTd(td.start_time) : 'TD'}</b><span>{td.title}</span></div>
      ))}
    </div>
  )

  if (p.variant === 'urgence') {
    const cols: { k: string; cls: string; items: FocusItem[]; empty: string }[] = [
      { k: 'En retard', cls: 'late', items: late, empty: 'Aucun retard' },
      { k: "Aujourd'hui", cls: 'now', items: today, empty: 'Rien de prévu' },
      { k: 'Demain', cls: 'next', items: tomorrow, empty: 'Rien de prévu' },
    ]
    return (
      <div className="dfx">
        {head}
        <div className="dfx-cols">
          {cols.map(c => (
            <section key={c.k} className={`dfx-col ${c.cls}`}>
              <div className="dfx-col-h"><span>{c.k}</span><b>{c.items.length}</b></div>
              <div className="dfx-col-list">
                {c.items.length === 0 ? <div className="dfx-empty">{c.empty}</div>
                  : c.items.map(it => <Row key={it.lesson.id} it={it} compact {...p} />)}
              </div>
              {c.cls === 'late' && catchup}
              {c.cls === 'now' && tdBlock}
            </section>
          ))}
        </div>
      </div>
    )
  }

  if (p.variant === 'semaine') {
    const max = Math.max(1, ...p.days.map((d, i) => (i === 0 ? p.queue.length : d.items.length)))
    const sel = p.days[dayIdx]
    const list = dayIdx === 0 ? p.queue : sel.items
    return (
      <div className="dfx">
        {head}
        <div className="dfx-week">
          {p.days.map((d, i) => {
            const n = i === 0 ? p.queue.length : d.items.length
            const lateN = i === 0 ? late.length : 0
            return (
              <button key={d.date} type="button" className={`dfx-day${i === dayIdx ? ' on' : ''}`} onClick={() => setDayIdx(i)}>
                <span className="dfx-dow">{i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : d.dow}</span>
                <span className="dfx-num">{d.num}</span>
                <span className="dfx-bar"><i style={{ height: `${(n / max) * 100}%` }}>{lateN > 0 && <em style={{ height: `${(lateN / n) * 100}%` }} />}</i></span>
                <span className="dfx-cnt">{n === 0 ? 'libre' : plural(n, 'fiche')}</span>
              </button>
            )
          })}
        </div>
        <div className="dfx-split">
          <div className="dfx-list">
            {list.length === 0 ? <div className="dfx-empty">Aucune fiche ce jour-là.</div>
              : list.map(it => <Row key={it.lesson.id} it={it} {...p} />)}
          </div>
          <aside className="dfx-side">{catchup}{tdBlock}</aside>
        </div>
      </div>
    )
  }

  // « jour » : une liste, et à côté ce qu'il faut savoir pour s'organiser
  return (
    <div className="dfx">
      {head}
      <div className="dfx-split">
        <div className="dfx-list">
          {late.length > 0 && <div className="dfx-group">En retard</div>}
          {late.map(it => <Row key={it.lesson.id} it={it} {...p} />)}
          {today.length > 0 && <div className="dfx-group">Prévues aujourd&apos;hui</div>}
          {today.map(it => <Row key={it.lesson.id} it={it} {...p} />)}
        </div>
        <aside className="dfx-side">
          {catchup}
          {tdBlock}
          <div className="dfx-next">
            <div className="dfx-k">Les prochains jours</div>
            {p.days.slice(1, 5).map((d, i) => (
              <div key={d.date} className="dfx-next-row"><span>{i === 0 ? 'Demain' : `${d.dow} ${d.num}`}</span><b>{d.items.length === 0 ? 'libre' : plural(d.items.length, 'fiche')}</b></div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
