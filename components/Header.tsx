import Image from "next/image";
export default function Header() {
  return (
    <header>
      <a className="brand" href="/">
        <span className="logo">
          <Image
            src="/logo.png"
            alt="Logo : diamant et étoile"
            width={69}
            height={104}
            priority
          />
        </span>
        <span>
          LES SÉMINAIRES<small>Rencontrer · Comprendre · Avancer</small>
        </span>
      </a>
      <nav aria-label="Navigation principale">
        <a href="/seminaires">Les séminaires</a>
        <a href="/#approche">L’approche</a>
        <a href="/espace-client">Espace client</a>
      </nav>
      <a className="button small" href="/#rendez-vous">
        Prendre rendez-vous <span>↗</span>
      </a>
      <details className="mobile-menu">
        <summary>Menu</summary>
        <a href="/seminaires">Les séminaires</a>
        <a href="/#approche">L’approche</a>
        <a href="/espace-client">Espace client</a>
        <a href="/#rendez-vous">Rendez-vous prospects</a>
      </details>
    </header>
  );
}
