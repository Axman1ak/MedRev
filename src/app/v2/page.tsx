// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {"fiches": "beaucoup"}

const CSS = "\n\na{color:#15304E}a:hover{color:#0F1E36}\n.mr-row{transition:background .12s ease}\n.mr-row:hover{background:#F6F4EF}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}\n.mr-btn:active{transform:scale(.97)}\n.mr-tile{transition:transform .15s ease}\n.mr-tile:hover{transform:scale(1.25)}\n@keyframes mr-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}\n@keyframes mr-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-pop{animation:mr-pop .35s cubic-bezier(.2,.8,.2,1) both}\n"

class Logic extends DCLogic {
  renderVals() {
    const mode = this.props.fiches ?? 'beaucoup';
    const C = { bio: '#C4554D', ana: '#4F7CC9', phy: '#8B6BB8', stat: '#9C7148', pha: '#D08A3E', ssh: '#3E8E85' };
    const all = [
      ['Cerveau, vascularisation', 'Anatomie spécifique', C.ana, '44 j de retard'],
      ['Nerfs crâniens', 'Anatomie spécifique', C.ana, '44 j de retard'],
      ['Pharmacocinétique', 'Pharmacologie', C.pha, '44 j de retard'],
      ['Tronc cérébral', 'Anatomie spécifique', C.ana, '42 j de retard'],
      ['Optique géométrique', 'Biophysique', C.bio, '41 j de retard'],
      ['Potentiel d’action', 'Physiologie', C.phy, '36 j de retard'],
      ['Récepteurs et ligands', 'Pharmacologie', C.pha, 'J+7'],
      ['Éthique médicale', 'Santé, Société, Humanité', C.ssh, 'J+3'],
      ['Tests statistiques', 'Biostatistiques', C.stat, 'J+1'],
      ['Fonction rénale', 'Physiologie', C.phy, 'J+15'],
      ['Membre supérieur', 'Anatomie spécifique', C.ana, 'J+21']
    ];
    const list = mode === 'beaucoup' ? all : (mode === 'peu' ? all.slice(6, 9) : []);
    const fiches = list.map(([title, subject, color, tag], i) => {
      const late = tag.indexOf('retard') > -1;
      return { title, subject, color, tag, tagBg: late ? '#F6EEDC' : '#EEF2F8', tagColor: late ? '#8A6420' : '#2F5D8A', delay: (0.1 + i * 0.04).toFixed(2) + 's' };
    });
    const n = list.length;
    const stats = [['4 j', 'd’affilée'], ['6 h 40', 'cette semaine'], ['16/26', 'fiches maîtrisées']].map(([v, l], i) => ({ v, l, bg: i === 0 ? '#15304E' : '#FDFCFA', fg: i === 0 ? '#FFFFFF' : '#1A1D23' }));
    const shades = ['#EEEAE2', '#C9D6E8', '#8EA8CC', '#4F72A3', '#15304E'];
    const heat = Array.from({ length: 112 }, (_, i) => {
      const r = Math.abs(Math.sin((i + 1) * 7.31)) % 1;
      const recent = i / 112;
      let lvl = r < 0.28 ? 0 : Math.min(4, Math.floor(r * 4 + recent * 1.6));
      if (i > 107) lvl = 0;
      if (i === 107) lvl = 3;
      const mins = [0, 25, 50, 80, 110][lvl];
      return { bg: shades[lvl], t: mins ? mins + ' min de révision' : 'pas de session', d: (0.2 + i * 0.004).toFixed(3) + 's' };
    });
    const tasks = [
      { title: 'Imprimer le poly de pharmaco', when: 'aujourd’hui' },
      { title: 'Rendre le TD de biophysique', when: 'ven.' },
      { title: 'Relire les annales d’anatomie', when: 'sam.' }
    ];
    return {
      fiches, stats, heat, tasks,
      title: n ? n + (n > 1 ? ' fiches à réviser' : ' fiche à réviser') : 'Rien à réviser aujourd’hui',
      sub: n ? (mode === 'beaucoup' ? 'Dont 6 en retard, commence par elles' : 'Environ 1 h') : 'Profites en pour avancer sur ta liste à faire'
    };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "100vh", display: "flex"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="0" />
      </div>
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "44px 56px 56px", display: "flex", flexDirection: "column", gap: "28px"}}>
        <header className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "4px"}}>
          <span style={{fontSize: "15px", color: "#6B6F76"}}>
            {"Jeudi 5 novembre"}
          </span>
          <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
            {"Bonjour Lou"}
          </h1>
        </header>
        <div style={{display: "flex", gap: "28px", alignItems: "flex-start"}}>
          <section aria-label={"À réviser aujourd'hui"} className={"mr-rise"} style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", padding: "28px 30px 16px", borderRadius: "20px", background: "#FDFCFA", boxShadow: "0 0 0 1px #ECE8DF", animationDelay: ".05s"}}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", paddingBottom: "18px"}}>
              <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
                <span style={{fontSize: "26px", fontWeight: "700", letterSpacing: "-.01em"}}>
                  {v.title}
                </span>
                <span style={{fontSize: "15px", color: "#6B6F76"}}>
                  {v.sub}
                </span>
              </span>
              <Link href={"/v2/session"} className={"mr-btn"} style={{fontSize: "17px", fontWeight: "700", color: "#FFFFFF", background: "#15304E", padding: "15px 30px", borderRadius: "12px", textDecoration: "none"}}>
                {"Commencer"}
              </Link>
            </div>
            {(v.fiches || []).map((f: any, i_f: number) => (
              <Fragment key={i_f}>
                <Link href={"/v2/session"} className={"mr-row mr-rise"} style={{display: "flex", alignItems: "center", gap: "16px", padding: "15px 12px", borderTop: "1px solid #F1EEE7", borderRadius: "10px", textDecoration: "none", color: "inherit", animationDelay: f.delay}}>
                  <span style={{width: "10px", height: "10px", borderRadius: "50%", background: f.color, flex: "none"}}></span>
                  <span style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px"}}>
                    <span style={{fontSize: "16px", fontWeight: "600"}}>
                      {f.title}
                    </span>
                    <span style={{fontSize: "14px", color: "#6B6F76"}}>
                      {f.subject}
                    </span>
                  </span>
                  <span style={{fontSize: "14px", fontWeight: "600", color: f.tagColor, background: f.tagBg, padding: "5px 11px", borderRadius: "999px", whiteSpace: "nowrap"}}>
                    {f.tag}
                  </span>
                </Link>
              </Fragment>
            ))}
          </section>
          <aside style={{flex: "0 0 420px", display: "flex", flexDirection: "column", gap: "20px"}}>
            <div className={"mr-rise"} style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", animationDelay: ".1s"}}>
              {(v.stats || []).map((s: any, i_s: number) => (
                <Fragment key={i_s}>
                  <Link href={"/v2/statistiques"} style={{display: "flex", flexDirection: "column", gap: "4px", padding: "18px", borderRadius: "16px", background: s.bg, color: s.fg, textDecoration: "none", boxShadow: "0 0 0 1px #ECE8DF"}}>
                    <span style={{fontSize: "26px", fontWeight: "700", letterSpacing: "-.01em"}}>
                      {s.v}
                    </span>
                    <span style={{fontSize: "13px", opacity: ".72"}}>
                      {s.l}
                    </span>
                  </Link>
                </Fragment>
              ))}
            </div>
            <section aria-label={"Ton activité"} className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "14px", padding: "22px 24px", borderRadius: "18px", background: "#FDFCFA", boxShadow: "0 0 0 1px #ECE8DF", animationDelay: ".15s"}}>
              <span style={{display: "flex", justifyContent: "space-between", alignItems: "baseline"}}>
                <span style={{fontSize: "17px", fontWeight: "700"}}>
                  {"Ton activit\u00e9"}
                </span>
                <span style={{fontSize: "13px", color: "#6B6F76"}}>
                  {"16 derni\u00e8res semaines"}
                </span>
              </span>
              <div style={{display: "flex", gap: "8px"}}>
                <div style={{display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "1px 0", fontSize: "11px", color: "#9AA0A8"}}>
                  <span>
                    {"L"}
                  </span>
                  <span>
                    {"M"}
                  </span>
                  <span>
                    {"V"}
                  </span>
                  <span>
                    {"D"}
                  </span>
                </div>
                <div style={{flex: "1", display: "grid", gridTemplateColumns: "repeat(16, minmax(0, 1fr))", gridAutoFlow: "column", gridTemplateRows: "repeat(7, 14px)", gap: "4px"}}>
                  {(v.heat || []).map((h: any, i_h: number) => (
                    <Fragment key={i_h}>
                      <span className={"mr-tile mr-pop"} title={h.t} style={{borderRadius: "3px", background: h.bg, animationDelay: h.d}}></span>
                    </Fragment>
                  ))}
                </div>
              </div>
              <span style={{display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", fontSize: "12px", color: "#9AA0A8"}}>
                {"Moins "}
                <span style={{width: "11px", height: "11px", borderRadius: "3px", background: "#EEEAE2"}}></span>
                <span style={{width: "11px", height: "11px", borderRadius: "3px", background: "#C9D6E8"}}></span>
                <span style={{width: "11px", height: "11px", borderRadius: "3px", background: "#8EA8CC"}}></span>
                <span style={{width: "11px", height: "11px", borderRadius: "3px", background: "#4F72A3"}}></span>
                <span style={{width: "11px", height: "11px", borderRadius: "3px", background: "#15304E"}}></span>
                {"Plus"}
              </span>
            </section>
            <section aria-label={"À faire"} className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "2px", padding: "22px 24px 14px", borderRadius: "18px", background: "#FDFCFA", boxShadow: "0 0 0 1px #ECE8DF", animationDelay: ".2s"}}>
              <span style={{fontSize: "17px", fontWeight: "700", paddingBottom: "8px"}}>
                {"\u00c0 faire"}
              </span>
              {(v.tasks || []).map((t: any, i_t: number) => (
                <Fragment key={i_t}>
                  <label className={"mr-row"} style={{display: "flex", alignItems: "center", gap: "12px", padding: "10px 8px", borderRadius: "8px", fontSize: "15px", cursor: "pointer"}}>
                    <input type={"checkbox"} style={{margin: "0", width: "17px", height: "17px", accentColor: "#15304E"}} />
                    <span style={{flex: "1"}}>
                      {t.title}
                    </span>
                    <span style={{fontSize: "13px", color: "#6B6F76"}}>
                      {t.when}
                    </span>
                  </label>
                </Fragment>
              ))}
              <label style={{display: "flex", alignItems: "center", gap: "12px", padding: "10px 8px", fontSize: "15px", color: "#6B6F76"}}>
                <span aria-hidden={"true"} style={{width: "17px", textAlign: "center", fontSize: "18px", lineHeight: "1"}}>
                  {"+"}
                </span>
                <input type={"text"} aria-label={"Ajouter une tâche"} placeholder={"Ajouter une tâche"} style={{font: "inherit", border: "0", background: "transparent", outline: "none", flex: "1", minWidth: "0", color: "#1A1D23"}} />
              </label>
            </section>
          </aside>
        </div>
      </main>
    </div>
    </>
  )
}
