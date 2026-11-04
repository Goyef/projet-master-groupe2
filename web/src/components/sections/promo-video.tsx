"use client"

import { useEffect, useId, useRef, useState } from "react"
import { PauseIcon, PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PromoVideoProps = {
  src: string
  poster: string
  labels: { play: string; pause: string; description: string }
  className?: string
}

// Vidéo de présentation, sans son et en boucle. Elle se lance seule quand elle est assez visible et
// se met en pause hors de l'écran (batterie, données). Jamais de lecture automatique si le système
// demande moins de mouvements : l'affiche reste, avec le bouton de lecture. Le bouton lecture / pause
// est toujours présent (clavier, lecteurs d'écran) et une pause demandée n'est pas annulée par le
// défilement ; à la souris, un clic sur l'image fait de même.
export function PromoVideo({ src, poster, labels, className }: PromoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pausedByUser = useRef(false)
  const [playing, setPlaying] = useState(false)
  const descriptionId = useId()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !pausedByUser.current && !reducedMotion.matches) {
          // Muette pour respecter les règles de lecture automatique des navigateurs.
          video.muted = true
          video.play().catch(() => {})
        } else if (!entry.isIntersecting && !video.paused) {
          video.pause()
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  function toggle() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      pausedByUser.current = false
      video.muted = true
      video.play().catch(() => {})
    } else {
      pausedByUser.current = true
      video.pause()
    }
  }

  return (
    <figure className={cn("relative isolate", className)}>
      {/* Halo aux couleurs de la marque derrière le cadre. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -inset-y-6 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-diamond via-brand-ivory to-brand-champagne opacity-80 blur-3xl sm:-inset-x-10 dark:opacity-25"
      />
      <div className="relative rounded-[calc(var(--radius)*2.6)] bg-card p-1.5 shadow-2xl ring-1 ring-foreground/10 sm:p-2.5">
        <div className="group/video relative overflow-hidden rounded-[calc(var(--radius)*2)]">
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            aria-describedby={descriptionId}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onClick={toggle}
            className="aspect-video w-full cursor-pointer bg-brand-ivory object-cover"
          />
          {/* À l'arrêt : grand symbole de lecture au centre (décoratif, le clic passe à la vidéo). */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center bg-brand-navy/5 transition-opacity duration-300",
              playing && "opacity-0",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-background/60 transition-transform duration-300 group-hover/video:scale-110 sm:size-20 sm:ring-8">
              <PlayIcon className="ml-0.5 size-5 fill-current sm:ml-1 sm:size-8" />
            </span>
          </span>
          <Button
            variant="secondary"
            size="icon-lg"
            onClick={toggle}
            aria-label={playing ? labels.pause : labels.play}
            title={playing ? labels.pause : labels.play}
            className="absolute right-3 bottom-3 rounded-full bg-background/85 shadow-md backdrop-blur-sm hover:bg-background sm:right-4 sm:bottom-4"
          >
            {playing ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
          </Button>
        </div>
      </div>
      <figcaption id={descriptionId} className="sr-only">
        {labels.description}
      </figcaption>
    </figure>
  )
}
