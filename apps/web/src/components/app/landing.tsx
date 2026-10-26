"use client";

import Link from "next/link";
import { LocaleSwitch } from "@/components/app/locale-switch";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function LandingPage() {
  const { t, href } = useI18n();
  const l = t.landing;
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Logo />
        <nav className="flex flex-wrap items-center gap-2">
          <LocaleSwitch />
          <Button asChild variant="ghost">
            <Link href={href("/login")}>{l.login}</Link>
          </Button>
          <Button asChild>
            <Link href={href("/register")}>{l.getStarted}</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-14 px-6 py-16">
        <section className="flex max-w-3xl flex-col gap-6">
          <h1 className="text-5xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
            {l.titleA}
            <br />
            <span className="text-primary">{l.titleB}</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{l.lead}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={href("/register")}>{l.ctaPrimary}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={href("/login")}>{l.ctaSecondary}</Link>
            </Button>
          </div>
        </section>

        <section aria-label={l.howItWorks} className="grid gap-4 sm:grid-cols-3">
          {l.steps.map(([title, body]) => (
            <div key={title} className="rounded-xl border bg-card p-6">
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-muted-foreground">{t.common.disclaimer}</footer>
    </div>
  );
}
