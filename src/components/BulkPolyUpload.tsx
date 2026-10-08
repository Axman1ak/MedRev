'use client'
// src/components/BulkPolyUpload.tsx
//
// Dépôt groupé de polys : on lâche N PDF d'un coup, MedRev propose à quelle
// fiche rattacher chacun, l'étudiant corrige ce qui ne va pas, et tout part
// en une fois.
//
// POURQUOI CET ÉCRAN EXISTE
// -------------------------
// Sur la base de prod : 330 fiches sur 380 n'ont aucun cours attaché, et donc
// zéro QCM. Les 49 qui ont un PDF ont des QCM dans 39 cas sur 49. La
// génération n'a jamais été le problème : attacher le cours l'est. Et il
// fallait jusqu'ici ouvrir chaque fiche, une par une, dans la ReviewModal.
//
// RÈGLE : on propose, l'étudiant valide. Rien ne part sans un clic sur le
// bouton final. Un mauvais rattachement enverrait le mauvais cours à la
// génération, et une question fausse coûte plus cher que dix secondes de
// relecture.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, LessonMedia, System } from '@/types'
import { FREE_PDF_SIZE_MB } from '@/types'
import { countPdfPages } from '@/lib/pdf'
import { proposerRattachements } from '@/lib/matchFiles'
import './bulk-poly.css'

type Etat = 'choix' | 'revue' | 'envoi' | 'bilan'

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
  lessons,
  systems,
  userId,
  onClose,
  onUpdated,
}: {
  lessons: Lesson[]
  systems: System[]
  userId: string
  onClose: () => void
  onUpdated: (maj: Lesson[]) => void
}) {
  const supabase = createClient()
  const [etat, setEtat] = useState<Etat>('choix')
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [plan, setPlan] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [glisse, setGlisse] = useState(false)

  // Le plafond de taille dépend du plan. On le lit une fois : pas la peine de
  // le faire remonter depuis la page Fiches, qui ne s'en sert pas.
  useEffect(() => {
    let vivant = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('plan').eq('id', user.id).single()
        .then(({ data }) => { if (vivant) setPlan((data?.plan as string) ?? 'free') })
    })
    return () => { vivant = false }
  }, [supabase])

  const limiteMo = plan === 'pro' ? Infinity : FREE_PDF_SIZE_MB

  const nomMatiere = useMemo(() => {
    const m = new Map<string, string>()
    systems.forEach(s => m.set(s.id, s.name))
    return m
  }, [systems])

  // Fiches proposées dans les menus déroulants, groupées par matière.
  const parMatiere = useMemo(() => {
    const g = new Map<string, Lesson[]>()
    lessons.forEach(l => {
      const arr = g.get(l.system_id) ?? []
      arr.push(l)
      g.set(l.system_id, arr)
    })
    return Array.from(g.entries())
  }, [lessons])

  function recevoir(files: FileList | null) {
    if (!files || files.length === 0) return
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf')
    if (pdfs.length === 0) return

    const props = proposerRattachements(
      pdfs,
      f => f.name,
      lessons.map(l => ({ id: l.id, nom: l.name })),
    )

    setLignes(props.map(p => ({
      file: p.fichier,
      cibleId: p.cibleId ?? '',
      auto: !!p.cibleId,
      tropGros: p.fichier.size / (1024 * 1024) > limiteMo,
    })))
    setEtat('revue')
  }

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
    <div className="bulk-overlay" role="dialog" aria-modal="true" aria-label="Déposer mes polys">
      <div className="bulk-modal">
        <div className="bulk-head">
          <div>
            <div className="bulk-title">Déposer mes polys</div>
            <div className="bulk-sub">
              {etat === 'choix' && 'Un PDF par cours. On devine à quelle fiche chacun appartient, tu corriges si besoin.'}
              {etat === 'revue' && 'Vérifie les rattachements avant d’envoyer.'}
              {etat === 'envoi' && `Envoi ${enCours} sur ${aEnvoyer.length}…`}
              {etat === 'bilan' && 'Terminé.'}
            </div>
          </div>
          {etat !== 'envoi' && (
            <button type="button" className="bulk-close" onClick={onClose} aria-label="Fermer">×</button>
          )}
        </div>

        {etat === 'choix' && (
          <div
            className={`bulk-drop${glisse ? ' on' : ''}`}
            onDragOver={e => { e.preventDefault(); setGlisse(true) }}
            onDragLeave={() => setGlisse(false)}
            onDrop={e => { e.preventDefault(); setGlisse(false); recevoir(e.dataTransfer.files) }}
            onClick={() => inputRef.current?.click()}
          >
            <div className="bulk-drop-main">Glisse tes PDF ici</div>
            <div className="bulk-drop-sub">ou clique pour les choisir</div>
            {plan !== 'pro' && (
              <div className="bulk-drop-note">Jusqu&apos;à {FREE_PDF_SIZE_MB} Mo par fichier en Gratuit.</div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              hidden
              onChange={e => recevoir(e.target.files)}
            />
          </div>
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
                      {l.tropGros && <span className="bulk-tag warn">trop lourd pour le plan Gratuit</span>}
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
