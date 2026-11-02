"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
export const labels = {
  vente: "Appel de vente",
  audit: "Audit séminaire",
  suivi: "Séance de suivi",
};
export function dateLabel(value: number) {
  return new Date(value).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
export default function Reservation({
  client = false,
  onBooked,
}: {
  client?: boolean;
  onBooked?: () => void;
}) {
  const [type, setType] = useState<"vente" | "audit" | "suivi">(
    client ? "suivi" : "vente",
  );
  const [slots, setSlots] = useState<{ id: number; starts: number }[]>([]),
    [slot, setSlot] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setSlot("");
    fetch("/api/portal?action=slots&type=" + type, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setSlots(data.slots);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setSlots([]);
          setMessage(error.message || "Chargement impossible.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [type, revision]);
  return (
    <form
      className="booking-panel"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget,
          fields = new FormData(form);
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch("/api/portal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "reserve",
              type,
              slot: Number(slot),
              name: fields.get("name"),
              email: fields.get("email"),
              acknowledged: fields.get("acknowledged") === "on",
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          const selected = slots.find((item) => item.id === Number(slot));
          setMessage(
            `${labels[type]} confirmé le ${selected ? dateLabel(selected.starts) : ""}. Référence : ${data.reference}.`,
          );
          form.reset();
          onBooked?.();
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Réservation impossible.",
          );
        } finally {
          setRevision((value) => value + 1);
          setBusy(false);
        }
      }}
    >
      <p className="step">01 RENDEZ-VOUS / 02 CRÉNEAU / 03 CONFIRMATION</p>
      <h3>
        {client ? "Votre prochain rendez-vous" : "Parlons de votre projet"}
      </h3>
      <fieldset>
        <legend>Quel rendez-vous souhaitez-vous ?</legend>
        <div className="formats">
          {(client
            ? (["suivi", "audit"] as const)
            : (["vente", "audit"] as const)
          ).map((value) => (
            <Button
              type="button"
              key={value}
              aria-pressed={value === type}
              className={value === type ? "selected" : ""}
              onClick={() => {
                setType(value);
                setMessage("");
              }}
            >
              {labels[value]}
              <small>{value === "suivi" ? "1 heure*" : "45 minutes"}</small>
            </Button>
          ))}
        </div>
      </fieldset>
      <label>
        Créneau disponible · heure de Paris
        <select
          required
          disabled={loading || busy}
          value={slot}
          onChange={(event) => {
            setSlot(event.target.value);
            setMessage("");
          }}
        >
          <option value="">
            {loading ? "Chargement…" : "Choisir un créneau"}
          </option>
          {slots.map((item) => (
            <option key={item.id} value={item.id}>
              {dateLabel(item.starts)}
            </option>
          ))}
        </select>
      </label>
      {!loading && !slots.length && (
        <p className="form-note">
          Aucun créneau disponible pour le moment. Revenez prochainement.
        </p>
      )}
      {!client && (
        <div className="field-grid">
          <label>
            Votre nom
            <input name="name" required maxLength={160} autoComplete="name" />
          </label>
          <label>
            Votre e-mail
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
        </div>
      )}
      <label className="checkbox">
        <input name="acknowledged" type="checkbox" required />
        <span>
          J’ai pris connaissance des{" "}
          <a href="/confidentialite">informations sur mes données</a>.
        </span>
      </label>
      <Button
        type="submit"
        className="button full"
        disabled={busy || loading || !slot}
      >
        {busy ? "Réservation…" : "Confirmer le rendez-vous"} ↗
      </Button>
      {client && (
        <p className="form-note">
          * Durée du suivi provisoire : une heure, selon la durée des séances
          individuelles communiquée par le client. À confirmer avec le gérant.
        </p>
      )}
      <p role="status" className="form-message">
        {message}
      </p>
    </form>
  );
}
