'use client'
// src/components/GenProgress.tsx
//
// Progression de la génération des QCM d'UNE fiche, affichée là où on la
// regarde : dans la fenêtre de la fiche (variant "fiche", bloc QCM) et en fine
// barre au bas de sa carte dans « Mes matières » (variant "carte"), pour la
// suivre fenêtre fermée. Lit l'état partagé de src/lib/qcmGenStore.ts.

import { useEffect, useState } from 'react'
import { useGenJobs, estimateProgress } from '@/lib/qcmGenStore'

export default function GenProgress({ lessonId, variant }: { lessonId: string; variant: 'fiche' | 'carte' }) {
  const jobs = useGenJobs()
  const job = jobs.find(j => j.lessonId === lessonId)
  const running = job?.status === 'running'
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 400)
    return () => clearInterval(id)
  }, [running])

  if (!job) return null
  const p = estimateProgress(job, now)
  const pct = Math.round(p * 100)
  const label =
    job.status === 'running' ? 'Génération des QCM…'
    : job.status === 'done' ? (job.count ? `${job.count} QCM prêts` : 'QCM prêts')
    : 'Génération échouée'

  if (variant === 'carte') {
    return (
      <div className={`gp-card gp-${job.status}`} title={`${label} ${job.status === 'running' ? pct + ' %' : ''}`} aria-hidden="true">
        <i style={{ transform: `scaleX(${p})` }} />
      </div>
    )
  }

  return (
    <div className={`gp-fiche gp-${job.status}`} role="status" aria-live="polite">
      <div className="gp-fiche-top">
        <span>{label}</span>
        <b>{job.status === 'running' ? `${pct} %` : job.status === 'done' ? '✓' : ''}</b>
      </div>
      <div className="gp-fiche-bar"><i style={{ transform: `scaleX(${p})` }} /></div>
      {job.status === 'running' && <div className="gp-fiche-hint">Tu peux fermer la fiche, ça continue.</div>}
    </div>
  )
}
