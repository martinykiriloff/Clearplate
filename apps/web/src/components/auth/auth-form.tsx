"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api, fetcher, type User } from "@/lib/api";

type Mode = "login" | "register";
interface Providers {
  email: boolean;
  google: boolean;
  facebook: boolean;
}

const SOCIAL_ERRORS: Record<string, string> = {
  social: "We couldn't sign you in with that account. Try again or use your email.",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: providers } = useSWR<Providers>("/auth/providers", fetcher);
  const [error, setError] = useState<string | null>(SOCIAL_ERRORS[params.get("error") ?? ""] ?? null);
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
          ...(mode === "register" && form.get("name") ? { name: form.get("name") } : {}),
        },
      });
      await mutate("/auth/me", user, { revalidate: false });
      router.replace(user.onboarded ? "/today" : "/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPending(false);
    }
  }

  const isLogin = mode === "login";
  const social = providers && (providers.google || providers.facebook);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-muted-foreground">{isLogin ? "Log in to see what's left today." : "It takes about two minutes to get your plan."}</p>
        </div>

        {social && (
          <div className="flex flex-col gap-3">
            {providers.google && (
              <Button asChild variant="outline" size="lg">
                {/* Full navigation: the OAuth flow leaves the app */}
                <a href="/api/auth/google">Continue with Google</a>
              </Button>
            )}
            {providers.facebook && (
              <Button asChild variant="outline" size="lg">
                <a href="/api/auth/facebook">Continue with Facebook</a>
              </Button>
            )}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Separator className="flex-1" />
              or with email
              <Separator className="flex-1" />
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {!isLogin && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">First name (optional)</Label>
              <Input id="name" name="name" autoComplete="given-name" maxLength={80} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
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
                At least 10 characters.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 px-3.5 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Please wait…" : isLogin ? "Log in" : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          {isLogin ? "New to Clearplate? " : "Already have an account? "}
          <Link href={isLogin ? "/register" : "/login"} className="font-medium text-primary underline underline-offset-4">
            {isLogin ? "Create an account" : "Log in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
