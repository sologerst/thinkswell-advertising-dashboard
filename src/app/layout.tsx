import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Thinkswell Ads Dashboard", template: "%s · Thinkswell" },
  description: "Live Facebook & Instagram campaign results from your Thinkswell team.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111522",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <div className="tw-texture" aria-hidden />
        <div className="relative min-h-dvh">{children}</div>
      </body>
    </html>
  );
}
