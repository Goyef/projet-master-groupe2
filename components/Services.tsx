const services = [
  {
    symbol: "◌",
    title: "Faire le point",
    text: "Prendre du recul sur une période de questionnement et mettre des mots sur ce que vous vivez.",
  },
  {
    symbol: "≈",
    title: "Traverser un changement",
    text: "Trouver un espace de parole lors d’une transition personnelle ou professionnelle.",
  },
  {
    symbol: "✧",
    title: "Mieux se connaître",
    text: "Explorer vos ressentis, vos relations et les questions qui prennent de la place aujourd’hui.",
  },
];

export default function Services() {
  return (
    <section className="services section" id="accompagnements">
      <div className="section-head">
        <div>
          <p className="eyebrow">LES ACCOMPAGNEMENTS</p>
          <h2>
            Un espace, <em>pour votre histoire.</em>
          </h2>
        </div>
        <p>
          Exemples de rubriques à adapter
          <br />
          aux publics réellement accueillis.
        </p>
      </div>

      <div className="cards">
        {services.map((service, index) => (
          <article key={service.title}>
            <span className="number">{String(index + 1).padStart(2, "0")} /</span>
            <div className="symbol">{service.symbol}</div>
            <h3>{service.title}</h3>
            <p>{service.text}</p>
            <a href="#rendez-vous">
              En parler ensemble <span>↗</span>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
