import Header from "@/components/Header";
import Footer from "@/components/Footer";
export default function LegalPage() {
  return (
    <>
      <Header />
      <main className="section legal-copy">
        <p className="eyebrow">INFORMATIONS DU SITE</p>
        <h1>Mentions légales</h1>
        <p>
          Ce site est une version scolaire de travail. Ces informations doivent
          être complétées et validées avant toute ouverture au public.
        </p>
        <h2>Éditeur et publication</h2>
        <p>
          Nom ou raison sociale, statut, adresse professionnelle, coordonnées,
          immatriculation éventuelle et responsable de publication : à fournir
          par le gérant.
        </p>
        <h2>Hébergement</h2>
        <p>
          Nom, adresse et coordonnées de l’hébergeur : à compléter selon
          l’hébergement retenu.
        </p>
        <h2>Contenus</h2>
        <p>
          Le logo et la palette sont fournis par le client. Les textes sont des
          propositions à valider. Les droits d’utilisation des contenus
          définitifs doivent être vérifiés avant publication.
        </p>
        <a className="text-link" href="/confidentialite">
          Informations de confidentialité ↗
        </a>
      </main>
      <Footer />
    </>
  );
}
