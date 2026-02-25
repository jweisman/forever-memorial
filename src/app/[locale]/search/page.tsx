import { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { generateViewUrl } from "@/lib/s3-helpers";
import MemorialCard from "@/components/ui/MemorialCard";
import SectionHeading from "@/components/ui/SectionHeading";
import SearchBar from "@/components/ui/SearchBar";

type Props = {
  params: Promise<{ locale: string }>;
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

function formatDateRange(birthday: Date | null, dateOfDeath: Date, diedLabel: string): string {
  const deathYear = new Date(dateOfDeath).getFullYear();
  if (birthday) {
    const birthYear = new Date(birthday).getFullYear();
    return `${birthYear} – ${deathYear}`;
  }
  return diedLabel;
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Search");

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
        AND (name ILIKE ${"%" + query + "%"} OR word_similarity(${query}, name) > 0.4)
      ORDER BY word_similarity(${query}, name) DESC
      LIMIT 20
    `;

    results = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        dates: formatDateRange(
          row.birthday,
          row.dateOfDeath,
          t("died", { year: new Date(row.dateOfDeath).getFullYear() })
        ),
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
        <div className="mb-8">
          <SearchBar
            size="lg"
            initialValue={query}
            autoFocus={query.length < 2}
            placeholder={t("placeholder")}
            className="w-full"
          />
        </div>

        {query.length >= 2 ? (
          <>
            <SectionHeading
              title={t("titleWithQuery", { query })}
              subtitle={
                results.length > 0
                  ? t("resultCount", { count: results.length })
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
                  {t("noResults")}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {t("noResultsHint")}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-12 text-center">
            <p className="text-lg text-warm-500">{t("minChars")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
