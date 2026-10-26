import type { Metadata } from "next";
import { dictFor } from "@/i18n/dict";
import { DiaryView } from "./diary-view";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: dictFor(lang).meta.diary };
}

export default function Page() {
  return <DiaryView />;
}
