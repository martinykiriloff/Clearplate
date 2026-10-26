"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import { LocaleSwitch } from "@/components/app/locale-switch";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/i18n/provider";
import { api, fetcher, type User } from "@/lib/api";

type Mode = "login" | "register";
interface Providers {
  email: boolean;
  google: boolean;
  facebook: boolean;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { t, locale, errorText } = useI18n();
  const a = t.auth;
  const { data: providers } = useSWR<Providers>("/auth/providers", fetcher);
  const [error, setError] = useState<string | null>(params.get("error") === "social" ? t.errors.social : null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const { user } = await api<{ user: User }>(`/auth/${mode}`, {
        method: "POST",
        json: {
          email: form.get("email"),
          password: form.get("password"),
          ...(mode === "register" ? { locale, ...(form.get("name") ? { name: form.get("name") } : {}) } : {}),
        },
      });
      await mutate("/auth/me", user, { revalidate: false });
      // Continue in the language saved on the account.
      const lang = mode === "login" ? user.locale : locale;
      router.replace(`/${lang}${user.onboarded ? "/today" : "/onboarding"}`);
    } catch (err) {
      setError(errorText(err, mode === "login" ? { 401: t.errors.wrongCredentials } : { 409: t.errors.emailTaken }));
      setPending(false);
    }
  }

  const isLogin = mode === "login";
  const social = providers && (providers.google || providers.facebook);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <LocaleSwitch />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isLogin ? a.welcomeBack : a.createTitle}</h1>
          <p className="mt-2 text-muted-foreground">{isLogin ? a.loginLead : a.registerLead}</p>
        </div>

        {social && (
          <div className="flex flex-col gap-3">
            {providers.google && (
              <Button asChild variant="outline" size="lg">
                {/* Full navigation, not <Link>: the OAuth flow leaves the app via the API */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/api/auth/google">{a.continueGoogle}</a>
              </Button>
            )}
            {providers.facebook && (
              <Button asChild variant="outline" size="lg">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/api/auth/facebook">{a.continueFacebook}</a>
              </Button>
            )}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Separator className="flex-1" />
              {a.orEmail}
              <Separator className="flex-1" />
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {!isLogin && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{a.firstName}</Label>
              <Input id="name" name="name" autoComplete="given-name" maxLength={80} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{a.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{a.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? undefined : 10}
              aria-describedby={isLogin ? undefined : "password-hint"}
              required
            />
            {!isLogin && (
              <p id="password-hint" className="text-sm text-muted-foreground">
                {a.passwordHint}
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 px-3.5 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? t.common.pleaseWait : isLogin ? a.login : a.create}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          {isLogin ? a.newHere : a.haveAccount}
          <Link href={isLogin ? `/${locale}/register` : `/${locale}/login`} className="font-medium text-primary underline underline-offset-4">
            {isLogin ? a.createLink : a.loginLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
