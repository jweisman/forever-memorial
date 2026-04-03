import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import Button from "@/components/ui/Button";
import SearchBar from "@/components/ui/SearchBar";
import SectionHeading from "@/components/ui/SectionHeading";
import MemorialCard from "@/components/ui/MemorialCard";
import { prisma } from "@/lib/prisma";
import { generateViewUrl } from "@/lib/s3-helpers";
import { getHebrewDeathDate } from "@/lib/hebrewDate";

function formatDates(dateOfDeath: Date, deathAfterSunset: boolean): string {
  const english = new Date(dateOfDeath).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const hebrew = getHebrewDeathDate(dateOfDeath, deathAfterSunset, "he");
  return `${english} · ${hebrew}`;
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Logged-in users go to the feed
  const session = await auth();
  if (session?.user?.id) {
    redirect({ href: "/feed", locale });
  }

  const t = await getTranslations("Home");

  const rawMemorials = await prisma.memorial.findMany({
    where: { disabled: false },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      slug: true,
      name: true,
      birthday: true,
      dateOfDeath: true,
      deathAfterSunset: true,
      placeOfDeath: true,
      memorialPicture: true,
    },
  });

  const recentMemorials = await Promise.all(
    rawMemorials.map(async (m) => ({
      ...m,
      pictureUrl: m.memorialPicture
        ? await generateViewUrl(m.memorialPicture)
        : null,
    }))
  );

  const steps = [
    { step: "1", title: t("step1"), description: t("step1Desc") },
    { step: "2", title: t("step2"), description: t("step2Desc") },
    { step: "3", title: t("step3"), description: t("step3Desc") },
  ];

  return (
    <>
      {/* Hero section */}
      <section
        className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-28 lg:px-8"
        aria-labelledby="hero-heading"
      >
        {/* Background image — mobile (768w) + desktop (1920w) */}
        <picture aria-hidden="true">
          <source media="(max-width: 768px)" srcSet="/images/hero-mobile.jpg" />
          <source media="(min-width: 769px)" srcSet="/images/hero-desktop.jpg" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-desktop.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            fetchPriority="high"
          />
        </picture>
        {/* Warm overlay — adjust opacity as needed */}
        <div className="absolute inset-0 bg-warm-100/80" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <h1
            id="hero-heading"
            className="font-heading text-4xl font-semibold tracking-tight text-warm-800 sm:text-5xl"
          >
            {t("heroTitle")}
            <br />
            <span className="font-[family-name:var(--font-logo-he)] text-gold-500" lang="he">{t("heroTitleAccent")}</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            {t("heroDescription")}
          </p>

          {/* Hero search */}
          <div className="mt-10">
            <SearchBar
              size="lg"
              placeholder={t("searchPlaceholder")}
              className="mx-auto max-w-md"
              aria-label={t("searchLabel")}
            />
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="/dashboard/create" variant="primary" size="lg">
              {t("createMemorial")}
            </Button>
            <Button href="#how-heading" variant="ghost" size="lg">
              {t("learnMore")}
            </Button>
          </div>
        </div>
      </section>


      {/* Warm divider */}
      <div className="flex justify-center py-2" aria-hidden="true">
        <div className="h-px w-16 bg-gold-400" />
      </div>

      {/* How it works */}
      <section
        className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
        aria-labelledby="how-heading"
      >
        <div className="mx-auto max-w-4xl">
          <SectionHeading
            id="how-heading"
            title={t("howTitle")}
            subtitle={t("howSubtitle")}
          />
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map(({ step, title, description }) => (
              <div key={step} className="text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-gold-400/20 font-heading text-lg font-semibold text-gold-600">
                  {step}
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold text-warm-800">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent memorials */}
      <section
        className="bg-surface px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
        aria-labelledby="recent-heading"
      >
        <div className="mx-auto max-w-4xl">
          <SectionHeading
            id="recent-heading"
            title={t("recentTitle")}
            subtitle={t("recentSubtitle")}
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {recentMemorials.length > 0 ? (
              recentMemorials.map((memorial) => (
                <MemorialCard
                  key={memorial.id}
                  name={memorial.name}
                  dates={formatDates(memorial.dateOfDeath, memorial.deathAfterSunset)}
                  placeOfDeath={memorial.placeOfDeath ?? undefined}
                  imageUrl={memorial.pictureUrl ?? undefined}
                  href={`/memorial/${memorial.slug}`}
                />
              ))
            ) : (
              <p className="col-span-full text-center text-sm text-muted">
                {t("noMemorials")}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-xl text-center">
          <h2
            id="cta-heading"
            className="font-heading text-2xl font-semibold text-warm-800 sm:text-3xl"
          >
            {t("ctaTitle")}
          </h2>
          <p className="mt-4 text-base text-muted">
            {t("ctaDescription")}
          </p>
          <div className="mt-8">
            <Button href="/dashboard/create" variant="primary" size="lg">
              {t("getStarted")}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
