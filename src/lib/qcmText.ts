// src/lib/qcmText.ts
//
// Nettoyage des textes de correction des QCM.
//
// POURQUOI CE FICHIER EXISTE
// --------------------------
// À la génération, `reletterAndShuffleOptions` mélange les options pour
// neutraliser le biais de position de l'IA, puis leur réattribue A à E dans
// le nouvel ordre. Le champ "explanation", lui, était écrit par l'IA AVANT ce
// mélange et cite les anciennes lettres. Le mélange n'est pas mémorisé.
//
// Conséquence : dans toutes les questions générées jusqu'ici, une explication
// qui dit « A est faux » parle d'une proposition qui n'est plus la A. Les
// lettres ne pointent nulle part, et le mélange étant perdu, elles ne sont pas
// récupérables.
//
// Ce qu'on fait donc :
//   · les nouvelles questions portent une justification PAR proposition
//     (champ `why`), mélangée en même temps que les options, donc jamais
//     désynchronisable, et une explication sans aucune lettre ;
//   · pour les anciennes questions, on écarte à l'affichage les phrases dont
//     le sens dépend d'une lettre. On ne les réécrit pas : transformer
//     « A est faux : c'est une articulation plane » en « c'est une
//     articulation plane » inverserait l'affirmation et enseignerait une
//     erreur. Mieux vaut une phrase en moins qu'une phrase fausse.
//
// Les phrases sans lettre (« À jeun, le ratio descend autour de 0,4/1 »,
// « Cf cours p.12 ») restent, elles, parfaitement valables et sont conservées.

/**
 * Termes médicaux qui se terminent par une lettre A-E sans être une référence
 * à une proposition : vitamine D, hépatite B, immunoglobuline E, protéine C…
 * On les masque avant l'analyse, sinon une phrase de cours parfaitement saine
 * serait prise pour une référence cassée et supprimée.
 */
const MEDICAL_LETTER_CARRIERS =
  /\b(vitamines?|hépatites?|immunoglobulines?|ig|protéines?|apolipoprotéines?|lipoprotéines?|coenzymes?|cytochromes?|streptocoques?|classes?|types?|groupes?|sous-groupes?|stades?|grades?|phases?|segments?|ondes?|dérivations?|fibres?|cellules?)\s+[A-E]\b/gi

/**
 * Une lettre est une référence à une proposition quand elle est immédiatement
 * suivie d'un verdict, d'une parenthèse explicative, ou d'une ponctuation
 * d'énumération. « A est faux », « B (2 ATP nets) », « A, C et E sont exactes ».
 *
 * On exige ce voisinage plutôt que de traquer toute lettre isolée : « A jeun »
 * ou « le point A » doivent survivre.
 */
const LETTER_VERDICT =
  /\b[A-E]\s*(?:[,;:.)]|\(|est\b|sont\b|et\s+[A-E]\b|vraie?\b|fausse?\b|faux\b|exacte?\b|inexacte?\b|correcte?\b|incorrecte?\b|juste\b)/

/** « la proposition B », « les réponses A et C », « l'item D ». */
const LETTER_LABELLED = /\b(?:propositions?|réponses?|items?|affirmations?|assertions?|choix)\s+[A-E]\b/i

/** Vrai si la phrase s'appuie sur une lettre qui ne désigne plus rien. */
export function refersToLetters(sentence: string): boolean {
  const masked = sentence.replace(MEDICAL_LETTER_CARRIERS, '$1 §')
  return LETTER_VERDICT.test(masked) || LETTER_LABELLED.test(masked)
}

/**
 * Découpe en phrases sans casser les abréviations ni les renvois du texte
 * médical : « p.12 » ne doit pas devenir deux phrases. On ne coupe que sur une
 * ponctuation finale suivie d'une espace puis d'une majuscule, ou de la fin.
 *
 * Écrit à la main plutôt qu'avec un `split` : la version élégante demandait un
 * lookbehind, que Safari n'a appris qu'en 16.4. Un lookbehind sur un iPhone
 * plus ancien ne rate pas la coupure, il fait échouer le fichier entier au
 * chargement · une bonne partie des utilisatrices révisent sur un vieux
 * téléphone.
 */
function splitSentences(text: string): string[] {
  const out: string[] = []
  const UPPER = /[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ]/
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c !== '.' && c !== '!' && c !== '?') continue
    const rest = text.slice(i + 1)
    const next = /^\s+(\S)/.exec(rest)
    if (/^\s*$/.test(rest) || (next && UPPER.test(next[1]))) {
      out.push(text.slice(start, i + 1).trim())
      start = i + 1
    }
  }
  if (start < text.length) out.push(text.slice(start).trim())
  return out.filter(Boolean)
}

/**
 * Retire d'une ancienne explication les phrases dont le sens repose sur une
 * lettre, et rend le reste. Chaîne vide si rien n'est récupérable : l'appelant
 * affiche alors le récapitulatif construit à partir des bonnes réponses, qui
 * lui est toujours juste.
 */
export function cleanExplanation(text: string | null | undefined): string {
  if (!text) return ''
  const kept = splitSentences(String(text)).filter(s => !refersToLetters(s))
  return kept.join(' ').trim()
}

/**
 * L'IA écrit ses justifications sous la forme « Vrai · raison » / « Faux ·
 * raison ». Le verdict est utile dans la donnée, qui doit se suffire à
 * elle-même, mais à l'écran le libellé de la proposition le dit déjà juste
 * au-dessus : on lisait « VRAI · TU L'AS COCHÉE » puis « Vrai · la
 * phosphofructokinase-1… ». On retire donc l'amorce à l'affichage.
 */
function dropVerdictPrefix(s: string): string {
  const m = /^(?:vrai|vraie|faux|fausse|exact|exacte|inexact|inexacte)\s*(?:[·:.,-]|\s)\s*/i.exec(s)
  if (!m) return s
  const rest = s.slice(m[0].length).trim()
  if (!rest) return s
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

/**
 * La justification propre à une proposition, quand la question a été générée
 * avec le nouveau format. Rien pour les anciennes.
 */
export function whyFor(
  q: { why?: unknown } | null | undefined,
  index: number,
  optionCount: number,
): string {
  const why = q?.why
  if (!Array.isArray(why) || why.length !== optionCount) return ''
  const v = why[index]
  return typeof v === 'string' ? dropVerdictPrefix(v.trim()) : ''
}

/**
 * Récapitulatif toujours exact, construit à partir des index de bonnes
 * réponses et du texte des propositions · aucune lettre, donc rien qui puisse
 * se désynchroniser.
 */
export function correctAnswersRecap(options: string[], correctIdxs: number[]): string {
  const texts = correctIdxs
    .filter(i => i >= 0 && i < options.length)
    .map(i => options[i].replace(/^\s*[A-E][.)]\s*/, '').trim())
    .filter(Boolean)
  if (texts.length === 0) return ''
  const head = texts.length > 1 ? 'Propositions exactes' : 'Proposition exacte'
  return `${head} · ${texts.join(' · ')}`
}
