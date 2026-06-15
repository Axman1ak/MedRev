// src/lib/sounds.ts
// Bruitages discrets de la bibliothèque, synthétisés en Web Audio (aucun
// fichier audio à charger). Tous très courts (< 400 ms) et feutrés : on est
// dans une bibliothèque de nuit, pas dans une salle d'arcade.
//
// Toggle utilisateur : localStorage 'medrev-sounds' ('on' par défaut, 'off'
// pour couper). Exposé dans Réglages > Apparence.

const KEY = 'medrev-sounds'

export function soundsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

export function setSoundsEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* quota */ }
}

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

// Bruit blanc filtré : la matière première du papier et du feutre.
function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

type NoiseOpts = {
  dur: number
  vol: number
  // Balayage du filtre passe-bande (Hz) : départ → arrivée
  f0: number
  f1: number
  q?: number
  delay?: number
}

function playNoise(c: AudioContext, o: NoiseOpts) {
  const t = c.currentTime + (o.delay ?? 0)
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, o.dur)
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = o.q ?? 0.9
  filter.frequency.setValueAtTime(o.f0, t)
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), t + o.dur)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(o.vol, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  src.connect(filter).connect(gain).connect(c.destination)
  src.start(t)
  src.stop(t + o.dur + 0.05)
}

type ToneOpts = {
  freq: number
  dur: number
  vol: number
  type?: OscillatorType
  // Glissando éventuel vers cette fréquence
  to?: number
  delay?: number
}

function playTone(c: AudioContext, o: ToneOpts) {
  const t = c.currentTime + (o.delay ?? 0)
  const osc = c.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(o.vol, t + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + o.dur + 0.05)
}

// ============ Les 4 bruitages ============

// Ouverture d'un livre : froissement de page bref, qui monte.
export function playBookOpen() {
  if (!soundsEnabled()) return
  const c = getCtx(); if (!c) return
  playNoise(c, { dur: 0.16, vol: 0.10, f0: 900, f1: 2600, q: 0.7 })
  playNoise(c, { dur: 0.10, vol: 0.05, f0: 2000, f1: 3600, q: 1.2, delay: 0.05 })
}

// Fermeture : la page qui se rabat, puis le petit "fump" feutré de la couverture.
export function playBookClose() {
  if (!soundsEnabled()) return
  const c = getCtx(); if (!c) return
  playNoise(c, { dur: 0.12, vol: 0.08, f0: 2200, f1: 700, q: 0.8 })
  playTone(c, { freq: 130, to: 70, dur: 0.14, vol: 0.12, type: 'sine', delay: 0.07 })
  playNoise(c, { dur: 0.08, vol: 0.05, f0: 300, f1: 120, q: 0.6, delay: 0.07 })
}

// Tampon de cire : impact sourd et mat, une pointe de "toc".
export function playStamp() {
  if (!soundsEnabled()) return
  const c = getCtx(); if (!c) return
  playTone(c, { freq: 95, to: 48, dur: 0.18, vol: 0.16, type: 'sine' })
  playTone(c, { freq: 210, to: 140, dur: 0.06, vol: 0.07, type: 'triangle' })
  playNoise(c, { dur: 0.05, vol: 0.06, f0: 700, f1: 250, q: 0.5 })
}

// Envol du livre vers l'étagère : whoosh doux qui monte puis s'éteint.
export function playWhoosh() {
  if (!soundsEnabled()) return
  const c = getCtx(); if (!c) return
  playNoise(c, { dur: 0.34, vol: 0.07, f0: 350, f1: 1800, q: 1.6 })
}
