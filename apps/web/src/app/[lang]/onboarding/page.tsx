import type { Metadata } from "next";
import { dictFor } from "@/i18n/dict";
import { OnboardingFlow } from "./onboarding-flow";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: dictFor(lang).meta.onboarding };
}

export default function Page() {
  return <OnboardingFlow />;
}
