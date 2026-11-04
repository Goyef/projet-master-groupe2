import { SparklesIcon } from "lucide-react"

import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import avatarImage from "../../../public/brand/assistant/mascotte-avatar.webp"
import faceImage from "../../../public/brand/assistant/mascotte-visage.webp"

type AssistantAvatarProps = {
  // `avatar` : tête, écharpe et main qui salue (bouton, en-tête) ; `face` : visage seul, lisible en petit.
  variant?: "avatar" | "face"
  // Pastille « disponible ».
  online?: boolean
  className?: string
  imageClassName?: string
}

// Mascotte de l'assistant dans un rond bleu diamant. Image décorative : le nom est toujours écrit à côté.
export function AssistantAvatar({ variant = "avatar", online = false, className, imageClassName }: AssistantAvatarProps) {
  return (
    <Avatar className={cn("bg-brand-diamond after:border-transparent", className)}>
      <AvatarImage
        src={(variant === "face" ? faceImage : avatarImage).src}
        alt=""
        draggable={false}
        className={imageClassName}
      />
      <AvatarFallback className="bg-brand-diamond text-brand-navy">
        <SparklesIcon className="size-1/2" aria-hidden />
      </AvatarFallback>
      {online && <AvatarBadge className="size-3 bg-brand-sky ring-2 ring-background" />}
    </Avatar>
  )
}
