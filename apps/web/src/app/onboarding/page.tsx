import type { Metadata } from "next";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Your plan" };

export default function Page() {
  return <OnboardingFlow />;
}
