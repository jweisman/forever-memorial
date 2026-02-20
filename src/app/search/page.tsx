import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { generateViewUrl } from "@/lib/s3-helpers";
import { Prisma } from "@/generated/prisma/client";
import MemorialCard from "@/components/ui/MemorialCard";
import SectionHeading from "@/components/ui/SectionHeading";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

type MemorialRow = {
  id: string;
  slug: string;
  name: string;
  placeOfDeath: string | null;
  dateOfDeath: Date;
  birthday: Date | null;
  memorialPicture: string | null;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q} — Forever (לעולם)` : "Search — Forever (לעולם)",
  };
}

function formatDateRange(birthday: Date | null, dateOfDeath: Date): string {
  const deathYear = new Date(dateOfDeath).getFullYear();
  if (birthday) {
    const birthYear = new Date(birthday).getFullYear();
    return `${birthYear} – ${deathYear}`;
  }
  return `d. ${deathYear}`;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  let results: {
    id: string;
    slug: string;
    name: string;
    dates: string;
    placeOfDeath: string | null;
    pictureUrl: string | null;
  }[] = [];

  if (query.length >= 2) {
    const rows = await prisma.$queryRaw<MemorialRow[]>`
      SELECT id, slug, name, "placeOfDeath", "dateOfDeath", birthday, "memorialPicture"
      FROM memorials
      WHERE disabled = false
        AND (name ILIKE ${"%" + query + "%"} OR similarity(name, ${query}) > 0.1)
      ORDER BY similarity(name, ${query}) DESC
      LIMIT 20
    `;

    results = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        dates: formatDateRange(row.birthday, row.dateOfDeath),
        placeOfDeath: row.placeOfDeath,
        pictureUrl: row.memorialPicture
          ? await generateViewUrl(row.memorialPicture)
          : null,
      }))
    );
  }

  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {query.length >= 2 ? (
          <>
            <SectionHeading
              title={`Results for "${query}"`}
              subtitle={
                results.length > 0
                  ? `${results.length} memorial${results.length === 1 ? "" : "s"} found`
                  : undefined
              }
            />

            {results.length > 0 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((memorial) => (
                  <MemorialCard
                    key={memorial.id}
                    name={memorial.name}
                    dates={memorial.dates}
                    placeOfDeath={memorial.placeOfDeath ?? undefined}
                    imageUrl={memorial.pictureUrl ?? undefined}
                    href={`/memorial/${memorial.slug}`}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-12 text-center">
                <p className="text-lg text-warm-500">
                  No memorials found matching your search.
                </p>
                <p className="mt-2 text-sm text-muted">
                  Try a different name or check the spelling.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-12 text-center">
            <p className="text-lg text-warm-500">
              Enter at least 2 characters to search.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
