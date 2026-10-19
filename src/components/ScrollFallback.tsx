'use client'

// src/components/ScrollFallback.tsx
//
// Les animations de la page d'accueil avancent avec le défilement grâce à
// une fonction CSS récente (animation-timeline). Safari ne la gère qu'à
// partir de la version 26, et Firefox pas encore : sur ces navigateurs, la
// page restait figée. Ce composant prend le relais uniquement chez eux :
//   - il ajoute la classe .hl-js à la page (voir home-landing.css),
//   - il calcule la progression de chaque scène (0 à 1) et place chaque
//     animation à ce point ; les éléments qui ont leur propre plage
//     (ex. 38 % à 40 %) suivent leur progression à eux.
// Il fait aussi avancer la barre de progression de la barre du haut.
// Sur Chrome, Edge et Safari 26+, il ne fait rien.
//
// Pour tester le relais sur Chrome : ajouter ?relais=1 à l'adresse.

import { useEffect } from 'react'

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

// Plages propres à certains éléments, en % de la scène (comme dans le CSS).
const RANGES: [string, number, number][] = [
  ['.hl-qz-o.hl-ok .hl-qz-ck b', 62, 66],
  ['.hl-qz-o.hl-ok', 62, 66],
  ['.hl-qz-o.hl-no', 62, 66],
  ['.hl-qz-t em', 64, 69],
  ['.hl-pt-r1 i', 20, 42],
  ['.hl-pt-r2 i', 26, 48],
  ['.hl-pt-r3 i', 32, 54],
  ['.hl-pt-r4 i', 38, 60],
]

export default function ScrollFallback() {
  useEffect(() => {
    const force = new URLSearchParams(window.location.search).has('relais')
    const supported = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()') && CSS.supports('animation-timeline: scroll()')
    if (supported && !force) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const root = document.querySelector('.hl-mr-root')
    root?.classList.add('hl-js')
    const bar = document.querySelector<HTMLElement>('.sc-prog i')
    const scenes = Array.from(document.querySelectorAll<HTMLElement>('.hl-sn, .hl-wy'))

    // éléments à plage propre, rangés par scène
    type Item = { el: HTMLElement; a: number; b: number }
    const items = new Map<HTMLElement, Item[]>()
    for (const sc of scenes) {
      const list: Item[] = []
      for (const [sel, a, b] of RANGES) sc.querySelectorAll<HTMLElement>(sel).forEach(el => list.push({ el, a, b }))
      // cases du QCM : plage dans --a / --b sur la proposition
      sc.querySelectorAll<HTMLElement>('.hl-qz-o.hl-ok').forEach(o => {
        const a = parseFloat(o.style.getPropertyValue('--a')), b = parseFloat(o.style.getPropertyValue('--b'))
        const i = o.querySelector<HTMLElement>('.hl-qz-ck i')
        if (i && !isNaN(a) && !isNaN(b)) list.push({ el: i, a, b })
      })
      // coches de la scène sombre : 38-40 %, 42-44 %, … selon l'ordre
      sc.querySelectorAll<HTMLElement>('.hl-wy-li').forEach((li, k) => {
        const svg = li.querySelector<HTMLElement>('.hl-bx svg')
        if (svg) list.push({ el: svg, a: 38 + 4 * k, b: 40 + 4 * k })
      })
      items.set(sc, list)
    }

    // plage propre de chaque élément, sinon celle de la scène entière
    const own = new Map<Element, [number, number]>()
    items.forEach(list => list.forEach(({ el, a, b }) => own.set(el, [a, b])))

    let raf = 0
    const update = () => {
      raf = 0
      const vh = window.innerHeight
      for (const sc of scenes) {
        const r = sc.getBoundingClientRect()
        const span = r.height - vh
        const p = span > 0 ? clamp(-r.top / span) : r.top < 0 ? 1 : 0
        for (const anim of sc.getAnimations({ subtree: true })) {
          const target = (anim.effect as KeyframeEffect | null)?.target
          const range = target ? own.get(target) : undefined
          const q = range ? clamp((p * 100 - range[0]) / (range[1] - range[0])) : p
          anim.pause()
          anim.currentTime = Math.min(q, 0.9999) * 1000
        }
      }
      if (bar) {
        const max = document.documentElement.scrollHeight - vh
        bar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max) : 0})`
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    requestAnimationFrame(() => requestAnimationFrame(update))
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return null
}
