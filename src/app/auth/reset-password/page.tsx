'use client'
// src/app/auth/reset-password/page.tsx
//
// Page d'atterrissage après clic sur le lien "mot de passe oublié" reçu par email.
// Supabase a déjà créé une session de récupération via le token contenu dans l'URL,
// on demande juste à l'utilisateur de saisir son nouveau mot de passe.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Vérifie qu'une session est bien établie via le lien reçu par email.
  // Supabase parse automatiquement le hash #access_token=... et crée la session.
  useEffect(() => {
    let cancelled = false
    async function check() {
      // Petit délai pour laisser le client Supabase parser le hash de l'URL
      await new Promise(r => setTimeout(r, 200))
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) {
        setAuthReady(true)
      } else {
        setAuthError('Lien expiré ou invalide. Demande un nouveau lien depuis la page de connexion.')
        setAuthReady(true)
      }
    }
    check()
    return () => { cancelled = true }
  }, [supabase])

  async function submit() {
    setMsg(null)
    if (newPassword.length < 8) {
      setMsg({ kind: 'err', text: 'Le mot de passe doit faire au moins 8 caractères.' })
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setMsg({ kind: 'err', text: 'Les deux mots de passe ne correspondent pas.' })
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setMsg({ kind: 'ok', text: 'Mot de passe modifié, redirection en cours…' })
      setTimeout(() => router.push('/dashboard'), 800)
    } catch (e: unknown) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Erreur inconnue' })
      setSaving(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,400&family=Fraunces:ital,wght@0,500;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        :root {
          --bg: #EDEAE3;
          --card: #FFFFFF;
          --soft: #FAF8F2;
          --dark: #111310;
          --gray: #6B6F6A;
          --border: #E1DDD3;
          --green: #1B4332;
          --gm: #2D6A4F;
          --rose: #C75050;
        }
        body { margin: 0; }

        .rp-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          background: var(--bg);
          font-family: var(--font-hanken), sans-serif;
          color: var(--dark);
        }

        .rp-card {
          width: 100%;
          max-width: 420px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 30px 80px -30px rgba(17, 19, 16, .25);
        }

        .rp-logo {
          font-family: var(--font-bricolage), var(--font-bricolage), serif;
          font-weight: 600;
          font-size: 17px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--dark);
          text-align: center;
          margin-bottom: 24px;
        }
        .rp-logo span { color: var(--gm); }

        .rp-title {
          font-family: var(--font-bricolage), serif;
          font-weight: 500;
          font-size: 22px;
          color: var(--dark);
          margin: 0 0 6px;
          text-align: center;
        }
        .rp-title em {
          font-family: var(--font-bricolage), serif;
          font-style: italic;
          color: var(--gm);
          font-weight: 500;
          font-size: 22px;
        }
        .rp-sub {
          font-family: var(--font-hanken), serif;
          font-style: italic;
          color: var(--gray);
          font-size: 14px;
          text-align: center;
          margin: 0 0 24px;
        }

        .rp-row { margin-bottom: 14px; }
        .rp-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .12em;
          color: var(--gray);
          margin-bottom: 6px;
        }
        .rp-input {
          width: 100%;
          padding: 10px 13px;
          border: 1.5px solid var(--border);
          border-radius: 9px;
          font-family: var(--font-hanken), sans-serif;
          font-size: 14px;
          color: var(--dark);
          background: var(--card);
          outline: none;
          box-sizing: border-box;
        }
        .rp-input:focus { border-color: var(--gm); }

        .rp-msg {
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 12.5px;
          line-height: 1.4;
          margin: 14px 0;
        }
        .rp-msg.ok {
          background: rgba(45, 106, 79, .08);
          border: 1px solid rgba(45, 106, 79, .25);
          color: var(--green);
        }
        .rp-msg.err {
          background: rgba(199, 80, 80, .07);
          border: 1px solid rgba(199, 80, 80, .25);
          color: var(--rose);
        }

        .rp-btn {
          width: 100%;
          padding: 12px;
          border: none;
          background: var(--green);
          color: white;
          font-family: var(--font-hanken), sans-serif;
          font-weight: 600;
          font-size: 14px;
          border-radius: 9px;
          cursor: pointer;
          letter-spacing: .02em;
          margin-top: 6px;
        }
        .rp-btn:disabled { opacity: .55; cursor: default; }
        .rp-btn:not(:disabled):hover { background: var(--gm); }

        .rp-link {
          display: block;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          color: var(--gray);
          text-decoration: none;
          margin-top: 16px;
        }
        .rp-link:hover { color: var(--dark); }

        .rp-loading {
          text-align: center;
          padding: 40px 20px;
          font-family: var(--font-hanken), serif;
          font-style: italic;
          color: var(--gray);
        }
      `}</style>

      <div className="rp-wrap">
        <div className="rp-card">
          <div className="rp-logo">Med<span>·Rev</span></div>

          {!authReady ? (
            <div className="rp-loading">Vérification du lien…</div>
          ) : authError ? (
            <>
              <div className="rp-title">Lien <em>expiré</em></div>
              <p className="rp-sub">{authError}</p>
              <a className="rp-link" href="/">← Retour à la connexion</a>
            </>
          ) : (
            <>
              <div className="rp-title">Nouveau <em>mot de passe</em></div>
              <p className="rp-sub">Choisis un mot de passe d&apos;au moins 8 caractères.</p>

              <div className="rp-row">
                <label className="rp-label">Nouveau mot de passe</label>
                <input
                  type="password"
                  className="rp-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caractères"
                  autoComplete="new-password"
                />
              </div>

              <div className="rp-row">
                <label className="rp-label">Confirmer</label>
                <input
                  type="password"
                  className="rp-input"
                  value={newPasswordConfirm}
                  onChange={e => setNewPasswordConfirm(e.target.value)}
                  placeholder="Retape le même"
                  autoComplete="new-password"
                  onKeyDown={e => { if (e.key === 'Enter' && !saving) submit() }}
                />
              </div>

              {msg && <div className={`rp-msg ${msg.kind}`}>{msg.text}</div>}

              <button
                className="rp-btn"
                onClick={submit}
                disabled={saving || !newPassword || !newPasswordConfirm}
              >
                {saving ? 'Enregistrement…' : 'Modifier mon mot de passe'}
              </button>

              <a className="rp-link" href="/">← Annuler et retourner à la connexion</a>
            </>
          )}
        </div>
      </div>
    </>
  )
}
