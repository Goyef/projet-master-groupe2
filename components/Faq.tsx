const questions = [
  {
    question: "Comment se passe le premier rendez-vous ?",
    answer:
      "Il permet d’échanger sur votre demande, de découvrir le cadre proposé et de vérifier ensemble qu’il correspond à vos attentes. Le déroulement exact sera précisé par le praticien.",
  },
  {
    question: "Quels sont les tarifs et la durée d’une séance ?",
    answer:
      "Les tarifs, la durée, les moyens de paiement et les conditions d’annulation seront renseignés après validation du client.",
  },
  {
    question: "Puis-je consulter à distance ?",
    answer:
      "La maquette prévoit une option visioconférence. Sa disponibilité et ses modalités restent à confirmer avec le praticien.",
  },
  {
    question: "Comment contacter le cabinet ?",
    answer: "Le téléphone, l’adresse et l’e-mail professionnels seront affichés ici une fois transmis par le client.",
  },
];

export default function Faq() {
  return (
    <section className="faq section" id="questions">
      <div>
        <p className="eyebrow">VOS QUESTIONS</p>
        <h2>
          Avant de <em>se rencontrer.</em>
        </h2>
      </div>
      <div>
        {questions.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
