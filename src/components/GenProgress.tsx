'use client'
// src/components/GenProgress.tsx
//
// Petite barre « Génération des QCM… » en bas du menu (ordinateur) ou sous
// la barre du haut (téléphone). Lit l'état partagé de src/lib/qcmGenStore.ts.

import { useEffect, useState } from 'react'
import { useGenJobs, estimateProgress } from '@/lib/qcmGenStore'

export default function GenProgress({ variant }: { variant: 'side' | 'mobile' }) {
  const jobs = useGenJobs()
  const [now, setNow] = useState(() => Date.now())
  const running = jobs.some(j => j.status === 'running')

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 400)
    return () => clearInterval(id)
  }, [running])

  if (jobs.length === 0) return null
  // la plus récente d'abord
  const job = jobs[jobs.length - 1]
  const p = estimateProgress(job, now)
  const pct = Math.round(p * 100)
  const label =
    job.status === 'running' ? 'Génération des QCM…'
    : job.status === 'done' ? (job.count ? `${job.count} QCM prêts` : 'QCM prêts')
    : 'Génération échouée'
  const more = jobs.filter(j => j.status === 'running').length - (job.status === 'running' ? 1 : 0)

  return (
    <div
      className={`gp gp-${variant} gp-${job.status}`}
      role="status"
      aria-live="polite"
      title={`${label} ${job.lessonName}`}
    >
      <div className="gp-txt db-lbl">
        <span className="gp-lbl">{label}</span>
        <span className="gp-name">{job.lessonName}{more > 0 ? ` et ${more} autre${more > 1 ? 's' : ''}` : ''}</span>
      </div>
      <div className="gp-row">
        <div className="gp-bar"><i style={{ transform: `scaleX(${p})` }} /></div>
        <span className="gp-pct">{job.status === 'running' ? `${pct} %` : job.status === 'done' ? '✓' : '!'}</span>
      </div>
    </div>
  )
}
