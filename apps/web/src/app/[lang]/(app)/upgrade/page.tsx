import type { Metadata } from "next";
import { Suspense } from "react";
import { dictFor } from "@/i18n/dict";
import { UpgradeView } from "./upgrade-view";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: dictFor(lang).billing.title };
}

export default function Page() {
  return (
    <Suspense>
      <UpgradeView />
    </Suspense>
  );
}
