// src/app/api/generate-pass-qcm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
 
export async function POST(req: NextRequest) {
  try {
    const { matiere, nbQ, fac, semestre } = await req.json()
 
    if (!matiere || !nbQ) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }
 
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
 
    const prompt = `Tu es un créateur de QCM expert pour le concours PASS de ${fac || 'Sorbonne Université'}, semestre ${semestre || 1}.
 
Tu dois générer ${nbQ} QCM au format officiel du PASS Sorbonne pour la matière : ${matiere}.
 
FORMAT OBLIGATOIRE : chaque QCM a un énoncé (stem) + exactement 5 propositions (A, B, C, D, E) dont chacune est VRAIE ou FAUSSE de manière indépendante. L'étudiant doit indiquer V/F pour chaque item séparément.
 
NIVEAU : niveau concours blanc PASS, questions précises et discriminantes, basées sur les référentiels officiels.
 
Réponds UNIQUEMENT avec un JSON valide, sans backticks, sans texte autour :
{
  "questions": [
    {
      "stem": "Concernant [sujet précis], indiquer si chaque proposition est vraie ou fausse :",
      "context": "Vignette clinique si pertinent, sinon null",
      "items": {
        "a": "Proposition A (affirmation précise)",
        "b": "Proposition B",
        "c": "Proposition C",
        "d": "Proposition D",
        "e": "Proposition E"
      },
      "correct": {
        "a": true,
        "b": false,
        "c": true,
        "d": false,
        "e": true
      },
      "explanation": "Explication concise des bonnes réponses avec justification scientifique."
    }
  ]
}
 
Génère exactement ${nbQ} questions de qualité concours PASS pour ${matiere}.
Les items doivent couvrir différents aspects de la matière.
Évite les formulations ambiguës. Chaque item doit être indépendant et clairement vrai ou faux.`
 
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
 
    let parsed
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Réponse JSON invalide')
      parsed = JSON.parse(match[0])
    }
 
    if (!parsed.questions?.length) {
      throw new Error('Aucune question générée')
    }
 
    return NextResponse.json({ questions: parsed.questions })
  } catch (error: any) {
    console.error('generate-pass-qcm error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
