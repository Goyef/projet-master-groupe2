"use client";

import { useEffect, useRef, useState } from "react";

const formats = [
  { value: "Au cabinet", label: "⌂ Au cabinet" },
  { value: "En visioconférence", label: "◉ Visioconférence" },
];

const slots = ["09:00", "10:30", "14:00", "16:30"];

function tomorrowAsInputValue() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function BookingPanel() {
  const [format, setFormat] = useState(formats[0].value);
  const [slot, setSlot] = useState("");
  const [minDate, setMinDate] = useState("");
  const [day, setDay] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const dayInput = useRef<HTMLInputElement>(null);

  // Date calculée côté client pour éviter un écart entre le rendu serveur et le fuseau du visiteur.
  useEffect(() => {
    const tomorrow = tomorrowAsInputValue();
    setMinDate(tomorrow);
    setDay(tomorrow);
  }, []);

  const dayIsValid = Boolean(day) && day >= minDate;
  const canConfirm = Boolean(slot) && dayIsValid;

  function choose<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setConfirmed("");
  }

  function confirm() {
    if (!dayInput.current?.reportValidity() || !slot) return;
    const date = new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    setConfirmed(`Simulation : ${format}, ${date} à ${slot}. Aucun rendez-vous n’a été enregistré.`);
  }

  const summary =
    confirmed ||
    (slot ? `Créneau sélectionné : ${slot}. Consultez le récapitulatif.` : "Sélectionnez un horaire pour continuer.");

  return (
    <div className="booking-panel">
      <p className="step">01 FORMAT &nbsp; / &nbsp; 02 CRÉNEAU &nbsp; / &nbsp; 03 RÉCAPITULATIF</p>
      <h3>Votre première rencontre</h3>

      <fieldset>
        <legend>Quel format préférez-vous ?</legend>
        <div className="formats">
          {formats.map((option) => (
            <button
              key={option.value}
              type="button"
              className={format === option.value ? "selected" : undefined}
              aria-pressed={format === option.value}
              onClick={() => choose(setFormat, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="date-label" htmlFor="day">
        Choisir une date de démonstration
      </label>
      <input
        ref={dayInput}
        type="date"
        id="day"
        min={minDate}
        value={day}
        onChange={(event) => choose(setDay, event.target.value)}
      />

      <fieldset>
        <legend>Créneaux fictifs</legend>
        <div className="slots">
          {slots.map((time) => (
            <button
              key={time}
              type="button"
              className={slot === time ? "selected" : undefined}
              aria-pressed={slot === time}
              onClick={() => choose(setSlot, time)}
            >
              {time}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" className="button full" disabled={!canConfirm} onClick={confirm}>
        Voir le récapitulatif <span>→</span>
      </button>
      <p id="summary" role="status" aria-live="polite">
        {summary}
      </p>
    </div>
  );
}
