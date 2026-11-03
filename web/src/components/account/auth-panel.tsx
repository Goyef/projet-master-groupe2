"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { Texts } from "@/content/texts"

import type { Portal } from "./use-portal"

// Connexion (visiteur non connecté). Les comptes clients sont créés par le gérant.
export function AuthPanel({ dict, portal }: { dict: Texts["portal"]; portal: Portal }) {
  const { submit, isInvalid, errorFor, feedbackFor, busy } = portal

  return (
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Badge variant="secondary">{dict.loginEyebrow}</Badge>
          <h1 className="text-5xl font-semibold">{dict.loginTitle}</h1>
          <p className="text-lg text-muted-foreground">{dict.loginIntro}</p>
          <p className="text-muted-foreground">{dict.loginNote}</p>
          <Button variant="outline" render={<Link href="/rendez-vous" />} nativeButton={false}>
            {dict.loginBookLink}
          </Button>
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-3xl">{dict.loginTitleForm}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit("login", undefined, { scope: "login" })}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="login-email" data-invalid={isInvalid("login", "email")}>
                    {dict.email}
                  </FieldLabel>
                  <Input
                    id="login-email"
                    aria-invalid={isInvalid("login", "email")}
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    maxLength={254}
                  />
                  {errorFor("login", "email")}
                </Field>
                <Field>
                  <FieldLabel htmlFor="login-password" data-invalid={isInvalid("login", "password")}>
                    {dict.password}
                  </FieldLabel>
                  <Input
                    id="login-password"
                    aria-invalid={isInvalid("login", "password")}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={256}
                  />
                  {errorFor("login", "password")}
                </Field>
                <Button type="submit" size="lg" className="h-11" disabled={busy}>
                  {busy ? dict.loggingIn : dict.login}
                </Button>
                {feedbackFor("login")}
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </section>
    )
}
