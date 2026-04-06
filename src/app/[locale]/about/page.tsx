import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SectionHeading from "@/components/ui/SectionHeading";
import Card from "@/components/ui/Card";
import ContactForm from "@/components/ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "About — Forever (לעולם)" };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("About");

  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <SectionHeading title={t("title")} as="h1" />

        <Card className="mt-8">
          <p className="text-base leading-relaxed text-warm-700">
            {t("description")}
          </p>
          <p className="mt-2 text-sm text-warm-500">
            {t("nonprofit")}
          </p>
        </Card>

        <div className="mt-12">
          <SectionHeading title={t("contactTitle")} subtitle={t("contactSubtitle")} />
          <Card className="mt-6">
            <ContactForm />
          </Card>
        </div>
      </div>
    </section>
  );
}
