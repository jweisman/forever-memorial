import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseIdFromSlug } from "@/lib/slug";
import {
  generateViewUrl,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import { getHebrewDeathDate } from "@/lib/hebrewDate";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import CollapsibleText from "@/components/ui/CollapsibleText";
import GalleryView from "@/components/memorial/GalleryView";
import MemoryCard from "@/components/memorial/MemoryCard";
import MemorySubmissionForm from "@/components/memorial/MemorySubmissionForm";
import YahrzeitCalendar from "@/components/memorial/YahrzeitCalendar";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; locale: string }>;
};

async function checkDisabled(slug: string) {
  const id = parseIdFromSlug(slug);
  const row = await prisma.memorial.findUnique({
    where: { id },
    select: { disabled: true, name: true, slug: true },
  });
  if (!row) return null;
  if (row.disabled) return { disabled: true as const, name: row.name, slug: row.slug };
  return false as const;
}

async function getMemorial(slug: string) {
  const id = parseIdFromSlug(slug);
  const memorial = await prisma.memorial.findUnique({
    where: { id },
    include: {
      eulogies: { orderBy: { order: "asc" } },
      albums: {
        orderBy: { order: "asc" },
        include: {
          images: { orderBy: { order: "asc" } },
        },
      },
      owner: { select: { id: true, name: true } },
      memories: {
        where: { status: "ACCEPTED" },
        orderBy: { createdAt: "asc" },
        include: { images: true },
      },
    },
  });

  if (!memorial) return null;

  // Resolve presigned URLs
  let memorialPictureUrl: string | null = null;
  if (memorial.memorialPicture) {
    memorialPictureUrl = await generateViewUrl(memorial.memorialPicture);
  }

  const albumsWithUrls = await Promise.all(
    memorial.albums.map(async (album) => ({
      ...album,
      images: await Promise.all(
        album.images.map(async (img) => {
          if (img.mediaType === "VIDEO") {
            const url = await generateViewUrl(img.s3Key);
            return { ...img, thumbUrl: url, url };
          }
          return {
            ...img,
            thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
            url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
          };
        })
      ),
    }))
  );

  const memoriesWithUrls = await Promise.all(
    memorial.memories.map(async (memory) => ({
      ...memory,
      createdAt: memory.createdAt.toISOString(),
      images: await Promise.all(
        memory.images.map(async (img) => {
          if (img.mediaType === "VIDEO") {
            const url = await generateViewUrl(img.s3Key);
            return { ...img, thumbUrl: url, url };
          }
          return {
            ...img,
            thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
            url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
          };
        })
      ),
    }))
  );

  return {
    ...memorial,
    memorialPictureUrl,
    albums: albumsWithUrls,
    memories: memoriesWithUrls,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const disabledCheck = await checkDisabled(slug);
  if (disabledCheck === null) {
    return { title: "Memorial Not Found" };
  }
  if (disabledCheck !== false) {
    return { title: `${disabledCheck.name} — Memorial Unavailable` };
  }

  const memorial = await getMemorial(slug);

  if (!memorial) {
    return { title: "Memorial Not Found" };
  }

  const title = `${memorial.name} — Forever Memorial`;
  const description = `Memorial page for ${memorial.name}.${memorial.placeOfDeath ? ` ${memorial.placeOfDeath}.` : ""}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      ...(memorial.memorialPictureUrl && {
        images: [{ url: memorial.memorialPictureUrl }],
      }),
    },
  };
}

function formatDate(date: Date | null | undefined, locale: string): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateRange(
  birthday: Date | null | undefined,
  dateOfDeath: Date,
  diedLabel: string
): string {
  const deathYear = new Date(dateOfDeath).getFullYear();
  if (birthday) {
    const birthYear = new Date(birthday).getFullYear();
    return `${birthYear} – ${deathYear}`;
  }
  return diedLabel;
}

export default async function MemorialPage({ params }: Props) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Memorial");

  // Check disabled status with a lightweight query first
  const disabledCheck = await checkDisabled(slug);
  if (disabledCheck === null) {
    notFound();
  }
  if (disabledCheck !== false) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <Card>
          <h1 className="font-heading text-2xl font-semibold text-warm-800">
            {t("disabledTitle")}
          </h1>
          <p className="mt-4 text-warm-600">{t("disabledMessage")}</p>
          <div className="mt-6">
            <Link
              href="/"
              className="text-sm text-accent hover:text-accent-hover"
            >
              &larr; {t("backHome")}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const memorial = await getMemorial(slug);

  if (!memorial) {
    notFound();
  }

  // Redirect to canonical slug if URL doesn't match
  if (memorial.slug !== slug) {
    redirect(`/memorial/${memorial.slug}`);
  }

  const session = await auth();
  const isOwner = session?.user?.id === memorial.ownerId;

  // Prepare gallery data — only albums with images
  const galleryAlbums = memorial.albums
    .filter((a) => a.images.length > 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      images: a.images.map((img) => ({
        id: img.id,
        thumbUrl: img.thumbUrl,
        url: img.url,
        caption: img.caption,
        mediaType: img.mediaType as "IMAGE" | "VIDEO",
      })),
    }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: memorial.name,
    ...(memorial.birthday && {
      birthDate: new Date(memorial.birthday).toISOString().split("T")[0],
    }),
    deathDate: new Date(memorial.dateOfDeath).toISOString().split("T")[0],
    ...(memorial.placeOfDeath && {
      deathPlace: {
        "@type": "Place",
        name: memorial.placeOfDeath,
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="text-center">
          {/* Memorial picture */}
          <div className="mx-auto mb-6 flex size-28 items-center justify-center overflow-hidden rounded-full bg-warm-200">
            {memorial.memorialPictureUrl ? (
              <img
                src={memorial.memorialPictureUrl}
                alt={memorial.name}
                className="size-full object-cover"
              />
            ) : (
              <svg
                className="size-14 text-warm-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            )}
          </div>

          <h1 className="font-heading text-3xl font-semibold text-warm-800 sm:text-4xl">
            {memorial.name}
          </h1>

          <p className="mt-2 text-lg text-muted">
            {formatDateRange(
              memorial.birthday,
              memorial.dateOfDeath,
              t("died", { year: new Date(memorial.dateOfDeath).getFullYear() })
            )}
          </p>

          {memorial.placeOfDeath && (
            <p className="mt-1 text-sm text-warm-400">
              {memorial.placeOfDeath}
            </p>
          )}

          {isOwner && (
            <div className="mt-6">
              <Button
                href={`/memorial/${memorial.slug}/edit`}
                variant="secondary"
                size="sm"
              >
                {t("editMemorial")}
              </Button>
            </div>
          )}
        </header>

        <div className="mt-12 space-y-8">
          {/* Details */}
          <Card>
            <h2 className="font-heading text-lg font-semibold text-warm-800">
              {t("details")}
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              {memorial.birthday && (
                <div>
                  <dt className="font-medium text-warm-600">{t("born")}</dt>
                  <dd className="mt-0.5 text-warm-800">
                    {formatDate(memorial.birthday, locale)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-medium text-warm-600">{t("passedAway")}</dt>
                <dd className="mt-0.5 flex items-center text-warm-800">
                  {formatDate(memorial.dateOfDeath, locale)}
                  {" / "}
                  {getHebrewDeathDate(
                    memorial.dateOfDeath,
                    memorial.deathAfterSunset,
                    locale === "he" ? "he" : "en"
                  )}
                  <YahrzeitCalendar
                    memorialId={memorial.id}
                    memorialName={memorial.name}
                  />
                </dd>
              </div>
              {memorial.placeOfDeath && (
                <div>
                  <dt className="font-medium text-warm-600">
                    {t("placeOfDeath")}
                  </dt>
                  <dd className="mt-0.5 text-warm-800">
                    {memorial.placeOfDeath}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Funeral info */}
          {memorial.funeralInfo && (
            <Card>
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                {t("funeralInfo")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-warm-700">
                {memorial.funeralInfo}
              </p>
            </Card>
          )}

          {/* Survived by */}
          {memorial.survivedBy && (
            <Card>
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                {t("survivedBy")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-warm-700">
                {memorial.survivedBy}
              </p>
            </Card>
          )}

          {/* Life story */}
          {memorial.lifeStory && (
            <Card>
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                {t("lifeStory")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-warm-700">
                {memorial.lifeStory}
              </p>
            </Card>
          )}

          {/* Photo Gallery */}
          {galleryAlbums.length > 0 && (
            <section>
              <h2 className="font-heading text-xl font-semibold text-warm-800">
                {t("photos")}
              </h2>
              <div className="mt-6">
                <GalleryView albums={galleryAlbums} />
              </div>
            </section>
          )}

          {/* Eulogies */}
          {memorial.eulogies.length > 0 && (
            <section>
              <h2 className="font-heading text-xl font-semibold text-warm-800">
                {t("eulogies")}
              </h2>
              <div className="mt-6 space-y-6">
                {memorial.eulogies.map((eulogy) => (
                  <Card key={eulogy.id}>
                    <blockquote className="border-s-4 border-gold-400 ps-4">
                      <CollapsibleText text={eulogy.text} maxLines={8} />
                      <footer className="mt-4 text-sm">
                        <span className="font-medium text-warm-800">
                          {eulogy.deliveredBy}
                        </span>
                        {eulogy.relation && (
                          <span className="text-warm-400">
                            {" "}
                            — {eulogy.relation}
                          </span>
                        )}
                      </footer>
                    </blockquote>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Memories */}
          {memorial.memories.length > 0 && (
            <section>
              <h2 className="font-heading text-xl font-semibold text-warm-800">
                {t("memories")}
              </h2>
              <div className="mt-6 space-y-6">
                {memorial.memories.map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} />
                ))}
              </div>
            </section>
          )}

          {/* Share a Memory */}
          <section>
            <h2 className="font-heading text-xl font-semibold text-warm-800">
              {t("shareMemory")}
            </h2>
            {session?.user ? (
              <Card className="mt-6">
                <MemorySubmissionForm memorialId={memorial.id} />
              </Card>
            ) : (
              <Card className="mt-6">
                <p className="text-sm text-warm-600">
                  {t("shareMemoryPrompt", { name: memorial.name })}
                </p>
                <div className="mt-3">
                  <Button
                    href={`/auth/signin?callbackUrl=/memorial/${memorial.slug}`}
                    variant="secondary"
                    size="sm"
                  >
                    {t("signInToShare")}
                  </Button>
                </div>
              </Card>
            )}
          </section>

          {/* Back link */}
          <div className="pt-4 text-center">
            <Link
              href="/"
              className="text-sm text-accent hover:text-accent-hover"
            >
              &larr; {t("backHome")}
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
