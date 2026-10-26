import type { Metadata } from "next";
import { dictFor } from "@/i18n/dict";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: dictFor(lang).meta.register };
}

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
