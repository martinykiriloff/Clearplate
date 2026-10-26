import type { Metadata, Viewport } from "next";
import "@fontsource-variable/onest";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: { default: "Clearplate", template: "%s · Clearplate" },
  description: "Goal − Food = Left today. Nutrition tracking for sharp thinking, steady energy and fat loss.",
};

export const viewport: Viewport = {
  themeColor: "#10161c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
