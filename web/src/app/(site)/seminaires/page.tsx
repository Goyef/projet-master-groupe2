import Link from "next/link";
import { seminarTopics } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CtaSection } from "@/components/sections/cta-section";
export default function SeminarsPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-16 sm:px-6">
        <Badge variant="secondary">L’offre séminaires</Badge>
        <h1 className="max-w-3xl text-5xl font-semibold md:text-6xl">
          Se rencontrer pour construire la suite
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Des sessions autour de la connaissance de soi, de la communication et
          de la dynamique collective. Le programme se précise avec vous, à
          partir de votre contexte et de vos attentes.
        </p>
        <Button render={<Link href="/rendez-vous" />} nativeButton={false}>
          Réserver un audit · 45 minutes
        </Button>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="mb-8 text-4xl font-semibold">
          Les domaines d’intervention
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seminarTopics.map((topic) => (
            <Card key={topic.title}>
              <CardHeader>
                <CardTitle className="text-2xl">{topic.title}</CardTitle>
                <CardDescription>{topic.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Domaines communiqués par le gérant. Les descriptifs proposés, les
          publics, le lieu et les tarifs restent à valider avec lui.
        </p>
      </section>
      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="mb-8 text-4xl font-semibold">
            Du premier échange à l’accompagnement
          </h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {[
              [
                "01",
                "Faire connaissance",
                "Un appel de vente de 45 minutes pour présenter votre besoin.",
              ],
              [
                "02",
                "Explorer votre projet",
                "Un audit séminaire de 45 minutes, accessible aux prospects et aux clients signés.",
              ],
              [
                "03",
                "Poursuivre ensemble",
                "Votre espace personnel rassemble vos rendez-vous de suivi et les documents partagés par le gérant.",
              ],
            ].map(([number, title, description]) => (
              <li key={number} className="space-y-3">
                <span className="text-sm tracking-widest text-muted-foreground">
                  {number}
                </span>
                <h3 className="text-2xl font-semibold">{title}</h3>
                <p className="text-muted-foreground">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <CtaSection />
    </>
  );
}
