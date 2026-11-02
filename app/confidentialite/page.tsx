import Header from "@/components/Header";
import Footer from "@/components/Footer";
export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="section legal-copy">
        <p className="eyebrow">VOS DONNÉES</p>
        <h1>Confidentialité</h1>
        <p>
          Version de travail à compléter avec le gérant avant publication.
          Utilisez uniquement des données de test pour la démonstration
          scolaire.
        </p>
        <h2>Informations traitées</h2>
        <p>
          La réservation enregistre le nom, l’adresse e-mail, le créneau et le
          type de rendez-vous. L’espace privé conserve les informations du
          compte, les rendez-vous et les documents partagés. Aucun motif médical
          ni donnée sensible n’est demandé.
        </p>
        <h2>Accès et stockage</h2>
        <p>
          Le gérant accède aux réservations et gère les comptes et les
          documents. Un client connecté accède uniquement à ses rendez-vous et
          aux documents qui lui sont destinés ou partagés avec tous les clients.
          Les mots de passe sont hachés. Un cookie de session nécessaire à la
          connexion expire après huit heures.
        </p>
        <h2>Informations à compléter</h2>
        <p>
          L’identité du responsable de traitement, le contact pour exercer vos
          droits, les bases légales, les durées de conservation, les
          prestataires et les modalités de suppression doivent être définis avec
          le gérant. Cette page ne constitue pas encore une politique prête pour
          un service public.
        </p>
      </main>
      <Footer />
    </>
  );
}
