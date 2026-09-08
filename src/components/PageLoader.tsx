'use client'
// src/components/PageLoader.tsx
//
// Écran de chargement unique, partagé par toutes les pages du tableau de bord.
//
// Avant, trois pages n'affichaient rien du tout pendant le chargement (écran
// blanc puis apparition brutale) et cinq affichaient un simple « Chargement… »
// sans animation, sous quatre noms de classes différents. Rien ne bougeait,
// donc rien ne disait à l'étudiante que quelque chose était en cours.
//
// Un seul composant ici, pour que l'attente soit identique partout.
import './page-loader.css'

export default function PageLoader({
  label = 'Chargement…',
  /** Plein écran (page entière) ou inséré dans un bloc déjà en place. */
  inline = false,
}: {
  label?: string
  inline?: boolean
}) {
  return (
    <div
      className={`pld${inline ? ' pld-inline' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Deux anneaux qui tournent à des vitesses différentes : lisible même
          sur une carte claire comme sur le fond marine du mode sombre. */}
      <span className="pld-ring" aria-hidden="true">
        <span className="pld-ring-a" />
        <span className="pld-ring-b" />
      </span>
      <span className="pld-label">{label}</span>
    </div>
  )
}
