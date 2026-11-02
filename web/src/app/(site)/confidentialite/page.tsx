export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-16 sm:px-6">
      <h1 className="text-5xl font-semibold">Confidentialité</h1>
      <p>
        Version de travail à compléter avec le gérant avant publication.
        Utilisez uniquement des données de test pour la démonstration scolaire.
      </p>
      <h2 className="text-3xl">Informations traitées</h2>
      <p>
        La réservation enregistre le nom, l’adresse e-mail, le créneau et le
        type de rendez-vous. L’espace privé conserve les informations du compte,
        les rendez-vous et les documents partagés. Aucun motif médical ni donnée
        sensible n’est demandé.
      </p>
      <h2 className="text-3xl">Accès et stockage</h2>
      <p>
        Le gérant consulte les réservations et gère les comptes et les
        documents. Chaque client accède à ses rendez-vous et aux documents qui
        lui sont destinés ou partagés avec tous les clients. Les mots de passe
        sont hachés. Le cookie de session nécessaire à la connexion expire après
        huit heures.
      </p>
      <h2 className="text-3xl">Informations à compléter</h2>
      <p>
        L’identité du responsable de traitement, le contact pour exercer vos
        droits, les bases légales, les durées de conservation, les prestataires
        et les modalités de suppression doivent être définis avec le gérant.
        Cette page ne constitue pas encore une politique prête pour un service
        public.
      </p>
    </article>
  );
}
