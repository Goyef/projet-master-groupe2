"use client";

import { useRef } from "react";

export default function Footer() {
  const modal = useRef<HTMLDialogElement>(null);

  return (
    <>
      <footer>
        <a className="brand" href="#">
          LE CABINET <span>✧</span>
        </a>
        <p>Maquette scolaire · Informations illustratives à valider</p>
        <button type="button" onClick={() => modal.current?.showModal()}>
          Informations sur la maquette
        </button>
      </footer>

      <dialog ref={modal} id="legal-modal">
        <h2>Une proposition à personnaliser</h2>
        <p>
          Le nom du praticien, ses titres, ses coordonnées, ses tarifs et ses modalités ne sont pas encore fournis. Les
          textes sont des propositions éditoriales. Le calendrier est une simulation sans enregistrement.
        </p>
        <p>
          Les mentions légales et les informations de confidentialité du site définitif restent à rédiger à partir des
          informations réelles du cabinet.
        </p>
        <button className="button" type="button" onClick={() => modal.current?.close()}>
          Fermer
        </button>
      </dialog>
    </>
  );
}
