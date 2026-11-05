// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'

const DEFAULTS = {"active": "0"}

const CSS = ""

class Logic extends DCLogic {
  renderVals() {
    const active = String(this.props.active ?? '0');
    const on = 'rgba(255,255,255,.12)';
    const icons = {
      home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
      cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
      stats: 'M5 20V10M12 20V4M19 20v-7',
      lib: 'M5 4v16M10 4v16M15 5l4 15',
      sim: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z'
    };
    const items = [
      ['0', 'Aujourd’hui', 'home', '/v2'],
      ['1', 'Calendrier', 'cal', '/v2/calendrier'],
      ['2', 'Statistiques', 'stats', '/v2/statistiques'],
      ['3', 'Bibliothèque', 'lib', '/v2/bibliotheque'],
      ['4', 'Simulateur', 'sim', '/v2/simulateur']
    ];
    const nav = items.map(([id, label, ic, href]) => ({ label, href, icon: icons[ic], weight: id === active ? 600 : 500, bg: id === active ? on : 'transparent' }));
    const subs = [
      ['Anatomie spécifique', '#4F7CC9', 15],
      ['Physiologie', '#8B6BB8', 3],
      ['Santé, Société, Humanité', '#3E8E85', 3],
      ['Biophysique', '#C4554D', 2],
      ['Pharmacologie', '#D08A3E', 2],
      ['Biostatistiques', '#9C7148', 1]
    ];
    const subjects = subs.map(([name, color, count]) => ({ name, color, count, href: '/v2/matieres', weight: 500, bg: 'transparent' }));
    return { nav, subjects, allWeight: active === '5' ? 600 : 500, allBg: active === '5' ? on : 'transparent' };
  }
}

export default function Sidebar({ active = '0' }: { active?: string }) {
  const v = useDC(Logic, { ...DEFAULTS, active })
  return (
    <>
      <style>{CSS}</style>
    <nav aria-label={"Navigation principale"} style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#FFFFFF", boxSizing: "border-box", width: "100%", height: "100vh", position: "sticky", top: "0", overflowY: "auto", padding: "24px 14px", display: "flex", flexDirection: "column", gap: "20px", background: "#15304E"}}>
      <div style={{display: "flex", alignItems: "center", gap: "10px", padding: "0 10px"}}>
        <div style={{width: "30px", height: "30px", borderRadius: "8px", background: "#FFFFFF", color: "#15304E", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "16px"}}>
          {"M"}
        </div>
        <span style={{fontWeight: "700", fontSize: "18px"}}>
          {"MedRev"}
        </span>
      </div>
      <div style={{display: "flex", flexDirection: "column", gap: "2px"}}>
        <button type={"button"} style={{font: "inherit", display: "flex", alignItems: "center", gap: "12px", padding: "9px 12px", borderRadius: "8px", border: "0", background: "transparent", color: "rgba(255,255,255,.62)", fontSize: "15px", fontWeight: "500", cursor: "pointer", textAlign: "left"}}>
          <svg width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} aria-hidden={"true"}>
            <circle cx={"11"} cy={"11"} r={"7"} />
            <path d={"M20 20l-3.5-3.5"} />
          </svg>
          <span style={{flex: "1"}}>
            {"Rechercher"}
          </span>
          <span style={{fontSize: "12px", padding: "2px 6px", borderRadius: "5px", background: "rgba(255,255,255,.1)"}}>
            {"\u2318K"}
          </span>
        </button>
        {(v.nav || []).map((n: any, i_n: number) => (
          <Fragment key={i_n}>
            <a href={n.href} style={{display: "flex", alignItems: "center", gap: "12px", padding: "9px 12px", borderRadius: "8px", textDecoration: "none", color: "#FFFFFF", fontSize: "15px", fontWeight: n.weight, background: n.bg}}>
              <svg width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinecap={"round"} strokeLinejoin={"round"} aria-hidden={"true"}>
                <path d={n.icon} />
              </svg>
              <span>
                {n.label}
              </span>
            </a>
          </Fragment>
        ))}
      </div>
      <div style={{height: "1px", background: "rgba(255,255,255,.12)", margin: "0 12px"}}></div>
      <div style={{display: "flex", flexDirection: "column", gap: "2px"}}>
        <Link href={"/v2/matieres"} style={{display: "flex", alignItems: "center", gap: "12px", padding: "9px 12px", borderRadius: "8px", textDecoration: "none", color: "#FFFFFF", fontSize: "15px", fontWeight: v.allWeight, background: v.allBg}}>
          <svg width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.8"} strokeLinejoin={"round"} aria-hidden={"true"}>
            <path d={"M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"} />
          </svg>
          <span style={{flex: "1"}}>
            {"Toutes les mati\u00e8res"}
          </span>
          <span style={{fontSize: "13px", color: "rgba(255,255,255,.55)"}}>
            {"26"}
          </span>
        </Link>
        {(v.subjects || []).map((s: any, i_s: number) => (
          <Fragment key={i_s}>
            <a href={s.href} style={{display: "flex", alignItems: "center", gap: "12px", padding: "7px 12px", borderRadius: "8px", textDecoration: "none", color: "#FFFFFF", fontSize: "14px", fontWeight: s.weight, background: s.bg}}>
              <span style={{width: "8px", height: "8px", borderRadius: "50%", background: s.color, flex: "none", margin: "0 5px"}}></span>
              <span style={{flex: "1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                {s.name}
              </span>
              <span style={{fontSize: "13px", color: "rgba(255,255,255,.55)"}}>
                {s.count}
              </span>
            </a>
          </Fragment>
        ))}
      </div>
      <div style={{marginTop: "auto", display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px"}}>
        <div style={{width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,255,255,.16)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "600"}}>
          {"LO"}
        </div>
        <span style={{fontSize: "14px", fontWeight: "600"}}>
          {"Lou"}
        </span>
        <button type={"button"} style={{marginLeft: "auto", font: "inherit", fontSize: "13px", color: "rgba(255,255,255,.62)", background: "transparent", border: "0", padding: "8px", borderRadius: "6px", cursor: "pointer"}}>
          {"S2 \u25be"}
        </button>
      </div>
    </nav>
    </>
  )
}
