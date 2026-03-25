# MedRev — Révision Médicale IA

Plateforme de révision médicale par répétition espacée, propulsée par l'IA.
QCM générés sur vos cours, niveau annales EDN.

## Stack technique

- **Frontend** : Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend/Auth/DB** : Supabase (hébergé EU — RGPD compliant)
- **IA** : Google Gemini Flash via API (gratuit jusqu'à 1000 req/jour)
- **Déploiement** : Vercel (gratuit pour commencer)

---

## 🚀 Installation locale

### 1. Prérequis
- Node.js 18+ et npm
- Un compte [Supabase](https://supabase.com) (gratuit)
- Une clé API [Anthropic](https://console.anthropic.com) (pour les QCM IA)

### 2. Cloner et installer
```bash
git clone <votre-repo>
cd medrev
npm install
```

### 3. Configurer Supabase

1. Créez un nouveau projet sur [supabase.com](https://supabase.com)
2. Dans le dashboard Supabase → **SQL Editor**, copiez-collez le contenu de `supabase_schema.sql` et exécutez-le
3. Dans **Settings → API**, récupérez :
   - `Project URL`
   - `anon public` key

### 4. Variables d'environnement

```bash
cp .env.example .env.local
```

Éditez `.env.local` :
```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon

ANTHROPIC_API_KEY=sk-ant-votre-cle-api
```

### 5. Lancer en local
```bash
npm run dev
```
Ouvrez [http://localhost:3000](http://localhost:3000)

---

## 🌐 Déploiement sur Vercel

1. Poussez votre code sur GitHub
2. Importez le projet sur [vercel.com](https://vercel.com)
3. Ajoutez les variables d'environnement dans les settings Vercel
4. Déployez — Vercel gère le reste automatiquement

Coût : **0€/mois** jusqu'à ~500 users actifs.

---

## Structure du projet

```
src/
├── app/
│   ├── auth/          # Page login/register
│   ├── dashboard/     # App principale
│   │   ├── page.tsx          # Fiches (liste)
│   │   ├── lesson/[id]/      # ⭐ Page fiche — step panel + QCM IA
│   │   ├── calendar/         # Calendrier
│   │   ├── voyage/           # Module voyage
│   │   ├── stats/            # Statistiques
│   │   └── pricing/          # Pricing freemium
│   ├── api/
│   │   └── generate-qcm/     # Route API — appel Anthropic (serveur)
│   └── privacy/              # Politique de confidentialité RGPD
├── components/
│   ├── QcmPanel.tsx          # Panel QCM IA complet
│   ├── LessonModal.tsx       # Modal ajout/édition fiche
│   └── SystemModal.tsx       # Modal ajout/édition matière
├── lib/
│   └── supabase/
│       ├── client.ts         # Client browser
│       └── server.ts         # Client server (SSR)
└── types/
    └── index.ts              # Types TypeScript + utils
```

---

## RGPD — Points de conformité

- ✅ Hébergement EU (Supabase Frankfurt)
- ✅ Politique de confidentialité intégrée (`/privacy`)
- ✅ Consentement explicite au signup
- ✅ Mots de passe hashés (bcrypt via Supabase Auth)
- ✅ Row Level Security activé sur toutes les tables
- ✅ Aucun cookie de tracking
- ✅ Droit à l'effacement (suppression compte → suppression données)
- ⬜ DPO à désigner si >250 employés (non applicable ici)

---

## Roadmap

- [ ] Intégration Stripe pour les paiements Premium
- [ ] Notifications email quotidiennes (Resend.com)
- [ ] Upload PDF natif (parsing côté serveur)
- [ ] Application mobile (React Native ou PWA)
- [ ] Templates partagés par université
