// src/lib/useNarrow.ts
'use client'
import { useEffect, useState } from 'react'

/**
 * Vrai quand la fenêtre est celle d'un téléphone.
 *
 * Plusieurs écrans calculent en JavaScript combien de lignes tiennent sans
 * défilement, parce que sur ordinateur la page occupe exactement la hauteur de
 * l'écran et ne défile pas. Sur téléphone ce modèle n'a plus de sens : la page
 * défile naturellement, et tronquer la liste pour tenir dans un cadre revient
 * à cacher le contenu derrière un bouton alors qu'il suffirait de faire
 * glisser le pouce.
 *
 * On rend `false` au premier rendu (serveur et hydratation) puis on mesure :
 * partir de `false` évite un écart entre le HTML du serveur et celui du client.
 */
export function useIsNarrow(breakpoint = 900): boolean {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const apply = () => setNarrow(mq.matches)
    apply()
    // addEventListener n'existe pas sur les vieux Safari : on garde le repli.
    if (mq.addEventListener) {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    mq.addListener(apply)
    return () => mq.removeListener(apply)
  }, [breakpoint])

  return narrow
}
