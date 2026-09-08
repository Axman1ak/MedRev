// src/app/dashboard/loading.tsx
//
// Écran affiché par Next pendant la navigation entre deux pages du tableau de
// bord. Sans ce fichier, changer d'onglet laissait l'écran précédent figé le
// temps du chargement, sans aucun signe que quelque chose se passait.
import PageLoader from '@/components/PageLoader'

export default function DashboardLoading() {
  return <PageLoader />
}
