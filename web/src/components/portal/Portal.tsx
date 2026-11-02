"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useState, type FormEvent } from "react";
import Reservation, { labels, dateLabel } from "./Reservation";
type Client = { id: number; name: string; email: string; active: number };
type Data = {
  user: { name: string; role: "admin" | "client" } | null;
  appointments?: {
    id: number;
    name: string;
    email: string;
    type: keyof typeof labels;
    starts: number;
    completed: number;
  }[];
  documents?: { id: number; title: string; user_id: number | null }[];
  clients?: Client[];
  slots?: {
    id: number;
    starts: number;
    ends: number;
    appointment_id: number | null;
  }[];
};
export default function Portal() {
  const [data, setData] = useState<Data | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const response = await fetch("/api/portal", { cache: "no-store" });
    if (!response.ok) throw new Error("Impossible de charger votre espace.");
    setData(await response.json());
  }
  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);
  async function act(payload: Record<string, unknown> | FormData) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/portal", {
        method: "POST",
        ...(payload instanceof FormData
          ? { body: payload }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      setMessage("Modification enregistrée.");
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  function submit(
    action: string,
    transform?: (fields: FormData) => Record<string, unknown>,
  ) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget,
        fields = new FormData(form);
      if (
        await act({
          action,
          ...(transform ? transform(fields) : Object.fromEntries(fields)),
        })
      )
        form.reset();
    };
  }
  if (!data)
    return (
      <div className="section">
        <p role="status">{message || "Chargement de votre espace…"}</p>
        <Button
          onClick={() => refresh().catch((error) => setMessage(error.message))}
        >
          Réessayer
        </Button>
      </div>
    );
  if (!data.user)
    return (
      <section className="section login-section">
        <div>
          <p className="eyebrow">ESPACE RÉSERVÉ</p>
          <h1>
            Le fil de votre
            <br />
            <em>accompagnement.</em>
          </h1>
          <p>Retrouvez vos rendez-vous et les documents partagés avec vous.</p>
          <p>
            Votre compte est créé par le gérant après le début de votre
            accompagnement. Contactez-le pour recevoir votre accès.
          </p>
          <a className="text-link" href="/#rendez-vous">
            Découvrir l’offre et réserver sans compte ↗
          </a>
        </div>
        <form className="booking-panel" onSubmit={submit("login")}>
          <h2>Se connecter</h2>
          <label>
            Adresse e-mail
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </label>
          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          <Button type="submit" disabled={busy} className="button full">
            {busy ? "Connexion…" : "Accéder à mon espace"} ↗
          </Button>
          <p role="status">{message}</p>
        </form>
      </section>
    );
  const admin = data.user.role === "admin";
  return (
    <div className="section portal">
      <div className="section-head">
        <div>
          <p className="eyebrow">{admin ? "ESPACE GÉRANT" : "ESPACE CLIENT"}</p>
          <h1>
            Bonjour, <em>{data.user.name}.</em>
          </h1>
        </div>
        <Button
          className="button"
          disabled={busy}
          onClick={() => act({ action: "logout" })}
        >
          Se déconnecter
        </Button>
      </div>
      <p role="status" className="form-message">
        {message}
      </p>
      <section className="portal-section">
        <h2>{admin ? "Les rendez-vous" : "Mes rendez-vous"}</h2>
        {!data.appointments?.length ? (
          <p>Aucun rendez-vous pour le moment.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date · Paris</th>
                  <th>Rendez-vous</th>
                  {admin && <th>Client</th>}
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {data.appointments.map((item) => (
                  <tr key={item.id}>
                    <td>{dateLabel(item.starts)}</td>
                    <td>{labels[item.type]}</td>
                    {admin && (
                      <td>
                        {item.name}
                        <br />
                        {item.email}
                      </td>
                    )}
                    <td>
                      {item.completed ? "Séance réalisée" : "Confirmé"}
                      {admin && item.starts < Date.now() && (
                        <Button
                          disabled={busy}
                          className="inline-action"
                          onClick={() =>
                            act({ action: "complete", id: item.id })
                          }
                        >
                          {item.completed
                            ? "Corriger le statut"
                            : "Marquer réalisée"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {!admin && (
        <section className="portal-section">
          <h2>Réserver un rendez-vous</h2>
          <Reservation
            client
            onBooked={() => {
              refresh().catch((error) => setMessage(error.message));
            }}
          />
        </section>
      )}
      <section className="portal-section">
        <h2>{admin ? "Documents partagés" : "Mes documents"}</h2>
        <p>Vos supports pour prolonger les échanges.</p>
        {!data.documents?.length ? (
          <p>Aucun document partagé pour le moment.</p>
        ) : (
          <ul className="document-list">
            {data.documents.map((document) => (
              <li key={document.id}>
                <a href={"/api/portal?action=document&id=" + document.id}>
                  ↓ {document.title} <small>PDF</small>
                </a>
                {admin && (
                  <>
                    <span>
                      {document.user_id
                        ? data.clients?.find(
                            (client) => client.id === document.user_id,
                          )?.name
                        : "Tous les clients"}
                    </span>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        act({ action: "remove-document", id: document.id })
                      }
                    >
                      Retirer
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {admin && (
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              if (await act(new FormData(form))) form.reset();
            }}
          >
            <h3>Partager un document</h3>
            <label>
              Titre
              <input name="title" required maxLength={160} />
            </label>
            <label>
              Destinataire
              <select name="user_id">
                <option value="">Tous les clients</option>
                {data.clients?.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              PDF · 5 Mo maximum
              <input
                name="file"
                type="file"
                accept="application/pdf"
                required
              />
            </label>
            <Button type="submit" className="button" disabled={busy}>
              Partager le PDF
            </Button>
          </form>
        )}
      </section>
      {admin && (
        <>
          <section className="portal-section">
            <h2>Disponibilités</h2>
            <p>
              Chaque disponibilité correspond à un rendez-vous. Prévoir au moins
              une heure pour un suivi. Saisissez les dates dans le fuseau de
              votre appareil ; les rendez-vous sont affichés en heure de Paris.
            </p>
            <form
              className="admin-form"
              onSubmit={submit("add-slot", (fields) => ({
                starts: new Date(String(fields.get("starts"))).getTime(),
                ends: new Date(String(fields.get("ends"))).getTime(),
              }))}
            >
              <div className="field-grid">
                <label>
                  Début
                  <input name="starts" type="datetime-local" required />
                </label>
                <label>
                  Fin
                  <input name="ends" type="datetime-local" required />
                </label>
              </div>
              <Button type="submit" className="button" disabled={busy}>
                Ajouter une disponibilité
              </Button>
            </form>
            <ul className="document-list">
              {data.slots?.map((slot) => (
                <li key={slot.id}>
                  <span>
                    {dateLabel(slot.starts)} ·{" "}
                    {Math.round((slot.ends - slot.starts) / 60000)} min
                  </span>
                  {slot.appointment_id ? (
                    <span>Réservé</span>
                  ) : (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        act({ action: "remove-slot", id: slot.id })
                      }
                    >
                      Retirer
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="portal-section">
            <h2>Comptes clients</h2>
            <form className="admin-form" onSubmit={submit("create-client")}>
              <div className="field-grid">
                <label>
                  Nom
                  <input name="name" required maxLength={160} />
                </label>
                <label>
                  E-mail
                  <input name="email" type="email" required maxLength={254} />
                </label>
              </div>
              <label>
                Mot de passe initial · 12 caractères minimum
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={256}
                />
              </label>
              <Button type="submit" className="button" disabled={busy}>
                Créer le compte
              </Button>
            </form>
            <ul className="document-list">
              {data.clients?.map((client) => (
                <li key={client.id}>
                  <span>
                    {client.name}
                    <small>{client.email}</small>
                  </span>
                  <span>{client.active ? "Actif" : "Désactivé"}</span>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      act({ action: "toggle-client", id: client.id })
                    }
                  >
                    {client.active ? "Désactiver" : "Réactiver"}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
