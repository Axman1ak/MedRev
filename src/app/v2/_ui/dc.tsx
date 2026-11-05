'use client'
import { useEffect, useReducer, useRef } from 'react'

// Petit moteur qui reproduit le fonctionnement des maquettes (state + renderVals).
export class DCLogic {
  props: any
  state: any = {}
  _force: () => void = () => {}
  constructor(props: any) { this.props = props }
  setState(patch: any) {
    this.state = { ...this.state, ...patch }
    this._force()
  }
  renderVals(): any { return {} }
}

export function useDC<T extends DCLogic>(Ctor: new (p: any) => T, props: any) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  const ref = useRef<T | null>(null)
  // À l'ouverture du parcours, on se place sur aujourd'hui.
  useEffect(() => {
    const el = document.getElementById('aujourdhui')
    if (el) el.scrollIntoView({ block: 'center' })
  }, [])
  if (!ref.current) ref.current = new Ctor(props)
  ref.current.props = props
  ref.current._force = force
  return ref.current.renderVals()
}
