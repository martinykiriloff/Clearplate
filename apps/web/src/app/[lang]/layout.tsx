import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/onest";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { isLocale, LOCALES } from "@/i18n/config";
import { dictFor } from "@/i18n/dict";
import { I18nProvider } from "@/i18n/provider";

type Params = { params: Promise<{ lang: string }> };

/** Both languages are prerendered; anything else is a 404. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: { default: "Clearplate", template: "%s · Clearplate" },
    description: dictFor(lang).meta.description,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
  };
}

export const viewport: Viewport = {
  themeColor: "#10161c",
  colorScheme: "dark",
};

export default async function RootLayout({ children, params }: Readonly<{ children: React.ReactNode }> & Params) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className="h-full">
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={lang}>
          {children}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
