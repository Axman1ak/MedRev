// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#15304E}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.12);transform:translateY(-1px)}\n.mr-lift{transition:transform .2s ease, box-shadow .2s ease}\n.mr-lift:hover{transform:translateY(-3px);box-shadow:0 2px 4px rgba(26,29,35,.06),0 14px 30px rgba(26,29,35,.09) !important}\n@keyframes mr-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n@keyframes mr-ring{from{stroke-dashoffset:540}}\n@keyframes mr-fill{from{width:0}}\n@keyframes mr-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-ring{animation:mr-ring 1.6s cubic-bezier(.2,.8,.2,1) .2s both}\n.mr-bar{animation:mr-fill 1.2s cubic-bezier(.2,.8,.2,1) .4s both}\n.mr-line{stroke-dasharray:1;animation:mr-draw 1.6s ease .3s both}\n"

class Logic extends DCLogic {
  renderVals() {
    const factors = [
      ['Régularité', '12 jours sur 14', 86, '#4E9A6B', 'Très bien', '#E8F1EA', '#2F6B45', 'Tu révises presque tous les jours, c’est ce qui compte le plus.', 'Voir le calendrier', '/v2/calendrier'],
      ['Réussite aux QCM', '68 %', 68, '#E2AE6A', 'Correct', '#F6EEDC', '#8A6420', 'La pharmaco tire ta moyenne vers le bas, 46 % de réussite.', 'Faire des QCM de pharmaco', '/v2/simulateur'],
      ['Fiches en retard', '6 fiches', 30, '#D98C7E', 'À rattraper', '#F7E4E0', '#A0443A', 'Chaque jour de retard te fait oublier un peu plus.', 'Rattraper maintenant', '/v2/session']
    ].map(([title, value, p, color, tag, tagBg, tagFg, text, cta, href], i) => ({ title, value, pct: p + '%', color, tag, tagBg, tagFg, text, cta, href, delay: (0.15 + i * 0.08) + 's' }));
    return { factors };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "100vh", display: "flex"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="2" />
      </div>
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "44px 56px 56px", display: "flex", flexDirection: "column", gap: "28px"}}>
        <header style={{display: "flex", alignItems: "baseline", justifyContent: "space-between"}}>
          <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
            {"Statistiques"}
          </h1>
          <span style={{fontSize: "15px", color: "#6B6F76"}}>
            {"Option A, un score unique"}
          </span>
        </header>
        <div style={{display: "flex", gap: "24px", alignItems: "stretch"}}>
          <section className={"mr-rise"} style={{flex: "0 0 520px", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", padding: "36px", borderRadius: "22px", background: "#15304E", color: "#FFFFFF"}}>
            <span style={{fontSize: "16px", color: "rgba(255,255,255,.7)"}}>
              {"Ta m\u00e9moire aujourd\u2019hui"}
            </span>
            <div style={{position: "relative", width: "220px", height: "220px"}}>
              <svg width={"220"} height={"220"} viewBox={"0 0 200 200"} aria-hidden={"true"} style={{transform: "rotate(-90deg)"}}>
                <circle cx={"100"} cy={"100"} r={"86"} fill={"none"} stroke={"rgba(255,255,255,.12)"} strokeWidth={"14"} />
                <circle className={"mr-ring"} cx={"100"} cy={"100"} r={"86"} fill={"none"} stroke={"#F4C35A"} strokeWidth={"14"} strokeLinecap={"round"} strokeDasharray={"540"} strokeDashoffset={"140"} />
              </svg>
              <span style={{position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"}}>
                <span style={{fontSize: "64px", fontWeight: "700", letterSpacing: "-.03em", lineHeight: "1"}}>
                  {"74"}
                </span>
                <span style={{fontSize: "15px", color: "rgba(255,255,255,.7)"}}>
                  {"sur 100"}
                </span>
              </span>
            </div>
            <span style={{fontSize: "20px", fontWeight: "700", textAlign: "center"}}>
              {"Tu retiens bien ce que tu r\u00e9vises"}
            </span>
            <span style={{fontSize: "16px", color: "rgba(255,255,255,.75)", textAlign: "center"}}>
              {"+3 points cette semaine"}
            </span>
          </section>
          <section className={"mr-rise"} style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px", padding: "28px 32px", borderRadius: "22px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: ".1s"}}>
            <span style={{display: "flex", justifyContent: "space-between"}}>
              <span style={{fontSize: "18px", fontWeight: "700"}}>
                {"Ton score sur 30 jours"}
              </span>
              <span style={{fontSize: "15px", color: "#6B6F76"}}>
                {"de 61 \u00e0 74"}
              </span>
            </span>
            <svg viewBox={"0 0 800 260"} width={"100%"} aria-hidden={"true"} style={{display: "block"}}>
              <path d={"M0 230 H800 M0 160 H800 M0 90 H800"} stroke={"#F1EEE7"} strokeWidth={"1"} />
              <path className={"mr-line"} pathLength={"1"} d={"M0 190 C60 186 90 176 130 180 S210 160 250 166 S330 140 370 150 S450 128 490 132 S570 108 610 118 S700 92 740 90 S790 84 800 82"} fill={"none"} stroke={"#15304E"} strokeWidth={"4"} strokeLinecap={"round"} />
              <circle cx={"800"} cy={"82"} r={"7"} fill={"#F4C35A"} stroke={"#FFFFFF"} strokeWidth={"3"} />
            </svg>
            <span style={{display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#9AA0A8"}}>
              <span>
                {"6 oct."}
              </span>
              <span>
                {"aujourd\u2019hui"}
              </span>
            </span>
          </section>
        </div>
        <span style={{fontSize: "18px", fontWeight: "700"}}>
          {"Ce qui fait bouger ton score"}
        </span>
        <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "20px"}}>
          {(v.factors || []).map((f: any, i_f: number) => (
            <Fragment key={i_f}>
              <section className={"mr-rise mr-lift"} style={{display: "flex", flexDirection: "column", gap: "14px", padding: "26px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: f.delay}}>
                <span style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                  <span style={{fontSize: "17px", fontWeight: "700"}}>
                    {f.title}
                  </span>
                  <span style={{fontSize: "13px", fontWeight: "700", color: f.tagFg, background: f.tagBg, padding: "4px 10px", borderRadius: "999px"}}>
                    {f.tag}
                  </span>
                </span>
                <span style={{fontSize: "34px", fontWeight: "700", letterSpacing: "-.02em"}}>
                  {f.value}
                </span>
                <span style={{height: "8px", borderRadius: "4px", background: "#F1EEE7", overflow: "hidden"}}>
                  <span className={"mr-bar"} style={{display: "block", height: "8px", borderRadius: "4px", width: f.pct, background: f.color}}></span>
                </span>
                <span style={{fontSize: "15px", color: "#6B6F76"}}>
                  {f.text}
                </span>
                <a href={f.href} className={"mr-btn"} style={{alignSelf: "flex-start", fontSize: "15px", fontWeight: "700", color: "#15304E", background: "#F1EEE7", padding: "10px 16px", borderRadius: "10px", textDecoration: "none"}}>
                  {f.cta}
                </a>
              </section>
            </Fragment>
          ))}
        </div>
      </main>
    </div>
    </>
  )
}
