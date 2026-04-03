import type { Metadata } from "next";
import { Playfair_Display, Source_Serif_4, Inter, Heebo, Frank_Ruhl_Libre } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { routing } from "@/i18n/routing";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ToastProvider } from "@/components/ui/Toast";
import DisableBodyDrop from "@/components/DisableBodyDrop";
import "../globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "600", "700"],
});

const sourceSerif4 = Source_Serif_4({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "600"],
});

const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

const heebo = Heebo({
  variable: "--font-body-he",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

const frankRuhlLibre = Frank_Ruhl_Libre({
  variable: "--font-heading-he",
  subsets: ["hebrew", "latin"],
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Forever (לעולם) — Memorial Pages",
  description:
    "A platform for sharing stories, images, and memories of loved ones who have passed away.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const [session, messages] = await Promise.all([auth(), getMessages()]);

  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body
        className={`${playfairDisplay.variable} ${sourceSerif4.variable} ${inter.variable} ${heebo.variable} ${frankRuhlLibre.variable} flex min-h-screen flex-col`}
      >
        <SessionProvider session={session}>
          <NextIntlClientProvider messages={messages}>
            <ToastProvider>
              <a href="#main-content" className="skip-link">
                Skip to main content
              </a>
              <DisableBodyDrop />
              <Header />
              <main id="main-content" className="flex-1">
                {children}
              </main>
              <Footer />
            </ToastProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
