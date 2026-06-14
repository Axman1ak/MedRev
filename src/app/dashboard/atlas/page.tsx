'use client'
// src/app/dashboard/atlas/page.tsx
// Atlas 3D d'anatomie : on embarque Z-Anatomy (open-source, CC BY-SA) en iframe.
// Chargé À LA DEMANDE (bouton) car l'app Unity WebGL est lourde (plusieurs
// dizaines de Mo) — on évite de la charger tant que l'élève ne la demande pas.

import { useState } from 'react'
import './styles.css'

const ZBody = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="5" r="2.2" />
    <path d="M12 7.2V15M12 9 7 11M12 9l5 2M12 15l-2.5 5M12 15l2.5 5" />
  </svg>
)

export default function AtlasPage() {
  const [launched, setLaunched] = useState(false)
  const [ready, setReady] = useState(false)

  return (
    <div className="atlas-wrap">
      <div className="atlas-head">
        <div>
          <h1 className="atlas-title">Atlas 3D d&apos;anatomie</h1>
          <p className="atlas-sub">
            Atlas interactif complet : clique une structure pour la nommer, masque ou affiche les
            systèmes (os, muscles, vaisseaux, nerfs…), coupe, tourne et zoome.
          </p>
        </div>
        {launched && (
          <a className="atlas-ext" href="https://www.z-anatomy.com/" target="_blank" rel="noopener noreferrer">
            Ouvrir en plein écran ↗
          </a>
        )}
      </div>

      {!launched ? (
        <div className="atlas-launch">
          <div className="atlas-launch-card">
            <div className="atlas-launch-ic"><ZBody /></div>
            <h2>Atlas 3D · 7 000+ structures</h2>
            <p>
              L&apos;atlas est volumineux et met quelques secondes à charger. On le lance
              seulement quand tu en as besoin, pour ne pas ralentir le reste de MedRev.
            </p>
            <button className="atlas-launch-btn" onClick={() => setLaunched(true)}>
              Lancer l&apos;atlas 3D
            </button>
          </div>
        </div>
      ) : (
        <div className="atlas-frame">
          {!ready && <div className="atlas-loading">Chargement de l&apos;atlas 3D… (quelques secondes)</div>}
          <iframe
            title="Atlas 3D d'anatomie — Z-Anatomy"
            src="https://www.z-anatomy.com/"
            allow="fullscreen"
            onLoad={() => setReady(true)}
          />
        </div>
      )}

      <div className="atlas-credit">
        Atlas fourni par <a href="https://www.z-anatomy.com/" target="_blank" rel="noopener noreferrer">Z-Anatomy</a>
        {' '}· open-source, licence CC BY-SA · modèles basés sur BodyParts3D.
      </div>
    </div>
  )
}
