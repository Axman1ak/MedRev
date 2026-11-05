// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#15304E}\n.mr-lift{transition:transform .2s ease, box-shadow .2s ease}\n.mr-lift:hover{transform:translateY(-3px);box-shadow:0 2px 4px rgba(26,29,35,.06),0 14px 30px rgba(26,29,35,.09) !important}\n.mr-tab:hover{color:#1A1D23}\n@keyframes mr-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n@keyframes mr-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-grow{transform-origin:bottom;animation:mr-grow .6s cubic-bezier(.2,.8,.2,1) both}\n"

class Logic extends DCLogic {
  renderVals() {
    const big = [['5', 'sessions sur 6'], ['6 h 40', 'de révision'], ['31', 'fiches revues']].map(([v, l]) => ({ v, l }));
    const mins = [55, 80, 0, 95, 70, 40, 60];
    const names = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
    const days = mins.map((m, i) => ({ d: names[i], t: m ? (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m + ' min') : 'repos', h: Math.max(4, Math.round(m / 95 * 100)) + '%', bg: i === 3 ? '#15304E' : (m ? '#A9BFDB' : '#ECE8E0'), w: i === 3 ? 700 : 500, c: i === 3 ? '#15304E' : '#6B6F76', delay: (0.2 + i * 0.06).toFixed(2) + 's' }));
    const cards = [
      ['PROGRÈS', 'Physiologie, +12 points', 'Ta matière qui a le plus progressé cette semaine.', '#FFFFFF', '#2F6B45'],
      ['À SURVEILLER', 'Pharmacologie, 46 %', 'Encore en dessous de la moyenne aux QCM.', '#FFFFFF', '#B4533A'],
      ['TON MOMENT', 'Le matin', 'Tu réussis 78 % des QCM avant midi, 54 % le soir.', '#FFFFFF', '#15304E'],
      ['RECORD', '95 minutes jeudi', 'Ta plus longue session depuis la rentrée.', '#FDF3DC', '#8A5A08']
    ].map(([kicker, title, text, bg, kickerColor], i) => ({ kicker, title, text, bg, kickerColor, delay: (0.15 + i * 0.07) + 's' }));
    return { big, days, cards };
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
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "44px 56px 56px", display: "flex", flexDirection: "column", gap: "24px"}}>
        <header style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
          <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
            <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
              {"Ta semaine"}
            </h1>
            <span style={{fontSize: "15px", color: "#6B6F76"}}>
              {"Option C, le r\u00e9cap de la semaine"}
            </span>
          </span>
          <span style={{display: "flex", alignItems: "center", gap: "10px", fontSize: "16px", fontWeight: "600"}}>
            <span style={{padding: "10px 14px", borderRadius: "10px", background: "#FFFFFF", color: "#6B6F76"}}>
              {"\u2190"}
            </span>
            {"Du 2 au 8 novembre"}
            <span style={{padding: "10px 14px", borderRadius: "10px", background: "#FFFFFF", color: "#C9C3B8"}}>
              {"\u2192"}
            </span>
          </span>
        </header>
        <section className={"mr-rise"} style={{display: "flex", alignItems: "center", gap: "48px", padding: "34px 40px", borderRadius: "22px", background: "#15304E", color: "#FFFFFF"}}>
          <span style={{flex: "1", display: "flex", flexDirection: "column", gap: "8px"}}>
            <span style={{fontSize: "16px", color: "rgba(255,255,255,.7)"}}>
              {"En bref"}
            </span>
            <span style={{fontSize: "30px", fontWeight: "700", lineHeight: "1.25", letterSpacing: "-.01em"}}>
              {"Ta meilleure semaine depuis la rentr\u00e9e."}
            </span>
          </span>
          {(v.big || []).map((b: any, i_b: number) => (
            <Fragment key={i_b}>
              <span style={{display: "flex", flexDirection: "column", gap: "2px", minWidth: "140px"}}>
                <span style={{fontSize: "42px", fontWeight: "700", letterSpacing: "-.02em"}}>
                  {b.v}
                </span>
                <span style={{fontSize: "15px", color: "rgba(255,255,255,.7)"}}>
                  {b.l}
                </span>
              </span>
            </Fragment>
          ))}
        </section>
        <div style={{display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: "20px"}}>
          <section className={"mr-rise"} style={{gridRow: "span 2", display: "flex", flexDirection: "column", gap: "16px", padding: "28px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: ".1s"}}>
            <span style={{fontSize: "18px", fontWeight: "700"}}>
              {"Jour par jour"}
            </span>
            <div style={{flex: "1", display: "flex", alignItems: "flex-end", gap: "14px", minHeight: "260px"}}>
              {(v.days || []).map((d: any, i_d: number) => (
                <Fragment key={i_d}>
                  <span style={{flex: "1", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: "8px"}}>
                    <span style={{fontSize: "13px", fontWeight: "700", color: "#6B6F76"}}>
                      {d.t}
                    </span>
                    <span className={"mr-grow"} style={{width: "100%", height: d.h, borderRadius: "8px 8px 0 0", background: d.bg, animationDelay: d.delay}}></span>
                    <span style={{fontSize: "14px", fontWeight: d.w, color: d.c}}>
                      {d.d}
                    </span>
                  </span>
                </Fragment>
              ))}
            </div>
          </section>
          {(v.cards || []).map((c: any, i_c: number) => (
            <Fragment key={i_c}>
              <section className={"mr-rise mr-lift"} style={{display: "flex", flexDirection: "column", gap: "10px", padding: "24px 26px", borderRadius: "20px", background: c.bg, boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: c.delay}}>
                <span style={{fontSize: "14px", fontWeight: "700", color: c.kickerColor, letterSpacing: ".02em"}}>
                  {c.kicker}
                </span>
                <span style={{fontSize: "24px", fontWeight: "700", letterSpacing: "-.01em"}}>
                  {c.title}
                </span>
                <span style={{fontSize: "15px", color: "#6B6F76"}}>
                  {c.text}
                </span>
              </section>
            </Fragment>
          ))}
        </div>
      </main>
    </div>
    </>
  )
}
