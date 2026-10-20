'use client'
// src/lib/qcmGenStore.ts
//
// État partagé de la génération de QCM, pour l'afficher en bas du menu
// (GenProgress) même quand la fenêtre de la fiche est fermée. La génération
// est faite côté serveur et enregistrée directement dans la fiche : fermer la
// fenêtre ne l'interrompt pas, l'étudiant peut donc continuer ailleurs.
//
// Pas de vraie progression côté serveur (un seul appel de 30 à 60 s) : la
// barre avance selon le temps écoulé, ralentit vers 92 %, puis se remplit
// d'un coup quand le serveur répond.

import { useSyncExternalStore } from 'react'

export type GenJob = {
  lessonId: string
  lessonName: string
  startedAt: number
  status: 'running' | 'done' | 'error'
  count?: number
}

let jobs: GenJob[] = []
const listeners = new Set<() => void>()
const emit = () => { jobs = [...jobs]; listeners.forEach(l => l()) }

export function startGen(lessonId: string, lessonName: string) {
  jobs = jobs.filter(j => j.lessonId !== lessonId)
  jobs.push({ lessonId, lessonName, startedAt: Date.now(), status: 'running' })
  emit()
}

export function finishGen(lessonId: string, ok: boolean, count?: number) {
  const j = jobs.find(x => x.lessonId === lessonId)
  if (!j) return
  j.status = ok ? 'done' : 'error'
  j.count = count
  emit()
  // le message « QCM prêts » reste quelques secondes puis disparaît
  setTimeout(() => {
    jobs = jobs.filter(x => x !== j)
    emit()
  }, ok ? 6000 : 8000)
}

/** Retire une génération sans message (ex. quota atteint : la fenêtre
 *  d'abonnement s'ouvre déjà). */
export function dropGen(lessonId: string) {
  jobs = jobs.filter(j => j.lessonId !== lessonId)
  emit()
}

export function isGenerating(lessonId: string) {
  return jobs.some(j => j.lessonId === lessonId && j.status === 'running')
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => jobs
const serverSnapshot: GenJob[] = []

export function useGenJobs(): GenJob[] {
  return useSyncExternalStore(subscribe, snapshot, () => serverSnapshot)
}

/** Progression estimée (0-1) d'une génération en cours. */
export function estimateProgress(job: GenJob, now: number): number {
  if (job.status !== 'running') return 1
  const t = (now - job.startedAt) / 1000
  return Math.min(0.92, 1 - Math.exp(-t / 22))
}
