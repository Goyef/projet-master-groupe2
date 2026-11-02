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
import { mainNav } from "@/config/site"

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Ouvrir le menu" />}
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="Navigation mobile" className="flex flex-col gap-1 px-4">
          {mainNav.map((item) => (
            <SheetClose
              nativeButton={false}
              key={item.href}
              render={<Link href={item.href} className="rounded-md px-3 py-2 text-base hover:bg-muted" />}
            >
              {item.title}
            </SheetClose>
          ))}
          <SheetClose
            nativeButton={false}
            render={<Link href="/connexion" className="rounded-md px-3 py-2 text-base hover:bg-muted" />}
          >
            Espace client
          </SheetClose>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
