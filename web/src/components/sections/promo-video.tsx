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

// Vidéo de présentation en grand, sans cadre : son fond ivoire est celui du site et ses bords
// s'effacent en fondu, si bien qu'elle se fond dans la page (et reste douce sur les autres thèmes).
// Muette et en boucle, elle se lance toute seule dès qu'elle est visible et se met en pause hors
// de l'écran (batterie, données). Le petit bouton lecture / pause reste toujours disponible
// (clavier, lecteurs d'écran) ; une pause demandée n'est pas annulée par le défilement.
export function PromoVideo({ src, poster, labels, className }: PromoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pausedByUser = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const descriptionId = useId()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !pausedByUser.current) {
          // Muette pour respecter les règles de lecture automatique des navigateurs.
          video.muted = true
          // Lecture refusée (mode économie d'énergie…) : le bouton central invite à la lancer.
          video.play().catch(() => setPaused(true))
        } else if (!entry.isIntersecting && !video.paused) {
          video.pause()
        }
      },
      { threshold: 0.25 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  function toggle() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      pausedByUser.current = false
      setPaused(false)
      video.muted = true
      video.play().catch(() => setPaused(true))
    } else {
      pausedByUser.current = true
      setPaused(true)
      video.pause()
    }
  }

  return (
    <figure className={cn("relative", className)}>
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
        className="aspect-video w-full cursor-pointer bg-brand-ivory object-cover [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,transparent,black_7%,black_93%,transparent),linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
      />
      {/* En pause (demandée ou lecture refusée) : grand symbole de lecture, le clic passe à la vidéo. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          (playing || !paused) && "opacity-0",
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-background/60 sm:size-20 sm:ring-8">
          <PlayIcon className="ml-0.5 size-6 fill-current sm:ml-1 sm:size-8" />
        </span>
      </span>
      <Button
        variant="secondary"
        size="icon"
        onClick={toggle}
        aria-label={playing ? labels.pause : labels.play}
        title={playing ? labels.pause : labels.play}
        className="absolute right-[5%] bottom-[9%] rounded-full bg-background/70 text-foreground/80 opacity-70 shadow-sm backdrop-blur-sm transition-opacity hover:bg-background hover:opacity-100 focus-visible:opacity-100"
      >
        {playing ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
      </Button>
      <figcaption id={descriptionId} className="sr-only">
        {labels.description}
      </figcaption>
    </figure>
  )
}
