'use client'
// src/components/LandingPage.tsx
//
// MedRev — Landing rupture (vert foncé + blanc).
// Port du mockup landing-piste-B-rupture.html en composant Next.js.
// CSS scopé sous .lp-root (cf landing-styles.css).
//
// Côté Next.js, charge les fonts via /app/layout.tsx (next/font/google) :
//   Bricolage Grotesque, Hanken Grotesk, IBM Plex Mono.
// Sinon, ajoute le <link> Google Fonts dans le <head>.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import './landing-styles.css'

type Q = { q: string; opts: string[]; ans: number; fb: string; src: string }
const QUESTIONS: Q[] = [
  {
    q: "L'enzyme régulatrice de la glycolyse, dont l'activité est inhibée par l'ATP, est :",
    opts: ['Hexokinase', 'Phosphofructokinase-1', 'Pyruvate kinase', 'Aldolase', 'Énolase'],
    ans: 1,
    fb: "La PFK-1 est le point de contrôle majeur, inhibée allostériquement par l'ATP et le citrate.",
    src: 'Vidéo · 18:42',
  },
  {
    q: 'Le nœud sinusal, pacemaker physiologique du cœur, se situe dans :',
    opts: ["L'oreillette gauche", 'Le septum interventriculaire', "L'oreillette droite", 'Le ventricule gauche', 'Le faisceau de His'],
    ans: 2,
    fb: "Le nœud sinusal siège dans la paroi de l'oreillette droite, près de la veine cave supérieure.",
    src: 'Vidéo · 31:07',
  },
  {
    q: 'Parmi ces structures, laquelle ne fait PAS partie du néphron ?',
    opts: ['Glomérule', 'Tube contourné proximal', 'Anse de Henlé', 'Canal de Wirsung', 'Tube collecteur'],
    ans: 3,
    fb: "Le canal de Wirsung est le canal excréteur du pancréas — rien à voir avec le rein.",
    src: 'Vidéo · 09:54',
  },
]

const FEATURES = [
  ['▦', 'Bibliothèque vivante', "Chaque fiche notée ajoute un livre. 2000 ouvrages à amasser, 6 trésors aux paliers 100, 300, 600, 900, 1200 et 1500."],
  ['◷', 'Courbe J intelligente', "14 paliers de J0 à J+120. Une note basse re-programme une révision. Une note haute t'épargne."],
  ['⊕', 'Sessions Focus', "Plein écran, distractions verrouillées. La bibliothèque en fond, tu coches tes fiches du jour."],
  ['◎', 'Mode angles morts', "Le simulateur cible tes fiches faibles. 80 % du temps sur 20 % des notions à problème."],
  ['∿', 'Stats avancées', "Heatmap 52 semaines, sparkline 12 semaines, dumbbell par matière. Où tu progresses, où tu stagnes."],
  ['▶', 'Examen blanc', "Type concours : timer, grille de réponses, 0 indice avant la fin. Corrigé détaillé après."],
]

const PIPE_HEIGHTS = [100, 72, 80, 58, 64, 48, 52, 40, 44, 34, 38, 30, 32, 26]
const PIPE_LABELS = ['J0', 'J1', 'J2', 'J4', 'J7', 'J11', 'J16', 'J23', 'J32', 'J45', 'J60', 'J80', 'J100', 'J120']
const STAGE_TITLES = [
  'Un cours <span class="accent">entre.</span>',
  '30 QCM <span class="accent">sortent.</span>',
  'Le planning <span class="accent">se cale.</span>',
]
const STAGE_STEPS = ['// 01 — IMPORT', '// 02 — GÉNÉRATION', '// 03 — PLANNING']

const SPINES = ['#3a4a32', '#4a5a3a', '#2f3a28', '#52613f', '#3f4a35', '#46522f', '#384228', '#5a6b42']

export default function LandingPage() {
  // Cursor refs
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  // Nav scrolled
  const navRef = useRef<HTMLElement>(null)
  // Pipeline refs
  const pipeRef = useRef<HTMLDivElement>(null)
  const act1Ref = useRef<HTMLDivElement>(null)
  const act2Ref = useRef<HTMLDivElement>(null)
  const act3Ref = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef<HTMLDivElement>(null)
  const bar1Ref = useRef<HTMLDivElement>(null)
  const bar2Ref = useRef<HTMLDivElement>(null)
  const scrubFillRef = useRef<HTMLDivElement>(null)
  const scrubTcRef = useRef<HTMLSpanElement>(null)
  const ppRefs = [useRef<HTMLElement>(null), useRef<HTMLElement>(null), useRef<HTMLElement>(null)]
  const qCellsRef = useRef<HTMLDivElement>(null)
  const planRef = useRef<HTMLDivElement>(null)
  // J-curve
  const jsvgRef = useRef<SVGSVGElement>(null)
  // QCM demo state
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const Q = QUESTIONS[qi]

  // === CURSOR + MAGNET + NAV SCROLLED ===
  useEffect(() => {
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return
    let mx = window.innerWidth / 2, my = window.innerHeight / 2, rx = mx, ry = my
    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY
      dot.style.left = mx + 'px'; dot.style.top = my + 'px'
    }
    let raf = 0
    const loop = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px'
      raf = requestAnimationFrame(loop)
    }
    const onDown = () => ring.classList.add('click')
    const onUp = () => ring.classList.remove('click')
    const hov = 'a,button,.lp-opt,[data-magnet],.lp-feat-item'
    const onOver = (e: MouseEvent) => { if ((e.target as HTMLElement).closest(hov)) ring.classList.add('hover') }
    const onOut = (e: MouseEvent) => { if ((e.target as HTMLElement).closest(hov)) ring.classList.remove('hover') }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    loop()

    // Magnetic buttons
    const magnets = document.querySelectorAll<HTMLElement>('[data-magnet]')
    const enterFns: Array<{ el: HTMLElement; mm: (e: MouseEvent) => void; ml: () => void }> = []
    magnets.forEach(el => {
      const mm = (e: MouseEvent) => {
        const r = el.getBoundingClientRect()
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px,${(e.clientY - r.top - r.height / 2) * 0.35}px)`
      }
      const ml = () => { el.style.transform = '' }
      el.addEventListener('mousemove', mm)
      el.addEventListener('mouseleave', ml)
      enterFns.push({ el, mm, ml })
    })

    // Nav scrolled
    const onScroll = () => {
      navRef.current?.classList.toggle('scrolled', window.scrollY > 40)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
      enterFns.forEach(({ el, mm, ml }) => {
        el.removeEventListener('mousemove', mm)
        el.removeEventListener('mouseleave', ml)
      })
    }
  }, [])

  // === REVEAL ON SCROLL ===
  useEffect(() => {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    }), { threshold: 0.18 })
    document.querySelectorAll('.lp-rv').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  // === COUNT UP ===
  useEffect(() => {
    const cio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return
      const el = e.target as HTMLElement
      const to = +(el.dataset.to || '0')
      let s: number | null = null
      const step = (t: number) => {
        if (s == null) s = t
        const p = Math.min((t - s) / 1300, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        el.textContent = Math.round(ease * to).toLocaleString('fr-FR')
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
      cio.unobserve(el)
    }), { threshold: 0.5 })
    document.querySelectorAll<HTMLElement>('.lp-count').forEach(el => cio.observe(el))
    return () => cio.disconnect()
  }, [])

  // === PIPELINE SCROLL ENGINE ===
  useEffect(() => {
    const clamp = (v: number) => Math.max(0, Math.min(1, v))
    const onScroll = () => {
      const pipe = pipeRef.current
      if (!pipe) return
      const r = pipe.getBoundingClientRect()
      const total = pipe.offsetHeight - window.innerHeight
      if (total <= 0) return
      const p = clamp(-r.top / total)
      const act = p < 0.34 ? 0 : p < 0.67 ? 1 : 2
      ppRefs.forEach((ref, i) => ref.current?.classList.toggle('on', i <= act))
      if (labelRef.current) labelRef.current.innerHTML = STAGE_TITLES[act]
      if (stepRef.current) stepRef.current.textContent = STAGE_STEPS[act]
      act1Ref.current?.classList.toggle('show', act === 0)
      act2Ref.current?.classList.toggle('show', act === 1)
      act3Ref.current?.classList.toggle('show', act === 2)

      if (act === 0) {
        const lp = clamp(p / 0.34)
        if (bar1Ref.current) bar1Ref.current.style.width = Math.min(100, lp * 160) + '%'
        if (bar2Ref.current) bar2Ref.current.style.width = Math.min(100, lp * 160 - 30) + '%'
        const sp = clamp((lp - 0.4) / 0.6) * 100
        if (scrubFillRef.current) scrubFillRef.current.style.width = sp + '%'
        const m = Math.floor((sp / 100) * 47)
        if (scrubTcRef.current) scrubTcRef.current.textContent = String(m).padStart(2, '0') + ':00 / 47:00'
      }
      if (act === 1) {
        const lp = clamp((p - 0.34) / 0.33)
        const n = Math.floor(lp * 30)
        qCellsRef.current?.querySelectorAll<HTMLDivElement>('.q').forEach((c, i) => {
          c.classList.toggle('pop', i < n)
          c.classList.toggle('hi', i < n && i % 7 === 3)
        })
      }
      if (act === 2) {
        const lp = clamp((p - 0.67) / 0.33)
        const n = Math.floor(lp * 14)
        planRef.current?.querySelectorAll<HTMLDivElement>('.p').forEach((c, i) => c.classList.toggle('up', i < n))
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // === J-CURVE DRAW + DOTS ===
  useEffect(() => {
    if (!jsvgRef.current) return
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return
      jsvgRef.current?.querySelectorAll('.lp-jp1,.lp-jp2').forEach(el => el.classList.add('draw'))
      setTimeout(() => {
        jsvgRef.current?.querySelectorAll('.lp-jdot').forEach((d, i) => setTimeout(() => d.classList.add('show'), i * 300))
      }, 900)
      io.disconnect()
    }), { threshold: 0.4 })
    io.observe(jsvgRef.current)
    return () => io.disconnect()
  }, [])

  // === LIBRARY SHELF ANIMATE ===
  useEffect(() => {
    const shelf = document.querySelector('.lp-shelf')
    if (!shelf) return
    const books = shelf.querySelectorAll('.lp-book')
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return
      books.forEach((b, i) => setTimeout(() => b.classList.add('up'), i * 14))
      io.disconnect()
    }), { threshold: 0.3 })
    io.observe(shelf)
    return () => io.disconnect()
  }, [])

  // === QCM INTERACTION ===
  const pickAnswer = (i: number) => { if (picked != null) return; setPicked(i) }
  const nextQ = () => { setQi((qi + 1) % QUESTIONS.length); setPicked(null) }

  return (
    <div className="lp-root">
      <div className="lp-cur-dot" ref={dotRef} aria-hidden />
      <div className="lp-cur-ring" ref={ringRef} aria-hidden />

      {/* NAV */}
      <nav className="lp-nav" ref={navRef as React.RefObject<HTMLElement>}>
        <div className="lp-brand"><span className="blip" />MEDREV</div>
        <div className="lp-nav-links">
          <a href="#methode">Méthode</a>
          <a href="#demo">Démo</a>
          <a href="#features">Fonctions</a>
          <a href="#tarifs">Tarifs</a>
        </div>
        <Link href="/auth" className="lp-nav-cta" data-magnet>Commencer →</Link>
      </nav>

      {/* HERO */}
      <header className="lp-hero">
        <div className="lp-hero-grid-bg" />
        <svg className="lp-ekg" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden>
          <path d="M0,60 L380,60 L400,60 L410,20 L430,100 L450,40 L470,60 L760,60 L780,60 L790,30 L805,90 L820,45 L835,60 L1120,60 L1140,60 L1150,18 L1168,102 L1186,55 L1205,60 L1440,60" />
        </svg>
        <div className="lp-hero-inner">
          <span className="lp-tag"><span className="live" />P1 · Rentrée 2026 · système en ligne</span>
          <h1 className="lp-hero-h1">
            <span className="l"><b>Tes cours.</b></span>
            <span className="l"><b>Tes QCM.</b></span>
            <span className="l"><b className="accent">Ton planning.</b></span>
          </h1>
          <div className="lp-hero-bottom">
            <p className="lp-hero-sub">
              Importe ta vidéo de cours et ton poly. <b>MedRev génère 30 QCM</b>, programme tes 14 paliers de révision et te dit chaque jour quoi travailler. <span className="accent">La méthode des prépas, sans le prix.</span>
            </p>
            <div className="lp-hero-ctas">
              <Link href="/auth" className="lp-btn lp-btn-primary" data-magnet>Commencer gratuit →</Link>
              <a href="#methode" className="lp-btn lp-btn-ghost" data-magnet>▶ La méthode</a>
            </div>
          </div>
          <div className="lp-trust">
            <span><span className="d">●</span>Gratuit pour démarrer</span>
            <span><span className="d">●</span>Données en France</span>
            <span><span className="d">●</span>Sans pub, sans engagement</span>
          </div>
        </div>
      </header>

      {/* PIPELINE */}
      <section className="lp-pipe" id="methode" ref={pipeRef}>
        <div className="lp-pipe-sticky">
          <div className="lp-pipe-grid-bg" />
          <div className="lp-stage">
            <div className="lp-stage-hud">
              <div className="label" ref={labelRef} dangerouslySetInnerHTML={{ __html: STAGE_TITLES[0] }} />
              <div className="step" ref={stepRef}>{STAGE_STEPS[0]}</div>
            </div>
            <div className="lp-act" ref={act1Ref}>
              <div className="lp-panel lp-imp">
                <h4>◷ Flux d'import · cardiologie</h4>
                <div className="lp-file">
                  <div className="ic">▶</div>
                  <div className="nm">cours-glycolyse.mp4</div>
                  <div className="meta">47 min</div>
                  <div className="bar" ref={bar1Ref} />
                </div>
                <div className="lp-file">
                  <div className="ic">P</div>
                  <div className="nm">poly-glycolyse-2026.pdf</div>
                  <div className="meta">8 Mo</div>
                  <div className="bar" ref={bar2Ref} />
                </div>
                <div className="lp-scrub">
                  <div className="fill" ref={scrubFillRef} />
                  <span className="tc" ref={scrubTcRef}>00:00 / 47:00</span>
                </div>
              </div>
            </div>
            <div className="lp-act" ref={act2Ref}>
              <div className="lp-qgrid" ref={qCellsRef}>
                {Array.from({ length: 30 }, (_, i) => <div key={i} className="q">{i + 1}</div>)}
              </div>
              <div className="lp-cap"><b>30 QCM</b> générés · distribution A→E uniforme</div>
            </div>
            <div className="lp-act" ref={act3Ref}>
              <div className="lp-panel lp-plan">
                <div className="lp-plan-row" ref={planRef}>
                  {PIPE_HEIGHTS.map((h, i) => (
                    <div key={i} className="p" style={{ height: h + '%', opacity: i < 5 ? 1 : i < 10 ? 0.78 : 0.55 }}>
                      <span>{PIPE_LABELS[i]}</span>
                    </div>
                  ))}
                </div>
                <div className="lp-plan-cap"><b>14 paliers</b> J0 → J+120 · courbe d'Ebbinghaus</div>
              </div>
            </div>
            <div className="lp-bars">
              <i ref={ppRefs[0] as React.RefObject<HTMLElement>} />
              <i ref={ppRefs[1] as React.RefObject<HTMLElement>} />
              <i ref={ppRefs[2] as React.RefObject<HTMLElement>} />
            </div>
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="lp-sec" id="demo">
        <div className="lp-wrap">
          <span className="lp-k lp-rv">Démo live · pas une capture</span>
          <h2 className="lp-h2 lp-rv d1" style={{ marginBottom: 46 }}>Réponds à un <span className="accent">vrai QCM.</span></h2>
          <div className="lp-demo lp-rv d2">
            <div className="lp-demo-bar">
              <span className="dot r" /><span className="dot y" /><span className="dot g" />
              {' '}medrev — session_demo.qcm <span>● rec</span>
            </div>
            <div className="lp-demo-grid">
              <div className="lp-demo-left">
                <h3 className="lp-demo-h">Touche du doigt <span className="accent">ce que vivent tes révisions.</span></h3>
                <p className="lp-demo-p">Type concours, 5 propositions, retour immédiat vers le passage source de ta vidéo. Exactement ce que MedRev fabrique sur tes propres cours.</p>
                <div className="lp-demo-meta">
                  <span>SOURCE : <b>vidéo 18:42</b></span>
                  <span>NIVEAU : <b>concours</b></span>
                  <span>QCM générés : <b>30 / fiche</b></span>
                </div>
              </div>
              <div className="lp-demo-right">
                <div className="lp-qcard-top">
                  <span>Q{qi + 1} / {QUESTIONS.length}</span>
                  <span className="lp-qcard-prog">
                    {QUESTIONS.map((_, i) => <i key={i} className={i <= qi ? 'on' : ''} />)}
                  </span>
                </div>
                <div className="lp-qcard-q">{Q.q}</div>
                <div>
                  {Q.opts.map((o, i) => {
                    const isCorrect = picked != null && i === Q.ans
                    const isWrong = picked === i && i !== Q.ans
                    const cls = ['lp-opt', picked != null ? 'locked' : '', isCorrect ? 'correct' : '', isWrong ? 'wrong' : ''].filter(Boolean).join(' ')
                    return (
                      <div key={i} className={cls} onClick={() => pickAnswer(i)}>
                        <span className="lt">{String.fromCharCode(65 + i)}</span><span>{o}</span>
                      </div>
                    )
                  })}
                </div>
                <div className={'lp-qfb' + (picked != null ? ' show' : '')}>
                  {picked != null && (
                    <>
                      {picked === Q.ans ? '✓ Exact. ' : '✗ Raté. '}{Q.fb}
                      <br /><span className="src">↩ {Q.src}</span>
                    </>
                  )}
                </div>
                <button className={'lp-qnext' + (picked != null ? ' ready' : '')} onClick={nextQ}>
                  {qi < QUESTIONS.length - 1 ? 'Suivant →' : 'Recommencer ↺'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* J-CURVE */}
      <section className="lp-sec" id="jcurve">
        <div className="lp-wrap">
          <span className="lp-k lp-rv">Moteur · courbe de l'oubli</span>
          <h2 className="lp-h2 lp-rv d1">Ta mémoire <span className="accent">décroche.</span> Le moteur la rattrape.</h2>
          <p className="lp-sub lp-rv d2" style={{ marginBottom: 54 }}>Sans révision, tu perds 70 % d'un cours en une semaine. Les 14 rappels au bon moment maintiennent la trace vivante.</p>
          <div className="lp-jgrid">
            <div className="lp-jbox lp-rv d1">
              <svg className="lp-jsvg" viewBox="0 0 460 240" ref={jsvgRef}>
                <path className="lp-jp1" d="M40,30 C90,140 150,185 250,195 C330,202 390,204 440,204" />
                <path className="lp-jp2" d="M40,30 C66,80 86,62 104,100 C106,52 144,44 162,86 C164,48 214,42 232,80 C234,46 310,40 330,72 C332,44 412,38 440,62" />
                <circle className="lp-jdot" cx="104" cy="100" r="3.5" fill="var(--lp-lime)" />
                <circle className="lp-jdot" cx="162" cy="86" r="3.5" fill="var(--lp-lime)" />
                <circle className="lp-jdot" cx="232" cy="80" r="3.5" fill="var(--lp-lime)" />
                <circle className="lp-jdot" cx="330" cy="72" r="3.5" fill="var(--lp-lime)" />
              </svg>
              <div className="lp-jlegend">
                <span><span className="sw" style={{ background: 'var(--lp-coral)' }} />Sans MedRev</span>
                <span><span className="sw" style={{ background: 'var(--lp-lime)' }} />Avec les 14 rappels</span>
              </div>
            </div>
            <div className="lp-rv d2">
              <h3 style={{ fontFamily: 'var(--lp-fd)', fontWeight: 700, fontSize: 26, textTransform: 'uppercase', letterSpacing: '-.02em', marginBottom: 14 }}>
                Note basse → ça re-programme.<br />Note haute → ça t'épargne.
              </h3>
              <p style={{ fontSize: 19, lineHeight: 1.55, color: 'var(--lp-soft)' }}>
                Chaque fiche ajuste son propre calendrier. Tu rates&nbsp;? Le prochain rappel se rapproche. Tu maîtrises&nbsp;? Il s'espace. Tu ne touches jamais au planning — tu révises, le moteur gère le timing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-sec" id="features">
        <div className="lp-wrap">
          <span className="lp-k lp-rv">Ce que tu débloques</span>
          <h2 className="lp-h2 lp-rv d1" style={{ marginBottom: 46 }}>Un coach, <span className="accent">pas un cahier.</span></h2>
          <div>
            {FEATURES.map((f, i) => (
              <div key={i} className="lp-feat-item lp-rv">
                <div className="lp-feat-no">{`// 0${i + 1}`}</div>
                <div className="lp-feat-t">{f[0]} {f[1]}</div>
                <div className="lp-feat-d">{f[2]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIBRARY */}
      <section className="lp-sec" id="library">
        <div className="lp-wrap lp-lib-grid">
          <div className="lp-rv">
            <div className="lp-shelf">
              {[0, 1, 2].map(r => (
                <div key={r} className="lp-shelf-row">
                  {Array.from({ length: 22 }, (_, b) => {
                    const idx = r * 22 + b
                    const isTreasure = idx % 19 === 5
                    return (
                      <div
                        key={b}
                        className={'lp-book' + (isTreasure ? ' treasure' : '')}
                        style={{
                          height: 56 + ((idx * 13) % 42) + '%',
                          background: isTreasure ? 'var(--lp-lime)' : SPINES[idx % SPINES.length],
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="lp-rv d1">
            <span className="lp-k">Progression · rendue vivante</span>
            <h2 className="lp-h2" style={{ fontSize: 'clamp(30px,4.6vw,56px)' }}>
              Chaque fiche notée <span className="accent">ajoute un livre.</span>
            </h2>
            <p className="lp-sub" style={{ margin: '18px 0 30px' }}>2000 ouvrages à amasser sur l'année. 6 trésors aux paliers 100, 300, 600, 900, 1200 et 1500.</p>
            <div style={{ display: 'flex', gap: 44, alignItems: 'end' }}>
              <div>
                <div className="lp-bignum accent"><span className="lp-count" data-to="2000">0</span></div>
                <div style={{ fontFamily: 'var(--lp-fm)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--lp-soft)', marginTop: 6 }}>Livres à collecter</div>
              </div>
              <div>
                <div className="lp-bignum"><span className="lp-count" data-to="6">0</span></div>
                <div style={{ fontFamily: 'var(--lp-fm)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--lp-soft)', marginTop: 6 }}>Trésors</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section className="lp-sec" id="proof">
        <div className="lp-wrap">
          <div className="lp-proof lp-rv">
            <p className="lp-proof-q">
              « Une P1 typique fait <strong>~200 fiches</strong> dans l'année. MedRev les organise toutes, génère <strong>jusqu'à 30 QCM par fiche</strong> sur tes vrais cours, et te dit chaque jour <strong>quoi réviser</strong>. »
            </p>
            <div className="lp-pstats">
              <div><div className="lp-pnum"><span className="lp-count" data-to="30">0</span></div><div className="lp-plbl">QCM / fiche</div></div>
              <div><div className="lp-pnum"><span className="lp-count" data-to="14">0</span></div><div className="lp-plbl">Paliers J</div></div>
              <div><div className="lp-pnum"><span className="lp-count" data-to="6">0</span></div><div className="lp-plbl">Trésors</div></div>
              <div><div className="lp-pnum"><span className="lp-count" data-to="100">0</span>%</div><div className="lp-plbl">Auto-organisé</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-fcta" id="tarifs">
        <div className="lp-fcta-glow" />
        <h2 className="lp-fcta-h">La P1 commence.<br /><span className="accent">Tu commences avec elle.</span></h2>
        <p className="lp-fcta-sub">Pré-configure ton compte en 2 minutes. Tes matières Sorbonne / Paris Cité / Lyon… sont déjà prêtes selon ta fac.</p>
        <div className="lp-fcta-btns">
          <Link href="/auth" className="lp-btn lp-btn-primary" data-magnet>Créer mon compte →</Link>
          <Link href="/pricing" className="lp-btn lp-btn-ghost" data-magnet>Voir les tarifs</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-wrap">
        <div className="lp-foot">
          <div className="lp-brand"><span className="blip" />MEDREV</div>
          <div className="lp-foot-links">
            <Link href="/methode">Méthode</Link>
            <Link href="/pricing">Tarifs</Link>
            <Link href="/manifesto">Manifeste</Link>
            <Link href="/cgu">CGU</Link>
            <Link href="/confidentialite">Confidentialité</Link>
          </div>
          <div className="lp-foot-note">MEDREV · Données hébergées en France · Sans pub, sans engagement · © 2026</div>
        </div>
      </footer>
    </div>
  )
}
