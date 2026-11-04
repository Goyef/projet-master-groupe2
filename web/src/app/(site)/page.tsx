import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon, CompassIcon, EyeIcon, SearchIcon } from "lucide-react"

import { CtaSection } from "@/components/sections/cta-section"
import { PromoVideo } from "@/components/sections/promo-video"
import { Testimonials } from "@/components/sections/testimonials"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Locale } from "@/lib/i18n"
import { getLocale, getTexts, canonicalUrl } from "@/lib/i18n-server"
import portraitYoucef from "../../../public/brand/youcef.png"
import promoPosterEn from "../../../public/video/synego-promo-en-poster.webp"
import promoPosterFr from "../../../public/video/synego-promo-poster.webp"

const pillarIcons = [EyeIcon, SearchIcon, CompassIcon]

// Vidéo de présentation dans la langue de la page : ses textes incrustés sont traduits.
const promoVideos = {
  fr: { src: "/video/synego-promo.mp4", poster: promoPosterFr.src },
  en: { src: "/video/synego-promo-en.mp4", poster: promoPosterEn.src },
} satisfies Record<Locale, { src: string; poster: string }>

export default async function HomePage() {
  const [dict, locale] = await Promise.all([getTexts(), getLocale()])
  const home = dict.home
  const promo = promoVideos[locale]

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-24">
        <div className="space-y-6">
          <Badge variant="secondary">{home.badge}</Badge>
          <h1 className="text-5xl leading-tight font-semibold md:text-6xl">{home.title}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{home.intro}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="h-11 px-5"
              render={<Link href="/rendez-vous" />}
              nativeButton={false}
            >
              {home.primaryCta}
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-5" render={<Link href="#approche" />} nativeButton={false}>
              {home.secondaryCta}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-sm">
          <div className="absolute inset-0 rounded-full bg-accent dark:bg-brand-diamond" />
          <Image
            src="/brand/logo-transparent.png"
            alt={home.logoAlt}
            fill
            priority
            sizes="(min-width: 768px) 384px, 80vw"
            className="object-contain p-10"
          />
        </div>
      </section>

      {/* Vidéo de présentation en grand, sans cadre : le site et l'approche en 30 secondes, juste sous l'accroche. */}
      <section aria-labelledby="video-titre" className="pb-12 md:pb-16">
        <div className="mx-auto max-w-6xl space-y-2 px-4 text-center sm:px-6">
          <p className="text-sm font-medium tracking-widest text-brand-sky uppercase">{home.videoEyebrow}</p>
          <h2 id="video-titre" className="text-4xl font-semibold">
            {home.videoTitle}
          </h2>
        </div>
        {/* Nouvelle clé au changement de langue : la vidéo repart du début et se relance seule. */}
        <PromoVideo
          key={promo.src}
          src={promo.src}
          poster={promo.poster}
          labels={{ play: home.videoPlay, pause: home.videoPause, description: home.videoDescription }}
          className="mx-auto max-w-screen-2xl"
        />
      </section>

      <section id="approche" className="scroll-mt-20 border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div className="space-y-4">
            <p className="text-sm font-medium tracking-widest text-brand-sky uppercase">{home.signsEyebrow}</p>
            <h2 className="text-4xl font-semibold">{home.signsTitle}</h2>
            <p className="text-muted-foreground">{home.signsIntro}</p>
            <Button variant="outline" render={<Link href="/auto-evaluation" />} nativeButton={false}>
              {dict.quiz.homeCta}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
          <ul className="space-y-3">
            {home.signs.map((sign) => (
              <li key={sign} className="rounded-xl bg-accent px-5 py-4 text-foreground">
                {sign}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 sm:px-6 md:grid-cols-3">
          {home.pillars.map(({ title, description }, index) => {
            const Icon = pillarIcons[index % pillarIcons.length]
            return (
              <div key={title} className="space-y-3">
                <div className="flex size-11 items-center justify-center rounded-full bg-accent text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-2xl font-semibold">{title}</h3>
                <p className="text-muted-foreground">{description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 space-y-2">
          <p className="text-sm font-medium tracking-widest text-brand-sky uppercase">{home.stepsEyebrow}</p>
          <h2 className="text-4xl font-semibold">{home.stepsTitle}</h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {home.steps.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardHeader>
                  <span className="text-sm tracking-widest text-muted-foreground">0{index + 1}</span>
                  <CardTitle className="text-2xl">{step.title}</CardTitle>
                  <CardDescription className="text-base">{step.description}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <Testimonials
        id="temoignages"
        eyebrow={dict.testimonials.eyebrow}
        title={dict.testimonials.title}
        items={dict.testimonials.coaching}
        className="pt-0"
      />

      <section id="qui-suis-je" className="scroll-mt-20 border-y bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <Image
            src={portraitYoucef}
            alt={home.aboutPhotoAlt}
            placeholder="blur"
            sizes="(min-width: 1152px) 532px, (min-width: 768px) calc(50vw - 44px), calc(100vw - 32px)"
            className="h-auto w-full rounded-2xl"
          />
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-medium tracking-widest text-brand-sky uppercase">{home.aboutEyebrow}</p>
              <h2 className="text-4xl font-semibold">{home.aboutTitle}</h2>
              <p className="text-muted-foreground">{home.aboutText}</p>
            </div>
            <Card className="self-center bg-secondary/40">
              <CardHeader>
                <p className="text-sm font-medium tracking-widest text-brand-sky uppercase">{home.seminarsEyebrow}</p>
                <CardTitle className="text-2xl">{home.seminarsTitle}</CardTitle>
                <CardDescription className="text-base">{home.seminarsText}</CardDescription>
                <Button
                  variant="link"
                  className="w-fit px-0"
                  render={<Link href="/seminaires" />}
                  nativeButton={false}
                >
                  {home.seminarsCta}
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  )
}

export async function generateMetadata() {
  return { alternates: canonicalUrl("/") }
}
