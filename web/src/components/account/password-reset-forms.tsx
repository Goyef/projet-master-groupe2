"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { useLocalizedFetch } from "@/components/i18n/locale-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { Texts } from "@/content/texts"

import { PasswordInput } from "./password-input"

type Result = { ok: boolean; message: string; field?: string } | null

// Envoi d'une action à l'API ; renvoie le message à afficher.
function usePost(networkError: string) {
  const localizedFetch = useLocalizedFetch()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>(null)
  async function post(payload: Record<string, unknown>, success: string) {
    setBusy(true)
    setResult(null)
    try {
      const response = await localizedFetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      setResult(response.ok ? { ok: true, message: success } : { ok: false, message: data.error, field: data.field })
      return response.ok
    } catch {
      setResult({ ok: false, message: networkError })
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, result, post }
}

function Feedback({ result }: { result: Result }) {
  if (!result || result.field) return null
  return (
    <Alert variant={result.ok ? "default" : "destructive"} role="status">
      {result.ok ? <CircleCheckIcon /> : <CircleAlertIcon />}
      <AlertDescription>{result.message}</AlertDescription>
    </Alert>
  )
}

type FormProps = { dict: Texts["passwordReset"]; labels: Texts["portal"]; networkError: string }

// « Mot de passe oublié » : le message de confirmation est le même que l'adresse ait un compte ou non.
export function ForgotPasswordForm({ dict, labels, networkError }: FormProps) {
  const { busy, result, post } = usePost(networkError)
  const invalid = !!result && !result.ok && result.field === "email"

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const email = new FormData(form).get("email")
    if (await post({ action: "forgot-password", email }, dict.forgotSent)) form.reset()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{dict.forgotTitle}</CardTitle>
        <CardDescription>{dict.forgotIntro}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor="forgot-email">{labels.email}</FieldLabel>
              <Input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                aria-invalid={invalid}
              />
              {invalid && <FieldError>{result?.message}</FieldError>}
            </Field>
            <Button type="submit" size="lg" className="h-11" disabled={busy}>
              {busy ? dict.forgotSending : dict.forgotSubmit}
            </Button>
            <Feedback result={result} />
            <Link href="/connexion" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              {dict.backToLogin}
            </Link>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

// Nouveau mot de passe depuis le lien reçu par e-mail ; le client est ensuite connecté.
export function ResetPasswordForm({ dict, labels, networkError, token }: FormProps & { token: string }) {
  const router = useRouter()
  const { busy, result, post } = usePost(networkError)
  const invalid = !!result && !result.ok && result.field === "password"

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = new FormData(event.currentTarget).get("password")
    if (await post({ action: "reset-password", token, password }, "")) {
      router.push("/connexion")
      router.refresh()
    }
  }

  if (!token)
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl">{dict.resetTitle}</CardTitle>
          <CardDescription>{dict.resetMissing}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/mot-de-passe-oublie" />} nativeButton={false}>
            {dict.newLink}
          </Button>
        </CardContent>
      </Card>
    )

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{dict.resetTitle}</CardTitle>
        <CardDescription>{dict.resetIntro}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor="reset-password">{dict.newPassword}</FieldLabel>
              <PasswordInput
                id="reset-password"
                name="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={256}
                aria-invalid={invalid}
                labels={{ show: labels.showPassword, hide: labels.hidePassword }}
              />
              {invalid && <FieldError>{result?.message}</FieldError>}
            </Field>
            <Button type="submit" size="lg" className="h-11" disabled={busy}>
              {busy ? dict.resetSaving : dict.resetSubmit}
            </Button>
            <Feedback result={result} />
            {result && !result.ok && !result.field && (
              <Link href="/mot-de-passe-oublie" className="text-sm underline underline-offset-4">
                {dict.newLink}
              </Link>
            )}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
