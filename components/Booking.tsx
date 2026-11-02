import Reservation from "./Reservation";
export default function Booking() {
  return (
    <section className="booking section" id="rendez-vous">
      <div className="booking-copy">
        <p className="eyebrow">RENDEZ-VOUS PROSPECTS</p>
        <h2>
          Votre projet commence
          <br />
          <em>par une conversation.</em>
        </h2>
        <p>
          Vous découvrez l’offre ? Réservez un appel de vente. Vous souhaitez
          approfondir votre projet ? Choisissez un audit séminaire.
        </p>
        <div className="booking-detail">
          ↗{" "}
          <span>
            45 minutes pour faire le point
            <br />
            <small>Confirmation automatique après réservation</small>
          </span>
        </div>
        <p>
          Déjà client ? L’audit vous est également ouvert. Retrouvez vos séances
          de suivi et vos documents dans votre espace personnel.
        </p>
        <a className="button light" href="/espace-client">
          Accéder à mon espace client ↗
        </a>
      </div>
      <Reservation />
    </section>
  );
}
