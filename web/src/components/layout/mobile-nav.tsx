"use client"

import Link from "next/link"
import { MenuIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type MobileNavProps = {
  items: { title: string; href: string }[]
  labels: { menu: string; open: string; nav: string }
}

export function MobileNav({ items, labels }: MobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={labels.open} />}>
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{labels.menu}</SheetTitle>
        </SheetHeader>
        <nav aria-label={labels.nav} className="flex flex-col gap-1 px-4">
          {items.map((item) => (
            <SheetClose
              nativeButton={false}
              key={item.href}
              render={<Link href={item.href} className="rounded-md px-3 py-2 text-base hover:bg-muted" />}
            >
              {item.title}
            </SheetClose>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
