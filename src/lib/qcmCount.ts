// Nombre de QCM à générer pour une fiche (10, 20 ou 30). Au début d'un cours,
// 10 questions suffisent : l'étudiant choisit, et le choix est retenu sur cet
// appareil pour les générations suivantes.
export const QCM_COUNTS = [10, 20, 30] as const
export type QcmCount = typeof QCM_COUNTS[number]
const KEY = 'medrev-qcm-nb'

export function getQcmCount(): QcmCount {
  if (typeof window === 'undefined') return 10
  try {
    const n = Number(localStorage.getItem(KEY))
    return (QCM_COUNTS as readonly number[]).includes(n) ? (n as QcmCount) : 10
  } catch { return 10 }
}

export function setQcmCount(n: QcmCount) {
  try { localStorage.setItem(KEY, String(n)) } catch { /* navigation privée */ }
}
