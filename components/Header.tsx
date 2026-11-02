import Image from "next/image";

export default function Header() {
  return (
    <header>
      <a className="brand" href="#">
        <span className="logo">
          <Image src="/logo.png" alt="Logo du cabinet : diamant et étoile" width={69} height={104} priority />
        </span>
        <span>
          LE CABINET<small>Psychologie & accompagnement</small>
        </span>
      </a>

      <nav aria-label="Navigation principale">
        <a href="#approche">L’approche</a>
        <a href="#accompagnements">Les accompagnements</a>
        <a href="#questions">Questions fréquentes</a>
      </nav>

      <a className="button small" href="#rendez-vous">
        Prendre rendez-vous <span>↗</span>
      </a>
    </header>
  );
}
