// src/types/index.ts
export interface System {
  id: string
  user_id: string
  name: string
  icon: string
  cal_hidden: boolean
  semestre: number   // ← ajouté : 1 ou 2
  created_at: string
}
export interface StepEntry {
  score: number  // 1-5
  note: string
}
export interface AiQuestion {
  type: 'qcm' | 'kfp' | 'vf'
  stem: string
  context: string | null
  options: string[]
  correct: number
  explanation: string
  source_ref: string
}
export interface Lesson {
  id: string
  user_id: string
  system_id: string
  name: string
  learn_date: string | null
  steps: (StepEntry | null)[]  // length 14
  ai_questions: AiQuestion[]
  created_at: string
}
export interface Profile {
  id: string
  email: string
  name: string
  username: string | null
  plan: 'free' | 'pro'
  fac: string | null
  created_at: string
}
export const J_STEPS = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]
export const FREE_LIMIT = 15
export function jLabel(i: number): string {
  return i === 0 ? 'J0' : `J+${J_STEPS[i]}`
}
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}
export function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
export function scoreColor(v: number | null): string {
  if (!v) return '#4a5268'
  if (v <= 1) return '#f87171'
  if (v <= 2) return '#fb923c'
  if (v <= 3) return '#facc15'
  if (v <= 4) return '#4ade80'
  return '#6ee7b7'
}
export function doneCount(lesson: Lesson): number {
  return lesson.steps.filter(s => s !== null).length
}
export function avgScore(lesson: Lesson): number | null {
  const done = lesson.steps.filter(s => s !== null) as StepEntry[]
  if (!done.length) return null
  return done.reduce((a, s) => a + s.score, 0) / done.length
}
export function stepDate(lesson: Lesson, i: number): string | null {
  if (!lesson.learn_date) return null
  return addDays(lesson.learn_date, J_STEPS[i])
}
