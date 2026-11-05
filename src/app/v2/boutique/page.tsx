// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#15304E}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.12);transform:translateY(-1px)}\n.mr-btn:active{transform:scale(.96)}\n.mr-lift{transition:transform .2s ease, box-shadow .2s ease}\n.mr-lift:hover{transform:translateY(-4px);box-shadow:0 2px 4px rgba(26,29,35,.06),0 16px 32px rgba(26,29,35,.10) !important}\n.mr-lift:hover .mr-art{transform:scale(1.1) rotate(-4deg)}\n.mr-art{transition:transform .3s cubic-bezier(.2,.8,.2,1)}\n@keyframes mr-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n@keyframes mr-pop{0%{transform:scale(.92)}50%{transform:scale(1.06)}100%{transform:scale(1)}}\n@keyframes mr-flicker{0%,100%{transform:scale(1,1) rotate(-2deg)}50%{transform:scale(1.05,.95) rotate(2deg)}}\n@keyframes mr-count{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1)}}\n@keyframes mr-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-bought{animation:mr-pop .45s ease both}\n.mr-fl{transform-origin:50% 100%;animation:mr-flicker 1.8s ease-in-out infinite}\n.mr-bump{animation:mr-count .45s ease both}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { owned: { gel: 1, orange: true, creme: true }, active: { flame: 'orange', theme: 'creme' }, spent: 0, last: null };
  }
  renderVals() {
    const st = this.state;
    const balance = 240 - st.spent;
    const FL = { orange: '/v2/assets/flame.svg', bleue: '/v2/assets/flame-bleue.svg', verte: '/v2/assets/flame-verte.svg', violette: '/v2/assets/flame-violette.svg' };
    const G = [
      { title: 'Protections', sub: 'Pour garder ta flamme allumée', items: [
        ['gel', 'Gel de flamme', 'Protège ta flamme un jour sans session', 50, 'consumable', '/v2/assets/gel.svg', '#EEF3FA'],
        ['coffre', 'Coffre bonus', 'Un coffre de plus sur ton parcours', 80, 'consumable', '/v2/assets/chest.svg', '#FDF3DC']
      ] },
      { title: 'Flammes', sub: 'La couleur de ta flamme sur le parcours', items: [
        ['orange', 'Classique', 'Ta flamme de départ', 0, 'flame', FL.orange, '#FDF3DC'],
        ['bleue', 'Bleu glacier', 'Pour les nuits de révision', 120, 'flame', FL.bleue, '#EEF3FA'],
        ['verte', 'Émeraude', 'Calme et concentrée', 120, 'flame', FL.verte, '#EAF5EF'],
        ['violette', 'Améthyste', 'La plus rare', 150, 'flame', FL.violette, '#F2EEF8']
      ] },
      { title: 'Thèmes', sub: 'Les couleurs de toute l’application', items: [
        ['creme', 'Crème', 'Le thème de base', 0, 'theme', ['#FAF8F4', '#15304E', '#F49A2E'], '#F1EEE7'],
        ['nuit', 'Nuit', 'Pour réviser le soir', 200, 'theme', ['#0F1A2A', '#22344F', '#F4C35A'], '#1A2638'],
        ['sauge', 'Sauge', 'Doux pour les yeux', 200, 'theme', ['#F3F6F1', '#2F5A47', '#E2A04A'], '#E6EDE4'],
        ['lavande', 'Lavande', 'Tout en douceur', 200, 'theme', ['#F6F4FA', '#3B3366', '#E58FA0'], '#ECE8F5']
      ] }
    ];
    let k = 0;
    const shop = G.map((g) => ({
      title: g.title, sub: g.sub,
      items: g.items.map(([id, name, desc, price, kind, art, previewBg]) => {
        const owned = st.owned[id];
        const group = kind === 'flame' ? 'flame' : (kind === 'theme' ? 'theme' : null);
        const active = group && st.active[group] === id;
        const afford = balance >= price;
        let btn, btnBg, btnFg, cursor = 'pointer', buy, showGem = false;
        if (kind === 'consumable') {
          btn = String(price); showGem = true; btnBg = afford ? '#15304E' : '#ECE8E0'; btnFg = afford ? '#FFFFFF' : '#9AA0A8';
          buy = () => afford && this.setState({ spent: st.spent + price, owned: { ...st.owned, [id]: (owned || 0) + 1 }, last: id });
        } else if (active) { btn = 'Utilisé'; btnBg = '#E8F1EA'; btnFg = '#2F6B45'; cursor = 'default'; buy = () => {}; }
        else if (owned) { btn = 'Utiliser'; btnBg = '#F1EEE7'; btnFg = '#15304E'; buy = () => this.setState({ active: { ...st.active, [group]: id }, last: id }); }
        else { btn = String(price); showGem = true; btnBg = afford ? '#15304E' : '#ECE8E0'; btnFg = afford ? '#FFFFFF' : '#9AA0A8'; buy = () => afford && this.setState({ spent: st.spent + price, owned: { ...st.owned, [id]: true }, active: { ...st.active, [group]: id }, last: id }); }
        return {
          name, desc: kind === 'consumable' && owned ? desc + '. ' + owned + ' en réserve' : desc, previewBg, btn, btnBg, btnFg, cursor, buy, showGem,
          border: active ? '#15304E' : 'transparent', anim: st.last === id ? 'mr-bought' : '', delay: (k++ * 0.05) + 's',
          hasImg: kind !== 'theme', isTheme: kind === 'theme',
          img: kind !== 'theme' ? art : '', imgW: kind === 'flame' ? '70px' : '96px', imgH: kind === 'flame' ? '82px' : '96px', imgClass: kind === 'flame' ? 'mr-fl' : '',
          swatches: kind === 'theme' ? art.map((c) => ({ c })) : []
        };
      })
    }));
    return { shop, balance: String(balance), balanceAnim: st.spent ? 'mr-bump' : '' };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "100vh", display: "flex"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="9" />
      </div>
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "40px 56px 64px", display: "flex", flexDirection: "column", gap: "32px"}}>
        <Link href={"/v2"} style={{alignSelf: "flex-start", fontSize: "15px", fontWeight: "600", textDecoration: "none", color: "#6B6F76"}}>
          {"\u2190 Aujourd\u2019hui"}
        </Link>
        <section className={"mr-rise"} style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "32px", padding: "30px 36px", borderRadius: "22px", background: "#15304E", color: "#FFFFFF"}}>
          <span style={{display: "flex", flexDirection: "column", gap: "6px"}}>
            <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
              {"Boutique"}
            </h1>
            <span style={{fontSize: "16px", color: "rgba(255,255,255,.72)"}}>
              {"Gagne des \u00e9clats en ouvrant les coffres et en r\u00e9ussissant tes d\u00e9fis."}
            </span>
          </span>
          <span style={{display: "flex", alignItems: "center", gap: "14px", padding: "14px 22px", borderRadius: "16px", background: "rgba(255,255,255,.08)"}}>
            <img src={"/v2/assets/eclat.svg"} alt={""} style={{width: "44px", height: "44px"}} />
            <span className={v.balanceAnim} style={{fontSize: "30px", fontWeight: "700", display: "inline-block"}}>
              {v.balance}
              <span style={{fontSize: "16px", fontWeight: "500", color: "rgba(255,255,255,.7)"}}>
                {" \u00e9clats"}
              </span>
            </span>
          </span>
        </section>
        {(v.shop || []).map((g: any, i_g: number) => (
          <Fragment key={i_g}>
            <section style={{display: "flex", flexDirection: "column", gap: "16px"}}>
              <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
                <span style={{fontSize: "20px", fontWeight: "700"}}>
                  {g.title}
                </span>
                <span style={{fontSize: "15px", color: "#6B6F76"}}>
                  {g.sub}
                </span>
              </span>
              <div style={{display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "18px"}}>
                {(g.items || []).map((it: any, i_it: number) => (
                  <Fragment key={i_it}>
                    <div className={`mr-rise mr-lift ${it.anim}`} style={{display: "flex", flexDirection: "column", gap: "16px", padding: "22px", borderRadius: "18px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", border: `2px solid ${it.border}`, animationDelay: it.delay}}>
                      <div style={{height: "140px", borderRadius: "14px", background: it.previewBg, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", overflow: "hidden"}}>
                        {it.hasImg ? (
                          <>
                            <span className={"mr-art"} style={{display: "flex"}}>
                              <img className={it.imgClass} src={it.img} alt={""} style={{width: it.imgW, height: it.imgH}} />
                            </span>
                          </>
                        ) : null}
                        {it.isTheme ? (
                          <>
                            <span className={"mr-art"} style={{display: "flex", gap: "8px"}}>
                              {(it.swatches || []).map((w: any, i_w: number) => (
                                <Fragment key={i_w}>
                                  <span style={{width: "40px", height: "40px", borderRadius: "12px", background: w.c, boxShadow: "0 0 0 2px rgba(255,255,255,.7), 0 4px 10px rgba(26,29,35,.12)"}}></span>
                                </Fragment>
                              ))}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
                        <span style={{fontSize: "17px", fontWeight: "700"}}>
                          {it.name}
                        </span>
                        <span style={{fontSize: "14px", color: "#6B6F76", minHeight: "20px"}}>
                          {it.desc}
                        </span>
                      </span>
                      <button type={"button"} className={"mr-btn"} onClick={it.buy} style={{font: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "15px", fontWeight: "700", color: it.btnFg, background: it.btnBg, border: "0", padding: "12px", borderRadius: "12px", cursor: it.cursor}}>
                        {" "}{it.btn}{" "}
                        {it.showGem ? (
                          <>
                            <img src={"/v2/assets/eclat.svg"} alt={"éclats"} style={{width: "18px", height: "18px"}} />
                          </>
                        ) : null}
                      </button>
                    </div>
                  </Fragment>
                ))}
              </div>
            </section>
          </Fragment>
        ))}
      </main>
    </div>
    </>
  )
}
