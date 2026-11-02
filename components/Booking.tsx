import BookingPanel from "./BookingPanel";

export default function Booking() {
  return (
    <section className="booking section" id="rendez-vous">
      <div className="booking-copy">
        <p className="eyebrow">LE PREMIER PAS</p>
        <h2>
          Un moment
          <br />
          <em>qui vous appartient.</em>
        </h2>
        <p>Choisissez un format, puis un créneau pour découvrir le parcours de réservation.</p>
        <div className="booking-detail">
          ↗{" "}
          <span>
            Au cabinet ou à distance
            <br />
            <small>Adresse, durée et tarifs à renseigner</small>
          </span>
        </div>
        <p className="notice">
          Démonstration : ces disponibilités sont fictives. Aucune réservation réelle ni collecte de données
          personnelles.
        </p>
      </div>

      <BookingPanel />
    </section>
  );
}
