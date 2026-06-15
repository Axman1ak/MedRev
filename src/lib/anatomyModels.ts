// src/lib/anatomyModels.ts
// Catalogue de modèles 3D d'anatomie (.glb) légers, chargés UN PAR FICHE.
// Source : HuBMAP CCF 3D Reference Object Library (CDN humanatlas.io), licence
// CC BY 4.0 (sauf cerveau : Allen Institute Terms of Use). Modèles par organe,
// quelques Mo chacun → rapides, pas de Unity, pas de ralentissement du site.

export type AnatomyModel = { key: string; label: string; url: string; credit: string; keywords: string[] }

const HRA = 'https://cdn.humanatlas.io/hra-releases/v1.2/models/'
const HUB = 'Modèle : HuBMAP CCF · CC BY 4.0'

export const MODEL_CATALOG: AnatomyModel[] = [
  { key: 'heart',  label: 'Cœur',          url: HRA + 'VH_M_Heart.glb',           credit: HUB, keywords: ['coeur', 'cardia', 'cardio', 'myocard', 'cardiaque', 'heart'] },
  { key: 'brain',  label: 'Cerveau',       url: HRA + 'Allen_M_Brain.glb',        credit: 'Modèle : Allen Institute', keywords: ['cerveau', 'encephal', 'cerebr', 'neuro', 'brain'] },
  { key: 'lung',   label: 'Poumons',       url: HRA + 'VH_M_Lung.glb',            credit: HUB, keywords: ['poumon', 'pulmo', 'pneumo', 'respi', 'bronch', 'lung', 'thorax'] },
  { key: 'kidney', label: 'Rein',          url: HRA + 'VH_M_Kidney_L.glb',        credit: HUB, keywords: ['rein', 'renal', 'nephro', 'kidney'] },
  { key: 'liver',  label: 'Foie',          url: HRA + 'VH_M_Liver.glb',           credit: HUB, keywords: ['foie', 'hepat', 'hepato', 'liver'] },
  { key: 'spleen', label: 'Rate',          url: HRA + 'VH_M_Spleen.glb',          credit: HUB, keywords: ['rate', 'splen', 'spleen'] },
  { key: 'colon',  label: 'Gros intestin', url: HRA + 'SBU_M_Intestine_Large.glb', credit: HUB, keywords: ['intestin', 'colon', 'digest', 'colique', 'gastro'] },
]

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Auto-détection : 1er modèle dont un mot-clé apparaît dans le texte (titre + matière).
export function resolveModel(text: string): AnatomyModel | null {
  const n = norm(text)
  for (const m of MODEL_CATALOG) {
    if (m.keywords.some(k => n.includes(norm(k)))) return m
  }
  return null
}

export function modelByUrl(url: string): AnatomyModel | null {
  return MODEL_CATALOG.find(m => m.url === url) || null
}
