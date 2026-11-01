import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import { connection } from "next/server";
import { Icon } from "@/components/Icon";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], display: "swap", variable: "--font-fraunces" });
const source = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-source",
});

export const metadata: Metadata = {
  title: { default: "Jashn: plan your celebration", template: "%s | Jashn" },
  description:
    "Plan weddings, birthdays and community events with a budget that adds up, " +
    "a dated timeline, a vendor checklist and ideas made for you.",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffcf7" },
    { media: "(prefers-color-scheme: dark)", color: "#191613" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render per request so Next can attach the CSP nonce from proxy.ts.
  await connection();
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${source.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand" aria-label="Jashn home">
              <span className="brand-mark">
                <Icon name="logo" />
              </span>
              Jashn
            </Link>
            <NavLinks />
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer">
          <div className="container">
            Costs are planning estimates; confirm prices with local vendors. Plans are saved only in this browser.
          </div>
        </footer>
      </body>
    </html>
  );
}
