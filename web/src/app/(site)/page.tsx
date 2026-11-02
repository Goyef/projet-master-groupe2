import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon, CalendarCheckIcon, SparklesIcon, UsersIcon } from "lucide-react"

import { CtaSection } from "@/components/sections/cta-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { seminarTopics } from "@/config/site"

// Textes proposés par l'équipe : à faire valider par le gérant avant mise en ligne.
const pillars = [
  {
    icon: UsersIcon,
    title: "Des séminaires sur mesure",
    description: "Chaque séminaire est construit à partir des enjeux réels de votre équipe.",
  },
  {
    icon: SparklesIcon,
    title: "Plusieurs approches à explorer",
    description: "PNL, MBTI, Ennéagramme, Process Communication : des thèmes à préciser ensemble selon votre projet.",
  },
  {
    icon: CalendarCheckIcon,
    title: "Un suivi dans la durée",
    description: "Des séances individuelles et un espace client pour prolonger l'accompagnement.",
  },
]

export default function HomePage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-24">
        <div className="space-y-6">
          <Badge variant="secondary">Séminaires & accompagnement</Badge>
          <h1 className="text-5xl leading-tight font-semibold md:text-6xl">
            Révéler ce qu&apos;il y a de plus précieux dans vos équipes
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Nous concevons et animons des séminaires qui renforcent la cohésion, apaisent les
            tensions et donnent à chacun les clés pour mieux communiquer.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="h-11 px-5" render={<Link href="/rendez-vous" />} nativeButton={false}>
              Prendre rendez-vous
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-5"
              render={<Link href="/seminaires" />}
              nativeButton={false}
            >
              Découvrir les séminaires
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-sm">
          <div className="absolute inset-0 rounded-full bg-accent" />
          <Image
            src="/brand/logo-transparent.png"
            alt="Logo du cabinet"
            fill
            priority
            sizes="(min-width: 768px) 384px, 80vw"
            className="object-contain p-10"
          />
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, description }) => (
            <div key={title} className="space-y-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-accent text-primary">
                <Icon className="size-5" />
              </div>
              <h2 className="text-2xl font-semibold">{title}</h2>
              <p className="text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-2">
            <p className="text-sm font-medium tracking-widest text-brand-sky uppercase">Thématiques</p>
            <h2 className="text-4xl font-semibold">Nos domaines d&apos;intervention</h2>
          </div>
          <Button variant="link" render={<Link href="/seminaires" />} nativeButton={false}>
            Voir l&apos;offre complète
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seminarTopics.slice(0, 6).map((topic) => (
            <Card key={topic.title}>
              <CardHeader>
                <CardTitle className="font-heading text-xl">{topic.title}</CardTitle>
                <CardDescription>{topic.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <CtaSection />
    </>
  )
}
