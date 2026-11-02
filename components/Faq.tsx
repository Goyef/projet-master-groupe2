const questions = [
  {
    question: "Quel rendez-vous choisir ?",
    answer:
      "L’appel de vente est un premier échange pour découvrir votre besoin. L’audit permet de faire le point sur votre projet de séminaire. Chacun dure 45 minutes.",
  },
  {
    question: "L’audit est-il ouvert aux clients existants ?",
    answer:
      "Oui, l’audit séminaire est accessible aux prospects comme aux clients signés.",
  },
  {
    question: "Comment accéder aux séances de suivi ?",
    answer:
      "Le gérant crée votre compte client. Connectez-vous ensuite à votre espace personnel pour réserver un suivi, consulter vos rendez-vous et retrouver vos documents.",
  },
  {
    question: "Quels thèmes peut-on aborder ?",
    answer:
      "PNL, MBTI, Ennéagramme, team building, gestion de conflit, Process Communication, gestion mentale, estime de soi et déconstruction de la confiance en soi.",
  },
  {
    question: "Comment se déroule le rendez-vous et quels sont les tarifs ?",
    answer:
      "Le lieu, le format, les tarifs et les conditions d’annulation restent à préciser avec le gérant. Aucun paiement en ligne n’est proposé.",
  },
];
export default function Faq() {
  return (
    <section className="faq section" id="questions">
      <div>
        <p className="eyebrow">VOS QUESTIONS</p>
        <h2>
          Avant de <em>nous rencontrer.</em>
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
