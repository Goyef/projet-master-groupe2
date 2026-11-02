import Image from "next/image";
export default function Footer() {
  return (
    <footer>
      <a className="brand" href="/">
        <span className="logo">
          <Image
            src="/logo.png"
            alt="Logo diamant et étoile"
            width={69}
            height={104}
          />
        </span>
        LES SÉMINAIRES
      </a>
      <p>Projet scolaire · Textes et identité à valider</p>
      <div className="footer-links">
        <a href="/mentions-legales">Mentions légales</a>
        <a href="/confidentialite">Confidentialité</a>
        <a href="/espace-client">Espace client</a>
      </div>
    </footer>
  );
}
