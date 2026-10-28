'use client'
// Page de migration des fichiers vers Cloudflare R2. Réservée au compte de Lou
// (l'API refuse tout autre compte). Pas de lien dans l'appli : /dashboard/admin/stockage

import { useCallback, useEffect, useState } from 'react'
import './styles.css'

type Status = { r2: boolean; total: number; onR2: number; error?: string }
type Line = { path: string; result: string }

export default function StockagePage() {
  const [st, setSt] = useState<Status | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [log, setLog] = useState<Line[]>([])
  const [msg, setMsg] = useState('')

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/stockage')
    setSt(await r.json())
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function run(action: 'copy' | 'purge') {
    setBusy(action); setLog([]); setMsg('')
    let offset = 0
    try {
      for (;;) {
        const r = await fetch('/api/admin/stockage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, offset }) })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || `Erreur ${r.status}`)
        setLog(l => [...l, ...(d.report as Line[])])
        setMsg(`${d.next} / ${d.total}`)
        if (d.done) break
        offset = d.next
      }
      setMsg(m => `${m} : terminé`)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erreur') }
    setBusy(null)
    void refresh()
  }

  async function cors() {
    setBusy('cors'); setMsg('')
    const r = await fetch('/api/admin/stockage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cors' }) })
    const d = await r.json()
    setMsg(d.ok ? 'Le site peut maintenant lire et envoyer des fichiers sur R2.' : `Échec (${d.status ?? d.error})`)
    setBusy(null)
  }

  if (st?.error) return <main className="stk"><h1>Stockage</h1><p className="stk-err">{st.error}</p></main>

  const allCopied = !!st && st.r2 && st.onR2 >= st.total && st.total > 0

  return (
    <main className="stk">
      <h1>Migration des fichiers vers R2</h1>
      {!st ? <p>Chargement…</p> : !st.r2 ? (
        <p className="stk-err">R2 n&apos;est pas encore configuré : ajoute les 4 variables R2 dans Vercel puis redéploie.</p>
      ) : (
        <>
          <p className="stk-state"><b>{st.onR2}</b> fichier{st.onR2 > 1 ? 's' : ''} sur R2, sur <b>{st.total}</b> au total.</p>
          <ol className="stk-steps">
            <li><button type="button" disabled={!!busy} onClick={cors}>1. Autoriser le site sur R2</button></li>
            <li><button type="button" disabled={!!busy} onClick={() => run('copy')}>2. Copier les fichiers vers R2</button></li>
            <li><button type="button" disabled={!!busy || !allCopied} onClick={() => run('purge')}>3. Libérer la place sur Supabase</button>
              {!allCopied && <span> (après la copie complète)</span>}</li>
          </ol>
        </>
      )}
      {msg && <p className="stk-msg">{busy ? 'En cours… ' : ''}{msg}</p>}
      {log.length > 0 && (
        <ul className="stk-log">{log.map((l, i) => <li key={i}><code>{l.path}</code> {l.result}</li>)}</ul>
      )}
    </main>
  )
}
