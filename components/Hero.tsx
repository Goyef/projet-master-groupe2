export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">
          <span></span> UN TEMPS POUR SOI, UN ESPACE POUR AVANCER
        </p>
        <h1>
          Faire le premier pas.
          <br />
          <em>À votre rythme.</em>
        </h1>
        <p className="intro">
          Parfois, tout commence par une conversation.
          <br />
          Un espace d’écoute pour déposer ce qui vous traverse et explorer, ensemble, de nouvelles perspectives.
        </p>
        <div className="actions">
          <a className="button" href="#rendez-vous">
            Prendre un premier rendez-vous <span>↗</span>
          </a>
          <a className="text-link" href="#approche">
            Découvrir l’approche <span>↓</span>
          </a>
        </div>
        <p className="hero-note">
          Au cabinet ou en visioconférence <span>•</span> Modalités à confirmer
        </p>
      </div>

      <div className="hero-art" role="img" aria-label="Illustration abstraite d’une fenêtre ouverte sur un paysage calme">
        <div className="sun"></div>
        <div className="land land-back"></div>
        <div className="land land-front"></div>
        <div className="window-line"></div>
        <div className="art-caption">
          <span>✧</span> S’accorder une pause.
          <br />
          Se donner de l’espace.
        </div>
        <div className="art-label">ÉCOUTER. COMPRENDRE. AVANCER.</div>
      </div>

      <div className="hero-index">01 — UN NOUVEAU DÉPART</div>
    </section>
  );
}
