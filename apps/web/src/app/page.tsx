import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-14 px-6 py-16">
        <section className="flex max-w-3xl flex-col gap-6">
          <h1 className="text-5xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
            One number a day.
            <br />
            <span className="text-primary">What&apos;s left.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Clearplate turns your goal into a daily budget and shows the only thing that matters while you eat: how much is left. Built for sharp thinking, steady
            energy and fat loss.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">Create your plan</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section aria-label="How it works" className="grid gap-4 sm:grid-cols-3">
          {[
            ["Answer 6 questions", "Goal, body, activity, pace. Your targets update as you answer, so you see why."],
            ["Log in seconds", "Search, recent foods, recipes or a quick estimate. Estimates are labelled, and everything can be undone."],
            ["Follow the trend", "A smoothed weight trend instead of daily noise, and one suggestion for what to eat next."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border bg-card p-6">
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-muted-foreground">
        Clearplate is a wellness tool, not medical advice. For adults 18+.
      </footer>
    </div>
  );
}
