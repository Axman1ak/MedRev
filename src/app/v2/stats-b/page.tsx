// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#15304E}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.12);transform:translateY(-1px)}\n.mr-row{transition:background .15s ease}\n.mr-row:hover{background:#F8F6F1}\n@keyframes mr-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n@keyframes mr-fill{from{width:0}}\n@keyframes mr-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-bar{animation:mr-fill 1.1s cubic-bezier(.2,.8,.2,1) .3s both}\n.mr-grow{transform-origin:bottom;animation:mr-grow .6s cubic-bezier(.2,.8,.2,1) both}\n"

class Logic extends DCLogic {
  renderVals() {
    const kpis = [['Maîtrise globale', '58 %', '15 fiches sur 26', '#15304E', '#FFFFFF'], ['Réussite QCM', '68 %', '+4 pts ce mois', '#FFFFFF', '#1A1D23'], ['Temps de révision', '6 h 40', 'cette semaine', '#FFFFFF', '#1A1D23'], ['Partiel blanc', '12,8/20', 'dernier, 2 nov.', '#FFFFFF', '#1A1D23']]
      .map(([l, v, s, bg, fg], i) => ({ l, v, s, bg, fg, delay: (i * 0.06) + 's' }));
    const rows = [
      ['Biostatistiques', '#9C7148', 0, '—', 'pas encore', 'Commencer', true],
      ['Pharmacologie', '#D08A3E', 50, '46 %', '28e centile', 'Réviser', true],
      ['Biophysique', '#C4554D', 50, '41 %', '22e centile', 'Réviser', true],
      ['Anatomie spécifique', '#4F7CC9', 60, '70 %', '64e centile', 'Réviser', false],
      ['Physiologie', '#8B6BB8', 67, '74 %', '71e centile', 'Réviser', false],
      ['Santé, Société, Humanité', '#3E8E85', 100, '88 %', '92e centile', 'Entretenir', false]
    ].map(([name, color, m, q, rank, cta, weak]) => {
      const qn = parseInt(q, 10);
      return { name, color, m: m + '%', q, rank, cta, qColor: isNaN(qn) ? '#9AA0A8' : (qn < 50 ? '#B4533A' : '#1A1D23'), btnBg: weak ? '#15304E' : '#F1EEE7', btnFg: weak ? '#FFFFFF' : '#15304E' };
    });
    const counts = [1, 2, 4, 7, 11, 17, 24, 31, 38, 42, 44, 41, 36, 29, 22, 15, 9, 5, 3, 1];
    const curve = counts.map((c, i) => ({ h: Math.round(c / 44 * 100) + '%', bg: i === 13 ? '#F4C35A' : '#D3DEEC', d: (0.2 + i * 0.03).toFixed(2) + 's' }));
    return { kpis, rows, curve };
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
            {"Option B, mati\u00e8re par mati\u00e8re"}
          </span>
        </header>
        <div style={{display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px"}}>
          {(v.kpis || []).map((k: any, i_k: number) => (
            <Fragment key={i_k}>
              <div className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "4px", padding: "22px 24px", borderRadius: "18px", background: k.bg, color: k.fg, boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: k.delay}}>
                <span style={{fontSize: "15px", opacity: ".7"}}>
                  {k.l}
                </span>
                <span style={{fontSize: "32px", fontWeight: "700", letterSpacing: "-.02em"}}>
                  {k.v}
                </span>
                <span style={{fontSize: "14px", opacity: ".7"}}>
                  {k.s}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
        <div style={{display: "flex", gap: "24px", alignItems: "flex-start"}}>
          <section className={"mr-rise"} style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", padding: "10px 14px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: ".15s"}}>
            <div style={{display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 2fr) 90px 110px 170px", gap: "18px", padding: "16px 14px", fontSize: "14px", color: "#6B6F76"}}>
              <span>
                {"De la plus faible \u00e0 la plus forte"}
              </span>
              <span>
                {"Ma\u00eetrise"}
              </span>
              <span>
                {"QCM"}
              </span>
              <span>
                {"Dans ta promo"}
              </span>
              <span></span>
            </div>
            {(v.rows || []).map((r: any, i_r: number) => (
              <Fragment key={i_r}>
                <div className={"mr-row"} style={{display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 2fr) 90px 110px 170px", gap: "18px", alignItems: "center", padding: "18px 14px", borderTop: "1px solid #F1EEE7", borderRadius: "10px"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "17px", fontWeight: "600"}}>
                    <span style={{width: "11px", height: "11px", borderRadius: "50%", background: r.color}}></span>
                    {r.name}
                  </span>
                  <span style={{display: "flex", alignItems: "center", gap: "12px"}}>
                    <span style={{flex: "1", height: "10px", borderRadius: "5px", background: "#F1EEE7", overflow: "hidden"}}>
                      <span className={"mr-bar"} style={{display: "block", height: "10px", borderRadius: "5px", width: r.m, background: r.color}}></span>
                    </span>
                    <span style={{width: "44px", fontSize: "16px", fontWeight: "700"}}>
                      {r.m}
                    </span>
                  </span>
                  <span style={{fontSize: "16px", fontWeight: "600", color: r.qColor}}>
                    {r.q}
                  </span>
                  <span style={{fontSize: "15px", color: "#3D424A"}}>
                    {r.rank}
                  </span>
                  <Link href={"/v2/session"} className={"mr-btn"} style={{justifySelf: "end", fontSize: "14px", fontWeight: "700", color: r.btnFg, background: r.btnBg, padding: "10px 16px", borderRadius: "10px", textDecoration: "none"}}>
                    {r.cta}
                  </Link>
                </div>
              </Fragment>
            ))}
          </section>
          <section className={"mr-rise"} style={{flex: "0 0 400px", display: "flex", flexDirection: "column", gap: "14px", padding: "26px 28px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: ".25s"}}>
            <span style={{fontSize: "18px", fontWeight: "700"}}>
              {"Toi face \u00e0 ta promo"}
            </span>
            <span style={{fontSize: "15px", color: "#6B6F76"}}>
              {"R\u00e9ussite aux QCM des 412 \u00e9tudiants MedRev de ta fac"}
            </span>
            <div style={{display: "flex", alignItems: "flex-end", gap: "4px", height: "170px", borderBottom: "1px solid #EDE9E1"}}>
              {(v.curve || []).map((c: any, i_c: number) => (
                <Fragment key={i_c}>
                  <span className={"mr-grow"} style={{flex: "1", height: c.h, borderRadius: "4px 4px 0 0", background: c.bg, animationDelay: c.d}}></span>
                </Fragment>
              ))}
            </div>
            <span style={{display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#9AA0A8"}}>
              <span>
                {"0 %"}
              </span>
              <span>
                {"100 %"}
              </span>
            </span>
            <span style={{fontSize: "16px"}}>
              <span style={{fontWeight: "700"}}>
                {"Tu fais mieux que 71 %"}
              </span>
              {" des \u00e9tudiants de ta fac."}
            </span>
          </section>
        </div>
      </main>
    </div>
    </>
  )
}
