import type { Metadata } from "next"
import Link from "next/link"

import { CtaSection } from "@/components/sections/cta-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getTexts, canonicalUrl } from "@/lib/i18n-server"

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getTexts()
  return { title: dict.seminars.metaTitle, alternates: canonicalUrl("/seminaires") }
}

export default async function SeminarsPage() {
  const dict = await getTexts()
  const seminars = dict.seminars

  return (
    <>
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-16 sm:px-6">
        <Badge variant="secondary">{seminars.badge}</Badge>
        <h1 className="max-w-3xl text-5xl font-semibold md:text-6xl">{seminars.title}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{seminars.intro}</p>
        <Button render={<Link href="/rendez-vous" />} nativeButton={false}>
          {seminars.cta}
        </Button>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="mb-8 text-4xl font-semibold">{seminars.topicsTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seminars.topics.map((topic) => (
            <Card key={topic.title}>
              <CardHeader>
                <CardTitle className="text-2xl">{topic.title}</CardTitle>
                <CardDescription>{topic.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{seminars.topicsNote}</p>
      </section>
      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="mb-8 text-4xl font-semibold">{seminars.stepsTitle}</h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {seminars.steps.map((step, index) => (
              <li key={step.title} className="space-y-3">
                <span className="text-sm tracking-widest text-muted-foreground">0{index + 1}</span>
                <h3 className="text-2xl font-semibold">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <CtaSection />
    </>
  )
}
