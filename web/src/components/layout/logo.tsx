import Image from "next/image"
import Link from "next/link"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

export function Logo({ href, className }: { href: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/brand/logo-transparent.png"
        alt=""
        width={40}
        height={40}
        priority
        className="size-9 dark:rounded-full dark:bg-brand-ivory"
      />
      <span className="font-heading text-lg font-semibold">{siteConfig.name}</span>
    </Link>
  )
}
