import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Services from "@/components/Services";
import Closing from "@/components/Closing";
const themes = [
  "PNL",
  "MBTI",
  "Ennéagramme",
  "Team building",
  "Gestion de conflit",
  "Process Communication",
  "Gestion mentale",
  "Estime de soi",
  "Déconstruction de la confiance en soi",
];
export default function SeminarsPage() {
  return (
    <>
      <Header />
      <main>
        <section className="section seminar-intro">
          <p className="eyebrow">L’OFFRE SÉMINAIRES</p>
          <h1>
            Se rencontrer.
            <br />
            <em>Construire la suite.</em>
          </h1>
          <p className="intro">
            Des sessions autour de la connaissance de soi, des échanges et de la
            dynamique collective. Ensemble, précisons les sujets qui font écho à
            votre projet.
          </p>
          <a className="button" href="/#rendez-vous">
            Réserver un audit · 45 min ↗
          </a>
        </section>
        <Services />
        <section className="section themes">
          <p className="eyebrow">LES DOMAINES D’INTERVENTION</p>
          <h2>
            Plusieurs portes <em>d’entrée.</em>
          </h2>
          <ul className="theme-list">
            {themes.map((theme) => (
              <li key={theme}>✧ {theme}</li>
            ))}
          </ul>
          <p>
            Ces domaines ont été communiqués par le gérant. Le programme, le
            public, le lieu et les tarifs de chaque séminaire sont à définir
            avec lui.
          </p>
        </section>
        <section className="section approach">
          <div>
            <p className="eyebrow">VOTRE PARCOURS</p>
            <h2>
              Du premier échange
              <br />
              <em>à l’accompagnement.</em>
            </h2>
          </div>
          <ol className="journey">
            <li>
              <strong>Un premier appel</strong>
              <p>
                45 minutes pour présenter votre besoin et découvrir l’offre.
              </p>
            </li>
            <li>
              <strong>Un audit séminaire</strong>
              <p>
                45 minutes pour explorer votre projet, que vous soyez prospect
                ou déjà client.
              </p>
            </li>
            <li>
              <strong>Un espace pour poursuivre</strong>
              <p>
                Après création de votre compte par le gérant, retrouvez vos
                rendez-vous de suivi et les documents partagés avec vous.
              </p>
            </li>
          </ol>
        </section>
        <Closing />
      </main>
      <Footer />
    </>
  );
}
