// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {"session": "à faire", "fiches": "beaucoup", "nouvel": false, "emploiDuTemps": true}

const CSS = "\n\na{color:#1E3354}a:hover{color:#0F1E36}\n.mr-btn:hover{filter:brightness(.92)}\n.mr-btn-light:hover{background:#FFFFFF !important}\n.mr-ghost-dark:hover{background:rgba(255,255,255,.16) !important}\n.mr-drop:hover{border-color:#15304E !important;background:#F4F6FA !important}\n@keyframes mr-ignite{0%{transform:scale(.15);opacity:0}55%{transform:scale(1.18);opacity:1}75%{transform:scale(.94)}100%{transform:scale(1)}}\n@keyframes mr-flicker{0%,100%{transform:scale(1,1) rotate(-1.5deg)}33%{transform:scale(1.03,.97) rotate(1deg)}66%{transform:scale(.98,1.04) rotate(2deg)}}\n@keyframes mr-inner{0%,100%{transform:scale(1)}50%{transform:scale(.9,1.08)}}\n@keyframes mr-glow{0%,100%{opacity:.45;transform:scale(1)}50%{opacity:.8;transform:scale(1.08)}}\n@keyframes mr-spark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),-70px) scale(.2);opacity:0}}\n.mr-flame-lit{animation:mr-ignite .9s cubic-bezier(.2,.8,.2,1) both}\n.mr-flame-lit .f-outer{transform-origin:50% 100%;animation:mr-flicker 1.6s ease-in-out .9s infinite}\n.mr-flame-lit .f-inner{transform-origin:50% 100%;animation:mr-inner 1.1s ease-in-out .9s infinite}\n.mr-glow{animation:mr-glow 2.4s ease-in-out infinite}\n.mr-spark{animation:mr-spark 1.4s ease-out infinite}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { done: null, added: { 0: true } };
  }
  renderVals() {
    const mode = this.props.fiches ?? 'beaucoup';
    const nouvel = !!this.props.nouvel;
    const edt = this.props.emploiDuTemps !== false;
    const done = this.state.done === null ? (this.props.session === 'faite') : this.state.done;
    const C = { bio: '#C4554D', ana: '#4F7CC9', phy: '#8B6BB8', stat: '#9C7148', pha: '#D08A3E', ssh: '#3E8E85' };
    const F = [
      ['Anatomie', C.ana], ['Pharmacologie', C.pha], ['Pharmacologie', C.pha], ['Santé, Société, Humanité', C.ssh],
      ['Biostatistiques', C.stat], ['Physiologie', C.phy], ['Anatomie', C.ana], ['Biophysique', C.bio], ['Physiologie', C.phy]
    ];
    const count = mode === 'beaucoup' ? 9 : (mode === 'peu' ? 2 : 0);
    const all = F.slice(0, count);
    const subs = [];
    all.forEach((f) => { if (!subs.find((x) => x[0] === f[0])) subs.push(f); });
    const short = (n) => n.split(',')[0];
    let subLine = subs.slice(0, 3).map((x) => short(x[0])).join(', ') + (subs.length > 3 ? ' et ' + (subs.length - 3) + ' autres' : '');
    let dots = subs.map((x) => ({ c: x[1] }));
    let kicker = 'Ta session du jour';
    let heroTitle = count + (count > 1 ? ' fiches prêtes' : ' fiche prête');
    if (count === 0) { heroTitle = 'Rien à réviser'; subLine = 'Ajoute tes cours du jour pour qu’ils soient prêts demain'; dots = []; }
    if (done) { kicker = 'Bravo'; heroTitle = 'Session faite'; subLine = 'Demain, 5 fiches t’attendent'; dots = [{ c: C.phy }, { c: C.ana }, { c: C.pha }]; }
    const steps = [['1', 'Relire', 'ta fiche ou le poly'], ['2', 'S’entraîner', 'QCM et flashcards du cours'], ['3', 'Se noter', 'MedRev planifie la suite']].map(([n, title, desc]) => ({ n, title, desc }));
    const past = [true, true, false, true, true, false];
    const labels = ['J', 'V', 'S', 'D', 'L', 'M', 'M'];
    const week = labels.map((d, i) => {
      const today = i === 6;
      const lit = today ? done : past[i];
      return { d, fill: lit ? '#F49A2E' : 'rgba(255,255,255,.08)', stroke: lit ? '#F49A2E' : 'rgba(255,255,255,.25)', weight: today ? 700 : 500, color: today ? '#FFFFFF' : 'rgba(255,255,255,.55)' };
    });
    const sparks = [['70px', '-14px', '0s'], ['92px', '6px', '.3s'], ['110px', '18px', '.7s'], ['84px', '-24px', '1s'], ['118px', '-4px', '.5s']].map(([x, dx, delay]) => ({ x, dx, delay }));
    const courseDefs = edt ? [['8h', 'Le cœur', 'Physiologie', C.phy], ['10h', 'Membre inférieur', 'Anatomie', C.ana], ['14h', 'Interactions', 'Pharmacologie', C.pha]] : [];
    const courses = courseDefs.map(([hour, title, subject, color], i) => {
      const ok = !!this.state.added[i];
      return { hour, title, subject, color, done: ok, todo: !ok, add: () => this.setState({ added: { ...this.state.added, [i]: true } }) };
    });
    return {
      kicker, heroTitle, subLine, dots, steps, week, sparks, courses,
      canStart: !done && count > 0, isDone: done, notDone: !done,
      showSteps: nouvel && !done, showFlame: !(nouvel && !done),
      flameLabel: done ? 'Flamme allumée' : 'La flamme s’allume à la fin de ta session',
      toggleDone: () => this.setState({ done: !done }),
      noEdt: !edt, dropLabel: edt ? 'Autre cours' : 'Ajouter un cours'
    };
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
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "44px 56px 56px", display: "flex", flexDirection: "column", gap: "36px"}}>
        <section aria-label={"Session du jour"} style={{display: "flex", alignItems: "center", gap: "56px", minHeight: "420px", boxSizing: "border-box", padding: "56px", borderRadius: "24px", background: "#15304E", color: "#FFFFFF"}}>
          <div style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px"}}>
            <span style={{fontSize: "18px", color: "rgba(255,255,255,.7)"}}>
              {v.kicker}
            </span>
            <h1 style={{margin: "0", fontSize: "64px", fontWeight: "700", letterSpacing: "-.03em", lineHeight: "1"}}>
              {v.heroTitle}
            </h1>
            <span style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "18px", color: "rgba(255,255,255,.8)"}}>
              <span style={{display: "flex", gap: "5px"}}>
                {(v.dots || []).map((d: any, i_d: number) => (
                  <Fragment key={i_d}>
                    <span style={{width: "10px", height: "10px", borderRadius: "50%", background: d.c}}></span>
                  </Fragment>
                ))}
              </span>
              {v.subLine}{" "}
            </span>
            {v.canStart ? (
              <>
                <Link href={"/v2/session"} className={"mr-btn-light"} style={{alignSelf: "flex-start", marginTop: "18px", display: "inline-block", fontSize: "21px", fontWeight: "700", color: "#15304E", background: "#F4F1EA", padding: "22px 48px", borderRadius: "16px", textDecoration: "none"}}>
                  {"Lancer ma session"}
                </Link>
              </>
            ) : null}
            {v.isDone ? (
              <>
                <Link href={"/v2/session"} className={"mr-ghost-dark"} style={{alignSelf: "flex-start", marginTop: "18px", display: "inline-block", fontSize: "18px", fontWeight: "700", color: "#FFFFFF", background: "rgba(255,255,255,.1)", padding: "18px 32px", borderRadius: "14px", textDecoration: "none"}}>
                  {"Continuer \u00e0 r\u00e9viser"}
                </Link>
              </>
            ) : null}
          </div>
          {v.showSteps ? (
            <>
              <ol style={{flex: "0 0 auto", listStyle: "none", margin: "0", padding: "0 0 0 56px", borderLeft: "1px solid rgba(255,255,255,.14)", display: "flex", flexDirection: "column", gap: "22px"}}>
                {(v.steps || []).map((s: any, i_s: number) => (
                  <Fragment key={i_s}>
                    <li style={{display: "flex", alignItems: "center", gap: "16px"}}>
                      <span style={{width: "44px", height: "44px", borderRadius: "12px", background: "rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "700"}}>
                        {s.n}
                      </span>
                      <span style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                        <span style={{fontSize: "18px", fontWeight: "700"}}>
                          {s.title}
                        </span>
                        <span style={{fontSize: "15px", color: "rgba(255,255,255,.65)"}}>
                          {s.desc}
                        </span>
                      </span>
                    </li>
                  </Fragment>
                ))}
              </ol>
            </>
          ) : null}
          {v.showFlame ? (
            <>
              <div style={{flex: "0 0 340px", display: "flex", flexDirection: "column", alignItems: "center", gap: "22px"}}>
                <button type={"button"} onClick={v.toggleDone} aria-label={v.flameLabel} style={{font: "inherit", position: "relative", width: "200px", height: "200px", padding: "0", border: "0", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"}}>
                  {v.isDone ? (
                    <>
                      <span className={"mr-glow"} style={{position: "absolute", inset: "10px", borderRadius: "50%", background: "radial-gradient(circle at 50% 60%, rgba(255,170,60,.55), rgba(255,120,40,0) 65%)"}}></span>
                    </>
                  ) : null}
                  {v.isDone ? (
                    <>
                      <span style={{position: "absolute", left: "0", top: "0", width: "200px", height: "200px"}}>
                        {(v.sparks || []).map((p: any, i_p: number) => (
                          <Fragment key={i_p}>
                            <span className={"mr-spark"} style={{position: "absolute", left: p.x, top: "70px", width: "6px", height: "6px", borderRadius: "50%", background: "#FFD27A", "--dx": p.dx, animationDelay: p.delay}}></span>
                          </Fragment>
                        ))}
                      </span>
                    </>
                  ) : null}
                  {v.isDone ? (
                    <>
                      <svg className={"mr-flame-lit"} width={"150"} height={"170"} viewBox={"0 0 120 140"} aria-hidden={"true"} style={{position: "relative"}}>
                        <defs>
                          <linearGradient id={"fo"} x1={"0"} y1={"1"} x2={"0"} y2={"0"}>
                            <stop offset={"0"} stopColor={"#E8572A"} />
                            <stop offset={".6"} stopColor={"#F49A2E"} />
                            <stop offset={"1"} stopColor={"#FFC44D"} />
                          </linearGradient>
                          <linearGradient id={"fi"} x1={"0"} y1={"1"} x2={"0"} y2={"0"}>
                            <stop offset={"0"} stopColor={"#FFD66B"} />
                            <stop offset={"1"} stopColor={"#FFF6D6"} />
                          </linearGradient>
                        </defs>
                        <path className={"f-outer"} fill={"url(#fo)"} d={"M60 4C66 30 98 44 98 88a38 38 0 0 1-76 0c0-20 10-32 18-42 1 12 7 20 14 22-2-22 0-44 6-64z"} />
                        <path className={"f-inner"} fill={"url(#fi)"} d={"M60 62c4 14 20 22 20 40a20 20 0 0 1-40 0c0-12 8-20 12-26 2 8 5 10 8 10-2-10-2-18 0-24z"} />
                      </svg>
                    </>
                  ) : null}
                  {v.notDone ? (
                    <>
                      <svg width={"150"} height={"170"} viewBox={"0 0 120 140"} aria-hidden={"true"}>
                        <path fill={"rgba(255,255,255,.06)"} stroke={"rgba(255,255,255,.28)"} strokeWidth={"3"} strokeDasharray={"6 7"} strokeLinejoin={"round"} d={"M60 4C66 30 98 44 98 88a38 38 0 0 1-76 0c0-20 10-32 18-42 1 12 7 20 14 22-2-22 0-44 6-64z"} />
                      </svg>
                    </>
                  ) : null}
                </button>
                <div style={{display: "flex", gap: "12px"}}>
                  {(v.week || []).map((w: any, i_w: number) => (
                    <Fragment key={i_w}>
                      <span style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "6px"}}>
                        <svg width={"22"} height={"26"} viewBox={"0 0 120 140"} aria-hidden={"true"}>
                          <path fill={w.fill} stroke={w.stroke} strokeWidth={"8"} d={"M60 4C66 30 98 44 98 88a38 38 0 0 1-76 0c0-20 10-32 18-42 1 12 7 20 14 22-2-22 0-44 6-64z"} />
                        </svg>
                        <span style={{fontSize: "13px", fontWeight: w.weight, color: w.color}}>
                          {w.d}
                        </span>
                      </span>
                    </Fragment>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </section>
        <section aria-label={"Cours d'aujourd'hui"} style={{display: "flex", flexDirection: "column", gap: "16px"}}>
          <span style={{fontSize: "20px", fontWeight: "700"}}>
            {"Cours d'aujourd'hui"}
          </span>
          <div style={{display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px"}}>
            {(v.courses || []).map((c: any, i_c: number) => (
              <Fragment key={i_c}>
                <div style={{display: "flex", flexDirection: "column", gap: "14px", padding: "22px", borderRadius: "16px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", color: "#6B6F76"}}>
                    <span style={{width: "9px", height: "9px", borderRadius: "50%", background: c.color}}></span>
                    {c.hour}{", "}{c.subject}
                  </span>
                  <span style={{fontSize: "18px", fontWeight: "700"}}>
                    {c.title}
                  </span>
                  {c.done ? (
                    <>
                      <span style={{fontSize: "15px", fontWeight: "600", color: "#2F6B45", padding: "10px 0"}}>
                        {"Ajout\u00e9 \u2713"}
                      </span>
                    </>
                  ) : null}
                  {c.todo ? (
                    <>
                      <button type={"button"} className={"mr-btn"} onClick={c.add} style={{font: "inherit", alignSelf: "flex-start", fontSize: "15px", fontWeight: "700", color: "#15304E", background: "#E7ECF4", border: "0", padding: "11px 18px", borderRadius: "10px", cursor: "pointer"}}>
                        {"Ajouter le poly"}
                      </button>
                    </>
                  ) : null}
                </div>
              </Fragment>
            ))}
            {v.noEdt ? (
              <>
                <Link href={"/v2/calendrier"} style={{gridColumn: "span 2", display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px", padding: "22px", borderRadius: "16px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", textDecoration: "none", color: "#1A1D23"}}>
                  <span style={{fontSize: "18px", fontWeight: "700"}}>
                    {"Importe ton emploi du temps"}
                  </span>
                  <span style={{fontSize: "15px", color: "#6B6F76"}}>
                    {"Tes cours appara\u00eetront ici chaque jour"}
                  </span>
                </Link>
              </>
            ) : null}
            <button type={"button"} className={"mr-drop"} style={{font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "22px", borderRadius: "16px", border: "2px dashed #D9D3C7", background: "transparent", color: "#1A1D23", cursor: "pointer"}}>
              <span style={{fontSize: "28px", lineHeight: "1", color: "#15304E"}}>
                {"+"}
              </span>
              <span style={{fontSize: "16px", fontWeight: "700"}}>
                {v.dropLabel}
              </span>
            </button>
          </div>
        </section>
      </main>
    </div>
    </>
  )
}
