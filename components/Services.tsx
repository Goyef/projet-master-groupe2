const services = [
  {
    symbol: "◌",
    title: "Mieux se comprendre",
    text: "Explorer la connaissance de soi avec des thèmes comme le MBTI, l’Ennéagramme et la gestion mentale.",
  },
  {
    symbol: "≈",
    title: "Construire ensemble",
    text: "Ouvrir le dialogue autour du team building, de la gestion de conflit et de la Process Communication.",
  },
  {
    symbol: "✧",
    title: "Prendre du recul",
    text: "Aborder la PNL, l’estime de soi et la déconstruction de la confiance en soi au fil des sessions.",
  },
];
export default function Services() {
  return (
    <section className="services section" id="seminaires">
      <div className="section-head">
        <div>
          <p className="eyebrow">LES SÉMINAIRES</p>
          <h2>
            Des rencontres, <em>des perspectives.</em>
          </h2>
        </div>
        <p>
          Des thèmes à explorer ensemble.
          <br />
          Un programme à définir selon votre projet.
        </p>
      </div>
      <div className="cards">
        {services.map((service, index) => (
          <article key={service.title}>
            <span className="number">0{index + 1} /</span>
            <div className="symbol">{service.symbol}</div>
            <h3>{service.title}</h3>
            <p>{service.text}</p>
            <a href="/#rendez-vous">
              Échanger sur ce thème <span>↗</span>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
