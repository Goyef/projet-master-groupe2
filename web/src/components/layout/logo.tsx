import Image from "next/image"
import Link from "next/link"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/brand/logo-transparent.png"
        alt=""
        width={40}
        height={40}
        priority
        className="size-9"
      />
      <span className="font-heading text-lg font-semibold">{siteConfig.name}</span>
    </Link>
  )
}
