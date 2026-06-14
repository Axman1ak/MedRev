'use client'
// src/components/Model3D.tsx
// Visionneuse 3D légère (Google <model-viewer>) chargée À LA DEMANDE.
// Le script du composant n'est injecté que lorsqu'on affiche un modèle, donc
// aucun impact sur le reste du site. Affiche un seul fichier .glb (un organe).

import { useEffect, useRef, useState, createElement } from 'react'

function ensureScript() {
  if (typeof document === 'undefined') return
  if (document.querySelector('script[data-model-viewer]')) return
  const s = document.createElement('script')
  s.type = 'module'
  s.src = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js'
  s.setAttribute('data-model-viewer', '')
  document.head.appendChild(s)
}

export default function Model3D({ src, alt }: { src: string; alt?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => { ensureScript() }, [])

  useEffect(() => {
    setState('loading')
    const host = ref.current
    if (!host) return
    const el = host.querySelector('model-viewer') as (HTMLElement | null)
    if (!el) return
    const onLoad = () => setState('ready')
    const onErr = () => setState('error')
    el.addEventListener('load', onLoad)
    el.addEventListener('error', onErr)
    return () => { el.removeEventListener('load', onLoad); el.removeEventListener('error', onErr) }
  }, [src])

  return (
    <div className="m3d" ref={ref}>
      {state === 'loading' && <div className="m3d-overlay">Chargement du modèle 3D…</div>}
      {state === 'error' && <div className="m3d-overlay">Impossible de charger ce modèle 3D.</div>}
      {createElement('model-viewer', {
        src,
        alt: alt || 'Modèle 3D',
        'camera-controls': true,
        'auto-rotate': true,
        'touch-action': 'pan-y',
        exposure: '1',
        'shadow-intensity': '0.6',
        style: { width: '100%', height: '100%', backgroundColor: '#0b1622' },
      })}
    </div>
  )
}
