'use client'
// src/components/BulkPolyUpload.tsx
//
// Rattachement de plusieurs polys d'un coup.
//
// COMMENT ON Y ARRIVE
// -------------------
// Il n'y a pas de bouton dédié. On sélectionne simplement plusieurs fichiers
// depuis « Ajouter le polycopié (PDF) » d'une fiche : un seul fichier part
// directement sur cette fiche, plusieurs ouvrent cet écran, qui propose à
// quelle fiche rattacher chacun. Un geste de plus seulement quand il y a
// plusieurs fichiers, et rien de nouveau à découvrir dans l'interface.
//
// POURQUOI ÇA EXISTE
// ------------------
// Sur la base de prod : 330 fiches sur 380 n'ont aucun cours attaché, donc
// zéro QCM. Les 49 qui ont un PDF ont des QCM dans 39 cas. La génération n'a
// jamais été le problème, attacher le cours l'est, et ça se faisait fiche par
// fiche.
//
// RÈGLE : on propose, l'étudiant valide. Rien ne part sans un clic final. Un
// mauvais rattachement enverrait le mauvais cours à la génération de QCM, et
// une question fausse coûte plus cher que dix secondes de relecture.
//
// Le composant charge lui-même les matières et les fiches de l'année en cours,
// pour rester utilisable depuis n'importe quel écran qui ouvre une fiche sans
// avoir à lui faire redescendre ses listes.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, LessonMedia, System } from '@/types'
import { FREE_PDF_SIZE_MB } from '@/types'
import { countPdfPages } from '@/lib/pdf'
import { proposerRattachements } from '@/lib/matchFiles'
import { normalizeYear, scopeToYear } from '@/lib/year'
import './bulk-poly.css'

type Etat = 'chargement' | 'revue' | 'envoi' | 'bilan'

interface Ligne {
  file: File
  /** id de la fiche cible, '' = ne pas importer. */
  cibleId: string
  auto: boolean
  tropGros: boolean
  statut?: 'ok' | 'erreur'
  erreur?: string
}

export default function BulkPolyUpload({
  userId,
  files,
  ficheEnCoursId,
  onClose,
  onUpdated,
}: {
  userId: string
  /** Fichiers déjà choisis par l'étudiant, depuis le sélecteur d'une fiche. */
  files: File[]
  /** Fiche depuis laquelle le dépôt a été lancé : elle passe en tête. */
  ficheEnCoursId?: string
  onClose: () => void
  onUpdated: (maj: Lesson[]) => void
}) {
  const supabase = createClient()
  const [etat, setEtat] = useState<Etat>('chargement')
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [systems, setSystems] = useState<System[]>([])
  const [plan, setPlan] = useState<string>('free')
  const [enCours, setEnCours] = useState(0)
  const [erreurChargement, setErreurChargement] = useState<string | null>(null)

  const preparer = useCallback((ls: Lesson[], planLu: string) => {
    const limiteMo = planLu === 'pro' ? Infinity : FREE_PDF_SIZE_MB

    // La fiche d'où part le dépôt est proposée en premier aux fichiers : c'est
    // presque toujours celle que l'étudiant avait en tête en cliquant.
    const candidats = ls.map(l => ({ id: l.id, nom: l.name }))
    const props = proposerRattachements(files, f => f.name, candidats)

    const lignesPretes: Ligne[] = props.map(p => ({
      file: p.fichier,
      cibleId: p.cibleId ?? '',
      auto: !!p.cibleId,
      tropGros: p.fichier.size / (1024 * 1024) > limiteMo,
    }))

    if (ficheEnCoursId && !lignesPretes.some(l => l.cibleId === ficheEnCoursId)) {
      const orphelin = lignesPretes.find(l => !l.cibleId && !l.tropGros)
      if (orphelin) { orphelin.cibleId = ficheEnCoursId; orphelin.auto = true }
    }

    setLignes(lignesPretes)
    setEtat('revue')
  }, [files, ficheEnCoursId])

  useEffect(() => {
    let vivant = true
    Promise.all([
      supabase.from('systems').select('*').eq('user_id', userId).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('profiles').select('plan, current_year').eq('id', userId).single(),
    ]).then(([{ data: sys }, { data: les }, { data: prof }]) => {
      if (!vivant) return
      const p = prof as { plan?: string; current_year?: string } | null
      const year = normalizeYear(p?.current_year)
      const scoped = scopeToYear((sys as System[] | null) ?? [], (les as Lesson[] | null) ?? [], year)
      setSystems(scoped.systems)
      setLessons(scoped.lessons)
      setPlan(p?.plan ?? 'free')
      preparer(scoped.lessons, p?.plan ?? 'free')
    }).catch(() => {
      if (vivant) setErreurChargement("Impossible de charger tes fiches. Recharge la page et réessaie.")
    })
    return () => { vivant = false }
  }, [supabase, userId, preparer])

  const nomMatiere = useMemo(() => {
    const m = new Map<string, string>()
    systems.forEach(s => m.set(s.id, s.name))
    return m
  }, [systems])

  const parMatiere = useMemo(() => {
    const g = new Map<string, Lesson[]>()
    lessons.forEach(l => {
      const arr = g.get(l.system_id) ?? []
      arr.push(l)
      g.set(l.system_id, arr)
    })
    return Array.from(g.entries())
  }, [lessons])

  function changerCible(i: number, id: string) {
    setLignes(ls => ls.map((l, j) => (j === i ? { ...l, cibleId: id, auto: false } : l)))
  }

  const aEnvoyer = lignes.filter(l => l.cibleId && !l.tropGros)

  // Une même fiche choisie deux fois : le second upload écraserait le premier
  // sans prévenir. On bloque, c'est le seul cas où un envoi détruit une donnée.
  const doublons = useMemo(() => {
    const vus = new Set<string>()
    const d = new Set<string>()
    aEnvoyer.forEach(l => { if (vus.has(l.cibleId)) d.add(l.cibleId); vus.add(l.cibleId) })
    return d
  }, [aEnvoyer])

  async function envoyer() {
    if (aEnvoyer.length === 0 || doublons.size > 0) return
    setEtat('envoi')
    const majs: Lesson[] = []

    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i]
      if (!ligne.cibleId || ligne.tropGros) continue
      setEnCours(majs.length + 1)

      try {
        const fiche = lessons.find(l => l.id === ligne.cibleId)
        if (!fiche) throw new Error('Fiche introuvable')

        const pages = await countPdfPages(ligne.file)
        // Même convention que la ReviewModal : {uid}/{lessonId}/poly.pdf.
        // Si elle change ici, /api/generate-qcm ne retrouve plus les fichiers.
        const path = `${userId}/${fiche.id}/poly.pdf`

        const { error: upErr } = await supabase.storage
          .from('lesson-media')
          .upload(path, ligne.file, { upsert: true, contentType: 'application/pdf' })
        if (upErr) throw upErr

        const media: LessonMedia = {
          ...((fiche.media ?? {}) as LessonMedia),
          pdf_path: path,
          pdf_pages: pages ?? undefined,
          pdf_size: ligne.file.size,
          pdf_uploaded_at: new Date().toISOString(),
        }

        const { data: maj, error: dbErr } = await supabase
          .from('lessons').update({ media }).eq('id', fiche.id).select().single()
        if (dbErr) throw dbErr
        if (maj) majs.push(maj as Lesson)

        setLignes(ls => ls.map((l, j) => (j === i ? { ...l, statut: 'ok' } : l)))
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erreur inconnue'
        setLignes(ls => ls.map((l, j) => (j === i ? { ...l, statut: 'erreur', erreur: msg } : l)))
      }
    }

    // Un échec au milieu ne doit pas perdre les réussites : on remonte ce qui
    // est passé, puis on affiche le bilan ligne par ligne.
    if (majs.length > 0) onUpdated(majs)
    setEtat('bilan')
  }

  const reussis = lignes.filter(l => l.statut === 'ok').length
  const echoues = lignes.filter(l => l.statut === 'erreur').length

  return (
    <div className="bulk-overlay" role="dialog" aria-modal="true" aria-label="Rattacher les polys">
      <div className="bulk-modal">
        <div className="bulk-head">
          <div>
            <div className="bulk-title">
              {files.length} polys à rattacher
            </div>
            <div className="bulk-sub">
              {etat === 'chargement' && 'Lecture de tes fiches…'}
              {etat === 'revue' && 'On a deviné d’après le nom des fichiers. Corrige ce qui ne va pas.'}
              {etat === 'envoi' && `Envoi ${enCours} sur ${aEnvoyer.length}…`}
              {etat === 'bilan' && 'Terminé.'}
            </div>
          </div>
          {etat !== 'envoi' && (
            <button type="button" className="bulk-close" onClick={onClose} aria-label="Fermer">×</button>
          )}
        </div>

        {erreurChargement && <div className="bulk-list"><p className="bulk-count">{erreurChargement}</p></div>}

        {etat === 'chargement' && !erreurChargement && (
          <div className="bulk-list"><p className="bulk-count">Un instant…</p></div>
        )}

        {(etat === 'revue' || etat === 'envoi' || etat === 'bilan') && (
          <div className="bulk-list">
            {lignes.map((l, i) => {
              const fiche = lessons.find(x => x.id === l.cibleId)
              return (
                <div key={`${l.file.name}-${i}`} className={`bulk-row${l.statut ? ` ${l.statut}` : ''}`}>
                  <div className="bulk-file">
                    <div className="bulk-file-name">{l.file.name}</div>
                    <div className="bulk-file-meta">
                      {(l.file.size / (1024 * 1024)).toFixed(1)} Mo
                      {l.auto && l.cibleId && <span className="bulk-tag">rattachement proposé</span>}
                      {l.tropGros && <span className="bulk-tag warn">trop lourd ({FREE_PDF_SIZE_MB} Mo max)</span>}
                      {fiche?.media && (fiche.media as LessonMedia).pdf_path && !l.statut && (
                        <span className="bulk-tag warn">remplacera le poly actuel</span>
                      )}
                      {l.cibleId && doublons.has(l.cibleId) && !l.statut && (
                        <span className="bulk-tag warn">deux fichiers sur la même fiche</span>
                      )}
                    </div>
                  </div>
                  <div className="bulk-target">
                    {l.statut === 'ok' && <span className="bulk-ok">ajouté</span>}
                    {l.statut === 'erreur' && <span className="bulk-err">{l.erreur}</span>}
                    {!l.statut && (
                      <select
                        className="bulk-select"
                        value={l.cibleId}
                        disabled={etat === 'envoi' || l.tropGros}
                        onChange={e => changerCible(i, e.target.value)}
                      >
                        <option value="">Ne pas importer</option>
                        {parMatiere.map(([sysId, ls]) => (
                          <optgroup key={sysId} label={nomMatiere.get(sysId) ?? 'Matière'}>
                            {ls.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="bulk-foot">
          {etat === 'revue' && (
            <>
              <span className="bulk-count">
                {aEnvoyer.length} fichier{aEnvoyer.length > 1 ? 's' : ''} à rattacher
                {doublons.size > 0 && ' · corrige les doublons pour continuer'}
                {plan !== 'pro' && lignes.some(l => l.tropGros) && ` · limite ${FREE_PDF_SIZE_MB} Mo par fichier`}
              </span>
              <button
                type="button"
                className="bulk-btn"
                disabled={aEnvoyer.length === 0 || doublons.size > 0}
                onClick={envoyer}
              >
                Rattacher →
              </button>
            </>
          )}
          {etat === 'bilan' && (
            <>
              <span className="bulk-count">
                {reussis} rattaché{reussis > 1 ? 's' : ''}
                {echoues > 0 && ` · ${echoues} en échec`}
              </span>
              <button type="button" className="bulk-btn" onClick={onClose}>Fermer</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
