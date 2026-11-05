// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {"session": "à faire"}

const CSS = "\n\na{color:#1E3354}a:hover{color:#0F1E36}\n.mr-btn:hover{filter:brightness(.92)}\n.mr-node{transition:transform .15s ease}\n.mr-node:hover{transform:translateY(-3px)}\n@keyframes mr-pulse{0%{box-shadow:0 7px 0 #0B1D31,0 0 0 0 rgba(21,48,78,.45)}70%{box-shadow:0 7px 0 #0B1D31,0 0 0 22px rgba(21,48,78,0)}100%{box-shadow:0 7px 0 #0B1D31,0 0 0 0 rgba(21,48,78,0)}}\n@keyframes mr-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}\n@keyframes mr-flicker{0%,100%{transform:scale(1,1) rotate(-2deg)}50%{transform:scale(1.04,.96) rotate(2deg)}}\n.mr-today{animation:mr-pulse 2s ease-out infinite}\n.mr-bubble{animation:mr-bob 2.4s ease-in-out infinite}\n.mr-lit path{transform-origin:50% 100%;animation:mr-flicker 1.8s ease-in-out infinite}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sel: 'today' };
  }
  renderVals() {
    const st = this.state;
    const done = this.props.session === 'faite';
    const C = { bio: '#C4554D', ana: '#4F7CC9', phy: '#8B6BB8', stat: '#9C7148', pha: '#D08A3E', ssh: '#3E8E85' };
    const pool = [['Nerfs crâniens', C.ana], ['Pharmacocinétique', C.pha], ['Potentiel d’action', C.phy], ['Optique géométrique', C.bio], ['Éthique médicale', C.ssh], ['Tests statistiques', C.stat], ['Membre supérieur', C.ana], ['Fonction rénale', C.phy], ['Récepteurs et ligands', C.pha]];
    const wave = ['0px', '90px', '140px', '90px', '0px', '-90px', '-140px', '-90px'];
    const days = [
      { id: 'f3', date: 'samedi 7 nov.', kind: 'future', n: 2 },
      { id: 'f2', date: 'vendredi 6 nov.', kind: 'future', n: 3 },
      { id: 'f1', date: 'jeudi 5 nov.', kind: 'future', n: 5 },
      { id: 'today', date: 'mercredi 4 nov.', kind: 'today', n: 9 },
      { band: true, title: 'Cette semaine', sub: '3 sessions sur 3', bandBg: '#E7ECF4', bandFg: '#15304E' },
      { id: 'p1', date: 'mardi 3 nov.', kind: 'done', n: 6, qcm: '78%', note: '3,9' },
      { id: 'p2', date: 'lundi 2 nov.', kind: 'done', n: 4, qcm: '71%', note: '3,5' },
      { id: 'p3', date: 'dimanche 1 nov.', kind: 'rest' },
      { band: true, title: 'Semaine dernière', sub: '5 sessions sur 6', bandBg: '#F1EEE7', bandFg: '#3D424A' },
      { id: 'p4', date: 'samedi 31 oct.', kind: 'done', n: 3, qcm: '82%', note: '4,1' },
      { id: 'p5', date: 'vendredi 30 oct.', kind: 'missed', n: 5 },
      { id: 'p6', date: 'jeudi 29 oct.', kind: 'done', n: 7, qcm: '64%', note: '3,2' },
      { id: 'p7', date: 'mercredi 28 oct.', kind: 'done', n: 5, qcm: '69%', note: '3,6' },
      { id: 'p8', date: 'mardi 27 oct.', kind: 'done', n: 4, qcm: '75%', note: '3,8' },
      { id: 'p9', date: 'lundi 26 oct.', kind: 'done', n: 6, qcm: '58%', note: '3,0' },
      { band: true, title: 'Il y a 2 semaines', sub: '4 sessions sur 6', bandBg: '#F1EEE7', bandFg: '#3D424A' },
      { id: 'p10', date: 'samedi 24 oct.', kind: 'done', n: 2, qcm: '80%', note: '4,0' },
      { id: 'p11', date: 'vendredi 23 oct.', kind: 'done', n: 5, qcm: '62%', note: '3,1' },
      { id: 'p12', date: 'jeudi 22 oct.', kind: 'missed', n: 4 },
      { id: 'p13', date: 'mercredi 21 oct.', kind: 'done', n: 6, qcm: '66%', note: '3,4' }
    ];
    let k = 0;
    const blocks = days.map((d) => {
      if (d.band) return { isBand: true, isNode: false, title: d.title, sub: d.sub, bandBg: d.bandBg, bandFg: d.bandFg };
      const x = wave[k++ % wave.length];
      const on = st.sel === d.id;
      const isTodayPending = d.kind === 'today' && !done;
      const kind = d.kind === 'today' && done ? 'done' : d.kind;
      const base = {
        isBand: false, isNode: true, x, date: d.kind === 'today' ? 'Aujourd’hui' : d.date, label: d.date,
        pressed: on ? 'true' : 'false', pick: () => this.setState({ sel: d.id }), isToday: isTodayPending,
        nodeClass: '', flameClass: '', showFlame: true, showText: false, text: '',
        rowH: isTodayPending ? '270px' : '150px', dateWeight: 500, dateColor: '#6B6F76',
        bubbleTitle: d.n + ' fiches t’attendent'
      };
      const ring = on ? ', 0 0 0 5px #FAF8F4, 0 0 0 8px #15304E' : '';
      if (kind === 'done') return { ...base, size: '96px', border: '0', bg: '#F49A2E', fg: '#FFFFFF', shadow: '0 6px 0 #C46F17' + ring, flameFill: '#FFF3D6', flameSize: '46', flameClass: d.kind === 'today' ? 'mr-lit' : '', dateColor: '#1A1D23', dateWeight: 600 };
      if (kind === 'today') return { ...base, size: '120px', border: '0', bg: '#15304E', fg: '#FFFFFF', shadow: '0 7px 0 #0B1D31' + ring, flameFill: 'rgba(255,255,255,.9)', flameSize: '56', nodeClass: 'mr-today', dateColor: '#15304E', dateWeight: 700 };
      if (kind === 'missed') return { ...base, size: '80px', border: '3px dashed #D9D3C7', bg: '#FAF8F4', fg: '#9AA0A8', shadow: on ? '0 0 0 4px #15304E' : 'none', flameFill: '#E4DFD4', flameSize: '34' };
      if (kind === 'rest') return { ...base, size: '64px', border: '0', bg: '#ECE8E0', fg: '#9AA0A8', shadow: on ? '0 0 0 4px #15304E' : 'none', showFlame: false, showText: true, text: 'z', rowH: '120px' };
      return { ...base, size: '88px', border: '0', bg: '#E4DFD4', fg: '#9AA0A8', shadow: '0 6px 0 #CFC8BB' + ring, showFlame: false, showText: true, text: String(d.n) };
    });
    const d = days.find((x) => x.id === st.sel) || days[3];
    const fiches = (n, right) => Array.from({ length: Math.min(n, 5) }, (_, i) => { const p = pool[(i * 2 + n) % pool.length]; return { title: p[0], color: p[1], right: right(i) }; });
    let sel;
    if (d.kind === 'today' && !done) sel = { kicker: 'Session du jour', date: 'Aujourd’hui', hasStats: false, stats: [], fiches: fiches(d.n, (i) => ['45 min', '30 min', '25 min', '20 min', '35 min'][i]), isToday: true, cta: 'Commencer la session' };
    else if (d.kind === 'today') sel = { kicker: 'Session faite', date: 'Aujourd’hui', hasStats: true, stats: [{ v: '9', l: 'fiches' }, { v: '74%', l: 'QCM' }, { v: '3,8', l: 'note' }], fiches: fiches(9, (i) => ['3/5', '4/5', '4/5', '3/5', '5/5'][i]), isToday: true, cta: 'Continuer à réviser' };
    else if (d.kind === 'done') sel = { kicker: 'Session faite', date: d.date, hasStats: true, stats: [{ v: String(d.n), l: 'fiches' }, { v: d.qcm, l: 'QCM' }, { v: d.note, l: 'note' }], fiches: fiches(d.n, (i) => ['4/5', '3/5', '5/5', '3/5', '4/5'][i]), isToday: false };
    else if (d.kind === 'missed') sel = { kicker: 'Session manquée', date: d.date, hasStats: false, stats: [], fiches: fiches(d.n, () => 'reportée'), isToday: false };
    else if (d.kind === 'rest') sel = { kicker: 'Jour de repos', date: d.date, hasStats: false, stats: [], fiches: [], isToday: false };
    else sel = { kicker: 'À venir', date: d.date, hasStats: false, stats: [], fiches: fiches(d.n, () => 'prévue'), isToday: false };
    return { blocks, sel };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style>{CSS}</style>
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "100vh", display: "flex"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="0" />
      </div>
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "40px 56px 80px", display: "flex", gap: "48px", alignItems: "flex-start"}}>
        <section aria-label={"Ton parcours"} style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", alignItems: "center"}}>
          {(v.blocks || []).map((b: any, i_b: number) => (
            <Fragment key={i_b}>
              <div style={{width: "100%", maxWidth: "760px", display: "flex", flexDirection: "column", alignItems: "center"}}>
                {b.isBand ? (
                  <>
                    <div style={{width: "100%", boxSizing: "border-box", margin: "28px 0 20px", padding: "18px 24px", borderRadius: "16px", background: b.bandBg, color: b.bandFg, display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                      <span style={{fontSize: "18px", fontWeight: "700"}}>
                        {b.title}
                      </span>
                      <span style={{fontSize: "15px", opacity: ".75"}}>
                        {b.sub}
                      </span>
                    </div>
                  </>
                ) : null}
                {b.isNode ? (
                  <>
                    <div style={{position: "relative", height: b.rowH, width: "100%", display: "flex", justifyContent: "center", alignItems: "center"}}>
                      <div style={{transform: `translateX(${b.x})`, display: "flex", flexDirection: "column", alignItems: "center", gap: "10px"}}>
                        {b.isToday ? (
                          <>
                            <Link href={"/v2/session"} className={"mr-bubble"} style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "14px 22px", borderRadius: "16px", background: "#FFFFFF", boxShadow: "0 6px 20px rgba(26,29,35,.12)", textDecoration: "none", color: "#1A1D23", position: "relative", marginBottom: "8px"}}>
                              <span style={{fontSize: "17px", fontWeight: "700"}}>
                                {b.bubbleTitle}
                              </span>
                              <span style={{fontSize: "15px", fontWeight: "700", color: "#FFFFFF", background: "#15304E", padding: "10px 26px", borderRadius: "12px", marginTop: "6px"}}>
                                {"Commencer"}
                              </span>
                              <span style={{position: "absolute", bottom: "-8px", left: "50%", width: "16px", height: "16px", background: "#FFFFFF", transform: "translateX(-50%) rotate(45deg)"}}></span>
                            </Link>
                          </>
                        ) : null}
                        <button type={"button"} className={`mr-node ${b.nodeClass}`} onClick={b.pick} aria-label={b.label} aria-pressed={b.pressed} style={{font: "inherit", width: b.size, height: b.size, borderRadius: "50%", border: b.border, background: b.bg, color: b.fg, boxShadow: b.shadow, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0"}}>
                          {b.showFlame ? (
                            <>
                              <svg className={b.flameClass} width={b.flameSize} height={b.flameSize} viewBox={"0 0 120 140"} aria-hidden={"true"}>
                                <path fill={b.flameFill} d={"M60 4C66 30 98 44 98 88a38 38 0 0 1-76 0c0-20 10-32 18-42 1 12 7 20 14 22-2-22 0-44 6-64z"} />
                              </svg>
                            </>
                          ) : null}
                          {b.showText ? (
                            <>
                              <span style={{fontSize: "20px", fontWeight: "700"}}>
                                {b.text}
                              </span>
                            </>
                          ) : null}
                        </button>
                        <span style={{fontSize: "14px", fontWeight: b.dateWeight, color: b.dateColor}}>
                          {b.date}
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </Fragment>
          ))}
        </section>
        <aside style={{flex: "0 0 400px", display: "flex", flexDirection: "column", gap: "20px", position: "sticky", top: "40px"}}>
          <section aria-label={"Détail"} style={{display: "flex", flexDirection: "column", gap: "18px", padding: "28px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <span style={{fontSize: "15px", color: "#6B6F76"}}>
                {v.sel.kicker}
              </span>
              <span style={{fontSize: "26px", fontWeight: "700"}}>
                {v.sel.date}
              </span>
            </span>
            {v.sel.hasStats ? (
              <>
                <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px"}}>
                  {(v.sel.stats || []).map((s: any, i_s: number) => (
                    <Fragment key={i_s}>
                      <div style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                        <span style={{fontSize: "24px", fontWeight: "700"}}>
                          {s.v}
                        </span>
                        <span style={{fontSize: "14px", color: "#6B6F76"}}>
                          {s.l}
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </>
            ) : null}
            <div style={{display: "flex", flexDirection: "column"}}>
              {(v.sel.fiches || []).map((f: any, i_f: number) => (
                <Fragment key={i_f}>
                  <div style={{display: "flex", alignItems: "center", gap: "12px", padding: "11px 0", borderTop: "1px solid #F1EEE7", fontSize: "15px"}}>
                    <span style={{width: "9px", height: "9px", borderRadius: "50%", background: f.color}}></span>
                    <span style={{flex: "1", fontWeight: "600"}}>
                      {f.title}
                    </span>
                    <span style={{fontSize: "14px", color: "#6B6F76"}}>
                      {f.right}
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
            {v.sel.isToday ? (
              <>
                <Link href={"/v2/session"} className={"mr-btn"} style={{textAlign: "center", fontSize: "18px", fontWeight: "700", color: "#FFFFFF", background: "#15304E", padding: "16px", borderRadius: "14px", textDecoration: "none"}}>
                  {v.sel.cta}
                </Link>
              </>
            ) : null}
          </section>
          <section aria-label={"Prochain concours blanc"} style={{display: "flex", flexDirection: "column", gap: "10px", padding: "24px 28px", borderRadius: "20px", background: "#15304E", color: "#FFFFFF"}}>
            <span style={{fontSize: "15px", color: "rgba(255,255,255,.7)"}}>
              {"Prochain concours blanc"}
            </span>
            <span style={{fontSize: "22px", fontWeight: "700"}}>
              {"Samedi 22 novembre"}
            </span>
            <Link href={"/v2/simulateur"} style={{alignSelf: "flex-start", marginTop: "6px", fontSize: "15px", fontWeight: "700", color: "#15304E", background: "#F4F1EA", padding: "11px 18px", borderRadius: "10px", textDecoration: "none"}}>
              {"Je m\u2019inscris"}
            </Link>
          </section>
        </aside>
      </main>
    </div>
    </>
  )
}
