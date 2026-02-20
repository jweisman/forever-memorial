import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseIdFromSlug } from "@/lib/slug";
import {
  generateViewUrl,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import CollapsibleText from "@/components/ui/CollapsibleText";
import GalleryView from "@/components/memorial/GalleryView";
import MemoryCard from "@/components/memorial/MemoryCard";
import MemorySubmissionForm from "@/components/memorial/MemorySubmissionForm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

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

  if (!memorial || memorial.disabled) return null;

  // Resolve presigned URLs
  let memorialPictureUrl: string | null = null;
  if (memorial.memorialPicture) {
    memorialPictureUrl = await generateViewUrl(memorial.memorialPicture);
  }

  const albumsWithUrls = await Promise.all(
    memorial.albums.map(async (album) => ({
      ...album,
      images: await Promise.all(
        album.images.map(async (img) => ({
          ...img,
          thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
          url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
        }))
      ),
    }))
  );

  const memoriesWithUrls = await Promise.all(
    memorial.memories.map(async (memory) => ({
      ...memory,
      name: memory.withholdName ? "Anonymous" : memory.name,
      createdAt: memory.createdAt.toISOString(),
      images: await Promise.all(
        memory.images.map(async (img) => ({
          ...img,
          thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
          url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
        }))
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

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateRange(
  birthday: Date | null | undefined,
  dateOfDeath: Date
): string {
  const deathYear = new Date(dateOfDeath).getFullYear();
  if (birthday) {
    const birthYear = new Date(birthday).getFullYear();
    return `${birthYear} – ${deathYear}`;
  }
  return `d. ${deathYear}`;
}

export default async function MemorialPage({ params }: Props) {
  const { slug } = await params;
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
            {formatDateRange(memorial.birthday, memorial.dateOfDeath)}
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
                Edit Memorial
              </Button>
            </div>
          )}
        </header>

        <div className="mt-12 space-y-8">
          {/* Dates */}
          {(memorial.birthday || memorial.placeOfDeath) && (
            <Card>
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                Details
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                {memorial.birthday && (
                  <div>
                    <dt className="font-medium text-warm-600">Born</dt>
                    <dd className="mt-0.5 text-warm-800">
                      {formatDate(memorial.birthday)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-warm-600">Passed away</dt>
                  <dd className="mt-0.5 text-warm-800">
                    {formatDate(memorial.dateOfDeath)}
                  </dd>
                </div>
                {memorial.placeOfDeath && (
                  <div>
                    <dt className="font-medium text-warm-600">
                      Place of death
                    </dt>
                    <dd className="mt-0.5 text-warm-800">
                      {memorial.placeOfDeath}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          {/* Funeral info */}
          {memorial.funeralInfo && (
            <Card>
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                Funeral Information
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
                Survived By
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
                Life Story
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
                Photos
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
                Eulogies
              </h2>
              <div className="mt-6 space-y-6">
                {memorial.eulogies.map((eulogy) => (
                  <Card key={eulogy.id}>
                    <blockquote className="border-l-4 border-gold-400 pl-4">
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
                Memories
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
              Share a Memory
            </h2>
            {session?.user ? (
              <Card className="mt-6">
                <MemorySubmissionForm memorialId={memorial.id} />
              </Card>
            ) : (
              <Card className="mt-6">
                <p className="text-sm text-warm-600">
                  Have a memory of {memorial.name} you&apos;d like to share?
                </p>
                <div className="mt-3">
                  <Button
                    href={`/auth/signin?callbackUrl=/memorial/${memorial.slug}`}
                    variant="secondary"
                    size="sm"
                  >
                    Sign in to share a memory
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
              &larr; Back to home
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
