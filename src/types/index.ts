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
  // Format actuel (post-2026-05, multi-réponses depuis 2026-05-15) :
  // - answer est TOUJOURS un tableau d'index 0-based.
  // - 1 élément = QCS (Question à Choix Simple) → radio buttons côté UI.
  // - 2+ éléments = QCM/QRM (Question à Réponses Multiples) → checkboxes côté UI.
  // Pour les questions legacy avec answer: number (avant 2026-05-15), on
  // convertit à la volée au load via normalizeAnswer() : 3 → [3].
  question: string
  options: string[]
  answer: number[] | number  // number = legacy, [number] ou plus = nouveau format
  explanation: string
  // Forme objet (post-2026-05) ou string (legacy data) ou absent.
  source_ref?: AiQuestionSourceRef | string | null
  // Compteurs cumulés sur les sessions QCM par fiche (incrémentés à chaque
  // session via persistSessionResults). Optionnels = pas encore répondu.
  attempts?: number
  correct?: number
  // Champs rétro-compat (legacy AVANT la refonte 2026-05) — toujours typés
  // optionnels. Utilisés par d'anciens chemins de code (ex : page /dashboard/lesson/[id])
  // qui n'a pas encore été migrée vers les nouveaux noms. NE PAS supprimer
  // tant que ces fichiers existent.
  type?: 'qcm' | 'kfp' | 'vf'
  context?: string | null
  stem?: string      // legacy alias de "question"
}

// Helper centralisé : normalise answer en tableau d'index, qu'il soit
// number legacy ou number[] nouveau. À utiliser partout où on lit
// q.answer pour comparer aux sélections de l'utilisateur.
export function normalizeAnswer(raw: AiQuestion['answer'] | undefined): number[] {
  if (Array.isArray(raw)) return raw.filter(n => typeof n === 'number' && n >= 0)
  if (typeof raw === 'number' && raw >= 0) return [raw]
  return []
}

// Helper : la question est-elle multi-réponses ?
// 2+ index = QCM/QRM multi, sinon QCS simple.
export function isMultiAnswer(q: AiQuestion): boolean {
  return normalizeAnswer(q.answer).length >= 2
}
// Flashcard maison (recto/verso) — créée manuellement par l'étudiant.
// Stockée dans la colonne lessons.flashcards (jsonb default [], migration 2026-06).
// Les compteurs reviews/known sont cumulés sur les sessions de révision
// (même esprit que attempts/correct sur AiQuestion).
export interface Flashcard {
  id: string            // identifiant local unique (crypto.randomUUID)
  front: string         // recto : question / terme
  back: string          // verso : réponse / définition
  created_at: string    // ISO
  reviews?: number      // nb de fois vue en session
  known?: number        // nb de fois marquée "je savais"
  last_reviewed_at?: string
}

// Annale d'examen (PDF + questions extraites par IA) — table annales,
// migration 2026-06. Rattachée à la matière (system_id), pas à une fiche.
// questions = AiQuestion[] au même format que lessons.ai_questions.
export interface Annale {
  id: string
  user_id: string
  system_id: string
  name: string
  pdf_path: string | null
  pdf_pages: number | null
  pdf_size: number | null
  questions: AiQuestion[]
  status: 'pending' | 'ready' | 'error'
  extract_error: string | null
  created_at: string
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
  flashcards?: Flashcard[]     // ← ajouté 2026-06 : cartes recto/verso maison
  chapter?: string | null      // ← ajouté 2026-06 : chapitre libre (sous-matière légère)
  media?: LessonMedia | null   // ← ajouté 2026-05 : sources du cours
  // ← ajouté 2026-06 : Reporter / Annuler un palier (sans toucher à steps).
  // skips = indices de paliers annulés ; postpones = { "indice": "YYYY-MM-DD" }.
  skips?: number[]
  postpones?: Record<string, string>
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
  // Compteurs de quotas Free (ajoutés mai 2026, voir migration premium-quotas).
  // Toujours présents en DB (default 0), mais optionnels ici pour rétro-compat
  // avec d'éventuels SELECT partiels qui ne les remontent pas.
  ai_generations_count?: number              // total à vie (cap Free : 10)
  simulator_sessions_count?: number          // total à vie (cap Free : 3)
  // Fair use Premium (ajouté mai 2026, voir migration premium-fair-use)
  // Le compteur mensuel est reset à la volée côté API quand on entre dans un
  // nouveau mois calendaire.
  ai_generations_month_count?: number        // compteur mensuel (cap Pro : 100)
  ai_generations_month_started_at?: string    // ISO timestamp du début de la période
  // Stripe (existant dans le schéma)
  stripe_customer_id?: string | null
}

// Quotas Free centralisés — partagés entre l'API (route.ts) et l'UI (Settings).
// Toute modification de ces valeurs doit aussi être appliquée dans :
//   - src/app/api/generate-qcm/route.ts (FREE_AI_GENERATIONS_LIMIT)
//   - src/app/api/simulator/start/route.ts (FREE_SIMULATOR_SESSIONS_LIMIT)
//   - src/app/api/transcribe-video/route.ts (FREE_VIDEO_SIZE_LIMIT)
//
// Révision mai 2026 : 5→10 IA et 1→3 simu pour laisser le user vraiment
// découvrir la valeur Premium avant la limite. Rester sur des "totaux à vie"
// (pas de renouvellement mensuel) pour la simplicité d'implémentation.
export const FREE_AI_GENERATIONS_LIMIT = 10
export const FREE_SIMULATOR_SESSIONS_LIMIT = 3
export const FREE_VIDEO_SIZE_MB = 100
export const FREE_PDF_SIZE_MB = 20
// Fair use Premium : cap mensuel sur les générations IA pour protéger des
// outliers. User normal Premium fait 10-20/mois, donc 100 laisse une marge.
export const PREMIUM_MONTHLY_AI_CAP = 100
export const J_STEPS = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

// =============================================================
// SCORING SYSTEMS POUR LE SIMULATEUR
// =============================================================
// "Discordance progressive" est le système le plus répandu en PASS français
// (Sorbonne, Paris Cité, plupart). 1 point si parfait, dégradation selon le
// nombre de discordances (= options où ma sélection ≠ la vraie réponse).
//
// Si tu veux ajouter un système per-fac plus tard :
//   1. Ajouter une entrée dans SCORING_SYSTEMS
//   2. Mapper la fac dans SCORING_BY_FAC
//   3. Le simulateur lira automatiquement la bonne formule via getScoringForFac()
//
// Pour les QCM directement dans les fiches (route /dashboard/fiches/[id]/qcm),
// on utilise TOUJOURS "tout-ou-rien" pour la simplicité pédagogique.
// =============================================================

export type ScoringSystemId = 'tout-ou-rien' | 'discordance-progressive' | 'discordance-classique'

export const SCORING_SYSTEMS: Record<ScoringSystemId, {
  label: string
  desc: string
  // Calcul de la note pour une question :
  // selected = ensemble des index cochés par l'élève
  // correct  = ensemble des index officiellement bons
  score: (selected: number[], correct: number[], nbOptions: number) => number
}> = {
  'tout-ou-rien': {
    label: 'Tout ou rien',
    desc: 'Toutes les bonnes cochées ET aucune mauvaise = 1 pt. Sinon 0.',
    score: (selected, correct) => {
      // On itère directement sur les arrays plutôt que sur des Set, pour ne pas
      // dépendre d'un target TS >= ES2015 (sinon `for (const v of set)` fail à
      // la compile en ES5 sans downlevelIteration).
      if (selected.length !== correct.length) return 0
      const s = new Set(selected)
      for (let i = 0; i < correct.length; i++) {
        if (!s.has(correct[i])) return 0
      }
      return 1
    },
  },
  'discordance-progressive': {
    label: 'Discordance progressive',
    desc: '1 pt si parfait, 0,5 si 1 discordance, 0,2 si 2 discordances, 0 sinon.',
    score: (selected, correct, nbOptions) => {
      // Une discordance = un option où ma réponse diffère de la vraie.
      // Ex : bonnes = [0, 2], moi = [0, 3] → discordances sur index 2 (manqué)
      // et index 3 (faux positif) = 2 discordances.
      let discord = 0
      for (let i = 0; i < nbOptions; i++) {
        const inSel = selected.includes(i)
        const inCor = correct.includes(i)
        if (inSel !== inCor) discord++
      }
      if (discord === 0) return 1
      if (discord === 1) return 0.5
      if (discord === 2) return 0.2
      return 0
    },
  },
  'discordance-classique': {
    label: 'Discordance classique',
    desc: '1 pt si parfait, 0,5 si 1 discordance, 0,2 si 2, 0,1 si 3, 0 sinon.',
    score: (selected, correct, nbOptions) => {
      let discord = 0
      for (let i = 0; i < nbOptions; i++) {
        const inSel = selected.includes(i)
        const inCor = correct.includes(i)
        if (inSel !== inCor) discord++
      }
      if (discord === 0) return 1
      if (discord === 1) return 0.5
      if (discord === 2) return 0.2
      if (discord === 3) return 0.1
      return 0
    },
  },
}

// Mapping fac → système de scoring utilisé dans son examen officiel.
// Pour l'instant, défaut "discordance-progressive" partout (vérifié pour
// Sorbonne et Paris Cité, à confirmer pour les autres). À ajuster quand on
// récupère les vraies infos officielles de chaque fac.
export const SCORING_BY_FAC: Record<string, ScoringSystemId> = {
  'sorbonne': 'discordance-progressive',
  'paris-cite': 'discordance-progressive',
  'sorbonne-paris-nord': 'discordance-progressive',
  'upec': 'discordance-progressive',
  'lyon': 'discordance-progressive',
  'montpellier': 'discordance-progressive',
  'autre': 'discordance-progressive',
}

export function getScoringForFac(fac: string | null | undefined): ScoringSystemId {
  if (!fac) return 'discordance-progressive'
  return SCORING_BY_FAC[fac] || 'discordance-progressive'
}
// Legacy const conservée pour rétro-compat avec d'anciens imports qui
// pourraient encore traîner. À retirer en un coup quand on a vérifié qu'aucun
// code de prod ne l'utilise (grep "FREE_LIMIT" dans le repo).
// @deprecated — préfère FREE_AI_GENERATIONS_LIMIT / FREE_SIMULATOR_SESSIONS_LIMIT
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
