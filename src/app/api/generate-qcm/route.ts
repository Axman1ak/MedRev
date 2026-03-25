// src/app/api/generate-qcm/route.ts
import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

const FORMAT_DESC: Record<string, string> = {
  mixed: 'un mélange équilibré de : QCM classiques (4 options A/B/C/D, une seule bonne réponse), KFP (vignette clinique courte + 2-3 questions liées précises), et Vrai/Faux raisonnés',
  qcm:   'des QCM classiques avec 4 options (A/B/C/D), une seule bonne réponse par question',
  kfp:   'des Key-Feature Problems : vignette clinique courte réaliste puis questions précises sur les décisions-clés',
  vf:    'des questions Vrai/Faux avec une justification obligatoire dans l\'explication',
}

const DIFF_DESC: Record<string, string> = {
  annales:  'exactement au niveau des annales EDN réelles — questions précises, pièges subtils sur les valeurs seuils et définitions officielles, formulation proche du concours',
  concours: 'niveau concours blanc rigoureux — éléments sémiologiques et cliniques précis, raisonnement diagnostique',
  appro:    'niveau approfondi — physiopathologie, mécanismes moléculaires, exceptions, cas particuliers, dernières recommandations HAS',
}

export async function POST(req: NextRequest) {
  try {
    const { lessonName, courseText, nbQ, format, difficulty } = await req.json()

    const hasCourse = courseText && courseText.trim().length > 100

    const courseSection = hasCourse
      ? `CONTENU DU COURS FOURNI (utilise-le en priorité absolue) :\n"""\n${courseText.slice(0, 10000)}\n"""\n\n`
      : `SUJET : "${lessonName}"\nNote : aucun contenu fourni — génère des questions basées sur les référentiels officiels français (HAS, collèges de médecine, R2C 2024).\n\n`

    const prompt = `${courseSection}CONSIGNE :
Tu es un enseignant expert en médecine, spécialisé dans la préparation aux EDN (Épreuves Dématérialisées Nationales) français.

Génère exactement ${nbQ} questions de type : ${FORMAT_DESC[format] || FORMAT_DESC.mixed}.
Niveau requis : ${DIFF_DESC[difficulty] || DIFF_DESC.annales}.

RÈGLES IMPÉRATIVES :
- Utilise exclusivement le contenu du cours si fourni
- Questions précises avec valeurs numériques, termes exacts et définitions officielles
- Pièges réalistes (évite les questions évidentes ou les distracteurs absurdes)
- Pour les KFP : vignette clinique courte mais réaliste
- Explications pédagogiques qui CITENT le passage exact du cours ou la source officielle
- Langue : français médical rigoureux
- Pas de questions redondantes

RÉPONDS UNIQUEMENT avec un tableau JSON valide (sans markdown, sans backticks), format exact :
[
  {
    "type": "qcm",
    "stem": "Question précise ?",
    "context": null,
    "options": ["A. Option A", "B. Option B", "C. Option C", "D. Option D"],
    "correct": 0,
    "explanation": "Explication pédagogique détaillée...",
    "source_ref": "Extrait du cours ou 'HAS 2024 — Recommandation...'"
  },
  ...
]

Pour type="kfp" : mets la vignette clinique dans "context".
Pour type="vf" : options=["Vrai","Faux"], correct=0 (Vrai) ou 1 (Faux).
"correct" est l'index 0-3 de la bonne réponse.`

    const response = await fetch(GEMINI_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.3 },
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || 'Erreur Gemini API')
    }

    const data = await response.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const clean = raw.replace(/```json|```/g, '').trim()

    let questions
    try {
      questions = JSON.parse(clean)
    } catch {
      // Try to extract JSON array from text
      const match = clean.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('JSON invalide')
      questions = JSON.parse(match[0])
    }

    if (!Array.isArray(questions) || !questions.length) {
      throw new Error('Format de réponse invalide')
    }

    // Validate and sanitize
    const sanitized = questions.slice(0, nbQ).map((q: Record<string, unknown>) => ({
      type: ['qcm', 'kfp', 'vf'].includes(q.type as string) ? q.type : 'qcm',
      stem: String(q.stem || ''),
      context: q.context || null,
      options: Array.isArray(q.options) ? q.options.map(String) : ['A.', 'B.', 'C.', 'D.'],
      correct: typeof q.correct === 'number' ? q.correct : 0,
      explanation: String(q.explanation || ''),
      source_ref: String(q.source_ref || 'Référentiel R2C'),
    }))

    return NextResponse.json({ questions: sanitized })
  } catch (error) {
    console.error('QCM generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}
