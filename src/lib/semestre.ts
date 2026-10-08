// src/lib/semestre.ts
//
// Semestre affiché par défaut, quand l'utilisateur n'a encore rien choisi.
//
// POURQUOI CE FICHIER EXISTE
// --------------------------
// Cinq écrans (aujourd'hui, fiches, calendrier, simulateur, barre latérale)
// démarraient sur `useState<1 | 2 | 'year'>(2)`. Le 2 était en dur. Un étudiant
// qui s'inscrivait en septembre, donc en plein S1, arrivait sur la vue S2 :
// dashboard vide, fiches vides, calendrier vide, alors que son compte venait
// d'être pré-rempli correctement. Le pire moment pour un écran vide est la
// première minute.
//
// Le choix explicite de l'utilisateur reste prioritaire : il est lu dans
// localStorage ('medrev-sem') par la barre latérale et rediffusé aux écrans
// via l'évènement 'medrev-sem-change'. Cette fonction ne sert que de valeur
// initiale, avant toute lecture du stockage.

export type SemestreView = 1 | 2 | 'year'

/**
 * Septembre à janvier : premier semestre.
 * Février à juin : second semestre.
 * Juillet et août : on repasse au S1, la rentrée étant le prochain repère
 * utile pour quelqu'un qui prépare son année.
 */
export function currentSemestre(now: Date = new Date()): 1 | 2 {
  const m = now.getMonth() // 0 = janvier
  return m >= 1 && m <= 5 ? 2 : 1
}
