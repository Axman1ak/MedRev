// src/lib/pdf.ts
//
// Utilitaires PDF côté navigateur.
//
// countPdfPages vivait dans ReviewModal.tsx, en privé. Le dépôt groupé en a
// besoin aussi : plutôt que de le copier (et de laisser les deux versions
// diverger au premier correctif), on le sort ici et ReviewModal l'importe.

/**
 * Compte les pages d'un PDF sans dépendance externe, en cherchant les objets
 * /Type /Page dans les octets du fichier.
 *
 * Volontairement approximatif : c'est une métadonnée d'affichage (« 32 p. »),
 * pas une donnée dont dépend une décision. Renvoie null si le compte échoue,
 * et tout le code appelant doit traiter null comme « on ne sait pas ».
 *
 * Le [^s] après /Page écarte les /Pages (le noeud parent), qui compteraient
 * double. La lecture est découpée en blocs de 64 Ko parce que
 * String.fromCharCode sature la pile sur un gros tableau.
 */
export async function countPdfPages(file: File | Blob): Promise<number | null> {
  try {
    const buf = await file.arrayBuffer()
    const arr = new Uint8Array(buf)
    let str = ''
    const chunk = 65536
    for (let i = 0; i < arr.length; i += chunk) {
      const end = Math.min(i + chunk, arr.length)
      let part = ''
      for (let j = i; j < end; j++) part += String.fromCharCode(arr[j])
      str += part
    }
    const matches = str.match(/\/Type\s*\/Page[^s]/g)
    return matches ? matches.length : null
  } catch {
    return null
  }
}
