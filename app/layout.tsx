import type { Metadata, Viewport } from "next";
import { BackgroundFX } from "./components/BackgroundFX";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moonbag.ai — AI market intelligence & execution layer for traders",
  description:
    "Moonbag.ai scans crypto, stocks, gold, and macro markets in real time — then surfaces the highest-quality opportunities with clear ratings, risk framing, and execution-ready setups.",
  metadataBase: new URL("https://moonbag.ai"),
  keywords: [
    "AI trading",
    "crypto",
    "stocks",
    "market intelligence",
    "trade execution",
    "opportunity scanner",
    "trading signals",
  ],
  authors: [{ name: "Moonbag.ai" }],
  openGraph: {
    title: "Moonbag.ai — The AI trading system that scans the market for you",
    description:
      "Ranked opportunities. Structured setups. Faster decisions. Join the waitlist.",
    url: "https://moonbag.ai",
    siteName: "Moonbag.ai",
    type: "website",
    images: [
      {
        url: "/logos/moonbag-logo-black.png",
        width: 1200,
        height: 630,
        alt: "Moonbag.ai",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Moonbag.ai",
    description:
      "AI market intelligence & execution layer for crypto, stocks, gold, and macro.",
    creator: "@moonbagai",
  },
  icons: {
    icon: [
      { url: "/logos/moonbag-icon-dark.png", sizes: "any" },
    ],
    apple: "/logos/moonbag-icon-dark.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-black">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="relative min-h-screen bg-black text-white antialiased">
        <BackgroundFX />
        {children}
      </body>
    </html>
  );
}
