import type { Metadata } from "next";
import { dictFor } from "@/i18n/dict";
import { TodayView } from "./today-view";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: dictFor(lang).meta.today };
}

export default function Page() {
  return <TodayView />;
}
