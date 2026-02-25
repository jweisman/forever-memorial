import type { Metadata } from "next";
import { Lora, Source_Sans_3, Heebo } from "next/font/google";
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

const lora = Lora({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const heebo = Heebo({
  variable: "--font-body-he",
  subsets: ["hebrew", "latin"],
  display: "swap",
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
        className={`${lora.variable} ${sourceSans.variable} ${heebo.variable} flex min-h-screen flex-col`}
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
