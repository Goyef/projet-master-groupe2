const values = ["Un accueil sans jugement", "Une démarche à votre rythme", "Un accompagnement personnalisé"];

export default function Values() {
  return (
    <div className="values">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}
