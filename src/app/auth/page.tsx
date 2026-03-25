'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const [lEmail, setLEmail] = useState('')
  const [lPass, setLPass] = useState('')
  const [rName, setRName] = useState('')
  const [rEmail, setREmail] = useState('')
  const [rPass, setRPass] = useState('')

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: lEmail, password: lPass })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  async function doRegister(e: React.FormEvent) {
    e.preventDefault()
    if (rPass.length < 6) { setError('Mot de passe trop court (min. 6 caracteres)'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email: rEmail,
      password: rPass,
      options: { data: { name: rName } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 24, padding: 40 }}>
        <div className="font-syne font-black text-3xl mb-1" style={{ letterSpacing: '-0.04em' }}>
          Med<span style={{ color: 'var(--accent)' }}>Rev</span>
        </div>
        <p className="text-xs mb-7" style={{ color: 'var(--t3)' }}>Revision medicale espacee</p>

        <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'var(--bg3)' }}>
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError('') }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border-0"
              style={{ background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--t2)', fontFamily: 'DM Sans' }}>
              {t === 'login' ? 'Connexion' : 'Creer un compte'}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={doLogin} className="flex flex-col gap-3">
            <input className="input" type="email" placeholder="Email" value={lEmail} onChange={e => setLEmail(e.target.value)} required autoComplete="email" />
            <input className="input" type="password" placeholder="Mot de passe" value={lPass} onChange={e => setLPass(e.target.value)} required autoComplete="current-password" />
            <button type="submit" disabled={loading} className="mt-1 py-3 rounded-xl font-semibold text-sm border-0 cursor-pointer"
              style={{ background: 'var(--accent)', color: '#fff', opacity: loading ? 0.6 : 1, fontFamily: 'DM Sans' }}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={doRegister} className="flex flex-col gap-3">
            <input className="input" type="text" placeholder="Prenom" value={rName} onChange={e => setRName(e.target.value)} required />
            <input className="input" type="email" placeholder="Email" value={rEmail} onChange={e => setREmail(e.target.value)} required />
            <input className="input" type="password" placeholder="Mot de passe (min. 6)" value={rPass} onChange={e => setRPass(e.target.value)} required />
            <p className="text-xs" style={{ color: 'var(--t3)' }}>
              En creant un compte vous acceptez notre <a href="/privacy" style={{ color: 'var(--accent)' }}>politique de confidentialite</a>.
            </p>
            <button type="submit" disabled={loading} className="mt-1 py-3 rounded-xl font-semibold text-sm border-0 cursor-pointer"
              style={{ background: 'var(--accent)', color: '#fff', opacity: loading ? 0.6 : 1, fontFamily: 'DM Sans' }}>
              {loading ? 'Creation...' : 'Creer mon compte gratuit'}
            </button>
          </form>
        )}

        <div className="flex gap-2 mt-5 flex-wrap">
          <span className="badge" style={{ background: 'rgba(79,142,247,.1)', color: 'var(--accent)', borderColor: 'rgba(79,142,247,.3)' }}>Gratuit - 15 fiches</span>
          <span className="badge" style={{ background: 'rgba(245,158,11,.1)', color: 'var(--gold)', borderColor: 'rgba(245,158,11,.3)' }}>Premium - IA + illimite</span>
        </div>
      </div>
    </div>
  )
}
