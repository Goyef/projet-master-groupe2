"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "./password-input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Texts } from "@/content/texts"

import type { Portal } from "./use-portal"

// Connexion et création de compte (visiteur non connecté).
export function AuthPanel({ dict, portal }: { dict: Texts["portal"]; portal: Portal }) {
  const passwordLabels = { show: dict.showPassword, hide: dict.hidePassword }
  const { submit, isInvalid, errorFor, feedbackFor, busy, setMessage } = portal

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
        <Tabs defaultValue="login" onValueChange={() => setMessage(null)}>
          <TabsList className="w-full">
            <TabsTrigger value="login">{dict.loginTab}</TabsTrigger>
            <TabsTrigger value="register">{dict.registerTab}</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <Card>
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
                      <div className="flex items-baseline justify-between gap-3">
                        <FieldLabel htmlFor="login-password" data-invalid={isInvalid("login", "password")}>
                          {dict.password}
                        </FieldLabel>
                        <Link
                          href="/mot-de-passe-oublie"
                          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {dict.forgotLink}
                        </Link>
                      </div>
                      <PasswordInput
                        id="login-password"
                        aria-invalid={isInvalid("login", "password")}
                        name="password"
                        autoComplete="current-password"
                        required
                        maxLength={256}
                        labels={passwordLabels}
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
          </TabsContent>
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl">{dict.registerTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={submit(
                    "register",
                    (fields) => ({ ...Object.fromEntries(fields), consent: fields.get("consent") === "on" }),
                    { scope: "register" },
                  )}
                >
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="register-name" data-invalid={isInvalid("register", "name")}>
                        {dict.registerName}
                      </FieldLabel>
                      <Input
                        id="register-name"
                        aria-invalid={isInvalid("register", "name")}
                        name="name"
                        autoComplete="name"
                        required
                        maxLength={160}
                      />
                      {errorFor("register", "name")}
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="register-email" data-invalid={isInvalid("register", "email")}>
                          {dict.email}
                        </FieldLabel>
                        <Input
                          id="register-email"
                          aria-invalid={isInvalid("register", "email")}
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          maxLength={254}
                        />
                        {errorFor("register", "email")}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="register-phone" data-invalid={isInvalid("register", "phone")}>
                          {dict.registerPhone}
                        </FieldLabel>
                        <Input
                          id="register-phone"
                          aria-invalid={isInvalid("register", "phone")}
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          required
                          maxLength={30}
                        />
                        {errorFor("register", "phone")}
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="register-password" data-invalid={isInvalid("register", "password")}>
                        {dict.registerPassword}
                      </FieldLabel>
                      <PasswordInput
                        id="register-password"
                        aria-invalid={isInvalid("register", "password")}
                        name="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={256}
                        labels={passwordLabels}
                      />
                      {errorFor("register", "password")}
                    </Field>
                    <Field orientation="horizontal" data-invalid={isInvalid("register", "consent")}>
                      <Checkbox
                        id="register-consent"
                        name="consent"
                        required
                        aria-invalid={isInvalid("register", "consent")}
                      />
                      <FieldLabel htmlFor="register-consent" className="font-normal">
                        <span>
                          {dict.registerConsent}{" "}
                          <Link href="/confidentialite" className="underline underline-offset-4">
                            {dict.registerConsentLink}
                          </Link>
                          .
                        </span>
                      </FieldLabel>
                    </Field>
                    {errorFor("register", "consent")}
                    <Button type="submit" size="lg" className="h-11" disabled={busy}>
                      {busy ? dict.registering : dict.register}
                    </Button>
                    {feedbackFor("register")}
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    )
}
