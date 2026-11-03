import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getTexts } from "@/lib/i18n-server"

export default async function NotFound() {
  const dict = await getTexts()
  return (
    <main className="mx-auto max-w-xl space-y-5 px-6 py-24 text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="text-4xl font-semibold">{dict.common.notFoundTitle}</h1>
      <p>{dict.common.notFoundText}</p>
      <Button render={<Link href="/" />} nativeButton={false}>{dict.common.backHome}</Button>
    </main>
  )
}
