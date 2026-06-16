// src/app/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 32px', color: '#e8ecf4' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, marginBottom: 8 }}>
        Politique de confidentialité
      </h1>
      <p style={{ color: '#8892aa', marginBottom: 40, fontSize: 14 }}>Dernière mise à jour : Mars 2026</p>

      {[
        { title: '1. Responsable du traitement', content: 'MedRev est responsable du traitement de vos données personnelles conformément au RGPD (Règlement Général sur la Protection des Données, UE 2016/679).' },
        { title: '2. Données collectées', content: 'Nous collectons uniquement : votre adresse email, votre prénom, et vos données de révision (fiches, matières, scores, notes). Aucune donnée sensible (santé, finances, données biométriques) n\'est collectée.' },
        { title: '3. Finalité du traitement', content: 'Vos données sont utilisées exclusivement pour le fonctionnement du service MedRev : authentification, synchronisation de vos fiches de révision, génération de statistiques de progression.' },
        { title: '4. Hébergement et sécurité', content: 'Toutes vos données sont hébergées sur des serveurs situés en Europe (Union Européenne), via Supabase (Frankfurt, Allemagne). Les mots de passe sont hashés avec bcrypt. Les connexions sont chiffrées en TLS.' },
        { title: '5. Partage des données', content: 'Vos données ne sont jamais revendues, partagées avec des tiers à des fins publicitaires, ou transmises hors de l\'Union Européenne sans accord de transfert conforme au RGPD.' },
        { title: '6. Vos droits', content: 'Conformément au RGPD, vous disposez des droits d\'accès, de rectification, d\'effacement, de portabilité et d\'opposition. Pour exercer ces droits, contactez-nous à : medrev.fr@gmail.com. Nous répondons sous 30 jours.' },
        { title: '7. Durée de conservation', content: 'Vos données sont conservées pendant la durée de votre abonnement. En cas de suppression de compte, l\'intégralité de vos données est supprimée définitivement sous 30 jours.' },
        { title: '8. Cookies', content: 'MedRev utilise uniquement des cookies strictement nécessaires au fonctionnement du service (session d\'authentification). Aucun cookie de tracking ou publicitaire n\'est utilisé.' },
      ].map(s => (
        <div key={s.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#4f8ef7', marginBottom: 8 }}>{s.title}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#8892aa' }}>{s.content}</p>
        </div>
      ))}

      <div style={{ marginTop: 48, padding: '20px 24px', background: '#1e2330', border: '1px solid #2a3045', borderRadius: 14 }}>
        <p style={{ fontSize: 14, color: '#8892aa' }}>
          Pour toute question relative à vos données : <strong style={{ color: '#4f8ef7' }}>medrev.fr@gmail.com</strong>
        </p>
      </div>
    </div>
  )
}
