import Button from "@/components/ui/Button";
import SearchBar from "@/components/ui/SearchBar";
import SectionHeading from "@/components/ui/SectionHeading";
import MemorialCard from "@/components/ui/MemorialCard";
import { prisma } from "@/lib/prisma";
import { generateViewUrl } from "@/lib/s3-helpers";

function formatDateRange(
  birthday: Date | null,
  dateOfDeath: Date
): string {
  const deathYear = new Date(dateOfDeath).getFullYear();
  if (birthday) {
    const birthYear = new Date(birthday).getFullYear();
    return `${birthYear} – ${deathYear}`;
  }
  return `d. ${deathYear}`;
}

export default async function Home() {
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

  return (
    <>
      {/* Hero section */}
      <section
        className="bg-surface px-4 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-28 lg:px-8"
        aria-labelledby="hero-heading"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h1
            id="hero-heading"
            className="font-heading text-4xl font-semibold tracking-tight text-warm-800 sm:text-5xl"
          >
            Preserve the memories
            <br />
            <span className="text-gold-500">that matter forever</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Create a lasting memorial for your loved ones. Share stories,
            photos, and cherished moments with family, friends, and the wider
            community.
          </p>

          {/* Hero search */}
          <div className="mt-10">
            <SearchBar
              size="lg"
              placeholder="Search for a memorial by name..."
              className="mx-auto max-w-md"
              aria-label="Search for a memorial"
            />
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="/dashboard/create" variant="primary" size="lg">
              Create a Memorial
            </Button>
            <Button href="#how-heading" variant="ghost" size="lg">
              Learn more
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
            title="A place to remember, together"
            subtitle="Create a memorial page in minutes. Invite others to contribute their memories."
          />
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Create",
                description:
                  "Set up a memorial page with photos, life story, and funeral details.",
              },
              {
                step: "2",
                title: "Share",
                description:
                  "Invite family and friends to visit the page and contribute memories.",
              },
              {
                step: "3",
                title: "Preserve",
                description:
                  "Collect and curate stories, eulogies, and images — all in one place.",
              },
            ].map(({ step, title, description }) => (
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
            title="Recent Memorials"
            subtitle="Recently created memorial pages"
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentMemorials.length > 0 ? (
              recentMemorials.map((memorial) => (
                <MemorialCard
                  key={memorial.id}
                  name={memorial.name}
                  dates={formatDateRange(memorial.birthday, memorial.dateOfDeath)}
                  placeOfDeath={memorial.placeOfDeath ?? undefined}
                  imageUrl={memorial.pictureUrl ?? undefined}
                  href={`/memorial/${memorial.slug}`}
                />
              ))
            ) : (
              <p className="col-span-full text-center text-sm text-muted">
                No memorials have been created yet. Be the first to create one.
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
            Every life deserves to be remembered
          </h2>
          <p className="mt-4 text-base text-muted">
            Create a free memorial page and give family and friends a place to
            share their stories.
          </p>
          <div className="mt-8">
            <Button href="/dashboard/create" variant="primary" size="lg">
              Get Started
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
