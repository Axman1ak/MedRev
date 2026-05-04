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
  score: number  // 1-5 — score officiel posé le jour J
  note: string
  date?: string         // date du score officiel (YYYY-MM-DD)
  // Score temporaire posé via "Retravailler ces fiches" hors jour J.
  // N'affecte ni l'avg ni le calendrier — purement cosmétique sur le stamp
  // (couleur soft). Effacé quand le vrai J arrive et reçoit un score officiel.
  temp_score?: number   // 1-5
  temp_date?: string    // YYYY-MM-DD
  // Legacy (anciens enregistrements)
  ok?: boolean
}
// Référence vers la source qui a fourni la question (vidéo et/ou PDF).
// Utilisée par le bouton "Voir la source ↗" en cas de réponse fausse.
export interface AiQuestionSourceRef {
  pdf_page?: number   // numéro de page (1-N) dans le PDF
  video_ts?: number   // timestamp en secondes dans la vidéo
}
export interface AiQuestion {
  // Format actuel (post-2026-05)
  question: string
  options: string[]
  answer: number          // index 0-based de la bonne réponse
  explanation: string
  // Forme objet (post-2026-05) ou string (legacy data) ou absent.
  source_ref?: AiQuestionSourceRef | string | null
  // Champs rétro-compat (legacy AVANT la refonte 2026-05) — toujours typés
  // optionnels. Utilisés par d'anciens chemins de code (ex : page /dashboard/lesson/[id])
  // qui n'a pas encore été migrée vers les nouveaux noms. NE PAS supprimer
  // tant que ces fichiers existent.
  type?: 'qcm' | 'kfp' | 'vf'
  context?: string | null
  stem?: string      // legacy alias de "question"
  correct?: number   // legacy alias de "answer"
}
// Médias source d'une fiche (vidéo + PDF) — voir migration 2026-05.
// Stocké dans la colonne lessons.media (jsonb default {}).
export interface LessonMedia {
  video_path?: string
  video_duration_s?: number
  video_size?: number
  video_uploaded_at?: string
  pdf_path?: string
  pdf_pages?: number
  pdf_size?: number
  pdf_uploaded_at?: string
}
export interface Lesson {
  id: string
  user_id: string
  system_id: string
  name: string
  learn_date: string | null
  steps: (StepEntry | null)[]  // length 14
  ai_questions: AiQuestion[]
  media?: LessonMedia | null   // ← ajouté 2026-05 : sources du cours
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
