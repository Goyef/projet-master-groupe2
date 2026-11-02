export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">
          <span /> SÉMINAIRES & ACCOMPAGNEMENT
        </p>
        <h1>
          Faire grandir
          <br />
          <em>les possibles.</em>
        </h1>
        <p className="intro">
          Un temps pour se rencontrer, mieux se comprendre et faire avancer vos
          projets. Découvrez des séminaires autour des relations, de la
          connaissance de soi et de la dynamique collective.
        </p>
        <div className="actions">
          <a className="button" href="/seminaires">
            Explorer les séminaires <span>↗</span>
          </a>
          <a className="text-link" href="#rendez-vous">
            Parlons de votre projet ↓
          </a>
        </div>
        <p className="hero-note">
          Appel de vente · 45 minutes <span>•</span> Sur rendez-vous
        </p>
      </div>
      <div
        className="hero-art"
        role="img"
        aria-label="Paysage abstrait bleu et ivoire"
      >
        <div className="sun" />
        <div className="land land-back" />
        <div className="land land-front" />
        <div className="window-line" />
        <div className="art-caption">
          <span>✧</span>Ouvrir le dialogue.
          <br />
          Créer du mouvement.
        </div>
        <div className="art-label">SE RENCONTRER. EXPLORER. CONSTRUIRE.</div>
      </div>
      <div className="hero-index">01 — UNE IMPULSION COLLECTIVE</div>
    </section>
  );
}
